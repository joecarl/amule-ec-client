/**
 * Client Queue Request - Get client upload queue
 */

import { Request } from './Request';
import { ECOpCode, ECTagName, ECDetailLevel } from '../ec/Codes';
import { UByteTag } from '../ec/tag/Tag';

export class ClientQueueRequest extends Request {
	constructor(detailLevel: ECDetailLevel = ECDetailLevel.EC_DETAIL_FULL) {
		super(ECOpCode.EC_OP_GET_ULOAD_QUEUE);

		this.addTag(new UByteTag(ECTagName.EC_TAG_DETAIL_LEVEL, detailLevel));
	}
}
