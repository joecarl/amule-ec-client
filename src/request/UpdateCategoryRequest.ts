/**
 * Update Category Request - Update an existing category
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { StringTag, UByteTag, UIntTag } from '../ec/tag/Tag';
import type { AmuleCategory } from '../model';

export class UpdateCategoryRequest extends Request {
	constructor(id: number, category: AmuleCategory) {
		super(ECOpCode.EC_OP_UPDATE_CATEGORY);

		const subtags = [
			new StringTag(ECTagName.EC_TAG_CATEGORY_TITLE, category.name),
			new StringTag(ECTagName.EC_TAG_CATEGORY_PATH, category.path),
			new StringTag(ECTagName.EC_TAG_CATEGORY_COMMENT, category.comment),
			new UByteTag(ECTagName.EC_TAG_CATEGORY_COLOR, category.color),
			new UIntTag(ECTagName.EC_TAG_CATEGORY_PRIO, category.priority),
		];

		// Category tag is a container for all category properties
		this.addTag(new UIntTag(ECTagName.EC_TAG_CATEGORY, id, subtags));
	}
}
