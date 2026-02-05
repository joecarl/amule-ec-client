/**
 * Example: Concurrent Requests
 *
 * This example demonstrates that the client can now handle multiple requests
 * concurrently without losing responses or overwriting pending requests.
 */

import { AmuleClient } from '../../src';

async function main() {
	// Create the client
	const client = new AmuleClient({
		host: 'localhost',
		port: 4712,
		password: 'secret',
		timeout: 10000,
	});

	try {
		console.log('Sending stats and shared files requests concurrently...');

		// We trigger both at the same time using Promise.all
		// This used to fail but now works thanks to the response queue in AmuleConnection

		const statsP = client.getStats();
		const sharedP = client.getSharedFiles();

		const sharedR = await sharedP;
		console.log('Shared files received:', sharedR);

		const statsR = await statsP;
		console.log('Stats received:', statsR);

		console.log('SUCCESS: Both requests completed!');
	} catch (error) {
		console.error('\n!!! REQUEST FAILED !!!');
		console.error('Error message:', (error as Error).message);

		if ((error as any).code === 'ECONNREFUSED') {
			console.log('\nNote: Connection refused is expected if aMule is not running.');
			console.log('The bug would have manifested as a protocol error or a timeout if aMule was running.');
		}
	} finally {
		// Force exit since the connection might still be open
		setTimeout(() => process.exit(0), 1000);
	}
}

// Run the example
main().catch(console.error);
