import { describe, it, expect } from 'vitest';
import { ECOpCode, ECTagName, ECTagType } from '../src/ec/Codes';
import { UIntTag, StringTag, Hash16Tag } from '../src/ec/tag/Tag';
import { Packet } from '../src/ec/packet/Packet';
import { Flags } from '../src/ec/packet/Flags';
import { PacketWriter } from '../src/ec/packet/PacketWriter';
import { PacketParser } from '../src/ec/packet/PacketParser';
import { TagEncoder } from '../src/ec/tag/TagEncoder';
import { TagParser } from '../src/ec/tag/TagParser';

describe('EC Protocol', () => {
	describe('Flags', () => {
		it('should create flags accepting UTF-8 and ZLIB', () => {
			const flags = Flags.accept();
			expect(flags.isUtf8NumbersAccepted()).toBe(true);
			expect(flags.isZlibAccepted()).toBe(true);
		});

		it('should create flags using UTF-8 numbers', () => {
			const flags = Flags.useUtf8Numbers();
			expect(flags.isUtf8Numbers()).toBe(true);
			expect(flags.isZlib()).toBe(false);
		});

		it('should write and read flags from buffer', () => {
			const flags = Flags.useUtf8Numbers();
			const buffer = Buffer.allocUnsafe(4);
			flags.writeToBuffer(buffer, 0);

			const readFlags = Flags.fromBuffer(buffer, 0);
			expect(readFlags.getValue()).toBe(flags.getValue());
		});
	});

	describe('Tags', () => {
		it('should create and encode UIntTag', () => {
			const tag = new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345);
			expect(tag.name).toBe(ECTagName.EC_TAG_CLIENT_ID);
			expect(tag.type).toBe(ECTagType.EC_TAGTYPE_UINT32);
			expect(tag.getValue()).toBe(12345);

			const encoded = tag.encodeValue();
			expect(encoded).toBeInstanceOf(Buffer);
			expect(encoded.length).toBe(4);
		});

		it('should create and encode StringTag', () => {
			const tag = new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'test-client');
			expect(tag.getValue()).toBe('test-client');

			const encoded = tag.encodeValue();
			// StringTag includes null terminator
			expect(encoded.toString('utf-8')).toBe('test-client\u0000');
		});

		it('should create and encode Hash16Tag', () => {
			const hash = Buffer.from('0123456789ABCDEF0123456789ABCDEF', 'hex');
			const tag = new Hash16Tag(ECTagName.EC_TAG_PARTFILE, hash);
			expect(tag.getValue()).toEqual(hash);
			expect(tag.encodeValue()).toEqual(hash);
		});
	});

	describe('TagEncoder', () => {
		it('should encode tags without UTF-8 numbers', () => {
			const encoder = new TagEncoder(false);
			const tag = new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345);

			const size = encoder.calculateTagSize(tag);
			expect(size).toBeGreaterThan(0);

			const buffer = Buffer.allocUnsafe(size);
			encoder.encodeTag(tag, buffer, 0);
			expect(buffer.length).toBe(size);
		});

		it('should encode tags with UTF-8 numbers', () => {
			const encoder = new TagEncoder(true);
			const tag = new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345);

			const size = encoder.calculateTagSize(tag);
			expect(size).toBeGreaterThan(0);
		});

		it('should encode nested tags', () => {
			const encoder = new TagEncoder(false);
			const parentTag = new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345);
			const childTag = new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'test');
			parentTag.nestedTags = [childTag];

			const size = encoder.calculateTagSize(parentTag);
			const buffer = Buffer.allocUnsafe(size);
			const written = encoder.encodeTag(parentTag, buffer, 0);
			expect(written).toBe(size);
		});
	});

	describe('TagParser', () => {
		it('should parse UIntTag', () => {
			const encoder = new TagEncoder(false);
			const originalTag = new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345);

			const size = encoder.calculateTagSize(originalTag);
			const buffer = Buffer.allocUnsafe(size);
			encoder.encodeTag(originalTag, buffer, 0);

			const parser = new TagParser(buffer, 0, false);
			const parsedTag = parser.parseTag();

			expect(parsedTag.name).toBe(originalTag.name);
			expect(parsedTag.type).toBe(originalTag.type);
			expect(parsedTag.getValue()).toBe(originalTag.getValue());
		});

		it('should parse StringTag', () => {
			const encoder = new TagEncoder(false);
			const originalTag = new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'test-client');

			const size = encoder.calculateTagSize(originalTag);
			const buffer = Buffer.allocUnsafe(size);
			encoder.encodeTag(originalTag, buffer, 0);

			const parser = new TagParser(buffer, 0, false);
			const parsedTag = parser.parseTag();

			expect(parsedTag.name).toBe(originalTag.name);
			// Parser removes null terminator, so values should match
			expect(parsedTag.getValue()).toBe('test-client');
		});
	});

	describe('Packet', () => {
		it('should create a packet with tags', () => {
			const packet = new Packet(ECOpCode.EC_OP_STAT_REQ);
			packet.addTag(new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345));
			packet.addTag(new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'test'));

			expect(packet.opCode).toBe(ECOpCode.EC_OP_STAT_REQ);
			expect(packet.tags.length).toBe(2);
		});

		it('should find tags by name', () => {
			const packet = new Packet(ECOpCode.EC_OP_STAT_REQ);
			packet.addTag(new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345));

			const tag = packet.findTag(ECTagName.EC_TAG_CLIENT_ID);
			expect(tag).toBeDefined();
			expect(tag?.getValue()).toBe(12345);
		});

		it('should check if packet has a tag', () => {
			const packet = new Packet(ECOpCode.EC_OP_STAT_REQ);
			packet.addTag(new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345));

			expect(packet.hasTag(ECTagName.EC_TAG_CLIENT_ID)).toBe(true);
			expect(packet.hasTag(ECTagName.EC_TAG_CONNSTATE)).toBe(false);
		});
	});

	describe('PacketWriter and PacketParser', () => {
		it('should write and parse a simple packet', () => {
			const originalPacket = new Packet(ECOpCode.EC_OP_STAT_REQ, Flags.useUtf8Numbers());
			originalPacket.addTag(new UIntTag(ECTagName.EC_TAG_CLIENT_ID, 12345));

			const buffer = PacketWriter.write(originalPacket);
			expect(buffer).toBeInstanceOf(Buffer);

			const parsedPacket = PacketParser.parse(buffer);
			expect(parsedPacket.opCode).toBe(originalPacket.opCode);
			expect(parsedPacket.tags.length).toBe(originalPacket.tags.length);
		});

		it('should write and parse packet with multiple tags', () => {
			const originalPacket = new Packet(ECOpCode.EC_OP_AUTH_REQ, Flags.useUtf8Numbers());
			originalPacket.addTag(new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'test-client'));
			originalPacket.addTag(new StringTag(ECTagName.EC_TAG_CLIENT_VERSION, '1.0.0'));
			originalPacket.addTag(new UIntTag(ECTagName.EC_TAG_PROTOCOL_VERSION, 0x0204));

			const buffer = PacketWriter.write(originalPacket);
			const parsedPacket = PacketParser.parse(buffer);

			expect(parsedPacket.tags.length).toBe(3);
		});

		it('should handle ZLIB compression', () => {
			const originalPacket = new Packet(ECOpCode.EC_OP_STAT_REQ, Flags.useZlib());
			// Add enough data to make compression worthwhile
			for (let i = 0; i < 100; i++) {
				originalPacket.addTag(new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'test-client-name-long'));
			}

			const buffer = PacketWriter.write(originalPacket);
			const parsedPacket = PacketParser.parse(buffer);

			expect(parsedPacket.opCode).toBe(originalPacket.opCode);
			expect(parsedPacket.tags.length).toBe(originalPacket.tags.length);
		});
	});
});
