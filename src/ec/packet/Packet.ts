/**
 * EC Packet structure
 */

import { ECOpCode, type ECTagName } from '../Codes';
import { Flags } from './Flags';
import { findTag, type Tag } from '../tag/Tag';

export class Packet {
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
	 * Find a tag by name
	 */
	findTag(tagName: ECTagName): Tag<any> | undefined {
		return findTag(this.tags, tagName);
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
