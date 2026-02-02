/**
 * Download Queue Request - Get download queue
 */

import { Request } from './Request';
import { ECOpCode, ECTagName, ECDetailLevel } from '../ec/Codes';
import { UByteTag } from '../ec/tag/Tag';

export class DownloadQueueRequest extends Request {
	constructor(detailLevel: ECDetailLevel = ECDetailLevel.EC_DETAIL_FULL) {
		super(ECOpCode.EC_OP_GET_DLOAD_QUEUE);

		this.addTag(new UByteTag(ECTagName.EC_TAG_DETAIL_LEVEL, detailLevel));
	}
}
