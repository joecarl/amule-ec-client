/**
 * Search Request - Start a search
 *
 * In the EC protocol, search is structured as:
 * - EC_TAG_SEARCH_TYPE (UByte) containing subtag:
 *   - EC_TAG_SEARCH_NAME (String) with the search query
 * - Uses non-UTF8 flags (Flags.noUtf8())
 */

import { Request } from './Request';
import { Packet } from '../ec/packet/Packet';
import { Flags } from '../ec/packet/Flags';
import { ECOpCode, ECTagName, ECSearchType } from '../ec/Codes';
import { StringTag, UByteTag, UIntTag, ULongTag } from '../ec/tag/Tag';
import { SearchType } from '../model';
import type { SearchFilters } from '../types';

export class SearchRequest extends Request {
	private readonly query: string;
	private readonly searchType: SearchType;
	private readonly filters?: SearchFilters;

	constructor(query: string, searchType: SearchType = SearchType.LOCAL, filters?: SearchFilters) {
		super(ECOpCode.EC_OP_SEARCH_START);
		this.query = query;
		this.searchType = searchType;
		this.filters = filters;
	}

	/**
	 * Override buildPacket to use non-UTF8 flags and correct tag structure
	 */
	buildPacket(): Packet {
		const flags = Flags.noUtf8();
		const tags = this.buildTags();
		return new Packet(this.opCode, flags, tags);
	}

	private buildTags(): any[] {
		const tags: any[] = [];

		// EC_TAG_SEARCH_TYPE with EC_TAG_SEARCH_NAME as subtag
		const ecSearchType = this.convertSearchType(this.searchType);
		const searchNameTag = new StringTag(ECTagName.EC_TAG_SEARCH_NAME, this.query);
		const searchTypeTag = new UByteTag(ECTagName.EC_TAG_SEARCH_TYPE, ecSearchType, [searchNameTag]);
		tags.push(searchTypeTag);

		// Add filters if provided
		if (this.filters) {
			if (this.filters.minSize !== undefined) {
				tags.push(new ULongTag(ECTagName.EC_TAG_SEARCH_MIN_SIZE, BigInt(this.filters.minSize)));
			}
			if (this.filters.maxSize !== undefined) {
				tags.push(new ULongTag(ECTagName.EC_TAG_SEARCH_MAX_SIZE, BigInt(this.filters.maxSize)));
			}
			if (this.filters.fileType !== undefined) {
				tags.push(new StringTag(ECTagName.EC_TAG_SEARCH_FILE_TYPE, this.filters.fileType));
			}
			if (this.filters.extension !== undefined) {
				tags.push(new StringTag(ECTagName.EC_TAG_SEARCH_EXTENSION, this.filters.extension));
			}
			if (this.filters.availability !== undefined) {
				tags.push(new UIntTag(ECTagName.EC_TAG_SEARCH_AVAILABILITY, this.filters.availability));
			}
		}

		return tags;
	}

	private convertSearchType(searchType: SearchType): ECSearchType {
		switch (searchType) {
			case SearchType.LOCAL:
				return ECSearchType.EC_SEARCH_LOCAL;
			case SearchType.GLOBAL:
				return ECSearchType.EC_SEARCH_GLOBAL;
			case SearchType.KAD:
				return ECSearchType.EC_SEARCH_KAD;
			case SearchType.WEB:
				return ECSearchType.EC_SEARCH_WEB;
		}
	}
}
