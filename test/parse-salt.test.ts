import { describe, it, expect } from 'vitest';
import { PacketParser } from '../src/ec/packet/PacketParser';
import { AuthSaltResponse } from '../src/response/AuthSaltResponse';

describe('Auth Salt Response Parsing', () => {
	it('should parse auth salt response correctly', () => {
		// Auth Response (Salt): 000000220000000d4f0116050855099a4aea510c43
		const packetHex = '000000220000000d4f0116050855099a4aea510c43';
		const packetBuffer = Buffer.from(packetHex, 'hex');

		const packet = PacketParser.parse(packetBuffer);
		const saltResponse = AuthSaltResponse.fromPacket(packet);

		expect(saltResponse.salt.toString(16)).toBe('55099a4aea510c43');
	});
});
