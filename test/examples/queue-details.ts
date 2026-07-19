/**
 * Example: Queue details + preferences
 *
 * Demonstrates download queue details (chunk info, per-peer sources and
 * source name buckets), the incremental behavior of source names, and a
 * basic preferences read/write flow.
 */

import { AmuleClient } from '../../src/client/AmuleClient';
import type { AmuleTransferringFile } from '../../src/model';

function toMB(bytes: number | undefined): string {
	if (!bytes) return '0.00';
	return (bytes / 1024 / 1024).toFixed(2);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBuckets(file: AmuleTransferringFile): string {
	if (!file.sourceNames || file.sourceNames.length === 0) return '(none)';
	return file.sourceNames.map((x) => `${x.name}:${x.count}`).join(', ');
}

async function main() {
	const client = new AmuleClient({
		host: '127.0.0.1',
		port: 4712,
		password: 'secret',
		timeout: 10000,
	});

	try {
		console.log('1) Reading preferences...');
		const prefs = await client.getPreferences();
		console.log(`   Nick: ${prefs.general.userNick}`);
		console.log(`   Check new version: ${prefs.general.checkNewVersion}`);
		console.log(`   Upload cap: ${prefs.connection.uploadCapacity} KB/s`);
		console.log(`   Download cap: ${prefs.connection.downloadCapacity} KB/s`);
		console.log(`   Server update URL: ${prefs.servers.updateUrl || '(empty)'}`);

		// Reversible write example: toggle checkNewVersion and restore it.
		console.log('\n2) Updating one preference (reversible)...');
		const originalCheck = prefs.general.checkNewVersion;
		await client.setPreferences({
			general: {
				userNick: prefs.general.userNick,
				checkNewVersion: !originalCheck,
			},
		});
		console.log(`   checkNewVersion changed to: ${!originalCheck}`);

		await client.setPreferences({
			general: {
				userNick: prefs.general.userNick,
				checkNewVersion: originalCheck,
			},
		});
		console.log(`   checkNewVersion restored to: ${originalCheck}`);

		console.log('\n3) Fetching download queue with per-peer sources...');
		const queue = await client.getDownloadQueueWithSources();
		console.log(`   Files in queue: ${queue.length}`);

		if (queue.length === 0) {
			console.log('   No downloads currently active.');
			return;
		}

		for (const file of queue) {
			console.log('\n---');
			console.log(`Name: ${file.fileName || '(unknown)'}`);
			console.log(`Hash: ${file.fileHashHexString || '(missing)'}`);
			console.log(`Size: ${toMB(file.sizeFull)} MB`);
			console.log(`Speed: ${file.speed || 0} B/s`);
			console.log(`Sources: ${file.sourceCount || 0}`);

			if (file.chunkInfo) {
				console.log(`Chunk count: ${file.chunkInfo.partCount}`);
				console.log(`Chunk status entries: ${file.chunkInfo.chunks.length}`);
				console.log(`Availability entries: ${file.chunkInfo.availability.length}`);
			} else {
				console.log('Chunk info: not available');
			}

			console.log(`Detailed client sources: ${file.sources?.length || 0}`);
			for (const s of file.sources || []) {
				console.log(`  - ${s.clientName} (${s.userIP}:${s.userPort}) ${s.software || ''} ${s.softVerStr || ''} downSpeed=${s.downSpeed || 0}`);
			}

			console.log(`Source name buckets: ${file.sourceNames?.length || 0}`);
			if (file.sourceNames && file.sourceNames.length > 0) {
				console.log(
					`  ${file.sourceNames
						.slice(0, 5)
						.map((x) => `${x.name}:${x.count}`)
						.join(', ')}`
				);
			}
		}

		// -----------------------------------------------------------------
		// sourceNames verification
		//
		// The daemon sends the source-names map as per-connection diffs (new
		// entries carry the name, count changes don't, count 0 removes). The
		// update-based methods merge those diffs client-side, so buckets must
		// stay complete across repeated polls. Plain getDownloadQueue() is
		// stateless: only the first call of a connection is complete.
		// -----------------------------------------------------------------
		console.log('\n4) Verifying sourceNames via the update path (3 polls, buckets must stay complete)...');
		for (let i = 1; i <= 3; i++) {
			const files = await client.getDownloadQueueWithSources();
			console.log(`   Poll #${i}:`);
			for (const file of files) {
				console.log(`     ${file.fileName}: ${file.sourceNames?.length || 0} bucket(s) -> ${formatBuckets(file)}`);
			}
			const anyMissing = files.some((f) => !f.sourceNames || f.sourceNames.length === 0);
			console.log(anyMissing ? '     (some files have no buckets yet — sources may not have reported names)' : '     OK: every file kept complete buckets');
			if (i < 3) await sleep(2000);
		}

		console.log('\n5) Demonstrating the per-connection incremental behavior of getDownloadQueue()...');
		await client.reconnect(); // fresh connection: daemon diff state starts over

		const firstCall = await client.getDownloadQueue();
		const secondCall = await client.getDownloadQueue();

		for (const file of firstCall) {
			const again = secondCall.find((f) => f.fileHashHexString === file.fileHashHexString);
			console.log(`   ${file.fileName}:`);
			console.log(`     1st call after reconnect: ${file.sourceNames?.length || 0} bucket(s) -> ${formatBuckets(file)}`);
			console.log(`     2nd call same connection: ${again?.sourceNames?.length || 0} bucket(s) (only diffs — 0 expected unless names changed in between)`);
		}
		console.log('   For polling, prefer getDownloadQueueWithSources()/getUpdate(): they merge the diffs for you.');

		console.log('\nDone.');
	} catch (error) {
		console.error('Error running queue-details example:', error);
	}
}

main();
