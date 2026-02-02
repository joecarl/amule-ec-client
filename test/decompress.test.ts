import { describe, it, expect } from 'vitest';
import * as zlib from 'zlib';

describe('ZLIB Decompression', () => {
	it('should handle invalid compressed data', () => {
		// Packet from the error: 0000002100000bd6789c... (ZLIB compressed)
		// This data appears to be truncated or corrupted
		const compressedHex =
			'789ced5c5b6fe3c81596b74290aa411ab48bb4455f669322f6ba16259212251149365edbeb55777d89d7' +
			'7739629250ecc4edfbd838024d60b0a66fc361d5d7e35fbd68a9cfd0f064cf11042ba04d3cb6ba7eb0ba06510ad6d0a93b59';

		const compressed = Buffer.from(compressedHex, 'hex');

		// The original test showed that this data causes decompression to fail
		expect(() => zlib.inflateSync(compressed)).toThrow('invalid code lengths set');
	});
});
