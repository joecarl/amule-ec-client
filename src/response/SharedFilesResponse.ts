/**
 * Shared Files Response - Parse shared files list
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import type { AmuleFile } from '../model';
import { toOptionalNumber } from './utils';

export interface SharedFilesResponse {
	files: AmuleFile[];
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
				sizeFull: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_FULL)?.getLong()),
				fileEd2kLink: findTag(tags, ECTagName.EC_TAG_PARTFILE_ED2K_LINK)?.getValue(),

				upPrio: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_PRIO)?.getInt(),
				getRequests: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_REQ_COUNT)?.getShort(),
				getAllRequests: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_REQ_COUNT_ALL)?.getInt(),
				getAccepts: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ACCEPT_COUNT)?.getShort(),
				getAllAccepts: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ACCEPT_COUNT_ALL)?.getInt(),
				getXferred: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_XFERRED)?.getLong()),
				getAllXferred: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_XFERRED_ALL)?.getLong()),
				getCompleteSourcesLow: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES_LOW)?.getShort(),
				getCompleteSourcesHigh: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES_HIGH)?.getShort(),
				getCompleteSources: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES)?.getShort(),
				getOnQueue: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ON_QUEUE)?.getShort(),
				getComment: findTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMMENT)?.getValue(),
				getRating: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_RATING)?.getInt(),
			};

			files.push(file);
		}

		return { files };
	}
}
