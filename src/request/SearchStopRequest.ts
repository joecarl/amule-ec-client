/**
 * Search Stop Request - Stop current search
 */

import { Request } from './Request';
import { ECOpCode } from '../ec/Codes';

export class SearchStopRequest extends Request {
	constructor() {
		super(ECOpCode.EC_OP_SEARCH_STOP);
	}
}
