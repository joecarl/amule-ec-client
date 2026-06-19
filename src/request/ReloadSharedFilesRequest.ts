/**
 * Reload Shared Files Request - Reload shared files list
 */

import { Request } from './Request';
import { ECOpCode } from '../ec/Codes';

export class ReloadSharedFilesRequest extends Request {
	constructor() {
		super(ECOpCode.EC_OP_SHAREDFILES_RELOAD);
	}
}
