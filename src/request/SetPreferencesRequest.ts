import { ECOpCode, ECTagName } from '../ec/Codes';
import { StringTag, UByteTag, UShortTag, UIntTag, type Tag } from '../ec/tag/Tag';
import type { AmulePreferences } from '../types/preferences';
import { Request } from './Request';

export class SetPreferencesRequest extends Request {
	constructor(prefs: Partial<AmulePreferences>) {
		super(ECOpCode.EC_OP_SET_PREFERENCES);
		this.tags.push(...SetPreferencesRequest.buildTopLevelTags(prefs));
	}

	private static buildTopLevelTags(prefs: Partial<AmulePreferences>): Tag<any>[] {
		const topTags: Tag<any>[] = [];

		if (prefs.general) {
			const g = prefs.general;
			topTags.push(
				new UByteTag(ECTagName.EC_TAG_PREFS_GENERAL, 0, [
					new StringTag(ECTagName.EC_TAG_USER_NICK, g.userNick),
					new UByteTag(ECTagName.EC_TAG_GENERAL_CHECK_NEW_VERSION, g.checkNewVersion ? 1 : 0),
				])
			);
		}

		if (prefs.connection) {
			const c = prefs.connection;
			topTags.push(
				new UByteTag(ECTagName.EC_TAG_PREFS_CONNECTIONS, 0, [
					new UIntTag(ECTagName.EC_TAG_CONN_UL_CAP, c.uploadCapacity),
					new UIntTag(ECTagName.EC_TAG_CONN_DL_CAP, c.downloadCapacity),
					new UIntTag(ECTagName.EC_TAG_CONN_MAX_UL, c.maxUploadSpeed),
					new UIntTag(ECTagName.EC_TAG_CONN_MAX_DL, c.maxDownloadSpeed),
					new UIntTag(ECTagName.EC_TAG_CONN_SLOT_ALLOCATION, c.slotAllocation),
					new UShortTag(ECTagName.EC_TAG_CONN_TCP_PORT, c.tcpPort),
					new UShortTag(ECTagName.EC_TAG_CONN_UDP_PORT, c.udpPort),
					new UIntTag(ECTagName.EC_TAG_CONN_MAX_FILE_SOURCES, c.maxFileSources),
					new UIntTag(ECTagName.EC_TAG_CONN_MAX_CONN, c.maxConnections),
					new UByteTag(ECTagName.EC_TAG_CONN_AUTOCONNECT, c.autoconnect ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_CONN_RECONNECT, c.reconnect ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_NETWORK_ED2K, c.networkED2K ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_NETWORK_KADEMLIA, c.networkKademlia ? 1 : 0),
				])
			);
		}

		if (prefs.servers) {
			const s = prefs.servers;
			topTags.push(
				new UByteTag(ECTagName.EC_TAG_PREFS_SERVERS, 0, [
					new UByteTag(ECTagName.EC_TAG_SERVERS_REMOVE_DEAD, s.removeDead ? 1 : 0),
					new UShortTag(ECTagName.EC_TAG_SERVERS_DEAD_SERVER_RETRIES, s.deadRetries),
					new UByteTag(ECTagName.EC_TAG_SERVERS_USE_SCORE_SYSTEM, s.useScoreSystem ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_SERVERS_SMART_ID_CHECK, s.smartIdCheck ? 1 : 0),
					new StringTag(ECTagName.EC_TAG_SERVERS_UPDATE_URL, s.updateUrl),
				])
			);
		}

		if (prefs.security) {
			const sec = prefs.security;
			topTags.push(
				new UByteTag(ECTagName.EC_TAG_PREFS_SECURITY, 0, [
					new UByteTag(ECTagName.EC_TAG_SECURITY_CAN_SEE_SHARES, sec.canSeeShares),
					new UByteTag(ECTagName.EC_TAG_IPFILTER_CLIENTS, sec.ipFilterClients ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_IPFILTER_SERVERS, sec.ipFilterServers ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_IPFILTER_AUTO_UPDATE, sec.ipFilterAutoUpdate ? 1 : 0),
					new StringTag(ECTagName.EC_TAG_IPFILTER_UPDATE_URL, sec.ipFilterUpdateUrl),
					new UByteTag(ECTagName.EC_TAG_IPFILTER_LEVEL, sec.ipFilterLevel),
					new UByteTag(ECTagName.EC_TAG_IPFILTER_FILTER_LAN, sec.filterLan ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_SECURITY_USE_SECIDENT, sec.useSecIdent ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_SECURITY_OBFUSCATION_SUPPORTED, sec.obfuscationSupported ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_SECURITY_OBFUSCATION_REQUESTED, sec.obfuscationRequested ? 1 : 0),
					new UByteTag(ECTagName.EC_TAG_SECURITY_OBFUSCATION_REQUIRED, sec.obfuscationRequired ? 1 : 0),
				])
			);
		}

		return topTags;
	}
}
