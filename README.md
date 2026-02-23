# aMule EC Client for TypeScript

[![npm version](https://img.shields.io/npm/v/amule-ec-client.svg)](https://www.npmjs.com/package/amule-ec-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript client library for interacting with aMule's External Connection (EC) protocol.

Ported from [jamule](https://github.com/vexdev/jamule) (Java/Kotlin) to TypeScript.

## Features

- ✅ Full EC protocol implementation (v0x0204)
- ✅ Authentication and connection management
- ✅ Server statistics
- ✅ File searching (local, global, Kad, web)
- ✅ Download management
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

#### Methods

**Connection**

- `reconnect(): Promise<void>` - Reconnect to server

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
- `getDownloadQueue(): Promise<AmuleTransferringFile[]>` - Get download queue

**Shared Files**

- `getSharedFiles(): Promise<AmuleFile[]>` - Get shared files

## Protocol Details

This library implements the aMule External Connection protocol version 0x0204, compatible with:

- aMule 2.3.1
- aMule 2.3.2
- aMule 2.3.3

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
