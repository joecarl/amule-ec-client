/**
 * Part File Priority Request - Change the priority of a download
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { Hash16Tag, UByteTag } from '../ec/tag/Tag';
import type { FilePriority } from '../model';

export class PartFilePriorityRequest extends Request {
	constructor(hash: Buffer, priority: FilePriority) {
		super(ECOpCode.EC_OP_PARTFILE_PRIO_SET);

		// The daemon reads the priority from the hash tag's first child
		this.addTag(new Hash16Tag(ECTagName.EC_TAG_PARTFILE, hash, [new UByteTag(ECTagName.EC_TAG_PARTFILE_PRIO, priority)]));
	}
}
