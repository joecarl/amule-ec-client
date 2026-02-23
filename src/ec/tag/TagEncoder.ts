/**
 * Tag Encoder - Serializes tags to binary data
 */

import { ECTagType } from '../Codes';
import type { Tag } from './Tag';
import { encodeUtf8Number, numberLength } from '../Encoding';

export class TagEncoder {
	private readonly useUtf8Numbers: boolean;

	constructor(useUtf8Numbers: boolean = false) {
		this.useUtf8Numbers = useUtf8Numbers;
	}

	/**
	 * Calculate total size needed for a tag (Physical Buffer Size)
	 */
	calculateTagSize(tag: Tag<any>): number {
		let size = 0;

		// Tag name (with subtags bit)
		if (this.useUtf8Numbers) {
			const hasSubtags = (tag.nestedTags?.length ?? 0) > 0 ? 1 : 0;
			const nameAndSubtags = ((tag.name & 0xffff) << 1) | hasSubtags;
			size += numberLength(nameAndSubtags);
		} else {
			size += 2; // name (uint16)
		}

		// Type is always a single byte
		size += 1; // type (uint8)

		// Tag length (subtags + value)
		// CRITICAL: The length field itself reports "Logical Length" (using fixed header sizes),
		// NOT the physical byte length. This matches Jamule/aMule protocol expectation.
		// However, the SIZE of the length field depends on the encoded value of this logical length.
		const reportedLength = this.calculateReportedLength(tag);
		if (this.useUtf8Numbers) {
			size += numberLength(reportedLength);
		} else {
			size += 4; // uint32
		}

		// Nested tags count (only if has subtags)
		const hasSubtags = (tag.nestedTags?.length ?? 0) > 0;
		if (hasSubtags) {
			const nestedCount = tag.nestedTags?.length ?? 0;
			if (this.useUtf8Numbers) {
				size += numberLength(nestedCount);
			} else {
				// In non-UTF8 mode, nested count is UInt16 (not UInt32)
				size += 2; // uint16
			}
		}

		// Nested tags
		if (tag.nestedTags) {
			for (const nestedTag of tag.nestedTags) {
				size += this.calculateTagSize(nestedTag);
			}
		}

		// Tag value size
		size += this.calculateValueSize(tag);

		return size;
	}

	/**
	 * Calculate the "Reported Length" of the tag content.
	 * This logic mimics Jamule's computeTagLength, which assumes FIXED header sizes
	 * (2 bytes name, 1 byte type, 4 bytes length, 2 bytes subtag count)
	 * even when UTF-8 encoding is used.
	 */
	private calculateReportedLength(tag: Tag<any>): number {
		let length = 0;

		// Subtags
		if (tag.nestedTags) {
			for (const nestedTag of tag.nestedTags) {
				// Reported length of subtag content
				length += this.calculateReportedLength(nestedTag);

				// Add Fixed Header Overhead
				// TAG_NAME_SIZE (2) + TAG_TYPE_SIZE (1) + TAG_LENGTH_SIZE (4)
				length += 7;

				if ((nestedTag.nestedTags?.length ?? 0) > 0) {
					// SUBTAG_COUNT_SIZE (2)
					length += 2;
				}
			}
		}

		// Value of this tag
		length += this.calculateValueSize(tag);

		return length;
	}

	/**
	 * Calculate size of tag value
	 */
	private calculateValueSize(tag: Tag<any>): number {
		const encoded = tag.encodeValue();

		switch (tag.type) {
			case ECTagType.EC_TAGTYPE_CUSTOM:
				// Empty custom tags (capability flags) have no data
				if (encoded.length === 0) {
					return 0;
				}
				// Custom tags with data have no length prefix
				return encoded.length;

			case ECTagType.EC_TAGTYPE_STRING:
				// String value is just the UTF-8 string + null terminator
				// No length prefix
				return encoded.length;

			case ECTagType.EC_TAGTYPE_UINT8:
				return 1;

			case ECTagType.EC_TAGTYPE_UINT16:
				return 2;

			case ECTagType.EC_TAGTYPE_UINT32:
				return 4;

			case ECTagType.EC_TAGTYPE_UINT64:
				return 8;

			case ECTagType.EC_TAGTYPE_UINT128:
				return 16;

			case ECTagType.EC_TAGTYPE_DOUBLE:
				return 8;

			case ECTagType.EC_TAGTYPE_IPV4:
				return 6; // 4 bytes IP + 2 bytes port

			case ECTagType.EC_TAGTYPE_HASH16:
				return 16;

			default:
				return 0;
		}
	}

	/**
	 * Encode a tag to a buffer
	 */
	encodeTag(tag: Tag<any>, buffer: Buffer, offset: number): number {
		let currentOffset = offset;

		// Write tag name with subtags bit
		const hasSubtags = (tag.nestedTags?.length ?? 0) > 0 ? 1 : 0;
		const nameAndSubtags = ((tag.name & 0xffff) << 1) | hasSubtags;

		if (this.useUtf8Numbers) {
			const encoded = encodeUtf8Number(nameAndSubtags);
			encoded.copy(buffer, currentOffset);
			currentOffset += encoded.length;
		} else {
			// In non-UTF8 mode, also encode name with subtags bit
			buffer.writeUInt16BE(nameAndSubtags, currentOffset);
			currentOffset += 2;
		}

		// Write type (always a single byte)
		buffer.writeUInt8(tag.type, currentOffset);
		currentOffset += 1;

		// Write tag length (subtags + value)
		// Use Reported Length (Logical) for the Value
		const tagLength = this.calculateReportedLength(tag);
		if (this.useUtf8Numbers) {
			const encoded = encodeUtf8Number(tagLength);
			encoded.copy(buffer, currentOffset);
			currentOffset += encoded.length;
		} else {
			buffer.writeUInt32BE(tagLength, currentOffset);
			currentOffset += 4;
		}

		// Write nested tags count if has subtags
		const nestedCount = tag.nestedTags?.length ?? 0;
		if (hasSubtags) {
			if (this.useUtf8Numbers) {
				const encoded = encodeUtf8Number(nestedCount);
				encoded.copy(buffer, currentOffset);
				currentOffset += encoded.length;
			} else {
				// In non-UTF8 mode, nested count is UInt16 (not UInt32)
				buffer.writeUInt16BE(nestedCount, currentOffset);
				currentOffset += 2;
			}
		}

		// Write nested tags
		if (tag.nestedTags) {
			for (const nestedTag of tag.nestedTags) {
				currentOffset = this.encodeTag(nestedTag, buffer, currentOffset);
			}
		}

		// Write tag value (AFTER subtags)
		currentOffset = this.encodeValue(tag, buffer, currentOffset);

		return currentOffset;
	}

	/**
	 * Encode tag value to buffer
	 */
	private encodeValue(tag: Tag<any>, buffer: Buffer, offset: number): number {
		const encoded = tag.encodeValue();

		switch (tag.type) {
			case ECTagType.EC_TAGTYPE_CUSTOM:
				// For empty custom tags (like capability flags), don't write any data
				if (encoded.length > 0) {
					// Custom tags with data have no additional length prefix
					// The tagLength header already specifies the size
					encoded.copy(buffer, offset);
					return offset + encoded.length;
				}
				return offset; // Empty custom tag, no data to write

			case ECTagType.EC_TAGTYPE_UINT8:
			case ECTagType.EC_TAGTYPE_UINT16:
			case ECTagType.EC_TAGTYPE_UINT32:
			case ECTagType.EC_TAGTYPE_UINT64:
			case ECTagType.EC_TAGTYPE_STRING:
			case ECTagType.EC_TAGTYPE_DOUBLE:
			case ECTagType.EC_TAGTYPE_IPV4:
			case ECTagType.EC_TAGTYPE_HASH16:
			case ECTagType.EC_TAGTYPE_UINT128:
				encoded.copy(buffer, offset);
				return offset + encoded.length;

			default:
				return offset;
		}
	}

	/**
	 * Encode multiple tags
	 */
	encodeTags(tags: Tag<any>[]): Buffer {
		// Calculate total size
		let totalSize = 0;
		for (const tag of tags) {
			totalSize += this.calculateTagSize(tag);
		}

		// Allocate buffer and encode
		const buffer = Buffer.allocUnsafe(totalSize);
		let offset = 0;
		for (const tag of tags) {
			offset = this.encodeTag(tag, buffer, offset);
		}

		return buffer;
	}
}
