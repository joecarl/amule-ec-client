/**
 * Preferences Response - Contains aMule preferences, including categories
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findTag, findNumericTag, NumericTag } from '../ec/tag/Tag';
import type { AmuleCategory } from '../model';

export class PreferencesResponse {
	constructor(public readonly categories: AmuleCategory[]) {}
}

export class PreferencesResponseParser {
	static fromPacket(packet: Packet): PreferencesResponse {
		const categories: AmuleCategory[] = [];

		const prefsCategoriesTag = findTag(packet.tags, ECTagName.EC_TAG_PREFS_CATEGORIES);

		if (prefsCategoriesTag && prefsCategoriesTag.nestedTags) {
			for (const categoryTag of prefsCategoriesTag.nestedTags) {
				if (categoryTag.name === ECTagName.EC_TAG_CATEGORY) {
					const nestedTags = categoryTag.nestedTags || [];

					const idTag = categoryTag;
					const nameTag = findTag(nestedTags, ECTagName.EC_TAG_CATEGORY_TITLE);
					const pathTag = findTag(nestedTags, ECTagName.EC_TAG_CATEGORY_PATH);
					const commentTag = findTag(nestedTags, ECTagName.EC_TAG_CATEGORY_COMMENT);
					const colorTag = findNumericTag(nestedTags, ECTagName.EC_TAG_CATEGORY_COLOR);
					const priorityTag = findNumericTag(nestedTags, ECTagName.EC_TAG_CATEGORY_PRIO);

					if (nameTag) {
						categories.push({
							id: idTag ? Number((idTag as unknown as NumericTag).getInt()) : 0,
							name: nameTag.getValue() || '',
							path: pathTag ? pathTag.getValue() : '',
							comment: commentTag ? commentTag.getValue() : '',
							color: colorTag ? Number((colorTag as unknown as NumericTag).getInt()) : 0,
							priority: priorityTag ? Number((priorityTag as unknown as NumericTag).getInt()) : 0,
						});
					}
				}
			}
		}

		return new PreferencesResponse(categories);
	}
}
