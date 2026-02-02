/**
 * Download Command Request - Send commands to files in download queue
 * Commands: PAUSE, RESUME, STOP, DELETE, SWAP_A4AF_THIS, etc.
 */

import { Request } from './Request';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { Hash16Tag } from '../ec/tag/Tag';
import { DownloadCommand } from '../model';

export class DownloadCommandRequest extends Request {
	constructor(hash: Buffer, command: DownloadCommand) {
		// The command IS the opcode
		super(DownloadCommandRequest.commandToOpCode(command));

		this.addTag(new Hash16Tag(ECTagName.EC_TAG_PARTFILE, hash));
	}

	private static commandToOpCode(command: DownloadCommand): ECOpCode {
		switch (command) {
			case DownloadCommand.SWAP_A4AF_THIS:
				return ECOpCode.EC_OP_PARTFILE_SWAP_A4AF_THIS;
			case DownloadCommand.SWAP_A4AF_THIS_AUTO:
				return ECOpCode.EC_OP_PARTFILE_SWAP_A4AF_THIS_AUTO;
			case DownloadCommand.SWAP_A4AF_OTHERS:
				return ECOpCode.EC_OP_PARTFILE_SWAP_A4AF_OTHERS;
			case DownloadCommand.PAUSE:
				return ECOpCode.EC_OP_PARTFILE_PAUSE;
			case DownloadCommand.RESUME:
				return ECOpCode.EC_OP_PARTFILE_RESUME;
			case DownloadCommand.STOP:
				return ECOpCode.EC_OP_PARTFILE_STOP;
			case DownloadCommand.DELETE:
				return ECOpCode.EC_OP_PARTFILE_DELETE;
			default:
				throw new Error(`Unknown download command: ${command}`);
		}
	}
}
