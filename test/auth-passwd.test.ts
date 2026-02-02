import { describe, it, expect } from 'vitest';
import { ECOpCode, ECTagName } from '../src/ec/Codes';
import { Hash16Tag } from '../src/ec/tag/Tag';
import { Packet } from '../src/ec/packet/Packet';
import { Flags } from '../src/ec/packet/Flags';
import { PacketWriter } from '../src/ec/packet/PacketWriter';

describe('Auth Password Packet', () => {
	it('should encode auth password packet correctly', () => {
		// Expected from jamule SamplePackets:
		// Auth Passwd Request: 00000022000000155001020910ca9026415e1a7df7ec0f7ec69678c150
		const expectedHex = '00000022000000155001020910ca9026415e1a7df7ec0f7ec69678c150';

		const flags = Flags.useUtf8Numbers();
		const hash = Buffer.from('ca9026415e1a7df7ec0f7ec69678c150', 'hex');

		const packet = new Packet(ECOpCode.EC_OP_AUTH_PASSWD, flags, [new Hash16Tag(ECTagName.EC_TAG_PASSWD_HASH, hash)]);

		const buffer = PacketWriter.write(packet);
		const actualHex = buffer.toString('hex');

		expect(actualHex).toBe(expectedHex);
	});
});
