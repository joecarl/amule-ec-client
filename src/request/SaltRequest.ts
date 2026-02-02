/**
 * Salt Request - Request authentication salt from server
 */

import { Request } from './Request';
import { ECOpCode } from '../ec/Codes';

export class SaltRequest extends Request {
	constructor() {
		super(ECOpCode.EC_OP_AUTH_SALT);
	}
}
