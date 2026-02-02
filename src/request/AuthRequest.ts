/**
 * Auth Request - Send client info to initiate authentication
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { Hash16Tag, UShortTag, StringTag, CustomTag } from '../ec/tag/Tag';

export class AuthClientInfoRequest extends Request {
	constructor(clientName: string = 'amule-ts-client', clientVersion: string = '1.0.0') {
		super(ECOpCode.EC_OP_AUTH_REQ);

		// Add client info
		this.addTag(new StringTag(ECTagName.EC_TAG_CLIENT_NAME, clientName));
		this.addTag(new StringTag(ECTagName.EC_TAG_CLIENT_VERSION, clientVersion));

		// Add protocol version
		this.addTag(new UShortTag(ECTagName.EC_TAG_PROTOCOL_VERSION, 0x0204));

		// Add capability flags as empty CustomTag (like jamule does)
		this.addTag(new CustomTag(ECTagName.EC_TAG_CAN_ZLIB, Buffer.alloc(0)));
		this.addTag(new CustomTag(ECTagName.EC_TAG_CAN_UTF8_NUMBERS, Buffer.alloc(0)));
	}
}

/**
 * Auth Password Request - Send hashed password after receiving salt
 */
export class AuthPasswordRequest extends Request {
	constructor(hashedPassword: Buffer) {
		super(ECOpCode.EC_OP_AUTH_PASSWD);

		// Add password hash
		this.addTag(new Hash16Tag(ECTagName.EC_TAG_PASSWD_HASH, hashedPassword));
	}
}
