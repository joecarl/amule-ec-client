import { EcPrefs, ECTagName } from '../ec/Codes';
import { Packet } from '../ec/packet/Packet';
import { findNumericTag, findTag, type Tag } from '../ec/tag/Tag';
import type { AmulePreferences, AmulePrefsConnection, AmulePrefsGeneral, AmulePrefsSecurity, AmulePrefsServers } from '../types/preferences';

export class PreferencesDetailsResponse {
	constructor(public readonly preferences: AmulePreferences) {}
}

function getNestedTag(parent: Tag<any> | undefined, name: ECTagName): Tag<any> | undefined {
	if (!parent?.nestedTags) {
		return undefined;
	}
	return findTag(parent.nestedTags, name);
}

function getNestedNumber(parent: Tag<any> | undefined, name: ECTagName, fallback: number): number {
	if (!parent?.nestedTags) {
		return fallback;
	}

	const numeric = findNumericTag(parent.nestedTags, name);
	if (numeric) {
		return Number(numeric.getValue());
	}

	const tag = findTag(parent.nestedTags, name);
	if (!tag) {
		return fallback;
	}

	const value = tag.getValue();
	if (typeof value === 'number') {
		return value;
	}
	if (typeof value === 'bigint') {
		return Number(value);
	}
	return fallback;
}

function getNestedBool(parent: Tag<any> | undefined, name: ECTagName, fallback: boolean): boolean {
	const tag = getNestedTag(parent, name);
	if (!tag) {
		return fallback;
	}

	const value = tag.getValue();
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'number') {
		return value !== 0;
	}
	if (typeof value === 'bigint') {
		return value !== 0n;
	}
	if (Buffer.isBuffer(value)) {
		return value.length === 0 || value.some((byte) => byte !== 0);
	}

	// For empty/presence tags in EC protocol, presence means true.
	return true;
}

function getNestedString(parent: Tag<any> | undefined, name: ECTagName, fallback: string): string {
	const tag = getNestedTag(parent, name);
	if (!tag) {
		return fallback;
	}

	const value = tag.getValue();
	return typeof value === 'string' ? value : fallback;
}

export class PreferencesDetailsResponseParser {
	static fromPacket(packet: Packet): PreferencesDetailsResponse {
		const generalTag = findTag(packet.tags, ECTagName.EC_TAG_PREFS_GENERAL);
		const connectionTag = findTag(packet.tags, ECTagName.EC_TAG_PREFS_CONNECTIONS);
		const serversTag = findTag(packet.tags, ECTagName.EC_TAG_PREFS_SERVERS);
		const securityTag = findTag(packet.tags, ECTagName.EC_TAG_PREFS_SECURITY);

		const general: AmulePrefsGeneral = {
			userNick: getNestedString(generalTag, ECTagName.EC_TAG_USER_NICK, ''),
			checkNewVersion: getNestedBool(generalTag, ECTagName.EC_TAG_GENERAL_CHECK_NEW_VERSION, false),
		};

		const connection: AmulePrefsConnection = {
			uploadCapacity: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_UL_CAP, 0),
			downloadCapacity: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_DL_CAP, 0),
			maxUploadSpeed: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_MAX_UL, 0),
			maxDownloadSpeed: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_MAX_DL, 0),
			slotAllocation: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_SLOT_ALLOCATION, 2),
			tcpPort: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_TCP_PORT, 4662),
			udpPort: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_UDP_PORT, 4672),
			maxFileSources: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_MAX_FILE_SOURCES, 300),
			maxConnections: getNestedNumber(connectionTag, ECTagName.EC_TAG_CONN_MAX_CONN, 500),
			autoconnect: getNestedBool(connectionTag, ECTagName.EC_TAG_CONN_AUTOCONNECT, false),
			reconnect: getNestedBool(connectionTag, ECTagName.EC_TAG_CONN_RECONNECT, false),
			networkED2K: getNestedBool(connectionTag, ECTagName.EC_TAG_NETWORK_ED2K, true),
			networkKademlia: getNestedBool(connectionTag, ECTagName.EC_TAG_NETWORK_KADEMLIA, false),
		};

		const servers: AmulePrefsServers = {
			removeDead: getNestedBool(serversTag, ECTagName.EC_TAG_SERVERS_REMOVE_DEAD, true),
			deadRetries: getNestedNumber(serversTag, ECTagName.EC_TAG_SERVERS_DEAD_SERVER_RETRIES, 3),
			useScoreSystem: getNestedBool(serversTag, ECTagName.EC_TAG_SERVERS_USE_SCORE_SYSTEM, true),
			smartIdCheck: getNestedBool(serversTag, ECTagName.EC_TAG_SERVERS_SMART_ID_CHECK, true),
			updateUrl: getNestedString(serversTag, ECTagName.EC_TAG_SERVERS_UPDATE_URL, ''),
		};

		const security: AmulePrefsSecurity = {
			canSeeShares: getNestedNumber(securityTag, ECTagName.EC_TAG_SECURITY_CAN_SEE_SHARES, 2),
			ipFilterClients: getNestedBool(securityTag, ECTagName.EC_TAG_IPFILTER_CLIENTS, true),
			ipFilterServers: getNestedBool(securityTag, ECTagName.EC_TAG_IPFILTER_SERVERS, true),
			ipFilterAutoUpdate: getNestedBool(securityTag, ECTagName.EC_TAG_IPFILTER_AUTO_UPDATE, false),
			ipFilterUpdateUrl: getNestedString(securityTag, ECTagName.EC_TAG_IPFILTER_UPDATE_URL, ''),
			ipFilterLevel: getNestedNumber(securityTag, ECTagName.EC_TAG_IPFILTER_LEVEL, 127),
			filterLan: getNestedBool(securityTag, ECTagName.EC_TAG_IPFILTER_FILTER_LAN, true),
			useSecIdent: getNestedBool(securityTag, ECTagName.EC_TAG_SECURITY_USE_SECIDENT, true),
			obfuscationSupported: getNestedBool(securityTag, ECTagName.EC_TAG_SECURITY_OBFUSCATION_SUPPORTED, true),
			obfuscationRequested: getNestedBool(securityTag, ECTagName.EC_TAG_SECURITY_OBFUSCATION_REQUESTED, false),
			obfuscationRequired: getNestedBool(securityTag, ECTagName.EC_TAG_SECURITY_OBFUSCATION_REQUIRED, false),
		};

		return new PreferencesDetailsResponse({ general, connection, servers, security });
	}

	static preferenceMaskForAllSections(): EcPrefs {
		return EcPrefs.EC_PREFS_GENERAL | EcPrefs.EC_PREFS_CONNECTIONS | EcPrefs.EC_PREFS_SERVERS | EcPrefs.EC_PREFS_SECURITY;
	}
}
