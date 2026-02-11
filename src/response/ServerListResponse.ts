/**
 * Server List Response - Parse the list of servers
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import { formatIp, toOptionalBool } from './utils';
import type { AmuleServer } from '../model';

export interface ServerListResponse {
	servers: AmuleServer[];
}

export class ServerListResponseParser {
	static fromPacket(packet: Packet): ServerListResponse {
		return this.fromTags(packet.tags);
	}

	static fromTags(allTags: any[]): ServerListResponse {
		const servers: AmuleServer[] = [];

		// Find all server tags
		const serverTags = allTags.filter((tag) => tag.name === ECTagName.EC_TAG_SERVER);

		for (const serverTag of serverTags) {
			const nested = serverTag.nestedTags || [];

			// aMule often sends IP and Port combined in an Ipv4Tag (6 bytes)
			// Or as separate UInt32/UInt16 tags.
			// In many cases, the top-level EC_TAG_SERVER itself IS the Ipv4Tag.
			const ipv4Tag =
				findTag(nested, ECTagName.EC_TAG_SERVER_IP) ||
				findTag(nested, ECTagName.EC_TAG_SERVER_ADDRESS) ||
				(serverTag.constructor.name.includes('Ipv4') ? serverTag : null);

			let ip: string | undefined = undefined;
			let port: number | undefined = undefined;

			if (ipv4Tag && ipv4Tag.getValue() && typeof ipv4Tag.getValue() === 'object' && 'address' in (ipv4Tag.getValue() as any)) {
				const val = ipv4Tag.getValue() as any;
				ip = val.address;
				port = val.port;
			} else {
				// Fallback to separate tags if not combined or if top-level
				const ipNum = findNumericTag(nested, ECTagName.EC_TAG_SERVER_IP)?.getInt() || findNumericTag(allTags, ECTagName.EC_TAG_SERVER_IP)?.getInt();

				port = findNumericTag(nested, ECTagName.EC_TAG_SERVER_PORT)?.getInt() || findNumericTag(allTags, ECTagName.EC_TAG_SERVER_PORT)?.getInt();

				ip = ipNum !== undefined ? formatIp(ipNum) : undefined;
			}

			// Some servers might have port in EC_TAG_SERVER_PORT even if IP is in combined tag
			if (port === undefined || port === 0) {
				const extraPort = findNumericTag(nested, ECTagName.EC_TAG_SERVER_PORT)?.getInt();
				if (extraPort !== undefined) port = extraPort;
			}

			servers.push({
				name: findTag(nested, ECTagName.EC_TAG_SERVER_NAME)?.getValue(),
				description: findTag(nested, ECTagName.EC_TAG_SERVER_DESC)?.getValue(),
				address: findTag(nested, ECTagName.EC_TAG_SERVER_ADDRESS)?.getValue(),
				ip: ip,
				port: port,
				ping: findNumericTag(nested, ECTagName.EC_TAG_SERVER_PING)?.getInt(),
				users: findNumericTag(nested, ECTagName.EC_TAG_SERVER_USERS)?.getInt(),
				maxUsers: findNumericTag(nested, ECTagName.EC_TAG_SERVER_USERS_MAX)?.getInt(),
				files: findNumericTag(nested, ECTagName.EC_TAG_SERVER_FILES)?.getInt(),
				priority: findNumericTag(nested, ECTagName.EC_TAG_SERVER_PRIO)?.getInt(),
				version: findTag(nested, ECTagName.EC_TAG_SERVER_VERSION)?.getValue(),
				isStatic: toOptionalBool(findNumericTag(nested, ECTagName.EC_TAG_SERVER_STATIC)?.getInt()),
				failedCount: findNumericTag(nested, ECTagName.EC_TAG_SERVER_FAILED)?.getInt(),
			});
		}

		return { servers };
	}
}
