/**
 * Download File Request - Download a file from search results
 *
 * This request downloads a file that was found in search results.
 * It uses the file hash to identify the file to download.
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { Hash16Tag } from '../ec/tag/Tag';

export class DownloadFileRequest extends Request {
	constructor(hash: Buffer) {
		super(ECOpCode.EC_OP_DOWNLOAD_SEARCH_RESULT);

		// Only send the hash - same as jamule DownloadSearchResultRequest
		this.addTag(new Hash16Tag(ECTagName.EC_TAG_PARTFILE, hash));
	}
}
