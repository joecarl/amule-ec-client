/**
 * UpdateState - Client-side state for EC_OP_GET_UPDATE responses.
 *
 * EC_OP_GET_UPDATE with EC_DETAIL_INC_UPDATE is stateful and incremental on the daemon
 * side (per connection): the first response carries full state, subsequent responses only
 * carry the fields that changed since the previous request. Every live object is always
 * present (identified by its ECID as the tag's own value), so objects missing from a
 * response are gone and must be dropped.
 *
 * This class merges those diffs into full snapshots, reconstructs the XOR-diffed
 * part/gap/req status buffers, and links clients to the download they are a source of
 * (EC_TAG_CLIENT_REQUEST_FILE holds the partfile's ECID).
 */

import { ECTagName } from '../ec/Codes';
import { Packet } from '../ec/packet/Packet';
import type { AmuleFile, AmuleTransferringFile, AmuleUpDownClient } from '../model';
import { computeChunkInfo, extractPartFileStatusBuffers, rleDecode, sourceNameEntriesFromFileTag, xorReconstruct } from '../response/DownloadDetailsResponse';
import { UpdateResponseParser, type UpdateResponse } from '../response/UpdateResponse';
import { tagOwnNumericValue, toOptionalNumber } from '../response/utils';
import type { PartFileStatusBuffers, SourceNameCount } from '../types/download-details';

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

	apply(packet: Packet): UpdateResponse {
		const parsed = UpdateResponseParser.fromPacket(packet);

		// Chunk info and source names computed statelessly from an incremental packet are
		// wrong past the first response (XOR diffs / partial map entries); both are
		// reconstructed below from the accumulated state instead.
		for (const file of parsed.downloadQueue) {
			delete file.chunkInfo;
			delete file.sourceNames;
		}

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
	 * accumulated state), and apply the source-names map diffs (new entry / count change /
	 * removal when count is 0).
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
				if (!rawBuffer || rawBuffer.length === 0) {
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

			const entries = sourceNameEntriesFromFileTag(fileTag);
			if (entries) {
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

			const nameMap = this.sourceNames.get(ecid);
			if (nameMap) {
				file.sourceNames = [...nameMap.values()];
			}
		}
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
