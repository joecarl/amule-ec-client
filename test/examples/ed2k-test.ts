/**
 * Example: Ed2k link download test
 *
 * This example tests downloading a file via an ed2k link.
 */

import { AmuleClient } from '../../src/client/AmuleClient';

const client = new AmuleClient({
	host: 'localhost',
	port: 4712,
	password: 'secret',
});

async function main() {
	console.log('Testing ed2k link download...\n');

	try {
		// Get initial download queue
		console.log('1. Getting initial download queue...');
		const initialQueue = await client.getDownloadQueue();
		console.log(`   ✓ Current downloads: ${initialQueue.length}`);

		// Sample ed2k link (small test file)
		// You can replace this with a valid ed2k link
		const ed2kLink = 'ed2k://|file|test_file.txt|1234|1234567890ABCDEF1234567890ABCDEF|/';

		console.log(`\n2. Attempting to download from ed2k link:`);
		console.log(`   Link: ${ed2kLink}`);

		try {
			await client.downloadEd2kLink(ed2kLink);
			console.log('   ✓ Download request sent!');
		} catch (e: any) {
			console.log(`   ! Download failed: ${e.message}`);
		}

		// Wait a moment
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Check download queue
		console.log('\n3. Checking download queue...');
		const newQueue = await client.getDownloadQueue();
		console.log(`   ✓ Download queue: ${newQueue.length} files`);
		if (newQueue.length > 0) {
			newQueue.forEach((file) => {
				console.log(`     - ${file.fileName}`);
			});
		}

		console.log('\n✓ Ed2k link test complete!');
	} catch (error) {
		console.error('Error:', error);
	}
}

main();
