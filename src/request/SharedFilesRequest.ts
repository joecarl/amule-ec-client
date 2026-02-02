/**
 * Shared Files Request - Get shared files list
 */

import { Request } from './Request';
import { ECOpCode, ECTagName, ECDetailLevel } from '../ec/Codes';
import { UByteTag } from '../ec/tag/Tag';

export class SharedFilesRequest extends Request {
	constructor(detailLevel: ECDetailLevel = ECDetailLevel.EC_DETAIL_FULL) {
		super(ECOpCode.EC_OP_GET_SHARED_FILES);

		this.addTag(new UByteTag(ECTagName.EC_TAG_DETAIL_LEVEL, detailLevel));
	}
}
