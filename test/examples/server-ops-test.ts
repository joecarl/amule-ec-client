/**
 * Example: Server operations verification flow
 *
 * End-to-end check of the server management API against a real daemon:
 *
 *   1. addServer()          - add a disposable test server
 *   2. getUpdate()          - locate it and grab its ECID (only updates carry it)
 *   3. setServerPriority()  - HIGH, then LOW, verifying each change
 *   4. setServerStatic()    - on and off, verifying each change
 *   5. removeServer()       - delete it and verify it is gone
 *   6. removeServer() again - must reject with the daemon's "server not found"
 *
 * The flow only touches the disposable server, so it is safe to run against a
 * live aMule. Configuration via environment variables:
 *
 *   AMULE_HOST / AMULE_PORT / AMULE_PASSWORD  - EC connection (default localhost:4712/secret)
 *   TEST_SERVER_ADDR                          - "ip:port" for the disposable server. When
 *                                               unset, candidate IPs are tried in order:
 *                                               192.0.2.1 (TEST-NET-1, no real host) first,
 *                                               and 8.8.8.8 as fallback, since bogon-based
 *                                               IP filters often block reserved ranges.
 *
 * Run with: npx tsx test/examples/server-ops-test.ts
 */

import { AmuleClient, ServerException, ServerPriority, type AmuleServer } from '../../src';

const PRIORITY_LABELS: Record<number, string> = {
	[ServerPriority.NORMAL]: 'NORMAL',
	[ServerPriority.HIGH]: 'HIGH',
	[ServerPriority.LOW]: 'LOW',
};

const candidates: Array<{ ip: string; port: number }> = process.env.TEST_SERVER_ADDR
	? [
			(([ip, port]) => ({ ip, port: parseInt(port || '4661') }))(process.env.TEST_SERVER_ADDR.split(':')),
		]
	: [
			{ ip: '192.0.2.1', port: 4661 },
			{ ip: '8.8.8.8', port: 4661 },
		];

let testIp = candidates[0].ip;
let testPort = candidates[0].port;
const testName = 'amule-ec-client test server';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
	if (ok) {
		passed++;
		console.log(`  ✔ ${label}`);
	} else {
		failed++;
		console.log(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
	}
}

/**
 * Fetch a fresh incremental update and find the test server.
 *
 * Incremental updates only resend the fields that changed since the previous
 * call on this connection, so after the first sighting the server must be
 * tracked by its ECID (always present as the tag's own value), not by IP.
 */
async function findTestServer(client: AmuleClient, ecid?: number): Promise<AmuleServer | undefined> {
	const update = await client.getUpdate();
	if (ecid !== undefined) {
		return update.servers.find((s) => s.ecid === ecid);
	}
	return update.servers.find((s) => s.ip === testIp && s.port === testPort);
}

async function main() {
	const client = new AmuleClient({
		host: process.env.AMULE_HOST || 'localhost',
		port: parseInt(process.env.AMULE_PORT || '4712'),
		password: process.env.AMULE_PASSWORD || 'secret',
		timeout: 10000,
	});

	console.log('Connecting to aMule...');
	const stats = await client.getStats();
	console.log(`Connected (${stats.sharedFileCount} shared files).`);

	const baseline = await client.getUpdate();
	console.log(`Server list has ${baseline.servers.length} servers.\n`);

	for (const candidate of candidates) {
		const leftover = baseline.servers.find((s) => s.ip === candidate.ip && s.port === candidate.port);
		if (leftover) {
			console.log(`Removing leftover test server from a previous run (${candidate.ip}:${candidate.port})...`);
			if (leftover.isStatic && leftover.ecid !== undefined) {
				await client.setServerStatic(leftover.ecid, false);
			}
			await client.removeServer(candidate.ip, candidate.port);
		}
	}

	let ecid: number | undefined;
	let isStaticNow = false;

	try {
		// --- 1. Add the disposable server -----------------------------------
		let server: AmuleServer | undefined;
		for (const candidate of candidates) {
			testIp = candidate.ip;
			testPort = candidate.port;
			console.log(`[1/6] addServer(${testIp}, ${testPort}, '${testName}')`);
			try {
				await client.addServer(testIp, testPort, testName);
			} catch (error) {
				if (error instanceof ServerException) {
					// Typically an enabled IP filter blocking the candidate IP
					console.log(`  … daemon rejected it ('${error.message}'), trying next candidate`);
					continue;
				}
				throw error;
			}

			server = await findTestServer(client);
			if (server) {
				break;
			}
			console.log('  … accepted but missing from the update list, trying next candidate');
		}
		check('server appears in the update list', server !== undefined, 'no candidate was accepted; set TEST_SERVER_ADDR to an IP your filter allows');
		if (!server) {
			return;
		}
		ecid = server.ecid;
		check('server carries an ECID', ecid !== undefined);
		check(`server name is '${testName}'`, server.name === testName, `got '${server.name}'`);
		if (ecid === undefined) {
			return;
		}
		console.log(`  Server registered with ECID ${ecid}, priority ${PRIORITY_LABELS[server.priority ?? ServerPriority.NORMAL]}\n`);

		// --- 2. Priority: HIGH ----------------------------------------------
		console.log(`[2/6] setServerPriority(${ecid}, HIGH)`);
		await client.setServerPriority(ecid, ServerPriority.HIGH);
		server = await findTestServer(client, ecid);
		check('daemon reports priority HIGH', server?.priority === ServerPriority.HIGH, `got ${server?.priority}`);
		console.log();

		// --- 3. Priority: LOW -----------------------------------------------
		console.log(`[3/6] setServerPriority(${ecid}, LOW)`);
		await client.setServerPriority(ecid, ServerPriority.LOW);
		server = await findTestServer(client, ecid);
		check('daemon reports priority LOW', server?.priority === ServerPriority.LOW, `got ${server?.priority}`);
		console.log();

		// --- 4. Static flag on/off ------------------------------------------
		console.log(`[4/6] setServerStatic(${ecid}, true/false)`);
		await client.setServerStatic(ecid, true);
		isStaticNow = true;
		server = await findTestServer(client, ecid);
		check('daemon reports static = true', server?.isStatic === true, `got ${server?.isStatic}`);

		await client.setServerStatic(ecid, false);
		isStaticNow = false;
		server = await findTestServer(client, ecid);
		check('daemon reports static = false', server?.isStatic === false, `got ${server?.isStatic}`);
		console.log();

		// --- 5. Remove --------------------------------------------------------
		console.log(`[5/6] removeServer(${testIp}, ${testPort})`);
		await client.removeServer(testIp, testPort);
		server = await findTestServer(client, ecid);
		check('server is gone from the update list', server === undefined);
		ecid = undefined; // nothing left to clean up
		console.log();

		// --- 6. Removing it again must surface the daemon's failure response ---
		console.log(`[6/6] removeServer(${testIp}, ${testPort}) on the already-removed server`);
		let rejection: unknown;
		try {
			await client.removeServer(testIp, testPort);
		} catch (error) {
			rejection = error;
		}
		check(
			'daemon rejection is thrown as ServerException ("server not found")',
			rejection instanceof ServerException && rejection.message.includes('server not found'),
			rejection instanceof Error ? `got ${rejection.name}: ${rejection.message}` : 'no error was thrown'
		);
	} finally {
		// Best-effort cleanup if the flow aborted midway
		if (ecid !== undefined) {
			console.log('\nCleaning up test server...');
			try {
				if (isStaticNow) {
					// A static server would come back from staticservers.met on restart
					await client.setServerStatic(ecid, false);
				}
				await client.removeServer(testIp, testPort);
			} catch (error) {
				console.error(`Cleanup failed, remove ${testIp}:${testPort} manually:`, (error as Error).message);
			}
		}

		console.log(`\nResult: ${passed} passed, ${failed} failed`);
		process.exit(failed > 0 ? 1 : 0);
	}
}

main().catch((error) => {
	console.error('Error:', (error as Error).message);
	process.exit(1);
});
