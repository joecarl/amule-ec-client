/**
 * UpdateState - Client-side per-connection file-detail state.
 *
 * The daemon keeps ONE diff-encoder per file and per connection (CFileEncoderMap in
 * aMule's ExternalConn.cpp), shared by EC_OP_GET_UPDATE, EC_OP_GET_DLOAD_QUEUE and
 * EC_OP_GET_SHARED_FILES. The part/gap/req status buffers are RLE-encoded XOR diffs
 * against "whatever was last encoded over this connection by any of those ops":
 *
 * - EC_OP_GET_UPDATE (EC_DETAIL_INC_UPDATE) encodes without reset: buffers are XOR
 *   diffs, a present zero-length buffer means "state is now empty", an absent one
 *   means "unchanged". Scalar fields are also incremental: the first response carries
 *   full state, later ones only what changed. Every live object is always present
 *   (identified by its ECID as the tag's own value), so objects missing from a
 *   response are gone and must be dropped.
 * - EC_OP_GET_DLOAD_QUEUE / EC_OP_GET_SHARED_FILES at any other detail level reset
 *   the encoders before encoding (ResetEncoder + Encode): their buffers are full
 *   snapshots, BUT they still advance the connection's diff baseline, so they must
 *   be applied to this state or the next incremental update decodes into garbage.
 * - The source-names map is incremental per connection for every op and is never
 *   reset, not even by ResetEncoder (see CPartFile_Encoder::Encode).
 *
 * This class mirrors that shared daemon state: it merges incremental diffs into full
 * snapshots, rebases the buffers on full responses, and links clients to the download
 * they are a source of (EC_TAG_CLIENT_REQUEST_FILE holds the partfile's ECID).
 */

import { ECTagName } from '../ec/Codes';
import { Packet } from '../ec/packet/Packet';
import type { AmuleFile, AmuleTransferringFile, AmuleUpDownClient } from '../model';
import { computeChunkInfo, decodeFullPartFileStatusBuffers, extractPartFileStatusBuffers, rleDecode, sourceNameEntriesFromFileTag, xorReconstruct } from '../response/DownloadDetailsResponse';
import { DownloadQueueResponseParser } from '../response/DownloadQueueResponse';
import { UpdateResponseParser, type UpdateResponse } from '../response/UpdateResponse';
import { tagOwnNumericValue, toOptionalNumber } from '../response/utils';
import type { PartFileStatusBuffers, SourceNameCount, SourceNameEntry } from '../types/download-details';

const STATUS_BUFFER_KEYS = ['partStatus', 'gapStatus', 'reqStatus'] as const;

/**
 * Merge update fields into the existing object. Fields absent from an incremental
 * response are undefined after parsing and must not clobber previously known values.
 */
function mergeDefined<T extends object>(existing: T, updates: T): T {
	const result = { ...existing };
	for (const [key, value] of Object.entries(updates)) {
		if (value !== undefined) {
			(result as Record<string, unknown>)[key] = value;
		}
	}
	return result;
}

export class UpdateState {
	private downloads = new Map<number, AmuleTransferringFile>();
	private sharedFiles = new Map<number, AmuleFile>();
	private clients = new Map<number, AmuleUpDownClient>();
	private statusBuffers = new Map<number, PartFileStatusBuffers>();
	private sourceNames = new Map<number, Map<number, SourceNameCount>>();

	/**
	 * @param sessionGeneration Connection generation this state belongs to (see
	 * AmuleConnection.getSessionGeneration). The state is only valid while the
	 * connection that produced it is alive, since the daemon diffs per connection.
	 */
	constructor(public readonly sessionGeneration: number) {}

	/**
	 * Apply an incremental EC_OP_GET_UPDATE response.
	 */
	apply(packet: Packet): UpdateResponse {
		const parsed = UpdateResponseParser.fromPacket(packet);

		const downloadQueue = this.mergeCollection(this.downloads, parsed.downloadQueue);
		const sharedFiles = this.mergeCollection(this.sharedFiles, parsed.sharedFiles);
		const clients = this.mergeCollection(this.clients, parsed.clients);

		for (const ecid of [...this.statusBuffers.keys()]) {
			if (!this.downloads.has(ecid)) {
				this.statusBuffers.delete(ecid);
			}
		}
		for (const ecid of [...this.sourceNames.keys()]) {
			if (!this.downloads.has(ecid)) {
				this.sourceNames.delete(ecid);
			}
		}

		this.reconstructFileDetails(packet);
		this.attachSources();

		return {
			downloadQueue,
			sharedFiles,
			clients,
			servers: parsed.servers,
			friends: parsed.friends,
		};
	}

	/**
	 * Apply a full (non-EC_DETAIL_UPDATE) EC_OP_GET_DLOAD_QUEUE response.
	 *
	 * The daemon resets each file's diff encoder before encoding it, so the buffers
	 * are complete snapshots that become the connection's new diff baseline; they are
	 * stored here as-is (replace, not XOR) to keep later incremental updates decodable.
	 * Source-name diffs are applied to the shared per-connection map.
	 */
	applyDownloadQueue(packet: Packet): AmuleTransferringFile[] {
		const parsed = DownloadQueueResponseParser.fromPacket(packet);
		const partfileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_PARTFILE);

		const seen = new Set<number>();
		for (const fileTag of partfileTags) {
			const ecid = tagOwnNumericValue(fileTag);
			if (ecid === undefined) {
				continue;
			}
			seen.add(ecid);
			this.statusBuffers.set(ecid, decodeFullPartFileStatusBuffers(fileTag));
			this.applySourceNameEntries(ecid, sourceNameEntriesFromFileTag(fileTag));
		}

		// The response is a full snapshot of the queue: state of vanished files is dead.
		// (Entries recorded from shared-files responses go too; they are re-established
		// by the next shared-files response, which is also always a full snapshot.)
		for (const ecid of [...this.statusBuffers.keys()]) {
			if (!seen.has(ecid)) {
				this.statusBuffers.delete(ecid);
			}
		}
		for (const ecid of [...this.sourceNames.keys()]) {
			if (!seen.has(ecid)) {
				this.sourceNames.delete(ecid);
			}
		}

		for (const file of parsed.files) {
			if (file.ecid === undefined) {
				continue;
			}
			const buffers = this.statusBuffers.get(file.ecid);
			if (buffers && file.sizeFull && file.sizeFull > 0) {
				file.chunkInfo = computeChunkInfo(file.sizeFull, buffers);
			}
			const nameMap = this.sourceNames.get(file.ecid);
			if (nameMap) {
				file.sourceNames = [...nameMap.values()];
			}
		}

		return parsed.files;
	}

	/**
	 * Track the encoder side effects of a full (non-EC_DETAIL_UPDATE)
	 * EC_OP_GET_SHARED_FILES response.
	 *
	 * Shared partfiles use the same per-connection encoder as the download paths: the
	 * daemon resets it and re-encodes part/gap/req status (and consumes source-name
	 * diffs) into each EC_TAG_KNOWNFILE tag, so the new baselines must be recorded here
	 * or the next incremental update decodes into garbage.
	 */
	applySharedFiles(packet: Packet): void {
		const knownfileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_KNOWNFILE);

		for (const fileTag of knownfileTags) {
			const ecid = tagOwnNumericValue(fileTag);
			if (ecid === undefined) {
				continue;
			}
			this.statusBuffers.set(ecid, decodeFullPartFileStatusBuffers(fileTag));
			this.applySourceNameEntries(ecid, sourceNameEntriesFromFileTag(fileTag));
		}
	}

	private mergeCollection<T extends { ecid?: number }>(state: Map<number, T>, items: T[]): T[] {
		const seen = new Set<number>();
		const result: T[] = [];

		for (const item of items) {
			if (item.ecid === undefined) {
				// Cannot be tracked across updates; pass through as-is
				result.push(item);
				continue;
			}
			seen.add(item.ecid);
			const existing = state.get(item.ecid);
			const merged = existing ? mergeDefined(existing, item) : item;
			state.set(item.ecid, merged);
			result.push(merged);
		}

		// Objects absent from the response no longer exist on the daemon
		for (const ecid of [...state.keys()]) {
			if (!seen.has(ecid)) {
				state.delete(ecid);
			}
		}

		return result;
	}

	/**
	 * Reconstruct the incremental per-file details of each partfile in the packet:
	 * RLE-decode and XOR-reconstruct the status buffers (recomputing chunk info from the
	 * accumulated state), and apply the source-names map diffs.
	 */
	private reconstructFileDetails(packet: Packet): void {
		const partfileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_PARTFILE);

		for (const fileTag of partfileTags) {
			const ecid = tagOwnNumericValue(fileTag);
			if (ecid === undefined) {
				continue;
			}
			const file = this.downloads.get(ecid);
			if (!file) {
				continue;
			}

			const raw = extractPartFileStatusBuffers(fileTag);
			const state = this.statusBuffers.get(ecid) || {};

			for (const key of STATUS_BUFFER_KEYS) {
				const rawBuffer = raw[key];
				if (!rawBuffer) {
					// Tag absent: state unchanged. A present zero-length tag instead
					// means the state is now empty (mirroring RLE_Data::Decode) and
					// flows through: decoding it yields an empty buffer.
					continue;
				}
				const decoded = rleDecode(rawBuffer);
				const previous = state[key];
				state[key] = previous ? xorReconstruct(previous, decoded) : decoded;
			}

			this.statusBuffers.set(ecid, state);

			if (file.sizeFull && file.sizeFull > 0) {
				file.chunkInfo = computeChunkInfo(file.sizeFull, state);
			}

			this.applySourceNameEntries(ecid, sourceNameEntriesFromFileTag(fileTag));

			const nameMap = this.sourceNames.get(ecid);
			if (nameMap) {
				file.sourceNames = [...nameMap.values()];
			}
		}
	}

	/**
	 * Apply source-names map diffs: new entry (carries the name), count change
	 * (no name resent) or removal (count 0).
	 */
	private applySourceNameEntries(ecid: number, entries: SourceNameEntry[] | undefined): void {
		if (!entries) {
			return;
		}
		const nameMap = this.sourceNames.get(ecid) || new Map<number, SourceNameCount>();
		for (const entry of entries) {
			if (entry.count === 0) {
				nameMap.delete(entry.id);
				continue;
			}
			const existing = nameMap.get(entry.id);
			if (existing) {
				existing.count = entry.count;
				if (entry.name !== undefined) {
					existing.name = entry.name;
				}
			} else if (entry.name !== undefined) {
				nameMap.set(entry.id, { name: entry.name, count: entry.count });
			}
		}
		this.sourceNames.set(ecid, nameMap);
	}

	/**
	 * Group clients by the download they are requesting (client.requestFileId -> file.ecid).
	 */
	private attachSources(): void {
		for (const file of this.downloads.values()) {
			file.sources = [];
		}

		for (const client of this.clients.values()) {
			const requestFileId = toOptionalNumber(client.requestFileId);
			if (requestFileId === undefined) {
				continue;
			}
			const file = this.downloads.get(requestFileId);
			if (file) {
				file.sources!.push(client);
			}
		}
	}
}
