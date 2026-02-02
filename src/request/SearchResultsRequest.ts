/**
 * Search Results Request - Get search results
 */

import { Request } from './Request';
import { ECOpCode } from '../ec/Codes';

export class SearchResultsRequest extends Request {
	constructor() {
		super(ECOpCode.EC_OP_SEARCH_RESULTS);
	}
}
