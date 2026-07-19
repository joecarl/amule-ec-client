import { ECOpCode, ECTagName } from '../ec/Codes';
import { Hash16Tag, UIntTag } from '../ec/tag/Tag';
import { Request } from './Request';

export class SharedFilePriorityRequest extends Request {
	constructor(hash: Buffer, priority: number) {
		super(ECOpCode.EC_OP_SHARED_SET_PRIO);
		this.addTag(new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash));
		this.addTag(new UIntTag(ECTagName.EC_TAG_KNOWNFILE_PRIO, priority));
	}
}
