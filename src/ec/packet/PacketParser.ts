/**
 * Packet Parser - Deserializes EC packets from binary data
 */

import * as zlib from 'zlib';
import { Packet } from './Packet';
import { Flags } from './Flags';
import { ECOpCode } from '../Codes';
import { TagParser } from '../tag/TagParser';
import { InvalidECException } from '../../exceptions';

export class PacketParser {
	private static readonly HEADER_SIZE = 8; // flags(4) + data_length(4)

	/**
	 * Parse a packet from a buffer
	 */
	static parse(buffer: Buffer): Packet {
		if (buffer.length < this.HEADER_SIZE) {
			throw new InvalidECException(`Buffer too small: ${buffer.length} bytes`);
		}

		// Read flags
		const flags = Flags.fromBuffer(buffer, 0);

		// Read data length
		const dataLength = buffer.readUInt32BE(4);

		if (buffer.length < this.HEADER_SIZE + dataLength) {
			throw new InvalidECException(`Incomplete packet: expected ${this.HEADER_SIZE + dataLength} bytes, got ${buffer.length}`);
		}

		// Extract data
		let data = buffer.subarray(this.HEADER_SIZE, this.HEADER_SIZE + dataLength);

		// Decompress if needed
		if (flags.isZlib()) {
			data = this.decompress(data);
		}

		// Parse packet data
		return this.parsePacketData(data, flags);
	}

	/**
	 * Parse packet data (after decompression)
	 */
	private static parsePacketData(data: Buffer, flags: Flags): Packet {
		let offset = 0;

		// Read opcode
		const opCode = data.readUInt8(offset) as ECOpCode;
		offset += 1;

		// Read tag count
		const useUtf8 = flags.isUtf8Numbers();
		let tagCount: number;

		if (useUtf8) {
			// UTF-8 encoded number - not implemented in full yet, assume simple case
			tagCount = data.readUInt8(offset);
			offset += 1;
		} else {
			tagCount = data.readUInt16BE(offset);
			offset += 2;
		}

		// Parse tags
		const tagParser = new TagParser(data, offset, useUtf8);
		const tags = tagParser.parseTags(tagCount);

		return new Packet(opCode, flags, tags);
	}

	/**
	 * Decompress ZLIB data
	 */
	private static decompress(data: Buffer): Buffer {
		try {
			return zlib.inflateSync(data);
		} catch (error) {
			throw new InvalidECException(`Failed to decompress packet: ${error}`);
		}
	}

	/**
	 * Calculate expected packet size from header
	 */
	static getExpectedPacketSize(headerBuffer: Buffer): number {
		if (headerBuffer.length < this.HEADER_SIZE) {
			throw new InvalidECException('Header buffer too small');
		}

		const dataLength = headerBuffer.readUInt32BE(4);
		return this.HEADER_SIZE + dataLength;
	}

	/**
	 * Check if buffer contains a complete packet
	 */
	static hasCompletePacket(buffer: Buffer): boolean {
		if (buffer.length < this.HEADER_SIZE) {
			return false;
		}

		const expectedSize = this.getExpectedPacketSize(buffer);
		return buffer.length >= expectedSize;
	}
}
