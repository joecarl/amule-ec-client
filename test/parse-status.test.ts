import { describe, it, expect } from 'vitest';
import { PacketParser } from '../src/ec/packet/PacketParser';

/**
 * Test parsing the status response from jamule SamplePackets
 */
describe('Status Response Parsing', () => {
	it('should parse status response correctly', () => {
		// This is statusResponse from jamule SamplePackets.kt (flags 0x22 = UTF8, no ZLIB)
		const statusResponseHex =
			'000000220000008c0c10d08003021664d082020100d484020100d4860302' +
			'1664d488020100d48a020100d084020100d086020100d09002010' +
			'0d08c020100d092040400017cbbd09402010ad096040402e2740f' +
			'd09803020438d0b60201000b023f03e0a881081f01e0a88206124' +
			'16b74656f6e20536572766572204e6f3200b07de76247b50c0404' +
			'1d4e48541404041d4e485419';

		const statusResponseBuffer = Buffer.from(statusResponseHex, 'hex');

		// Check if packet is complete
		const complete = PacketParser.hasCompletePacket(statusResponseBuffer);
		expect(complete).toBe(true);

		const packet = PacketParser.parse(statusResponseBuffer);

		// Verify basic packet properties
		expect(packet.opCode).toBe(0x0c); // EC_OP_STATS
		expect(packet.flags.isZlib()).toBe(false);
		expect(packet.flags.isUtf8Numbers()).toBe(true);
		expect(packet.tags.length).toBeGreaterThan(0);

		// Check that parsing succeeded (the main goal of the original test)
		// The original test was just checking that parsing doesn't throw
		expect(packet.tags.length).toBeGreaterThan(10); // Should have many tags
	});
});
