/**
 * Download Queue Response - Parse download queue
 */

import { Packet } from '../ec/packet/Packet';
import { ECTagName } from '../ec/Codes';
import { findNumericTag, findTag } from '../ec/tag/Tag';
import type { AmuleTransferringFile, FileStatus } from '../model';

export interface DownloadQueueResponse {
	files: AmuleTransferringFile[];
}

// Helper to convert bigint to number safely
function toNumber(value: bigint | number | undefined, defaultValue: number = 0): number {
	if (value === undefined) return defaultValue;
	return typeof value === 'bigint' ? Number(value) : value;
}

export class DownloadQueueResponseParser {
	static fromPacket(packet: Packet): DownloadQueueResponse {
		const files: AmuleTransferringFile[] = [];

		// Find all partfile tags
		const partfileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_PARTFILE);

		for (const fileTag of partfileTags) {
			const tags = fileTag.nestedTags || [];

			const hashTag = findTag(tags, ECTagName.EC_TAG_PARTFILE_HASH);
			const fileNameTag = findTag(tags, ECTagName.EC_TAG_PARTFILE_NAME);

			const a4afSources: number[] = [];
			const a4afSourcesTag = findTag(tags, ECTagName.EC_TAG_PARTFILE_A4AF_SOURCES);
			if (a4afSourcesTag) {
				a4afSourcesTag.nestedTags = a4afSourcesTag.nestedTags || [];
				for (const sourceTag of a4afSourcesTag.nestedTags) {
					if (sourceTag.name === ECTagName.EC_TAG_ECID) {
						a4afSources.push(sourceTag.getValue());
					}
				}
			}

			// Basic file info
			const file: AmuleTransferringFile = {
				fileHashHexString: hashTag ? hashTag.getValue().toString('hex') : undefined,
				fileName: fileNameTag ? fileNameTag.getValue() : undefined,
				filePath: findTag(tags, ECTagName.EC_TAG_KNOWNFILE_FILENAME)?.getValue(),
				sizeFull: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_FULL)?.getLong()),
				fileEd2kLink: findTag(tags, ECTagName.EC_TAG_PARTFILE_ED2K_LINK)?.getValue(),

				// Transfer info
				partMetID: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_PARTMETID)?.getShort(),
				sizeXfer: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_XFER)?.getLong()),
				sizeDone: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SIZE_DONE)?.getLong()),
				fileStatus: (findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_STATUS)?.getInt() ?? 0) as FileStatus,
				stopped: (findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_STOPPED)?.getInt() ?? 0) !== 0,
				sourceCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT)?.getShort() ?? 0,
				sourceNotCurrCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_NOT_CURRENT)?.getShort() ?? 0,
				sourceXferCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_XFER)?.getShort() ?? 0,
				sourceCountA4AF: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_A4AF)?.getShort() ?? 0,
				speed: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SPEED)?.getLong()),
				downPrio: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_PRIO)?.getInt() ?? 0,
				fileCat: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_CAT)?.getLong()),
				lastSeenComplete: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_LAST_SEEN_COMP)?.getLong()),
				lastDateChanged: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_LAST_RECV)?.getLong()),
				downloadActiveTime: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_DOWNLOAD_ACTIVE)?.getInt() ?? 0,
				availablePartCount: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_AVAILABLE_PARTS)?.getShort() ?? 0,
				a4AFAuto: (findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_A4AFAUTO)?.getInt() ?? 0) !== 0,
				hashingProgress: (findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_HASHED_PART_COUNT)?.getInt() ?? 0) !== 0,

				// Statistics
				getLostDueToCorruption: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_LOST_CORRUPTION)?.getLong()),
				getGainDueToCompression: toNumber(findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_GAINED_COMPRESSION)?.getLong()),
				totalPacketsSavedDueToICH: findNumericTag(tags, ECTagName.EC_TAG_PARTFILE_SAVED_ICH)?.getInt() ?? 0,

				// Known file shared info (defaults)
				upPrio: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_PRIO)?.getInt() ?? 0,
				getRequests: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_REQ_COUNT)?.getShort() ?? 0,
				getAllRequests: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_REQ_COUNT_ALL)?.getInt() ?? 0,
				getAccepts: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ACCEPT_COUNT)?.getShort() ?? 0,
				getAllAccepts: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ACCEPT_COUNT_ALL)?.getInt() ?? 0,
				getXferred: toNumber(findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_XFERRED)?.getLong()),
				getAllXferred: toNumber(findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_XFERRED_ALL)?.getLong()),
				getCompleteSourcesLow: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES_LOW)?.getShort() ?? 0,
				getCompleteSourcesHigh: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES_HIGH)?.getShort() ?? 0,
				getCompleteSources: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES)?.getShort() ?? 0,
				getOnQueue: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_ON_QUEUE)?.getShort() ?? 0,
				getComment: findTag(tags, ECTagName.EC_TAG_KNOWNFILE_COMMENT)?.getValue(),
				getRating: findNumericTag(tags, ECTagName.EC_TAG_KNOWNFILE_RATING)?.getInt(),
				a4afSources,
			};

			files.push(file);
		}

		return { files };
	}
}
