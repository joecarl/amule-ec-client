// Tag definitions for EC protocol

import { ECTagName, ECTagType } from '../Codes';

export interface NumericTag {
	getShort(): number;
	getInt(): number;
	getLong(): bigint;
}

export abstract class Tag<T> {
	protected value!: T;
	public nestedTags?: Tag<any>[];

	constructor(
		public readonly name: ECTagName,
		public readonly type: ECTagType,
		nestedTags: Tag<any>[] = [],
		public readonly nameValue: number = name
	) {
		if (nestedTags.length > 0) {
			this.nestedTags = nestedTags;
		}
	}

	abstract parseValue(value: Buffer): void;
	abstract encodeValue(): Buffer;

	getValue(): T {
		return this.value;
	}

	protected setValue(value: T): void {
		this.value = value;
	}
}

export class CustomTag extends Tag<Buffer> {
	constructor(name: ECTagName, value?: Buffer, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_CUSTOM, subtags, nameValue);
		if (value !== undefined) {
			this.setValue(value);
		}
	}

	parseValue(value: Buffer): void {
		this.setValue(value);
	}

	encodeValue(): Buffer {
		return this.getValue();
	}
}

export class UByteTag extends Tag<number> implements NumericTag {
	constructor(name: ECTagName, value?: number, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_UINT8, subtags, nameValue);
		if (value !== undefined) {
			this.setValue(value);
		}
	}

	static withValue(name: ECTagName, value: number, subtags: Tag<any>[] = []): UByteTag {
		return new UByteTag(name, value, subtags);
	}

	parseValue(value: Buffer): void {
		if (value.length === 0) {
			this.setValue(0);
		} else if (value.length === 1) {
			this.setValue(value[0]);
		} else {
			throw new Error('UInt8Tag value must be 1 byte long');
		}
	}

	encodeValue(): Buffer {
		return Buffer.from([this.getValue()]);
	}

	getShort(): number {
		return this.getValue();
	}

	getInt(): number {
		return this.getValue();
	}

	getLong(): bigint {
		return BigInt(this.getValue());
	}
}

export class UShortTag extends Tag<number> implements NumericTag {
	constructor(name: ECTagName, value?: number, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_UINT16, subtags, nameValue);
		if (value !== undefined) {
			this.setValue(value);
		}
	}

	static withValue(name: ECTagName, value: number, subtags: Tag<any>[] = []): UShortTag {
		return new UShortTag(name, value, subtags);
	}

	parseValue(value: Buffer): void {
		if (value.length === 0) {
			this.setValue(0);
		} else if (value.length === 2) {
			this.setValue(value.readUInt16BE(0));
		} else {
			throw new Error('UInt16Tag value must be 2 bytes long');
		}
	}

	encodeValue(): Buffer {
		const buf = Buffer.allocUnsafe(2);
		buf.writeUInt16BE(this.getValue());
		return buf;
	}

	getShort(): number {
		return this.getValue();
	}

	getInt(): number {
		return this.getValue();
	}

	getLong(): bigint {
		return BigInt(this.getValue());
	}
}

export class UIntTag extends Tag<number> implements NumericTag {
	constructor(name: ECTagName, value?: number, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_UINT32, subtags, nameValue);
		if (value !== undefined) {
			this.setValue(value);
		}
	}

	static withValue(name: ECTagName, value: number, subtags: Tag<any>[] = []): UIntTag {
		return new UIntTag(name, value, subtags);
	}

	parseValue(value: Buffer): void {
		if (value.length === 0) {
			this.setValue(0);
		} else if (value.length === 4) {
			this.setValue(value.readUInt32BE(0));
		} else {
			throw new Error('UInt32Tag value must be 4 bytes long');
		}
	}

	encodeValue(): Buffer {
		const buf = Buffer.allocUnsafe(4);
		buf.writeUInt32BE(this.getValue());
		return buf;
	}

	getShort(): number {
		throw new Error('Unsigned Integer cannot be cast to short');
	}

	getInt(): number {
		return this.getValue();
	}

	getLong(): bigint {
		return BigInt(this.getValue());
	}
}

export class ULongTag extends Tag<bigint> implements NumericTag {
	constructor(name: ECTagName, value?: bigint, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_UINT64, subtags, nameValue);
		if (value !== undefined) {
			this.setValue(value);
		}
	}

	static withValue(name: ECTagName, value: bigint, subtags: Tag<any>[] = []): ULongTag {
		return new ULongTag(name, value, subtags);
	}

	parseValue(value: Buffer): void {
		if (value.length === 0) {
			this.setValue(0n);
		} else if (value.length === 8) {
			this.setValue(value.readBigUInt64BE(0));
		} else {
			throw new Error('UInt64Tag value must be 8 bytes long');
		}
	}

	encodeValue(): Buffer {
		const buf = Buffer.allocUnsafe(8);
		buf.writeBigUInt64BE(this.getValue());
		return buf;
	}

	getShort(): number {
		throw new Error('Unsigned Long cannot be cast to short');
	}

	getInt(): number {
		throw new Error('Unsigned Long cannot be cast to int');
	}

	getLong(): bigint {
		return this.getValue();
	}
}

export class UInt128Tag extends Tag<bigint> {
	constructor(name: ECTagName, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_UINT128, subtags, nameValue);
	}

	static withValue(name: ECTagName, value: bigint, subtags: Tag<any>[] = []): UInt128Tag {
		const tag = new UInt128Tag(name, subtags);
		tag.setValue(value);
		return tag;
	}

	parseValue(value: Buffer): void {
		if (value.length === 0) {
			this.setValue(0n);
		} else {
			// Read as big-endian big integer
			let result = 0n;
			for (let i = 0; i < value.length; i++) {
				result = (result << 8n) | BigInt(value[i]);
			}
			this.setValue(result);
		}
	}

	encodeValue(): Buffer {
		// Encode as big-endian
		const val = this.getValue();
		const bytes: number[] = [];
		let remaining = val;

		while (remaining > 0n) {
			bytes.unshift(Number(remaining & 0xffn));
			remaining >>= 8n;
		}

		// Pad to 16 bytes
		while (bytes.length < 16) {
			bytes.unshift(0);
		}

		return Buffer.from(bytes);
	}
}

export class StringTag extends Tag<string> {
	constructor(name: ECTagName, value?: string, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_STRING, subtags, nameValue);
		if (value !== undefined) {
			this.setValue(value);
		}
	}

	static withValue(name: ECTagName, value: string, subtags: Tag<any>[] = []): StringTag {
		return new StringTag(name, value, subtags);
	}

	parseValue(value: Buffer): void {
		if (value[value.length - 1] !== 0x00) {
			throw new Error('StringTag value must be null terminated');
		}
		this.setValue(value.toString('utf8', 0, value.length - 1));
	}

	encodeValue(): Buffer {
		return Buffer.concat([Buffer.from(this.getValue(), 'utf8'), Buffer.from([0x00])]);
	}
}

export class DoubleTag extends Tag<number> {
	constructor(name: ECTagName, value?: number, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_DOUBLE, subtags, nameValue);
		if (value !== undefined) {
			this.setValue(value);
		}
	}

	static withValue(name: ECTagName, value: number, subtags: Tag<any>[] = []): DoubleTag {
		return new DoubleTag(name, value, subtags);
	}

	parseValue(value: Buffer): void {
		if (value[value.length - 1] !== 0x00) {
			throw new Error('DoubleTag value must be null terminated');
		}
		this.setValue(parseFloat(value.toString('utf8', 0, value.length - 1)));
	}

	encodeValue(): Buffer {
		return Buffer.concat([Buffer.from(this.getValue().toString(), 'utf8'), Buffer.from([0x00])]);
	}
}

export interface Ipv4Value {
	address: string;
	port: number;
}

export class Ipv4Tag extends Tag<Ipv4Value> {
	constructor(name: ECTagName, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_IPV4, subtags, nameValue);
	}

	static withValue(name: ECTagName, value: Ipv4Value, subtags: Tag<any>[] = []): Ipv4Tag {
		const tag = new Ipv4Tag(name, subtags);
		tag.setValue(value);
		return tag;
	}

	parseValue(value: Buffer): void {
		if (value.length !== 6) {
			throw new Error('Ipv4Tag value must be 6 bytes long');
		}
		const address = `${value[0]}.${value[1]}.${value[2]}.${value[3]}`;
		const port = value.readUInt16BE(4);
		this.setValue({ address, port });
	}

	encodeValue(): Buffer {
		const val = this.getValue();
		const parts = val.address.split('.').map((p) => parseInt(p));
		const buf = Buffer.allocUnsafe(6);
		buf[0] = parts[0];
		buf[1] = parts[1];
		buf[2] = parts[2];
		buf[3] = parts[3];
		buf.writeUInt16BE(val.port, 4);
		return buf;
	}
}

export class Hash16Tag extends Tag<Buffer> {
	constructor(name: ECTagName, value?: Buffer, subtags: Tag<any>[] = [], nameValue: number = name) {
		super(name, ECTagType.EC_TAGTYPE_HASH16, subtags, nameValue);
		if (value !== undefined) {
			this.setValue(value);
		}
	}

	static withValue(name: ECTagName, value: Buffer, subtags: Tag<any>[] = []): Hash16Tag {
		return new Hash16Tag(name, value, subtags);
	}

	parseValue(value: Buffer): void {
		if (value.length === 16) {
			this.setValue(value);
		} else {
			throw new Error('Hash16Tag value must be 16 bytes long');
		}
	}

	encodeValue(): Buffer {
		return this.getValue();
	}
}

// Helper functions for tag extraction
export function findTag(tags: Tag<any>[], name: ECTagName): Tag<any> | undefined {
	return tags.find((tag) => tag.name === name);
}

export function findNumericTag(tags: Tag<any>[], name: ECTagName): NumericTag | undefined {
	const tag = tags.find((tag) => tag.name === name);
	if (tag && 'getInt' in tag && 'getShort' in tag && 'getLong' in tag) {
		return tag as NumericTag;
	}
	return undefined;
}
