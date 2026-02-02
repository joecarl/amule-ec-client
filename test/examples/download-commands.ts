/**
 * Example: Download commands
 * This example tests the download command functionalities: PAUSE, RESUME, and STOP.
 */

import { AmuleClient } from '../../src/client/AmuleClient';
import { DownloadCommand } from '../../src/model';

const client = new AmuleClient({
	host: 'localhost',
	port: 4712,
	password: 'secret',
});

async function main() {
	console.log('Testing download commands...\n');

	try {
		// Get current download queue
		console.log('1. Getting download queue...');
		const queue = await client.getDownloadQueue();
		console.log(`   ✓ Downloads: ${queue.length}`);

		if (queue.length === 0) {
			console.log('   ! No downloads to test with');
			return;
		}

		// Find a small file to test with
		const testFile = queue.find((f) => (f.sizeFull ?? 0) < 10 * 1024 * 1024) || queue[0];
		console.log(`\n   Using file: ${testFile.fileName}`);
		console.log(`   Size: ${((testFile.sizeFull ?? 0) / 1024 / 1024).toFixed(2)} MB`);
		console.log(`   Hash: ${testFile.fileHashHexString}`);

		if (!testFile.fileHashHexString) {
			console.error('   ! File has no hash, cannot proceed');
			return;
		}

		const hashBuffer = Buffer.from(testFile.fileHashHexString, 'hex');

		// Test PAUSE command
		console.log('\n2. Testing PAUSE command...');
		await client.pauseDownload(hashBuffer);
		console.log('   ✓ Pause command sent!');

		await new Promise((r) => setTimeout(r, 500));

		// Check status
		console.log('\n3. Checking download queue after PAUSE...');
		const queueAfterPause = await client.getDownloadQueue();
		const pausedFile = queueAfterPause.find((f) => f.fileHashHexString === testFile.fileHashHexString);
		if (pausedFile) {
			console.log(`   File status: stopped=${pausedFile.stopped}`);
		}

		// Test RESUME command
		console.log('\n4. Testing RESUME command...');
		await client.resumeDownload(hashBuffer);
		console.log('   ✓ Resume command sent!');

		await new Promise((r) => setTimeout(r, 500));

		// Check status
		console.log('\n5. Checking download queue after RESUME...');
		const queueAfterResume = await client.getDownloadQueue();
		const resumedFile = queueAfterResume.find((f) => f.fileHashHexString === testFile.fileHashHexString);
		if (resumedFile) {
			console.log(`   File status: stopped=${resumedFile.stopped}`);
		}

		// Test STOP command
		console.log('\n6. Testing STOP command...');
		await client.stopDownload(hashBuffer);
		console.log('   ✓ Stop command sent!');

		await new Promise((r) => setTimeout(r, 500));

		// Check status
		console.log('\n7. Checking download queue after STOP...');
		const queueAfterStop = await client.getDownloadQueue();
		const stoppedFile = queueAfterStop.find((f) => f.fileHashHexString === testFile.fileHashHexString);
		if (stoppedFile) {
			console.log(`   File status: stopped=${stoppedFile.stopped}`);
		}

		// Resume again for cleanup
		console.log('\n8. Resuming for cleanup...');
		await client.resumeDownload(hashBuffer);
		console.log('   ✓ Resumed!');

		// Test sendDownloadCommand directly
		console.log('\n9. Testing sendDownloadCommand directly with PAUSE...');
		await client.sendDownloadCommand(hashBuffer, DownloadCommand.PAUSE);
		console.log('   ✓ Direct command sent!');

		// Resume again
		await client.sendDownloadCommand(hashBuffer, DownloadCommand.RESUME);
		console.log('   ✓ Resumed!');

		console.log('\n✓ All download commands work correctly!');
	} catch (error) {
		console.error('Error:', error);
	}
}

main();
