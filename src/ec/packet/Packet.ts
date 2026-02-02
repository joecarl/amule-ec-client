/**
 * EC Packet structure
 */

import { ECOpCode } from '../Codes';
import { Flags } from './Flags';
import type { Tag } from '../tag/Tag';

export class Packet {
	private static readonly EC_CURRENT_PROTOCOL_VERSION = 0x0204;

	constructor(
		public readonly opCode: ECOpCode,
		public readonly flags: Flags = new Flags(),
		public readonly tags: Tag<any>[] = []
	) {}

	/**
	 * Add a tag to the packet
	 */
	addTag(tag: Tag<any>): this {
		this.tags.push(tag);
		return this;
	}

	/**
	 * Add multiple tags to the packet
	 */
	addTags(tags: Tag<any>[]): this {
		this.tags.push(...tags);
		return this;
	}

	/**
	 * Get protocol version
	 */
	static getProtocolVersion(): number {
		return Packet.EC_CURRENT_PROTOCOL_VERSION;
	}

	/**
	 * Find a tag by name
	 */
	findTag(tagName: number): Tag<any> | undefined {
		return this.tags.find((tag) => tag.name === tagName);
	}

	/**
	 * Get all tags with a specific name
	 */
	findAllTags(tagName: number): Tag<any>[] {
		return this.tags.filter((tag) => tag.name === tagName);
	}

	/**
	 * Check if packet has a specific tag
	 */
	hasTag(tagName: number): boolean {
		return this.findTag(tagName) !== undefined;
	}
}
