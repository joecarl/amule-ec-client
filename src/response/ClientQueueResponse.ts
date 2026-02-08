/**
 * Client Queue Response - Parse client upload queue
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import { formatIp } from './utils';
import { AmuleUpDownClient } from '../model';

export interface ClientQueueResponse {
	clients: AmuleUpDownClient[];
}

// Helper to convert bigint to number safely
function toNumber(value: bigint | number | undefined, defaultValue: number = 0): number {
	if (value === undefined) return defaultValue;
	return typeof value === 'bigint' ? Number(value) : value;
}

export class ClientQueueResponseParser {
	static fromPacket(packet: Packet): ClientQueueResponse {
		const clients: AmuleUpDownClient[] = [];

		// Find all client tags
		const clientTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_CLIENT);

		for (const clientTag of clientTags) {
			const tags = clientTag.nestedTags || [];

			const client: AmuleUpDownClient = {
				userHashHexString: findTag(tags, ECTagName.EC_TAG_CLIENT_HASH)?.getValue().toString('hex'),
				userID: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_USER_ID)?.getInt(),

				clientName: findTag(tags, ECTagName.EC_TAG_CLIENT_NAME)?.getValue(),
				speedUp: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UP_SPEED)?.getLong()),
				speedDown: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_DOWN_SPEED)?.getLong()),

				xferUp: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_TOTAL)?.getLong()),
				xferDown: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_DOWNLOAD_TOTAL)?.getLong()),
				xferUpSession: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_SESSION)?.getLong()),
				xferDownSession: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_XFER)?.getLong()),

				friendSlot: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_FRIEND_SLOT)?.getInt() !== 0,

				clientSoftware: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_SOFTWARE)?.getInt(),
				softVerStr: findTag(tags, ECTagName.EC_TAG_CLIENT_SOFT_VER_STR)?.getValue(),

				clientUploadState: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_STATE)?.getInt(),
				clientDownloadState: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_DOWNLOAD_STATE)?.getInt(),

				getSourceFrom: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_FROM)?.getInt(),

				userIP: formatIp(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_USER_IP)?.getInt()),
				userPort: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_USER_PORT)?.getInt(),
				serverIP: formatIp(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_SERVER_IP)?.getInt()),
				serverPort: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_SERVER_PORT)?.getInt(),
				serverName: findTag(tags, ECTagName.EC_TAG_CLIENT_SERVER_NAME)?.getValue(),
				kadPort: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_KAD_PORT)?.getInt(),

				score: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_SCORE)?.getInt(),
				waitingPosition: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_WAITING_POSITION)?.getInt(),
				remoteQueueRank: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_REMOTE_QUEUE_RANK)?.getInt(),
				oldRemoteQueueRank: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_OLD_REMOTE_QUEUE_RANK)?.getInt(),

				identState: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_IDENT_STATE)?.getInt(),
				obfuscationStatus: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_OBFUSCATION_STATUS)?.getInt(),
				hasExtendedProtocol: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_EXT_PROTOCOL)?.getInt() !== 0,
				nextRequestedPart: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_NEXT_REQUESTED_PART)?.getInt(),
				lastDownloadingPart: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_LAST_DOWNLOADING_PART)?.getInt(),

				uploadFileID: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_FILE)?.getInt(),
				requestFileID: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_REQUEST_FILE)?.getInt(),
				remoteFilename: findTag(tags, ECTagName.EC_TAG_CLIENT_REMOTE_FILENAME)?.getValue(),
				disableViewShared: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_DISABLE_VIEW_SHARED)?.getInt() !== 0,
				version: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_VERSION)?.getInt(),
				modVersion: findTag(tags, ECTagName.EC_TAG_CLIENT_MOD_VERSION)?.getValue(),
				osInfo: findTag(tags, ECTagName.EC_TAG_CLIENT_OS_INFO)?.getValue(),
				availableParts: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_AVAILABLE_PARTS)?.getInt(),
			};

			clients.push(client);
		}

		return { clients };
	}
}
