/**
 * Update Response - Parse incremental updates
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findTag, findNumericTag } from '../ec/tag/Tag';
import { formatIp } from './utils';
import type { AmuleFile, AmuleTransferringFile, AmuleUpDownClient, AmuleServer, AmuleFriend } from '../model';
import { SharedFilesResponseParser } from './SharedFilesResponse';
import { DownloadQueueResponseParser } from './DownloadQueueResponse';
import { ClientQueueResponseParser } from './ClientQueueResponse';
import { ServerListResponseParser } from './ServerListResponse';

export interface UpdateResponse {
	sharedFiles: AmuleFile[];
	downloadQueue: AmuleTransferringFile[];
	clients: AmuleUpDownClient[];
	servers: AmuleServer[];
	friends: AmuleFriend[];
}

export class UpdateResponseParser {
	static fromPacket(packet: Packet): UpdateResponse {
		// Files are at the root of the packet according to res.cpp
		const sharedFiles = SharedFilesResponseParser.fromPacket(packet).files;
		const downloadQueue = DownloadQueueResponseParser.fromPacket(packet).files;

		// Clients, Servers, and Friends are wrapped in containers with their respective tag names
		const clientContainer = findTag(packet.tags, ECTagName.EC_TAG_CLIENT);
		const clients = clientContainer && clientContainer.nestedTags ? ClientQueueResponseParser.fromTags(clientContainer.nestedTags).clients : [];

		const serverContainer = findTag(packet.tags, ECTagName.EC_TAG_SERVER);
		const servers = serverContainer && serverContainer.nestedTags ? ServerListResponseParser.fromTags(serverContainer.nestedTags).servers : [];

		const friendContainer = findTag(packet.tags, ECTagName.EC_TAG_FRIEND);
		const friends = friendContainer && friendContainer.nestedTags ? this.parseFriends(friendContainer.nestedTags) : [];

		return {
			sharedFiles,
			downloadQueue,
			clients,
			servers,
			friends,
		};
	}

	private static parseFriends(tags: any[]): AmuleFriend[] {
		const friends: AmuleFriend[] = [];
		const friendTags = tags.filter((t) => t.name === ECTagName.EC_TAG_FRIEND);

		for (const friendTag of friendTags) {
			const nested = friendTag.nestedTags || [];
			friends.push({
				name: findTag(nested, ECTagName.EC_TAG_FRIEND_NAME)?.getValue(),
				userHashHexString: findTag(nested, ECTagName.EC_TAG_FRIEND_HASH)?.getValue()?.toString('hex'),
				ip: formatIp(findNumericTag(nested, ECTagName.EC_TAG_FRIEND_IP)?.getInt()),
				port: findNumericTag(nested, ECTagName.EC_TAG_FRIEND_PORT)?.getInt(),
				friendSlot: !!findNumericTag(nested, ECTagName.EC_TAG_FRIEND_FRIENDSLOT)?.getInt(),
				shared: !!findNumericTag(nested, ECTagName.EC_TAG_FRIEND_SHARED)?.getInt(),
				// Friend client information might be nested as a client tag
				client: ClientQueueResponseParser.fromTags(nested).clients[0],
			});
		}
		return friends;
	}
}
