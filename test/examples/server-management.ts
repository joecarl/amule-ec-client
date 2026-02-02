/**
 * Example: Server management
 *
 * This example demonstrates usage of server management methods
 */

import { AmuleClient } from '../../src/client/AmuleClient';

async function main() {
	const client = new AmuleClient({
		host: '127.0.0.1',
		port: 4712,
		password: 'secret',
	});

	try {
		console.log('Fetching server list...');
		const servers = await client.getServerList();
		console.log(`Found ${servers.length} servers.`);

		if (servers.length === 0) {
			console.log('No servers found. Trying to wait a bit...');
			await new Promise((r) => setTimeout(r, 2000));
		}

		for (const server of servers) {
			console.log(`- Server: ${server.name} | IP: ${server.ip} | Port: ${server.port} | Address: ${server.address}`);
		}

		if (servers.length > 1) {
			const server = servers[1];
			console.log(`Connecting to server: ${server.name} (${server.ip}:${server.port})`);
			await client.connectToServer(server.ip, server.port);
			console.log('Connect request sent.');
		}

		console.log('Disconnecting from current server...');
		await client.disconnectFromServer();
		console.log('Disconnect request sent.');
	} catch (error) {
		console.error('Error:', error);
	}
}

main();
