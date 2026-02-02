/**
 * Stats Response - Server statistics
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import type { StatsResponse } from '../client/AmuleClient';

export class StatsResponseParser {
	static fromPacket(packet: Packet): StatsResponse {
		// Extract common stats
		const uploadOverhead = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_UL_SPEED_OVERHEAD)?.value || 0;
		const downloadOverhead = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_DL_SPEED_OVERHEAD)?.value || 0;
		const bannedCount = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_BANNED_COUNT)?.value || 0;

		const totalSentBytes = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_TOTAL_SENT_BYTES)?.value || 0;
		const totalReceivedBytes = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_TOTAL_RECEIVED_BYTES)?.value || 0;
		const sharedFileCount = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_SHARED_FILE_COUNT)?.value || 0;

		const uploadSpeed = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_UL_SPEED)?.value || 0;
		const downloadSpeed = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_DL_SPEED)?.value || 0;
		const uploadSpeedLimit = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_UL_SPEED_LIMIT)?.value || 0;
		const downloadSpeedLimit = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_DL_SPEED_LIMIT)?.value || 0;

		const uploadQueueLength = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_UL_QUEUE_LEN)?.value || 0;
		const totalSourceCount = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_TOTAL_SRC_COUNT)?.value || 0;

		const ed2kUsers = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_ED2K_USERS)?.value || 0;
		const kadUsers = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_KAD_USERS)?.value || 0;
		const ed2kFiles = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_ED2K_FILES)?.value || 0;
		const kadFiles = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_KAD_FILES)?.value || 0;

		const kadNodes = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_KAD_NODES_TOTAL)?.value || 0;

		// Connection State & Server Info
		const connStateTag = findTag(packet.tags, ECTagName.EC_TAG_CONNSTATE);
		let ed2kId = 0;
		let clientId = 0;
		let kadId: string | undefined;
		let connectedServer: StatsResponse['connectedServer'];

		if (connStateTag && connStateTag.nestedTags) {
			ed2kId = Number(findNumericTag(connStateTag.nestedTags, ECTagName.EC_TAG_ED2K_ID)?.value || 0);
			clientId = Number(findNumericTag(connStateTag.nestedTags, ECTagName.EC_TAG_CLIENT_ID)?.value || 0);

			const kadIdTag = findTag(connStateTag.nestedTags, ECTagName.EC_TAG_KAD_ID);
			if (kadIdTag && kadIdTag.getValue() !== undefined) {
				const val = kadIdTag.getValue();
				if (typeof val === 'bigint') {
					kadId = val.toString(16).padStart(32, '0');
				} else if (val instanceof Buffer) {
					kadId = val.toString('hex');
				}
			}

			const serverTag = findTag(connStateTag.nestedTags, ECTagName.EC_TAG_SERVER);
			if (serverTag) {
				const serverVal = serverTag.getValue() as any;
				if (serverVal && typeof serverVal === 'object' && 'address' in serverVal) {
					connectedServer = {
						ip: serverVal.address,
						port: serverVal.port,
						name: findTag(serverTag.nestedTags || [], ECTagName.EC_TAG_SERVER_NAME)?.getValue(),
						description: findTag(serverTag.nestedTags || [], ECTagName.EC_TAG_SERVER_DESC)?.getValue(),
					};
				}
			}
		}

		// Fallback for ID if not in connState
		const id = clientId || findNumericTag(packet.tags, ECTagName.EC_TAG_CLIENT_ID)?.value || 0;

		// Logger messages (if any)
		const loggerMessage: string[] = [];
		// TODO: Parse logger messages from nested tags if present

		return {
			id: Number(id),
			ed2kId,
			kadId,
			connectedServer,
			uploadOverhead: Number(uploadOverhead),
			downloadOverhead: Number(downloadOverhead),
			bannedCount: Number(bannedCount),
			loggerMessage,
			totalSentBytes: Number(totalSentBytes),
			totalReceivedBytes: Number(totalReceivedBytes),
			sharedFileCount: Number(sharedFileCount),
			uploadSpeed: Number(uploadSpeed),
			downloadSpeed: Number(downloadSpeed),
			uploadSpeedLimit: Number(uploadSpeedLimit),
			downloadSpeedLimit: Number(downloadSpeedLimit),
			uploadQueueLength: Number(uploadQueueLength),
			totalSourceCount: Number(totalSourceCount),
			ed2kUsers: Number(ed2kUsers),
			kadUsers: Number(kadUsers),
			ed2kFiles: Number(ed2kFiles),
			kadFiles: Number(kadFiles),
			kadNodes: Number(kadNodes),
		};
	}
}
