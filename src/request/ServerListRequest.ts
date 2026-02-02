/**
 * Server List Request - Request the list of servers
 */

import { Request } from './Request';
import { ECOpCode } from '../ec/Codes';

export class ServerListRequest extends Request {
	constructor() {
		super(ECOpCode.EC_OP_GET_SERVER_LIST);
	}
}
