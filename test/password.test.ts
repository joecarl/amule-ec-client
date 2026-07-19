import { describe, it, expect } from 'vitest';
import { PasswordHasher } from '../src/auth/PasswordHasher';

describe('Password Hasher', () => {
	it('should hash password correctly', () => {
		// From jamule PasswordHasherTest:
		// salt = "55099a4aea510c43".hexToULong()
		// password = "amule"
		// expectedHash = "ca9026415e1a7df7ec0f7ec69678c150".hexToUByteArray()

		const salt = BigInt('0x55099a4aea510c43');
		const password = 'amule';
		const expectedHash = 'ca9026415e1a7df7ec0f7ec69678c150';

		const hash = PasswordHasher.hash(password, salt);
		const actualHash = hash.toString('hex');

		expect(actualHash).toBe(expectedHash);
	});

	it('should hash correctly when the salt has leading zero nibbles', () => {
		// aMule formats the salt with "%lX" (no leading zeros), so a salt whose top
		// nibble is 0 must be hashed from the SHORTER hex string ("123456789ABCDEF",
		// 15 chars). Zero-padding it made auth fail for ~1/16 of connections.
		// Vector computed with aMule's algorithm (ExternalConn.cpp).
		const salt = BigInt('0x0123456789abcdef');
		const hash = PasswordHasher.hash('secret', salt);

		expect(hash.toString('hex')).toBe('6d06108f34dac36920074906c9461530');
	});

	it('should hash correctly for a full-width salt', () => {
		const salt = BigInt('0xfedcba9876543210');
		const hash = PasswordHasher.hash('secret', salt);

		expect(hash.toString('hex')).toBe('b3884e6f86ffccc2e736c0fdb96ebb55');
	});
});
