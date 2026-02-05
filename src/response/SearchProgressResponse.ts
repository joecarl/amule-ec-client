/**
 * Search Progress Response - Search status/progress
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag } from '../ec/tag/Tag';

export class SearchProgressResponse {
	constructor(public readonly progress: number) {}

	static fromPacket(packet: Packet): SearchProgressResponse {
		const progressTag = findNumericTag(packet.tags, ECTagName.EC_TAG_SEARCH_STATUS);
		const progress = progressTag ? Number(progressTag.getValue()) / 100.0 : 0;

		return new SearchProgressResponse(progress);
	}
}
