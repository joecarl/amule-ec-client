/**
 * Stats Response - Server statistics
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import type { ConnectionState } from '../types';
import { tagOwnNumericValue } from './utils';

export interface StatsResponse {
	id: number;
	ed2kId: number;
	kadId?: string;
	connectedServer?: {
		name?: string;
		description?: string;
		ip: string;
		port: number;
	};
	connectionState?: ConnectionState;
	uploadOverhead: number;
	downloadOverhead: number;
	bannedCount: number;
	loggerMessage: string[];
	totalSentBytes: number;
	totalReceivedBytes: number;
	sharedFileCount: number;
	uploadSpeed: number;
	downloadSpeed: number;
	uploadSpeedLimit: number;
	downloadSpeedLimit: number;
	uploadQueueLength: number;
	totalSourceCount: number;
	ed2kUsers: number;
	kadUsers: number;
	ed2kFiles: number;
	kadFiles: number;
	kadNodes: number;
}

// EC_TAG_CONNSTATE value bits, see CEC_ConnState_Tag in aMule's ECSpecialTags.h
const CONNSTATE_ED2K_CONNECTED = 0x01;
const CONNSTATE_ED2K_CONNECTING = 0x02;
const CONNSTATE_KAD_CONNECTED = 0x04;
const CONNSTATE_KAD_FIREWALLED = 0x08;
const CONNSTATE_KAD_RUNNING = 0x10;

export class StatsResponseParser {
	static fromPacket(packet: Packet): StatsResponse {
		// Extract common stats
		const uploadOverhead = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_UP_OVERHEAD)?.getValue() || 0;
		const downloadOverhead = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_DOWN_OVERHEAD)?.getValue() || 0;
		const bannedCount = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_BANNED_COUNT)?.getValue() || 0;

		const totalSentBytes = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_TOTAL_SENT_BYTES)?.getValue() || 0;
		const totalReceivedBytes = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_TOTAL_RECEIVED_BYTES)?.getValue() || 0;
		const sharedFileCount = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_SHARED_FILE_COUNT)?.getValue() || 0;

		const uploadSpeed = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_UL_SPEED)?.getValue() || 0;
		const downloadSpeed = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_DL_SPEED)?.getValue() || 0;
		const uploadSpeedLimit = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_UL_SPEED_LIMIT)?.getValue() || 0;
		const downloadSpeedLimit = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_DL_SPEED_LIMIT)?.getValue() || 0;

		const uploadQueueLength = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_UL_QUEUE_LEN)?.getValue() || 0;
		const totalSourceCount = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_TOTAL_SRC_COUNT)?.getValue() || 0;
		const ed2kUsers = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_ED2K_USERS)?.getValue() || 0;
		const kadUsers = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_KAD_USERS)?.getValue() || 0;
		const ed2kFiles = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_ED2K_FILES)?.getValue() || 0;
		const kadFiles = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_KAD_FILES)?.getValue() || 0;

		const kadNodes = findNumericTag(packet.tags, ECTagName.EC_TAG_STATS_KAD_NODES)?.getValue() || 0;

		// Connection State & Server Info
		const connStateTag = findTag(packet.tags, ECTagName.EC_TAG_CONNSTATE);
		let ed2kId = 0;
		let clientId = 0;
		let kadId: string | undefined;
		let connectedServer: StatsResponse['connectedServer'];
		let connectionState: ConnectionState | undefined;

		if (connStateTag && connStateTag.nestedTags) {
			ed2kId = Number(findNumericTag(connStateTag.nestedTags, ECTagName.EC_TAG_ED2K_ID)?.getValue() || 0);
			clientId = Number(findNumericTag(connStateTag.nestedTags, ECTagName.EC_TAG_CLIENT_ID)?.getValue() || 0);

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

			const stateBits = tagOwnNumericValue(connStateTag) ?? 0;
			connectionState = {
				ed2kConnected: (stateBits & CONNSTATE_ED2K_CONNECTED) !== 0,
				ed2kConnecting: (stateBits & CONNSTATE_ED2K_CONNECTING) !== 0,
				kadConnected: (stateBits & CONNSTATE_KAD_CONNECTED) !== 0,
				kadFirewalled: (stateBits & CONNSTATE_KAD_FIREWALLED) !== 0,
				kadRunning: (stateBits & CONNSTATE_KAD_RUNNING) !== 0,
				ed2kId: ed2kId || undefined,
				clientId: clientId || undefined,
				serverIpv4: connectedServer ? { address: connectedServer.ip, port: connectedServer.port } : undefined,
				serverName: connectedServer?.name,
				serverDescription: connectedServer?.description,
			};
		}

		// Fallback for ID if not in connState
		const id = clientId || Number(findNumericTag(packet.tags, ECTagName.EC_TAG_CLIENT_ID)?.getValue() || 0);

		// Logger messages (if any)
		const loggerMessage: string[] = [];
		// TODO: Parse logger messages from nested tags if present

		return {
			id: Number(id),
			ed2kId,
			kadId,
			connectedServer,
			connectionState,
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
