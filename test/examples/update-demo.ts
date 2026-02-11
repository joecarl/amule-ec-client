/**
 * Example: Real-time update monitoring (Incremental Updates)
 *
 * This example demonstrates how to use getUpdate() to receive the
 * combined incremental update response from aMule.
 */

import { AmuleClient, ECDetailLevel } from '../../src';

async function main() {
	// aMule connection configuration
	// Note: You can set these via environment variables or hardcode them
	const client = new AmuleClient({
		host: process.env.AMULE_HOST || 'localhost',
		port: parseInt(process.env.AMULE_PORT || '4712'),
		password: process.env.AMULE_PASSWORD || 'secret',
		timeout: 10000,
	});

	try {
		console.log('Connecting to aMule...');

		// Check connectivity first
		const stats = await client.getStats();
		console.log(`Connected. Currently sharing ${stats.sharedFileCount} files.`);

		for (let i = 0; i < 3; i++) {
			console.log('\n--- Requesting Incremental Update ---');
			// By default getUpdate uses ECDetailLevel.EC_DETAIL_INC_UPDATE
			// which according to amule source 'Get_EC_Response_GetUpdate'
			// returns a combination of files, clients, servers, and friends.
			const updates = await client.getUpdate(ECDetailLevel.EC_DETAIL_INC_UPDATE);

			console.log('\n=== Update Results ===');

			console.log(`Shared Files:    ${updates.sharedFiles.length}`);
			if (updates.sharedFiles.length > 0) {
				updates.sharedFiles.slice(0, 3).forEach((f) => console.log(` - [SHARED] ${f.fileName} (${f.getXferred} bytes xferred)`));
			}

			console.log(`Download Queue:  ${updates.downloadQueue.length}`);
			if (updates.downloadQueue.length > 0) {
				updates.downloadQueue.slice(0, 3).forEach((f) => console.log(` - [DLOAD]  ${f.fileName} (${f.sizeDone} bytes done) Speed: ${f.speed}B/s`));
			}

			console.log(`Active Clients:  ${updates.clients.length}`);
			if (updates.clients.length > 0) {
				updates.clients
					.filter((c) => c.clientName)
					.slice(0, 20)
					.forEach((c) => console.log(` - [CLIENT] ${c.clientName} (IP: ${c.userIP}, UpSpeed: ${c.upSpeed}B/s, DownSpeed: ${c.downSpeed}B/s)`));
			}

			console.log(`Servers:         ${updates.servers.length}`);
			if (updates.servers.length > 0) {
				updates.servers.slice(0, 3).forEach((s) => console.log(` - [SERVER] ${s.name} (${s.ip}:${s.port})`));
			}

			console.log(`Friends:         ${updates.friends.length}`);
			if (updates.friends.length > 0) {
				updates.friends.slice(0, 3).forEach((f) => console.log(` - [FRIEND] ${f.name} (IP: ${f.ip})`));
			}

			await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before next update
		}
		console.log('\nDone!');
	} catch (error) {
		console.error('\nError connecting to aMule:', (error as Error).message);
		process.exit(1);
	}
}

main();
