/**
 * Search Results Response - Search results
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import type { SearchResultsResponse } from '../client/AmuleClient';

export class SearchResultsResponseParser {
	static fromPacket(packet: Packet): SearchResultsResponse {
		const files: SearchResultsResponse['files'] = [];

		// Find all search result tags
		const searchFileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_SEARCHFILE);

		for (const fileTag of searchFileTags) {
			const nestedTags = fileTag.nestedTags || [];

			// Extract file information
			const fileNameTag = findTag(nestedTags, ECTagName.EC_TAG_PARTFILE_NAME);
			const hashTag = findTag(nestedTags, ECTagName.EC_TAG_PARTFILE_HASH);
			const sizeTag = findNumericTag(nestedTags, ECTagName.EC_TAG_PARTFILE_SIZE_FULL);
			const sourceCountTag = findNumericTag(nestedTags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT);
			const completeSourcesTag = findNumericTag(nestedTags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_XFER);
			const downloadStatusTag = findNumericTag(nestedTags, ECTagName.EC_TAG_PARTFILE_STATUS);

			if (fileNameTag && hashTag) {
				files.push({
					fileName: fileNameTag.getValue(),
					hash: hashTag.getValue(),
					sizeFull: sizeTag ? Number(sizeTag.getLong()) : 0,
					downloadStatus: downloadStatusTag ? downloadStatusTag.getInt() : 0,
					completeSourceCount: completeSourcesTag ? completeSourcesTag.getInt() : 0,
					sourceCount: sourceCountTag ? sourceCountTag.getInt() : 0,
				});
			}
		}

		return { files };
	}
}
