/**
 * Packet Writer - Serializes EC packets to binary data
 */

import * as zlib from 'zlib';
import { Packet } from './Packet';
import { Flags } from './Flags';
import { TagEncoder } from '../tag/TagEncoder';
import { encodeUtf8Number } from '../Encoding';

export class PacketWriter {
	private static readonly HEADER_SIZE = 8; // flags(4) + data_length(4)

	/**
	 * Write a packet to a buffer
	 */
	static write(packet: Packet): Buffer {
		const useUtf8 = packet.flags.isUtf8Numbers();
		const useZlib = packet.flags.isZlib();

		// Encode packet data
		let data = this.encodePacketData(packet, useUtf8);

		// Compress if needed
		if (useZlib) {
			data = this.compress(data);
		}

		// Create final buffer with header
		const buffer = Buffer.allocUnsafe(this.HEADER_SIZE + data.length);

		// Write flags
		packet.flags.writeToBuffer(buffer, 0);

		// Write data length
		buffer.writeUInt32BE(data.length, 4);

		// Write data
		data.copy(buffer, this.HEADER_SIZE);

		return buffer;
	}

	/**
	 * Encode packet data (before compression)
	 */
	private static encodePacketData(packet: Packet, useUtf8: boolean): Buffer {
		const encoder = new TagEncoder(useUtf8);

		// Calculate size
		let size = 1; // opcode

		if (useUtf8) {
			const countBuf = encodeUtf8Number(packet.tags.length);
			size += countBuf.length;
		} else {
			size += 2; // tag count (uint16)
		}

		// Calculate tags size
		for (const tag of packet.tags) {
			size += encoder.calculateTagSize(tag);
		}

		// Create buffer
		const buffer = Buffer.allocUnsafe(size);
		let offset = 0;

		// Write opcode
		buffer.writeUInt8(packet.opCode, offset);
		offset += 1;

		// Write tag count
		if (useUtf8) {
			const countBuf = encodeUtf8Number(packet.tags.length);
			countBuf.copy(buffer, offset);
			offset += countBuf.length;
		} else {
			buffer.writeUInt16BE(packet.tags.length, offset);
			offset += 2;
		}

		// Write tags
		for (const tag of packet.tags) {
			offset = encoder.encodeTag(tag, buffer, offset);
		}

		return buffer;
	}

	/**
	 * Compress data with ZLIB
	 */
	private static compress(data: Buffer): Buffer {
		return zlib.deflateSync(data, {
			level: zlib.constants.Z_BEST_COMPRESSION,
		});
	}
}
