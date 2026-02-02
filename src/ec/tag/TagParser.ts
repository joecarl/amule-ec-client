/**
 * Tag Parser - Deserializes tags from binary data
 *
 * This implementation follows jamule's TagParser logic closely.
 * Key insight: tagLength is calculated using FIXED header sizes (not UTF-8 sizes),
 * even when the wire format uses UTF-8 encoding. So we must track "theoreticalLength"
 * using fixed sizes to correctly calculate the value size.
 */

import { ECTagType, ECTagName } from '../Codes';
import { Tag, CustomTag, UByteTag, UShortTag, UIntTag, ULongTag, UInt128Tag, StringTag, DoubleTag, Ipv4Tag, Hash16Tag } from './Tag';
import { readUtf8Number } from '../Encoding';
import { InvalidECException } from '../../exceptions';

// Fixed header sizes (from jamule TypeSizes.kt)
const TAG_NAME_SIZE = 2; // UShort
const TAG_TYPE_SIZE = 1; // UByte
const TAG_LENGTH_SIZE = 4; // UInt
const SUBTAG_COUNT_SIZE = 2; // UShort

interface TagParseResult {
	tag: Tag<any>;
	theoreticalLength: number;
	endIndex: number;
}

export class TagParser {
	private buffer: Buffer;
	private offset: number;
	private readonly useUtf8Numbers: boolean;

	constructor(buffer: Buffer, offset: number = 0, useUtf8Numbers: boolean = false) {
		this.buffer = buffer;
		this.offset = offset;
		this.useUtf8Numbers = useUtf8Numbers;
	}

	/**
	 * Parse a single tag from the current position
	 */
	parseTag(): Tag<any> {
		return this.parseTagWithMetadata().tag;
	}

	/**
	 * Internal parse that returns metadata needed for nested tag calculation
	 */
	private parseTagWithMetadata(): TagParseResult {
		// First part is the tag name and the flag indicating if it has subtags
		const tagNameAndSubtags = this.readNumber(TAG_NAME_SIZE);
		const tagNameRaw = (tagNameAndSubtags >> 1) & 0xffff;
		const tagName = tagNameRaw as ECTagName;
		const hasSubtags = (tagNameAndSubtags & 1) !== 0;

		// Then is the tag type
		const tagType = this.buffer.readUInt8(this.offset) as ECTagType;
		this.offset += TAG_TYPE_SIZE;

		// Then is the tag length, indicating the tag's own content length + length of children (with headers)
		const tagLength = this.readNumber(TAG_LENGTH_SIZE);

		// The next byte is the first byte of the tag's value
		// This is mutable because it will be updated if the tag has subtags
		let valueStartIndex = this.offset;

		// If the tag has subtags, we need to parse them
		const subTags: Tag<any>[] = [];

		// Theoretical length is the length of the tag, including the length of the subtags (with headers)
		// All numbers are considered to be non-UTF-8 (fixed sizes)
		let theoreticalLength = 0;

		// The last byte of the tag's value
		let valueEndIndex: number;

		if (!hasSubtags) {
			valueEndIndex = valueStartIndex + tagLength - 1;
		} else {
			// The first part to read is the subtags count
			const subTagCount = this.readNumber(SUBTAG_COUNT_SIZE);

			// We reuse valueStartIndex to store the index after reading subtag count
			valueStartIndex = this.offset;

			for (let i = 0; i < subTagCount; i++) {
				const result = this.parseTagWithMetadata();
				subTags.push(result.tag);
				theoreticalLength += result.theoreticalLength;
			}

			if (subTags.length > subTagCount) {
				throw new InvalidECException(`Error parsing subtags list - Expected subtags ${subTagCount} found subtags ${subTags.length}`);
			}

			// Calculate value end using tagLength minus theoreticalLength (fixed sizes)
			valueEndIndex = this.offset + (tagLength - theoreticalLength - 1);
			theoreticalLength += SUBTAG_COUNT_SIZE;
		}

		// Read the tag value
		const valueSize = valueEndIndex - this.offset + 1;
		const tagValue = this.buffer.subarray(this.offset, this.offset + valueSize);
		this.offset += valueSize;

		// Update theoretical length with the value and header sizes
		theoreticalLength += tagValue.length;
		theoreticalLength += TAG_NAME_SIZE;
		theoreticalLength += TAG_TYPE_SIZE;
		theoreticalLength += TAG_LENGTH_SIZE;

		// Create the tag
		const tag = this.createTagFromValue(tagName, tagType, tagValue);
		if (subTags.length > 0) {
			tag.nestedTags = subTags;
		}

		return {
			tag,
			theoreticalLength,
			endIndex: this.offset - 1,
		};
	}

	/**
	 * Parse multiple tags
	 */
	parseTags(count: number): Tag<any>[] {
		const tags: Tag<any>[] = [];
		for (let i = 0; i < count; i++) {
			tags.push(this.parseTag());
		}
		return tags;
	}

	/**
	 * Read a number with the given fixed size.
	 * In UTF-8 mode, reads as UTF-8 codepoint. Otherwise reads as big-endian integer.
	 */
	private readNumber(fixedSize: number): number {
		if (this.useUtf8Numbers) {
			const result = readUtf8Number(this.buffer, this.offset);
			this.offset = result.newOffset;
			return Number(result.value);
		} else {
			let value: number;
			switch (fixedSize) {
				case 1:
					value = this.buffer.readUInt8(this.offset);
					break;
				case 2:
					value = this.buffer.readUInt16BE(this.offset);
					break;
				case 4:
					value = this.buffer.readUInt32BE(this.offset);
					break;
				default:
					throw new InvalidECException(`Unsupported number size: ${fixedSize}`);
			}
			this.offset += fixedSize;
			return value;
		}
	}

	/**
	 * Create a tag instance based on type and raw value bytes
	 */
	private createTagFromValue(name: ECTagName, type: ECTagType, value: Buffer): Tag<any> {
		switch (type) {
			case ECTagType.EC_TAGTYPE_CUSTOM:
				return new CustomTag(name, value);

			case ECTagType.EC_TAGTYPE_UINT8: {
				const numValue = value.length > 0 ? value.readUInt8(0) : 0;
				return new UByteTag(name, numValue);
			}

			case ECTagType.EC_TAGTYPE_UINT16: {
				const numValue = value.length >= 2 ? value.readUInt16BE(0) : 0;
				return new UShortTag(name, numValue);
			}

			case ECTagType.EC_TAGTYPE_UINT32: {
				const numValue = value.length >= 4 ? value.readUInt32BE(0) : 0;
				return new UIntTag(name, numValue);
			}

			case ECTagType.EC_TAGTYPE_UINT64: {
				const numValue = value.length >= 8 ? value.readBigUInt64BE(0) : 0n;
				return new ULongTag(name, numValue);
			}

			case ECTagType.EC_TAGTYPE_UINT128:
				return new UInt128Tag(name, value);

			case ECTagType.EC_TAGTYPE_STRING: {
				// Remove null terminator if present
				const strValue = value[value.length - 1] === 0x00 ? value.toString('utf-8', 0, value.length - 1) : value.toString('utf-8');
				return new StringTag(name, strValue);
			}

			case ECTagType.EC_TAGTYPE_DOUBLE: {
				// Double is stored as a null-terminated string representation
				const strValue = value[value.length - 1] === 0x00 ? value.toString('utf-8', 0, value.length - 1) : value.toString('utf-8');
				return new DoubleTag(name, parseFloat(strValue));
			}

			case ECTagType.EC_TAGTYPE_IPV4: {
				// Read 4 bytes for IP address, 2 bytes for port (BE)
				if (value.length !== 6) {
					throw new InvalidECException(`Ipv4Tag value must be 6 bytes long, got ${value.length}`);
				}
				const address = `${value[0]}.${value[1]}.${value[2]}.${value[3]}`;
				const port = value.readUInt16BE(4);
				const tag = new Ipv4Tag(name);
				tag['value'] = { address, port };
				return tag;
			}

			case ECTagType.EC_TAGTYPE_HASH16:
				return new Hash16Tag(name, value);

			case ECTagType.EC_TAGTYPE_UNKNOWN:
			default:
				throw new InvalidECException(`Unknown tag type: ${type} for tag ${name}`);
		}
	}

	/**
	 * Get current offset
	 */
	getOffset(): number {
		return this.offset;
	}
}
