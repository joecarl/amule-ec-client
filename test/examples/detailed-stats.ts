/**
 * Example: Detailed stats
 *
 * This example demonstrates how to fetch and display detailed statistics from aMule.
 */

import { AmuleClient } from '../../src/client/AmuleClient';

async function main() {
	const client = new AmuleClient({
		host: 'localhost',
		port: 4712,
		password: 'secret',
	});

	try {
		console.log('Connecting to aMule...');
		await client.reconnect();

		console.log('Fetching detailed stats...');
		const stats = await client.getStats();

		console.log('--- DETAILED STATS ---');
		console.log(`Global ID (Stats): ${stats.id}`);
		console.log(`ED2K ID: ${stats.ed2kId}`);
		console.log(`Kad ID: ${stats.kadId || 'N/A'}`);

		if (stats.connectedServer) {
			console.log('--- CONNECTED SERVER ---');
			console.log(`Name: ${stats.connectedServer.name || 'Unknown'}`);
			console.log(`IP: ${stats.connectedServer.ip}`);
			console.log(`Port: ${stats.connectedServer.port}`);
		} else {
			console.log('Not connected to any server.');
		}

		console.log('--- TRAFFIC ---');
		console.log(`Download: ${stats.downloadSpeed} bytes/s`);
		console.log(`Upload: ${stats.uploadSpeed} bytes/s`);
		console.log(`Shared Files: ${stats.sharedFileCount}`);
	} catch (error) {
		console.error('Error:', error);
	} finally {
		process.exit();
	}
}

main();
