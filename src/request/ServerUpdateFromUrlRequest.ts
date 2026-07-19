import { ECOpCode, ECTagName } from '../ec/Codes';
import { StringTag } from '../ec/tag/Tag';
import { Request } from './Request';

export class ServerUpdateFromUrlRequest extends Request {
	constructor(url: string) {
		super(ECOpCode.EC_OP_SERVER_UPDATE_FROM_URL);
		this.addTag(new StringTag(ECTagName.EC_TAG_SERVERS_UPDATE_URL, url));
	}
}
