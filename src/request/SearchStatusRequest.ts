/**
 * Search Status Request - Get search progress
 */

import { Request } from './Request';
import { ECOpCode } from '../ec/Codes';

export class SearchStatusRequest extends Request {
	constructor() {
		super(ECOpCode.EC_OP_SEARCH_PROGRESS);
	}
}
