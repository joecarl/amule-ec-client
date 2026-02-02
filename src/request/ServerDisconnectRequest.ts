/**
 * Server Disconnect Request - Disconnect from the current server
 */

import { Request } from './Request';
import { ECOpCode } from '../ec/Codes';

export class ServerDisconnectRequest extends Request {
	constructor() {
		super(ECOpCode.EC_OP_SERVER_DISCONNECT);
	}
}
