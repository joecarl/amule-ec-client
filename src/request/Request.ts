/**
 * Base Request class
 */

import { Packet } from '../ec/packet/Packet';
import { Flags } from '../ec/packet/Flags';
import { ECOpCode } from '../ec/Codes';
import type { Tag } from '../ec/tag/Tag';

export abstract class Request {
	protected readonly opCode: ECOpCode;
	protected readonly tags: Tag<any>[] = [];

	constructor(opCode: ECOpCode) {
		this.opCode = opCode;
	}

	/**
	 * Add a tag to the request
	 */
	protected addTag(tag: Tag<any>): void {
		this.tags.push(tag);
	}

	/**
	 * Build the packet for this request
	 */
	buildPacket(): Packet {
		const flags = Flags.useUtf8Numbers();
		return new Packet(this.opCode, flags, this.tags);
	}
}
