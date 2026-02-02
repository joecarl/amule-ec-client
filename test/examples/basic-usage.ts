/**
 * Example: Basic usage of aMule EC Client
 *
 * This example demonstrates how to connect to aMule and perform basic operations.
 */

import { AmuleClient, SearchType } from '../../src';

async function main() {
	// Create the client
	const client = new AmuleClient({
		host: 'localhost',
		port: 4712,
		password: 'secret',
		timeout: 10000,
	});

	try {
		// Connect and authenticate (done automatically on first request)
		console.log('Connecting to aMule...');

		// Get server statistics
		const stats = await client.getStats();
		console.log('\n=== Server Statistics ===');
		console.log(`Download speed: ${(stats.downloadSpeed / 1024).toFixed(2)} KB/s`);
		console.log(`Upload speed: ${(stats.uploadSpeed / 1024).toFixed(2)} KB/s`);
		console.log(`Total sent: ${(stats.totalSentBytes / 1024 / 1024).toFixed(2)} MB`);
		console.log(`Total received: ${(stats.totalReceivedBytes / 1024 / 1024).toFixed(2)} MB`);
		console.log(`Shared files: ${stats.sharedFileCount}`);
		console.log(`ED2K users: ${stats.ed2kUsers}`);
		console.log(`Kad users: ${stats.kadUsers}`);

		// Get download queue
		console.log('\n=== Download Queue ===');
		const queue = await client.getDownloadQueue();
		console.log(`${queue.length} files in queue`);
		console.log('Files:', queue);

		// Get shared files
		console.log('\n=== Shared Files ===');
		const shared = await client.getSharedFiles();
		console.log(`Sharing ${shared.length} files`);

		console.log('\nDone!');
	} catch (error) {
		console.error('Error:', error);
		process.exit(1);
	}
}

// Run the example
main().catch(console.error);
