/**
 * Server Connect Request - Connect to a specific server
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { Ipv4Tag } from '../ec/tag/Tag';

export class ServerConnectRequest extends Request {
	constructor(ip?: string, port?: number) {
		super(ECOpCode.EC_OP_SERVER_CONNECT);

		if (ip && port) {
			this.addTag(new Ipv4Tag(ECTagName.EC_TAG_SERVER, { address: ip, port }));
		}
	}
}
