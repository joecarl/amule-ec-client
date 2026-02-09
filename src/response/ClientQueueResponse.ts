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
				clientName: findTag(tags, ECTagName.EC_TAG_CLIENT_NAME)?.getValue(),
				userHashHexString: findTag(tags, ECTagName.EC_TAG_CLIENT_HASH)?.getValue().toString('hex'),
				userID: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_USER_ID)?.getInt(),
				score: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_SCORE)?.getInt(),
				software: findTag(tags, ECTagName.EC_TAG_CLIENT_SOFTWARE)?.getValue(),
				softVerStr: findTag(tags, ECTagName.EC_TAG_CLIENT_SOFT_VER_STR)?.getValue(),
				userIP: formatIp(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_USER_IP)?.getInt()),
				userPort: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_USER_PORT)?.getInt(),
				sourceFrom: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_FROM)?.getLong()),
				serverIP: formatIp(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_SERVER_IP)?.getInt()),
				serverPort: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_SERVER_PORT)?.getInt(),
				serverName: findTag(tags, ECTagName.EC_TAG_CLIENT_SERVER_NAME)?.getValue(),

				upSpeed: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UP_SPEED)?.getLong()),
				downSpeed: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_DOWN_SPEED)?.getLong()),
				uploadSession: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_SESSION)?.getLong()),
				transferredDown: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_XFER)?.getLong()),
				uploadedTotal: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_TOTAL)?.getLong()),
				downloadedTotal: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_DOWNLOAD_TOTAL)?.getLong()),

				uploadState: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_STATE)?.getInt(),
				downloadState: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_DOWNLOAD_STATE)?.getInt(),
				identState: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_IDENT_STATE)?.getInt(),
				extProtocol: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_EXT_PROTOCOL)?.getInt(),
				waitingPosition: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_WAITING_POSITION)?.getInt(),
				remoteQueueRank: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_REMOTE_QUEUE_RANK)?.getInt(),
				oldRemoteQueueRank: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_OLD_REMOTE_QUEUE_RANK)?.getInt(),
				obfuscationStatus: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_OBFUSCATION_STATUS)?.getInt(),
				kadPort: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_KAD_PORT)?.getInt(),
				friendSlot: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_FRIEND_SLOT)?.getInt(),
				uploadFileId: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_FILE)?.getLong()),
				uploadFilename: findTag(tags, ECTagName.EC_TAG_PARTFILE_NAME)?.getValue(),
				requestFileId: toNumber(findNumericTag(tags, ECTagName.EC_TAG_CLIENT_REQUEST_FILE)?.getLong()),
				remoteFilename: findTag(tags, ECTagName.EC_TAG_CLIENT_REMOTE_FILENAME)?.getValue(),
				disableViewShared: !!findNumericTag(tags, ECTagName.EC_TAG_CLIENT_DISABLE_VIEW_SHARED)?.getInt(),
				version: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_VERSION)?.getInt(),
				modVersion: findTag(tags, ECTagName.EC_TAG_CLIENT_MOD_VERSION)?.getValue(),
				osInfo: findTag(tags, ECTagName.EC_TAG_CLIENT_OS_INFO)?.getValue(),
				availableParts: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_AVAILABLE_PARTS)?.getInt(),
				partStatus: findTag(tags, ECTagName.EC_TAG_CLIENT_PART_STATUS)?.getValue(),
				nextRequestedPart: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_NEXT_REQUESTED_PART)?.getInt(),
				lastDownloadingPart: findNumericTag(tags, ECTagName.EC_TAG_CLIENT_LAST_DOWNLOADING_PART)?.getInt(),
				uploadPartStatus: findTag(tags, ECTagName.EC_TAG_CLIENT_UPLOAD_PART_STATUS)?.getValue(),
				// Additional fields can be added here as needed
			};

			clients.push(client);
		}

		return { clients };
	}
}
