/**
 * Stats Request - Request server statistics
 */

import { Request } from './Request';
import { ECOpCode, ECTagName, ECDetailLevel } from '../ec/Codes';
import { UByteTag } from '../ec/tag/Tag';

export class StatsRequest extends Request {
	constructor(detailLevel: ECDetailLevel = ECDetailLevel.EC_DETAIL_FULL) {
		super(ECOpCode.EC_OP_STAT_REQ);

		this.addTag(new UByteTag(ECTagName.EC_TAG_DETAIL_LEVEL, detailLevel));
	}
}
