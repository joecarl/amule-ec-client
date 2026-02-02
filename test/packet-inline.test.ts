import { describe, it, expect } from 'vitest';
import { ECOpCode, ECTagName } from '../src/ec/Codes';
import { StringTag, UShortTag, CustomTag } from '../src/ec/tag/Tag';
import { Packet } from '../src/ec/packet/Packet';
import { Flags } from '../src/ec/packet/Flags';
import { PacketWriter } from '../src/ec/packet/PacketWriter';

describe('Auth Request Packet', () => {
	it('should encode auth request packet correctly', () => {
		// Expected from jamule SamplePackets:
		const expectedHex = '00000022000000240205c8800609614d756c65636d6400c8820606322e332e330004030202041801001a0100';

		const flags = Flags.useUtf8Numbers();

		const packet = new Packet(ECOpCode.EC_OP_AUTH_REQ, flags, [
			new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'aMulecmd'),
			new StringTag(ECTagName.EC_TAG_CLIENT_VERSION, '2.3.3'),
			new UShortTag(ECTagName.EC_TAG_PROTOCOL_VERSION, 0x0204),
			new CustomTag(ECTagName.EC_TAG_CAN_ZLIB, Buffer.alloc(0)),
			new CustomTag(ECTagName.EC_TAG_CAN_UTF8_NUMBERS, Buffer.alloc(0)),
		]);

		const buffer = PacketWriter.write(packet);
		const actualHex = buffer.toString('hex');

		expect(actualHex).toBe(expectedHex);
	});
});
