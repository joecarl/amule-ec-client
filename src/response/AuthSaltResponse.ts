/**
 * Auth Salt Response - Contains authentication salt
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag } from '../ec/tag/Tag';
import { InvalidECException } from '../exceptions';

export class AuthSaltResponse {
	constructor(public readonly salt: bigint) {}

	static fromPacket(packet: Packet): AuthSaltResponse {
		const saltTag = findNumericTag(packet.tags, ECTagName.EC_TAG_PASSWD_SALT);
		if (!saltTag) {
			throw new InvalidECException('Missing salt tag in auth salt response');
		}

		return new AuthSaltResponse(saltTag.getLong());
	}
}
