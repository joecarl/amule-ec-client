// Utility functions for encoding/decoding numbers and buffers

/**
 * Reads a UTF-8 encoded number from a buffer
 * Treats UTF-8 bytes as a Unicode code point and returns the numeric value
 */
export function readUtf8Number(buffer: Buffer, offset: number): { value: bigint; newOffset: number } {
	// Determine the length of the UTF-8 sequence from the first byte
	const firstByte = buffer[offset];
	let length: number;

	if ((firstByte & 0x80) === 0) {
		// 0xxxxxxx - 1 byte (ASCII)
		length = 1;
	} else if ((firstByte & 0xe0) === 0xc0) {
		// 110xxxxx - 2 bytes
		length = 2;
	} else if ((firstByte & 0xf0) === 0xe0) {
		// 1110xxxx - 3 bytes
		length = 3;
	} else if ((firstByte & 0xf8) === 0xf0) {
		// 11110xxx - 4 bytes
		length = 4;
	} else {
		throw new Error(`Invalid UTF-8 first byte: 0x${firstByte.toString(16)}`);
	}

	// Extract the UTF-8 sequence and decode it
	const utf8Bytes = buffer.subarray(offset, offset + length);
	const str = utf8Bytes.toString('utf-8');
	const codePoint = str.codePointAt(0);

	if (codePoint === undefined) {
		throw new Error('Failed to decode UTF-8 number');
	}

	return {
		value: BigInt(codePoint),
		newOffset: offset + length,
	};
}

/**
 * Encodes a number as UTF-8 code point
 * Treats the number as a Unicode code point and encodes it as UTF-8
 */
export function encodeUtf8Number(value: number | bigint): Buffer {
	const num = Number(value);

	// Encode the number as a UTF-8 code point
	// Create a string from the code point and encode as UTF-8
	const str = String.fromCodePoint(num);
	return Buffer.from(str, 'utf-8');
}

/**
 * Reads a 16-bit unsigned integer
 */
export function readUInt16(buffer: Buffer, offset: number, utf8: boolean): number {
	if (utf8) {
		const result = readUtf8Number(buffer, offset);
		return Number(result.value);
	}
	return buffer.readUInt16BE(offset);
}

/**
 * Reads a 32-bit unsigned integer
 */
export function readUInt32(buffer: Buffer, offset: number, utf8: boolean): number {
	if (utf8) {
		const result = readUtf8Number(buffer, offset);
		return Number(result.value);
	}
	return buffer.readUInt32BE(offset);
}

/**
 * Reads a 64-bit unsigned integer as bigint
 */
export function readUInt64(buffer: Buffer, offset: number): bigint {
	return buffer.readBigUInt64BE(offset);
}

/**
 * Encodes a 16-bit unsigned integer
 */
export function encodeUInt16(value: number, utf8: boolean): Buffer {
	if (utf8) {
		return encodeUtf8Number(value);
	}
	const buf = Buffer.allocUnsafe(2);
	buf.writeUInt16BE(value);
	return buf;
}

/**
 * Encodes a 32-bit unsigned integer
 */
export function encodeUInt32(value: number, utf8: boolean): Buffer {
	if (utf8) {
		return encodeUtf8Number(value);
	}
	const buf = Buffer.allocUnsafe(4);
	buf.writeUInt32BE(value);
	return buf;
}

/**
 * Encodes a 64-bit unsigned integer
 */
export function encodeUInt64(value: bigint): Buffer {
	const buf = Buffer.allocUnsafe(8);
	buf.writeBigUInt64BE(value);
	return buf;
}

/**
 * Gets the number of bytes needed to encode a value as UTF-8 code point
 */
export function numberLength(value: number | bigint): number {
	const num = Number(value);

	// Determine UTF-8 length based on code point value
	if (num < 0x80) {
		return 1; // ASCII range
	} else if (num < 0x800) {
		return 2; // 2-byte UTF-8
	} else if (num < 0x10000) {
		return 3; // 3-byte UTF-8
	} else if (num < 0x110000) {
		return 4; // 4-byte UTF-8
	} else {
		throw new Error(`Code point out of range: ${num}`);
	}
}
