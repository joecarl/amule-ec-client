/**
 * Server Connect Request - Connect to a specific server
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { UIntTag, UShortTag } from '../ec/tag/Tag';

export class ServerConnectRequest extends Request {
	constructor(ip: string, port: number) {
		super(ECOpCode.EC_OP_SERVER_CONNECT);

		this.addTag(new UIntTag(ECTagName.EC_TAG_SERVER_IP, this.ipToNumber(ip)));
		this.addTag(new UShortTag(ECTagName.EC_TAG_SERVER_PORT, port));
	}

	private ipToNumber(ip: string): number {
		const parts = ip.split('.').map((p) => parseInt(p, 10));
		return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
	}
}
