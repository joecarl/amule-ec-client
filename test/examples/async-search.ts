/**
 * Example: Async search monitoring
 *
 * This example shows how to start an async search and monitor its progress.
 */

import { AmuleClient, SearchType } from '../../src';

async function main() {
	const client = new AmuleClient({
		host: 'localhost',
		port: 4712,
		password: 'secret',
	});

	try {
		console.log('Connecting to ed2k server...');

		await client.connectToServer();

		while (true) {
			await new Promise((r) => setTimeout(r, 1000));
			const stats = await client.getStats();
			if (stats.connectedServer) {
				const srv = stats.connectedServer;
				console.log(`Currently connected to: ${srv.name} (${srv.ip}:${srv.port})`);
				break;
			}
		}

		console.log('Starting async search...');

		// Start the search
		await client.searchAsync('linux', SearchType.GLOBAL);

		// Monitor progress
		let progress = 0;
		while (progress < 1.0) {
			progress = await client.searchStatus();
			console.log(`Search progress: ${(progress * 100).toFixed(0)}%`);

			// Wait a bit before checking again
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		// Get results
		console.log('\nSearch complete! Fetching results...');
		const results = await client.searchResults();

		console.log(`Found ${results.files.length} files`);
		for (const file of results.files.slice(0, 5)) {
			console.log(`- ${file.fileName} (${(file.sizeFull / 1024 / 1024).toFixed(2)} MB)`);
		}

		console.log('First result detailed info:', results.files[0]);

		// Stop the search
		await client.searchStop();
		console.log('Search stopped');
	} catch (error) {
		console.error('Error:', error);
	}
}

main().catch(console.error);
