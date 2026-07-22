/**
 * Server Set Static/Prio Request - Change a server's priority and/or static flag.
 *
 * Unlike the other server ops (which identify the server with an IPv4 EC_TAG_SERVER),
 * the daemon resolves EC_OP_SERVER_SET_STATIC_PRIO by ECID: EC_TAG_SERVER carries the
 * server's ECID as a plain integer, and EC_TAG_SERVER_PRIO / EC_TAG_SERVER_STATIC are
 * top-level sibling tags (see Get_EC_Response in aMule's ExternalConn.cpp and
 * CServerListRem::SetServerPrio in amule-remote-gui.cpp).
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { UByteTag, UIntTag } from '../ec/tag/Tag';

export interface ServerSetStaticPrioOptions {
	priority?: number;
	isStatic?: boolean;
}

export class ServerSetStaticPrioRequest extends Request {
	constructor(ecid: number, options: ServerSetStaticPrioOptions) {
		super(ECOpCode.EC_OP_SERVER_SET_STATIC_PRIO);

		this.addTag(new UIntTag(ECTagName.EC_TAG_SERVER, ecid));

		if (options.priority !== undefined) {
			this.addTag(new UIntTag(ECTagName.EC_TAG_SERVER_PRIO, options.priority));
		}
		if (options.isStatic !== undefined) {
			this.addTag(new UByteTag(ECTagName.EC_TAG_SERVER_STATIC, options.isStatic ? 1 : 0));
		}
	}
}
