/**
 * Preferences Request - Get preferences
 */

import { Request } from './Request';
import { ECDetailLevel, ECOpCode, EcPrefs, ECTagName } from '../ec/Codes';
import { UByteTag, UIntTag } from '../ec/tag/Tag';

export class GetPreferencesRequest extends Request {
	constructor(pref: EcPrefs) {
		super(ECOpCode.EC_OP_GET_PREFERENCES);
		this.addTag(new UByteTag(ECTagName.EC_TAG_DETAIL_LEVEL, ECDetailLevel.EC_DETAIL_FULL));
		this.addTag(new UIntTag(ECTagName.EC_TAG_SELECT_PREFS, pref));
	}
}
