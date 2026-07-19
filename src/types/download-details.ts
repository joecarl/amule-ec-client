export const PARTSIZE = 9728000;

export const ChunkStatus = {
	UNAVAILABLE: 0,
	AVAILABLE: 1,
	COMPLETE: 2,
	DOWNLOADING: 3,
} as const;

export interface ChunkInfo {
	chunks: number[];
	availability: number[];
	partCount: number;
	sizeFull: number;
}

export interface SourceNameCount {
	name: string;
	count: number;
}

/**
 * Raw diff entry of a partfile's source-names map, as sent by the daemon.
 * `name` is only present when the entry is new for this connection; count 0 removes the entry.
 */
export interface SourceNameEntry {
	id: number;
	name?: string;
	count: number;
}

/**
 * Raw part/gap/req status buffers of a partfile.
 * Depending on the context they hold RLE-encoded wire data or RLE-decoded state.
 */
export interface PartFileStatusBuffers {
	partStatus?: Buffer;
	gapStatus?: Buffer;
	reqStatus?: Buffer;
}
