/**
 * Example: Download test
 *
 * This example tests downloading a file found via search.
 */

import { AmuleClient } from '../../src/client/AmuleClient';
import { SearchType } from '../../src/model';

const client = new AmuleClient({
	host: 'localhost',
	port: 4712,
	password: 'secret',
});

async function main() {
	console.log('Testing download functionality...\n');

	try {
		// Get initial stats
		console.log('1. Getting server stats...');
		const stats = await client.getStats();
		console.log(`   ✓ ED2K Users: ${stats.ed2kUsers}`);

		// Get initial download queue
		console.log('\n2. Getting initial download queue...');
		const initialQueue = await client.getDownloadQueue();
		console.log(`   ✓ Current downloads: ${initialQueue.length}`);
		if (initialQueue.length > 0) {
			initialQueue.forEach((file) => {
				const sizeFull = file.sizeFull ?? 0;
				console.log(`     - ${file.fileName} (${(sizeFull / 1024 / 1024).toFixed(2)} MB)`);
			});
		}

		// Search for small file to download
		console.log('\n3. Searching for a small test file...');
		const searchResults = await client.searchSync('test.txt', SearchType.GLOBAL, undefined, 15000);
		console.log(`   ✓ Found ${searchResults.files.length} files`);

		// Find a small file to download (< 1MB)
		const smallFile = searchResults.files.find(
			(f) => f.sizeFull > 1000 && f.sizeFull < 1024 * 1024 // Between 1KB and 1MB
		);

		if (smallFile) {
			console.log(`\n4. Found small file to download:`);
			console.log(`   - Name: ${smallFile.fileName}`);
			console.log(`   - Size: ${(smallFile.sizeFull / 1024).toFixed(2)} KB`);
			console.log(`   - Hash: ${smallFile.hash.toString('hex')}`);
			console.log(`   - Sources: ${smallFile.sourceCount}`);

			console.log('\n5. Attempting to download...');
			await client.downloadSearchResult(smallFile.hash);
			console.log('   ✓ Download request sent!');

			// Wait a moment
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Check download queue
			console.log('\n6. Checking download queue...');
			const newQueue = await client.getDownloadQueue();
			console.log(`   ✓ Download queue: ${newQueue.length} files`);
			if (newQueue.length > 0) {
				newQueue.forEach((file) => {
					console.log(`     - ${file.fileName}`);
				});
			}
		} else {
			console.log('\n   ! No small file found in search results, trying with first result...');

			if (searchResults.files.length > 0) {
				const firstFile = searchResults.files[0];
				console.log(`\n4. Using first file:`);
				console.log(`   - Name: ${firstFile.fileName}`);
				console.log(`   - Size: ${(firstFile.sizeFull / 1024 / 1024).toFixed(2)} MB`);
				console.log(`   - Hash: ${firstFile.hash.toString('hex')}`);

				console.log('\n5. Attempting to download...');
				await client.downloadSearchResult(firstFile.hash);
				console.log('   ✓ Download request sent!');

				await new Promise((resolve) => setTimeout(resolve, 1000));

				console.log('\n6. Checking download queue...');
				const newQueue = await client.getDownloadQueue();
				console.log(`   ✓ Download queue: ${newQueue.length} files`);
			}
		}

		// Stop search
		await client.searchStop();

		console.log('\n✓ Download test complete!');
	} catch (error) {
		console.error('Error:', error);
	}
}

main();
