/**
 * Packet flags for EC protocol
 */

export class Flags {
	private static readonly FLAG_ACCEPTS = 0x10;
	private static readonly FLAG_ZLIB = 0x01;
	private static readonly FLAG_UTF8_NUMBERS = 0x02;
	private static readonly FLAG_ALWAYS_SET = 0x20; // Bit 5 always set to distinguish from older clients

	private readonly flags: number;

	constructor(flags?: number) {
		this.flags = flags ?? 0;
	}

	/**
	 * Create flags from buffer
	 */
	static fromBuffer(buffer: Buffer, offset: number = 0): Flags {
		const flags = buffer.readUInt32BE(offset);
		return new Flags(flags);
	}

	/**
	 * Write flags to buffer
	 */
	writeToBuffer(buffer: Buffer, offset: number = 0): void {
		buffer.writeUInt32BE(this.flags, offset);
	}

	/**
	 * Check if UTF-8 number encoding is supported/accepted
	 */
	isUtf8NumbersAccepted(): boolean {
		return (this.flags & Flags.FLAG_ACCEPTS) > 0 && (this.flags & Flags.FLAG_UTF8_NUMBERS) > 0;
	}

	/**
	 * Check if ZLIB compression is supported/accepted
	 */
	isZlibAccepted(): boolean {
		return (this.flags & Flags.FLAG_ACCEPTS) > 0 && (this.flags & Flags.FLAG_ZLIB) > 0;
	}

	/**
	 * Check if UTF-8 number encoding is used
	 */
	isUtf8Numbers(): boolean {
		return (this.flags & Flags.FLAG_UTF8_NUMBERS) > 0;
	}

	/**
	 * Check if ZLIB compression is used
	 */
	isZlib(): boolean {
		return (this.flags & Flags.FLAG_ZLIB) > 0;
	}

	/**
	 * Create flags accepting UTF-8 numbers and ZLIB
	 */
	static accept(): Flags {
		return new Flags(Flags.FLAG_ACCEPTS | Flags.FLAG_UTF8_NUMBERS | Flags.FLAG_ZLIB | Flags.FLAG_ALWAYS_SET);
	}

	/**
	 * Create flags using UTF-8 numbers
	 */
	static useUtf8Numbers(): Flags {
		return new Flags(Flags.FLAG_UTF8_NUMBERS | Flags.FLAG_ALWAYS_SET);
	}

	/**
	 * Create flags without UTF-8 numbers (required for search)
	 */
	static noUtf8(): Flags {
		return new Flags(Flags.FLAG_ALWAYS_SET);
	}

	/**
	 * Create flags using ZLIB compression
	 */
	static useZlib(): Flags {
		return new Flags(Flags.FLAG_ZLIB | Flags.FLAG_ALWAYS_SET);
	}

	/**
	 * Get numeric value of flags
	 */
	getValue(): number {
		return this.flags;
	}
}
