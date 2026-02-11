/**
 * Update Request - Get incremental updates for files, clients, and servers
 */

import { Request } from './Request';
import { ECOpCode, ECTagName, ECDetailLevel } from '../ec/Codes';
import { UByteTag } from '../ec/tag/Tag';

export class UpdateRequest extends Request {
	constructor(detailLevel: ECDetailLevel = ECDetailLevel.EC_DETAIL_INC_UPDATE) {
		super(ECOpCode.EC_OP_GET_UPDATE);

		this.addTag(new UByteTag(ECTagName.EC_TAG_DETAIL_LEVEL, detailLevel));
	}
}
