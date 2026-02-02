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

		// Logger messages (if any)
		const loggerMessage: string[] = [];
		// TODO: Parse logger messages from nested tags if present

		return {
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
