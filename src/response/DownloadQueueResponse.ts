/**
 * Download Queue Response - Parse download queue
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import type { AmuleTransferringFile, FileStatus } from '../model';
import { parseKnownFileFields } from './SharedFilesResponse';
import { toOptionalBool, toOptionalNumber } from './utils';

export interface DownloadQueueResponse {
	files: AmuleTransferringFile[];
}

export class DownloadQueueResponseParser {
	static fromPacket(packet: Packet): DownloadQueueResponse {
		const files: AmuleTransferringFile[] = [];

		// Find all partfile tags
		const partfileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_PARTFILE);

		for (const fileTag of partfileTags) {
			const tags = fileTag.nestedTags || [];

			let a4afSources: number[] | undefined = undefined; // Will be filled if A4AF sources are present
			const a4afSourcesTag = findTag(tags, ECTagName.EC_TAG_PARTFILE_A4AF_SOURCES);
			if (a4afSourcesTag) {
				a4afSources = [];
				a4afSourcesTag.nestedTags = a4afSourcesTag.nestedTags || [];
				for (const sourceTag of a4afSourcesTag.nestedTags) {
					if (sourceTag.name === ECTagName.EC_TAG_ECID) {
						a4afSources.push(sourceTag.getValue());
					}
				}
			}

			const file: AmuleTransferringFile = {
				// Known file info (shared with EC_TAG_KNOWNFILE)
				...parseKnownFileFields(fileTag),

				// Transfer info
				partMetID: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_PARTMETID)?.getShort(),
				sizeXfer: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_XFER)?.getLong()),
				sizeDone: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_DONE)?.getLong()),
				fileStatus: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_STATUS)?.getInt() as FileStatus | undefined,
				stopped: toOptionalBool(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_STOPPED)?.getInt()),
				sourceCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT)?.getShort(),
				sourceNotCurrCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_NOT_CURRENT)?.getShort(),
				sourceXferCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_XFER)?.getShort(),
				sourceCountA4AF: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_A4AF)?.getShort(),
				speed: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SPEED)?.getLong()),
				downPrio: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_PRIO)?.getInt(),
				fileCat: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_CAT)?.getLong()),
				lastSeenComplete: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_LAST_SEEN_COMP)?.getLong()),
				lastDateChanged: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_LAST_RECV)?.getLong()),
				downloadActiveTime: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_DOWNLOAD_ACTIVE)?.getInt(),
				availablePartCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_AVAILABLE_PARTS)?.getShort(),
				a4AFAuto: toOptionalBool(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_A4AFAUTO)?.getInt()),
				hashedPartCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_HASHED_PART_COUNT)?.getInt(),

				// Statistics
				getLostDueToCorruption: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_LOST_CORRUPTION)?.getLong()),
				getGainDueToCompression: toOptionalNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_GAINED_COMPRESSION)?.getLong()),
				totalPacketsSavedDueToICH: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SAVED_ICH)?.getInt(),

				a4afSources,
			};

			// chunkInfo and sourceNames are not parsed here: both are diffed per connection
			// by the daemon and must be reconstructed statefully (see UpdateState)

			files.push(file);
		}

		return { files };
	}
}
