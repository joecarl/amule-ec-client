/**
 * Add Link Request - Download from ED2K link
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { StringTag } from '../ec/tag/Tag';

export class AddLinkRequest extends Request {
	constructor(link: string) {
		super(ECOpCode.EC_OP_ADD_LINK);

		this.addTag(new StringTag(ECTagName.EC_TAG_PARTFILE_ED2K_LINK, link));
	}
}
