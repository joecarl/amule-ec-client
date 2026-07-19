# aMule EC Client for TypeScript

[![npm version](https://img.shields.io/npm/v/amule-ec-client.svg)](https://www.npmjs.com/package/amule-ec-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript client library for interacting with aMule's External Connection (EC) protocol.

This project started as a port from [jamule](https://github.com/vexdev/jamule) (Java/Kotlin) to TypeScript. But as of the date this readme was last updated, this project covers wider functionality.

## Features

- ✅ Full EC protocol implementation (v0x0204)
- ✅ Authentication and connection management
- ✅ Server statistics
- ✅ File searching (local, global, Kad, web)
- ✅ Download management
- ✅ Per-peer source details for active downloads (via incremental updates)
- ✅ Shared files listing
- ✅ Category management
- ✅ ED2K link parsing

## Installation

```bash
npm install amule-ec-client
```

## Usage

```typescript
import { AmuleClient, SearchType } from 'amule-ec-client';

// Create client
const client = new AmuleClient({
	host: 'localhost',
	port: 4712,
	password: 'your-password',
	timeout: 10000, // optional, in milliseconds
});

// Get server stats
const stats = await client.getStats();
console.log(`Download speed: ${stats.downloadSpeed} bytes/s`);
console.log(`Upload speed: ${stats.uploadSpeed} bytes/s`);

// Perform a search
const results = await client.searchSync('ubuntu', SearchType.GLOBAL);
console.log(`Found ${results.files.length} files`);

for (const file of results.files) {
	console.log(`${file.fileName} (${file.sizeFull} bytes)`);

	// Download a file
	if (file.sourceCount > 5) {
		await client.downloadSearchResult(file.hash);
	}
}

// Get download queue
const queue = await client.getDownloadQueue();
console.log(`${queue.length} files downloading`);
```

## API

### AmuleClient

#### Constructor

```typescript
new AmuleClient(options: AmuleClientOptions)
```

Options:

- `host`: aMule server hostname
- `port`: EC port (default: 4712)
- `password`: EC password
- `timeout`: Connection timeout in ms (optional)
- `requestTimeout`: Per-request response timeout in ms (optional, `0` disables)

#### Methods

**Connection**

- `reconnect(): Promise<void>` - Reconnect to server
- `setRequestTimeout(timeoutMs: number): void` - Set default timeout for request responses
- `getRequestTimeout(): number` - Get current default request timeout

**Statistics**

- `getStats(): Promise<StatsResponse>` - Get server statistics

**Search**

- `searchAsync(query, searchType?, filters?): Promise<string>` - Start async search
- `searchStatus(): Promise<number>` - Get search progress (0-1)
- `searchResults(): Promise<SearchResultsResponse>` - Get search results
- `searchSync(query, searchType?, filters?, timeout?): Promise<SearchResultsResponse>` - Synchronous search
- `searchStop(): Promise<void>` - Stop current search

**Downloads**

- `downloadSearchResult(hash, category?): Promise<void>` - Download from search results
- `getDownloadQueue(): Promise<AmuleTransferringFile[]>` - Get download queue (chunk info and source name buckets, but no per-peer details)
- `getDownloadQueueWithSources(): Promise<AmuleTransferringFile[]>` - Get download queue with `sources` filled with the connected peers of each download (name, IP, software, speeds, queue rank, ...)
- `getUpdate(): Promise<UpdateResponse>` - Incremental update snapshot: downloads (with `sources`), shared files and clients. The daemon sends per-connection diffs; the client merges them internally, so every call returns full objects

> **Note:** aMule only exposes per-peer info through the incremental update mechanism (`EC_OP_GET_UPDATE`), never nested inside `EC_OP_GET_DLOAD_QUEUE` responses. Peers are linked to downloads through `client.requestFileId === file.ecid`. The internal cache is per connection and resets automatically on reconnect.
>
> `sourceNames` (the filenames under which the sources share each file) is also sent by the daemon as a per-connection incremental map — even for full-detail `getDownloadQueue()` requests. `getDownloadQueue()` therefore returns complete name buckets only on the first call of a connection; the update-based methods merge the diffs and are always complete.

**Shared Files**

- `getSharedFiles(): Promise<AmuleFile[]>` - Get shared files

## Protocol Details

This library implements the aMule External Connection protocol version 0x0204, compatible with:

- aMule 2.3.1
- aMule 2.3.2
- aMule 2.3.3
- aMule 3.0.0
- aMule 3.0.1

### Protocol Features

- ZLIB compression support
- Binary packet format with tagged data structures

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

## Credits

- Original Java/Kotlin implementation: [jamule](https://github.com/vexdev/jamule) by [vexdev](https://github.com/vexdev)

## License

MIT License
