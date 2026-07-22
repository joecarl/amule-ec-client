/**
 * Server Add Request - Add a server to the server list.
 *
 * The daemon (Get_EC_Response_Server_Add in aMule's ExternalConn.cpp) expects
 * EC_TAG_SERVER_ADDRESS as an "ip:port" string plus an optional EC_TAG_SERVER_NAME,
 * both as top-level tags. It answers EC_OP_NOOP on success and EC_OP_FAILED when the
 * server was rejected (already listed or blocked by the IP filter).
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { StringTag } from '../ec/tag/Tag';

export class ServerAddRequest extends Request {
	constructor(ip: string, port: number, name?: string) {
		super(ECOpCode.EC_OP_SERVER_ADD);

		this.addTag(new StringTag(ECTagName.EC_TAG_SERVER_ADDRESS, `${ip}:${port}`));
		if (name !== undefined) {
			this.addTag(new StringTag(ECTagName.EC_TAG_SERVER_NAME, name));
		}
	}
}
