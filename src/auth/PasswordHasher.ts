/**
 * Password Hasher for aMule EC authentication
 */

import * as crypto from 'crypto';

export class PasswordHasher {
	/**
	 * Hash a password with salt using MD5
	 *
	 * This matches aMule's password hashing algorithm (from jamule):
	 * 1. saltHash = MD5(salt.toHexString().uppercase())
	 * 2. passwordHash = MD5(password)
	 * 3. return MD5(passwordHash.toHex().lowercase() + saltHash.toHex().lowercase())
	 *
	 * @param password The password to hash
	 * @param salt The salt received from the server
	 * @returns The hashed password as a Buffer
	 */
	static hash(password: string, salt: bigint): Buffer {
		// Step 1: Hash the salt (as uppercase hex string)
		const saltHexUpper = salt.toString(16).toUpperCase().padStart(16, '0');
		const saltHash = crypto.createHash('md5').update(saltHexUpper, 'utf-8').digest();

		// Step 2: Hash the password
		const passwordHash = crypto.createHash('md5').update(password, 'utf-8').digest();

		// Step 3: Hash the concatenation of both hashes (as lowercase hex strings)
		const passwordHashHex = passwordHash.toString('hex').toLowerCase();
		const saltHashHex = saltHash.toString('hex').toLowerCase();
		const finalHash = crypto
			.createHash('md5')
			.update(passwordHashHex + saltHashHex, 'utf-8')
			.digest();

		return finalHash;
	}

	/**
	 * Hash a password without salt (for testing)
	 */
	static hashWithoutSalt(password: string): Buffer {
		const lowerPassword = password.toLowerCase();
		const md5Hash = crypto.createHash('md5');
		md5Hash.update(lowerPassword, 'utf-8');
		return md5Hash.digest();
	}
}
