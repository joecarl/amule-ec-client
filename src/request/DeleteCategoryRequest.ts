/**
 * Delete Category Request - Delete an existing category
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { UIntTag } from '../ec/tag/Tag';

export class DeleteCategoryRequest extends Request {
	constructor(id: number) {
		super(ECOpCode.EC_OP_DELETE_CATEGORY);

		this.addTag(new UIntTag(ECTagName.EC_TAG_CATEGORY, id));
	}
}
