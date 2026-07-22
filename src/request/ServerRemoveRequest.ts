/**
 * Server Remove Request - Remove a specific server
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { Ipv4Tag } from '../ec/tag/Tag';

export class ServerRemoveRequest extends Request {
	constructor(ip: string, port: number) {
		super(ECOpCode.EC_OP_SERVER_REMOVE);

		// Unlike EC_OP_SERVER_CONNECT (where no tag means "connect to any server"),
		// the daemon rejects a remove without the server tag with EC_OP_FAILED.
		this.addTag(new Ipv4Tag(ECTagName.EC_TAG_SERVER, { address: ip, port }));
	}
}
