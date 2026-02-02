// Model types and interfaces

export interface AmuleFile {
	fileHashHexString?: string;
	fileName?: string;
	filePath?: string;
	sizeFull?: number;
	fileEd2kLink?: string;
	upPrio: number;
	getRequests: number;
	getAllRequests: number;
	getAccepts: number;
	getAllAccepts: number;
	getXferred: number;
	getAllXferred: number;
	getCompleteSourcesLow: number;
	getCompleteSourcesHigh: number;
	getCompleteSources: number;
	getOnQueue: number;
	getComment?: string;
	getRating?: number;
}

export interface AmuleTransferringFile extends AmuleFile {
	partMetID?: number;
	sizeXfer?: number;
	sizeDone?: number;
	fileStatus: FileStatus;
	stopped: boolean;
	sourceCount: number;
	sourceNotCurrCount: number;
	sourceXferCount: number;
	sourceCountA4AF: number;
	speed?: number;
	downPrio: number;
	fileCat: number;
	lastSeenComplete: number;
	lastDateChanged: number;
	downloadActiveTime: number;
	availablePartCount: number;
	a4AFAuto: boolean;
	hashingProgress: boolean;
	getLostDueToCorruption: number;
	getGainDueToCompression: number;
	totalPacketsSavedDueToICH: number;
}

export interface AmuleCategory {
	id: number;
	name: string;
	path: string;
	comment: string;
	color: number;
	priority: number;
}

export interface AmuleServer {
	name?: string;
	description?: string;
	address?: string; // String representation usually
	ip: string;
	port: number;
	ping?: number;
	users?: number;
	maxUsers?: number;
	files?: number;
	priority: number;
	version?: string;
	isStatic: boolean;
	failedCount: number;
}

export enum FileStatus {
	READY = 0,
	EMPTY = 1,
	WAITINGFORHASH = 2,
	HASHING = 3,
	ERROR = 4,
	INSUFFICIENT = 5,
	UNKNOWN = 6,
	PAUSED = 7,
	COMPLETING = 8,
	COMPLETE = 9,
	ALLOCATING = 10,
}

export enum DownloadCommand {
	SWAP_A4AF_THIS = 0x16,
	SWAP_A4AF_THIS_AUTO = 0x17,
	SWAP_A4AF_OTHERS = 0x18,
	PAUSE = 0x19,
	RESUME = 0x1a,
	STOP = 0x1b,
	DELETE = 0x1d,
}

export enum SearchType {
	GLOBAL = 1,
	KAD = 2,
	LOCAL = 0,
	WEB = 3,
}
