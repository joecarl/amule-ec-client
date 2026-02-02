/**
 * Set File Category Request - Change category of a file
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { Hash16Tag, UByteTag } from '../ec/tag/Tag';

export class SetFileCategoryRequest extends Request {
	constructor(hash: Buffer, categoryId: number) {
		super(ECOpCode.EC_OP_PARTFILE_SET_CAT);

		// Hash tag with category as subtag
		this.addTag(new Hash16Tag(ECTagName.EC_TAG_PARTFILE, hash, [new UByteTag(ECTagName.EC_TAG_PARTFILE_CAT, categoryId)]));
	}
}
