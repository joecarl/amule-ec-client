import { ECTagName } from '../ec/Codes';
import { Packet } from '../ec/packet/Packet';
import { findNumericTag, findTag, type Tag } from '../ec/tag/Tag';
import { ChunkStatus, PARTSIZE, type ChunkInfo, type PartFileStatusBuffers, type SourceNameCount, type SourceNameEntry } from '../types/download-details';
import { tagOwnNumericValue } from './utils';

/**
 * Decode an aMule EC RLE-compressed buffer.
 * Format: [value, value, count] repeats value count times; other bytes pass through.
 */
export function rleDecode(buf: Buffer): Buffer {
	const output: number[] = [];
	let index = 0;

	while (index < buf.length) {
		if (index < buf.length - 2 && buf[index + 1] === buf[index]) {
			const value = buf[index];
			const count = buf[index + 2];
			for (let i = 0; i < count; i++) {
				output.push(value);
			}
			index += 3;
		} else {
			output.push(buf[index]);
			index += 1;
		}
	}

	return Buffer.from(output);
}

/**
 * Reconstruct the current state from the previous state and an RLE-decoded XOR diff,
 * mirroring aMule's RLE_Data: resize previous buffer to the diff size (zero-extend on
 * grow, truncate on shrink), then XOR byte-wise.
 */
export function xorReconstruct(previous: Buffer, decodedDiff: Buffer): Buffer {
	const result = Buffer.alloc(decodedDiff.length, 0);
	previous.copy(result, 0, 0, Math.min(previous.length, decodedDiff.length));
	for (let i = 0; i < decodedDiff.length; i++) {
		result[i] ^= decodedDiff[i];
	}
	return result;
}

/**
 * Decode an RLE-decoded buffer of byte-interleaved (column-major) little-endian uint64 values.
 */
function decodeInterleavedUint64(decoded: Buffer): number[] {
	if (decoded.length === 0 || decoded.length % 8 !== 0) {
		return [];
	}

	const valueCount = decoded.length / 8;
	const values = new Array<number>(valueCount);
	for (let i = 0; i < valueCount; i++) {
		let value = 0;
		for (let byte = 7; byte >= 0; byte--) {
			value = value * 256 + decoded[i + byte * valueCount];
		}
		values[i] = value;
	}
	return values;
}

function stringValue(tag: Tag<any> | undefined): string {
	if (!tag) {
		return '';
	}
	const value = tag.getValue();
	return typeof value === 'string' ? value : '';
}

function bufferValue(tag: Tag<any> | undefined): Buffer | undefined {
	if (!tag) {
		return undefined;
	}
	const value = tag.getValue();
	return Buffer.isBuffer(value) ? value : undefined;
}

function nestedTag(parent: Tag<any>, tagName: ECTagName): Tag<any> | undefined {
	return parent.nestedTags ? findTag(parent.nestedTags, tagName) : undefined;
}

function nestedNumeric(parent: Tag<any>, tagName: ECTagName): number {
	if (!parent.nestedTags) {
		return 0;
	}
	const numeric = findNumericTag(parent.nestedTags, tagName);
	if (numeric) {
		return Number(numeric.getValue());
	}
	const tag = findTag(parent.nestedTags, tagName);
	if (!tag) return 0;

	const value = tag.getValue();
	if (typeof value === 'number') return value;
	if (typeof value === 'bigint') return Number(value);

	return 0;
}

/**
 * Extract the raw (RLE-encoded) part/gap/req status buffers of a partfile tag.
 */
export function extractPartFileStatusBuffers(fileTag: Tag<any>): PartFileStatusBuffers {
	return {
		partStatus: bufferValue(nestedTag(fileTag, ECTagName.EC_TAG_PARTFILE_PART_STATUS)),
		gapStatus: bufferValue(nestedTag(fileTag, ECTagName.EC_TAG_PARTFILE_GAP_STATUS)),
		reqStatus: bufferValue(nestedTag(fileTag, ECTagName.EC_TAG_PARTFILE_REQ_STATUS)),
	};
}

/**
 * Compute per-chunk status from RLE-decoded part/gap/req status buffers.
 */
export function computeChunkInfo(sizeFull: number, buffers: PartFileStatusBuffers): ChunkInfo {
	const partCount = sizeFull > 0 ? Math.ceil(sizeFull / PARTSIZE) : 0;

	const availability = new Array<number>(partCount).fill(0);
	if (buffers.partStatus && buffers.partStatus.length > 0) {
		for (let i = 0; i < Math.min(buffers.partStatus.length, partCount); i++) {
			availability[i] = buffers.partStatus[i];
		}
	}

	const chunks = new Array<number>(partCount).fill(ChunkStatus.COMPLETE);
	if (partCount > 0 && buffers.gapStatus && buffers.gapStatus.length > 0) {
		const gapValues = decodeInterleavedUint64(buffers.gapStatus);
		for (let i = 0; i + 1 < gapValues.length; i += 2) {
			const gapStart = gapValues[i];
			const gapEnd = gapValues[i + 1];
			if (gapStart > sizeFull || gapEnd > sizeFull || gapStart >= gapEnd) {
				continue;
			}

			const startPart = Math.floor(gapStart / PARTSIZE);
			const endPart = Math.min(Math.floor(gapEnd / PARTSIZE) + 1, partCount);
			for (let part = startPart; part < endPart; part++) {
				const chunkStart = part * PARTSIZE;
				const chunkEnd = Math.min((part + 1) * PARTSIZE, sizeFull);
				if (gapStart < chunkEnd && gapEnd > chunkStart) {
					chunks[part] = availability[part] > 0 ? ChunkStatus.AVAILABLE : ChunkStatus.UNAVAILABLE;
				}
			}
		}
	}

	if (partCount > 0 && buffers.reqStatus && buffers.reqStatus.length > 0) {
		const reqValues = decodeInterleavedUint64(buffers.reqStatus);
		for (let i = 0; i + 1 < reqValues.length; i += 2) {
			const reqStart = reqValues[i];
			const reqEnd = reqValues[i + 1];
			if (reqStart > sizeFull || reqEnd > sizeFull || reqStart >= reqEnd) {
				continue;
			}

			const startPart = Math.floor(reqStart / PARTSIZE);
			const endPart = Math.min(Math.floor(reqEnd / PARTSIZE) + 1, partCount);
			for (let part = startPart; part < endPart; part++) {
				if (chunks[part] === ChunkStatus.COMPLETE) {
					continue;
				}
				const chunkStart = part * PARTSIZE;
				const chunkEnd = Math.min((part + 1) * PARTSIZE, sizeFull);
				if (reqStart < chunkEnd && reqEnd > chunkStart) {
					chunks[part] = ChunkStatus.DOWNLOADING;
				}
			}
		}
	}

	return { chunks, availability, partCount, sizeFull };
}

/**
 * Chunk details from a full (non-incremental) download queue packet, keyed by file hash.
 * Only valid for EC_OP_GET_DLOAD_QUEUE responses: incremental updates (EC_OP_GET_UPDATE)
 * send XOR diffs for the status buffers and must be reconstructed statefully instead.
 */
export class DownloadChunkDetailsResponseParser {
	static fromPacket(packet: Packet): Record<string, ChunkInfo> {
		const result: Record<string, ChunkInfo> = {};
		const partfileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_PARTFILE);

		for (const fileTag of partfileTags) {
			const hash = bufferValue(nestedTag(fileTag, ECTagName.EC_TAG_PARTFILE_HASH));
			if (!hash) {
				continue;
			}

			const sizeFull = nestedNumeric(fileTag, ECTagName.EC_TAG_PARTFILE_SIZE_FULL);
			const raw = extractPartFileStatusBuffers(fileTag);
			const decoded: PartFileStatusBuffers = {
				partStatus: raw.partStatus ? rleDecode(raw.partStatus) : undefined,
				gapStatus: raw.gapStatus ? rleDecode(raw.gapStatus) : undefined,
				reqStatus: raw.reqStatus ? rleDecode(raw.reqStatus) : undefined,
			};

			result[hash.toString('hex')] = computeChunkInfo(sizeFull, decoded);
		}

		return result;
	}
}

/**
 * Source names of a partfile: the filenames under which the sources share the file.
 *
 * The daemon sends them as a per-connection incremental map (see CPartFile_Encoder::Encode
 * in aMule's ExternalConn.cpp): an EC_TAG_PARTFILE_SOURCE_NAMES container whose children
 * are integer-valued EC_TAG_PARTFILE_SOURCE_NAMES tags (the map key), each carrying a
 * nested count (0 removes the entry) and, only when the entry is new, a nested name string.
 * The map is never reset while the connection lives, not even for EC_DETAIL_FULL requests.
 */
export class DownloadSourceNamesResponseParser {
	/**
	 * Raw diff entries of the source-names map of a partfile tag, or undefined when the
	 * packet carries no source-names changes for this file.
	 */
	static entriesFromFileTag(fileTag: Tag<any>): SourceNameEntry[] | undefined {
		const container = nestedTag(fileTag, ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES);
		if (!container) {
			return undefined;
		}

		const entries: SourceNameEntry[] = [];
		for (const child of container.nestedTags || []) {
			if (child.name !== ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES) {
				continue;
			}
			const id = tagOwnNumericValue(child);
			if (id === undefined) {
				continue;
			}
			const name = stringValue(nestedTag(child, ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES)) || undefined;
			const count = nestedNumeric(child, ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS);
			entries.push({ id, name, count });
		}
		return entries;
	}

	/**
	 * Stateless view keyed by file hash: only entries whose name is present in this very
	 * packet (i.e. new for the connection). Complete on the first request of a connection;
	 * later requests only carry changes, so prefer the stateful update path for polling.
	 */
	static fromPacket(packet: Packet): Record<string, SourceNameCount[]> {
		const result: Record<string, SourceNameCount[]> = {};
		const partfileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_PARTFILE);

		for (const fileTag of partfileTags) {
			const hash = bufferValue(nestedTag(fileTag, ECTagName.EC_TAG_PARTFILE_HASH));
			if (!hash) {
				continue;
			}

			const entries = this.entriesFromFileTag(fileTag);
			if (!entries) {
				continue;
			}

			result[hash.toString('hex')] = entries.filter((entry) => entry.name !== undefined && entry.count > 0).map((entry) => ({ name: entry.name!, count: entry.count }));
		}

		return result;
	}
}
