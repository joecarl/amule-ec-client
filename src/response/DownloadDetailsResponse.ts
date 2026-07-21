import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag, type Tag } from '../ec/tag/Tag';
import { ChunkStatus, PARTSIZE, type ChunkInfo, type PartFileStatusBuffers, type SourceNameEntry } from '../types/download-details';
import { tagOwnNumericValue } from './utils';

/**
 * Decode an aMule EC RLE-compressed buffer.
 * Format: [value, value, count] repeats value count times; other bytes pass through.
 */
export function rleDecode(buf: Buffer): Buffer {
	// First pass: compute the decoded size
	let size = 0;
	let index = 0;
	while (index < buf.length) {
		if (index < buf.length - 2 && buf[index + 1] === buf[index]) {
			size += buf[index + 2];
			index += 3;
		} else {
			size += 1;
			index += 1;
		}
	}

	// Second pass: decode
	const output = Buffer.alloc(size);
	let outIndex = 0;
	index = 0;
	while (index < buf.length) {
		if (index < buf.length - 2 && buf[index + 1] === buf[index]) {
			const count = buf[index + 2];
			output.fill(buf[index], outIndex, outIndex + count);
			outIndex += count;
			index += 3;
		} else {
			output[outIndex++] = buf[index];
			index += 1;
		}
	}

	return output;
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
	return tagOwnNumericValue(findTag(parent.nestedTags, tagName)) ?? 0;
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
 * Decode the status buffers of a file tag encoded after a daemon-side encoder reset,
 * i.e. a full snapshot: EC_OP_GET_DLOAD_QUEUE / EC_OP_GET_SHARED_FILES responses at any
 * detail level other than EC_DETAIL_UPDATE (see Get_EC_Response_GetDownloadQueue in
 * aMule's ExternalConn.cpp). After the reset, a present buffer holds the complete
 * current state and an absent one means the state is empty (the daemon skips the tag
 * when there is nothing to encode), so every key is always defined.
 */
export function decodeFullPartFileStatusBuffers(fileTag: Tag<any>): PartFileStatusBuffers {
	const raw = extractPartFileStatusBuffers(fileTag);
	return {
		partStatus: raw.partStatus ? rleDecode(raw.partStatus) : Buffer.alloc(0),
		gapStatus: raw.gapStatus ? rleDecode(raw.gapStatus) : Buffer.alloc(0),
		reqStatus: raw.reqStatus ? rleDecode(raw.reqStatus) : Buffer.alloc(0),
	};
}

/**
 * Raw diff entries of the source-names map of a partfile tag, or undefined when the
 * packet carries no source-names changes for this file.
 *
 * The daemon sends source names (the filenames under which the sources share the file)
 * as a per-connection incremental map (see CPartFile_Encoder::Encode in aMule's
 * ExternalConn.cpp): an EC_TAG_PARTFILE_SOURCE_NAMES container whose children are
 * integer-valued EC_TAG_PARTFILE_SOURCE_NAMES tags (the map key), each carrying a
 * nested count (0 removes the entry) and, only when the entry is new, a nested name
 * string. The map is never reset while the connection lives, not even for
 * EC_DETAIL_FULL requests.
 */
export function sourceNameEntriesFromFileTag(fileTag: Tag<any>): SourceNameEntry[] | undefined {
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

