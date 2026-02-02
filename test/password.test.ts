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
});
