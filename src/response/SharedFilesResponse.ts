/**
 * Shared Files Response - Parse shared files list
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import type { AmuleFile } from '../model';

export interface SharedFilesResponse {
	files: AmuleFile[];
}

// Helper to convert bigint to number safely
function toNumber(value: bigint | number | undefined, defaultValue: number = 0): number {
	if (value === undefined) return defaultValue;
	return typeof value === 'bigint' ? Number(value) : value;
}

export class SharedFilesResponseParser {
	static fromPacket(packet: Packet): SharedFilesResponse {
		const files: AmuleFile[] = [];

		// Find all knownfile tags
		const knownfileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_KNOWNFILE);

		for (const fileTag of knownfileTags) {
			const tags = fileTag.nestedTags || [];

			const hashTag = findTag(tags, ECTagName.EC_TAG_PARTFILE_HASH);
			const fileNameTag = findTag(tags, ECTagName.EC_TAG_PARTFILE_NAME);

			const file: AmuleFile = {
				fileHashHexString: hashTag ? hashTag.getValue().toString('hex') : undefined,
				fileName: fileNameTag ? fileNameTag.getValue() : undefined,
				filePath: findTag(tags, ECTagName.EC_TAG_KNOWNFILE_FILENAME)?.getValue(),
				sizeFull: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_FULL)?.getLong()),
				fileEd2kLink: findTag(tags, ECTagName.EC_TAG_PARTFILE_ED2K_LINK)?.getValue(),

				upPrio: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_PRIO)?.getInt() ?? 0,
				getRequests: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_REQ_COUNT)?.getShort() ?? 0,
				getAllRequests: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_REQ_COUNT_ALL)?.getInt() ?? 0,
				getAccepts: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ACCEPT_COUNT)?.getShort() ?? 0,
				getAllAccepts: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ACCEPT_COUNT_ALL)?.getInt() ?? 0,
				getXferred: toNumber(findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_XFERRED)?.getLong()),
				getAllXferred: toNumber(findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_XFERRED_ALL)?.getLong()),
				getCompleteSourcesLow: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES_LOW)?.getShort() ?? 0,
				getCompleteSourcesHigh: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES_HIGH)?.getShort() ?? 0,
				getCompleteSources: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES)?.getShort() ?? 0,
				getOnQueue: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ON_QUEUE)?.getShort() ?? 0,
				getComment: findTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMMENT)?.getValue(),
				getRating: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_RATING)?.getInt(),
			};

			files.push(file);
		}

		return { files };
	}
}
