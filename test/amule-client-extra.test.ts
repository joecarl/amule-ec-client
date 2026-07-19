import { describe, expect, it, vi } from 'vitest';
import { AmuleClient } from '../src/client/AmuleClient';
import { ECOpCode, ECTagName } from '../src/ec/Codes';
import { Flags } from '../src/ec/packet/Flags';
import { Packet } from '../src/ec/packet/Packet';
import { CustomTag, Hash16Tag, StringTag, UByteTag, UIntTag } from '../src/ec/tag/Tag';
import { ChunkStatus, PARTSIZE } from '../src/types/download-details';

function createClientWithPackets(packets: Packet[]) {
	const client = new AmuleClient({
		host: '127.0.0.1',
		port: 4712,
		password: 'test',
		timeout: 10,
	});

	let callIndex = 0;
	const sendRequest = vi.fn(async (request: { buildPacket: () => Packet }) => {
		const packet = packets[Math.min(callIndex, packets.length - 1)];
		callIndex++;
		return packet;
	});

	(client as any).connection = { sendRequest, getSessionGeneration: () => 1 };

	return { client, sendRequest };
}

function createClientWithPacket(packet: Packet) {
	return createClientWithPackets([packet]);
}

function toInterleavedUint64(values: number[]): number[] {
	const size = values.length;
	const out = new Array<number>(size * 8).fill(0);

	for (let i = 0; i < size; i++) {
		const value = values[i];
		for (let byte = 0; byte < 8; byte++) {
			out[i + byte * size] = Math.floor(value / 256 ** byte) % 256;
		}
	}

	return out;
}

function rleEncodeAsSingles(bytes: number[]): Buffer {
	const encoded: number[] = [];
	for (const value of bytes) {
		encoded.push(value, value, 1);
	}
	return Buffer.from(encoded);
}

describe('additional methods', () => {
	it('getPreferences sends preferences request and parses sections', async () => {
		const generalTag = new UByteTag(ECTagName.EC_TAG_PREFS_GENERAL, 0, [
			new StringTag(ECTagName.EC_TAG_USER_NICK, 'my-user'),
			new UByteTag(ECTagName.EC_TAG_GENERAL_CHECK_NEW_VERSION, 1),
		]);
		const connectionTag = new UByteTag(ECTagName.EC_TAG_PREFS_CONNECTIONS, 0, [
			new UIntTag(ECTagName.EC_TAG_CONN_UL_CAP, 20),
			new UIntTag(ECTagName.EC_TAG_CONN_DL_CAP, 200),
			new UByteTag(ECTagName.EC_TAG_NETWORK_ED2K, 1),
			new UByteTag(ECTagName.EC_TAG_NETWORK_KADEMLIA, 0),
		]);
		const serversTag = new UByteTag(ECTagName.EC_TAG_PREFS_SERVERS, 0, [
			new UByteTag(ECTagName.EC_TAG_SERVERS_REMOVE_DEAD, 1),
			new StringTag(ECTagName.EC_TAG_SERVERS_UPDATE_URL, 'http://server.met'),
		]);
		const securityTag = new UByteTag(ECTagName.EC_TAG_PREFS_SECURITY, 0, [
			new UByteTag(ECTagName.EC_TAG_SECURITY_CAN_SEE_SHARES, 2),
			new UByteTag(ECTagName.EC_TAG_SECURITY_USE_SECIDENT, 1),
		]);

		const packet = new Packet(ECOpCode.EC_OP_GET_PREFERENCES, Flags.useUtf8Numbers(), [generalTag, connectionTag, serversTag, securityTag]);

		const { client, sendRequest } = createClientWithPacket(packet);
		const prefs = await client.getPreferences();

		expect(sendRequest).toHaveBeenCalledTimes(1);
		const requestPacket = sendRequest.mock.calls[0][0].buildPacket();
		expect(requestPacket.opCode).toBe(ECOpCode.EC_OP_GET_PREFERENCES);
		expect(requestPacket.tags.some((tag: { name: ECTagName }) => tag.name === ECTagName.EC_TAG_SELECT_PREFS)).toBe(true);

		expect(prefs.general.userNick).toBe('my-user');
		expect(prefs.general.checkNewVersion).toBe(true);
		expect(prefs.connection.uploadCapacity).toBe(20);
		expect(prefs.connection.downloadCapacity).toBe(200);
		expect(prefs.connection.networkED2K).toBe(true);
		expect(prefs.connection.networkKademlia).toBe(false);
		expect(prefs.servers.removeDead).toBe(true);
		expect(prefs.servers.updateUrl).toBe('http://server.met');
		expect(prefs.security.canSeeShares).toBe(2);
		expect(prefs.security.useSecIdent).toBe(true);
	});

	it('getDownloadQueue includes chunk details and source names', async () => {
		const hash = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
		const fullSize = PARTSIZE * 2;

		const partStatusBuf = rleEncodeAsSingles([0, 2]);
		const gapStatusBuf = rleEncodeAsSingles(toInterleavedUint64([0, PARTSIZE]));
		const reqStatusBuf = rleEncodeAsSingles(toInterleavedUint64([0, PARTSIZE / 2]));

		// Real daemon structure: container of int-keyed entries with nested name + count
		const sourceNamesTag = new CustomTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, Buffer.alloc(0), [
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 1, [
				new StringTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 'file-a.iso'),
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 3),
			]),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 2, [
				new StringTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 'file-a-alt.iso'),
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 1),
			]),
		]);

		const partFile = new UIntTag(ECTagName.EC_TAG_PARTFILE, 77, [
			new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, partStatusBuf),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_GAP_STATUS, gapStatusBuf),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_REQ_STATUS, reqStatusBuf),
			sourceNamesTag,
		]);

		const packet = new Packet(ECOpCode.EC_OP_DLOAD_QUEUE, Flags.useUtf8Numbers(), [partFile]);
		const { client, sendRequest } = createClientWithPacket(packet);
		const queue = await client.getDownloadQueue();

		expect(sendRequest).toHaveBeenCalledTimes(1);
		const requestPacket = sendRequest.mock.calls[0][0].buildPacket();
		expect(requestPacket.opCode).toBe(ECOpCode.EC_OP_GET_DLOAD_QUEUE);

		expect(queue.length).toBe(1);
		expect(queue[0].ecid).toBe(77);
		expect(queue[0].chunkInfo).toBeDefined();
		expect(queue[0].chunkInfo?.partCount).toBe(2);
		expect(queue[0].chunkInfo?.availability).toEqual([0, 2]);
		expect(queue[0].chunkInfo?.chunks).toEqual([ChunkStatus.DOWNLOADING, ChunkStatus.COMPLETE]);
		expect(queue[0].sourceNames).toEqual([
			{ name: 'file-a.iso', count: 3 },
			{ name: 'file-a-alt.iso', count: 1 },
		]);
	});

	it('getDownloadQueueWithSources links update clients to downloads', async () => {
		const hash = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
		const fullSize = PARTSIZE * 2;
		const clientHash = Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex');

		const partFile = new UIntTag(ECTagName.EC_TAG_PARTFILE, 123, [
			new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
			new StringTag(ECTagName.EC_TAG_PARTFILE_NAME, 'file-a.iso'),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SPEED, 1000),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, rleEncodeAsSingles([0, 2])),
		]);

		const peerTag = new UIntTag(ECTagName.EC_TAG_CLIENT, 55, [
			new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'Peer-1'),
			new Hash16Tag(ECTagName.EC_TAG_CLIENT_HASH, clientHash),
			new StringTag(ECTagName.EC_TAG_CLIENT_SOFTWARE, 'aMule'),
			new StringTag(ECTagName.EC_TAG_CLIENT_SOFT_VER_STR, '2.3.3'),
			new UIntTag(ECTagName.EC_TAG_CLIENT_USER_IP, 0x7f000001),
			new UIntTag(ECTagName.EC_TAG_CLIENT_USER_PORT, 4662),
			new UIntTag(ECTagName.EC_TAG_CLIENT_REQUEST_FILE, 123),
		]);
		const clientContainer = new CustomTag(ECTagName.EC_TAG_CLIENT, Buffer.alloc(0), [peerTag]);

		const packet = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [partFile, clientContainer]);
		const { client, sendRequest } = createClientWithPacket(packet);

		const queue = await client.getDownloadQueueWithSources();

		expect(sendRequest).toHaveBeenCalledTimes(1);
		const requestPacket = sendRequest.mock.calls[0][0].buildPacket();
		expect(requestPacket.opCode).toBe(ECOpCode.EC_OP_GET_UPDATE);

		expect(queue.length).toBe(1);
		expect(queue[0].ecid).toBe(123);
		expect(queue[0].fileName).toBe('file-a.iso');
		expect(queue[0].chunkInfo?.availability).toEqual([0, 2]);
		expect(queue[0].sources?.length).toBe(1);
		expect(queue[0].sources?.[0].ecid).toBe(55);
		expect(queue[0].sources?.[0].clientName).toBe('Peer-1');
		expect(queue[0].sources?.[0].software).toBe('aMule');
		expect(queue[0].sources?.[0].userIP).toBe('127.0.0.1');
		expect(queue[0].sources?.[0].userPort).toBe(4662);
	});

	it('getUpdate merges incremental diffs and reconstructs buffers', async () => {
		const hash = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
		const fullSize = PARTSIZE * 2;

		const fullPartFile = new UIntTag(ECTagName.EC_TAG_PARTFILE, 123, [
			new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
			new StringTag(ECTagName.EC_TAG_PARTFILE_NAME, 'file-a.iso'),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SPEED, 1000),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, rleEncodeAsSingles([0, 2])),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, Buffer.alloc(0), [
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 1, [
					new StringTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 'name-a'),
					new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 3),
				]),
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 2, [
					new StringTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 'name-b'),
					new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 1),
				]),
			]),
		]);
		const fullPeer = new UIntTag(ECTagName.EC_TAG_CLIENT, 55, [
			new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'Peer-1'),
			new UIntTag(ECTagName.EC_TAG_CLIENT_DOWN_SPEED, 500),
			new UIntTag(ECTagName.EC_TAG_CLIENT_REQUEST_FILE, 123),
		]);
		const firstPacket = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [
			fullPartFile,
			new CustomTag(ECTagName.EC_TAG_CLIENT, Buffer.alloc(0), [fullPeer]),
		]);

		// Incremental diff: only changed fields present; part status is an XOR diff ([0,2] ^ [1,0] = [1,2]);
		// source names diff: count of entry 1 changes (no name resent), entry 2 removed (count 0)
		const diffPartFile = new UIntTag(ECTagName.EC_TAG_PARTFILE, 123, [
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SPEED, 2000),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, rleEncodeAsSingles([1, 0])),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, Buffer.alloc(0), [
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 1, [new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 5)]),
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 2, [new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 0)]),
			]),
		]);
		const diffPeer = new UIntTag(ECTagName.EC_TAG_CLIENT, 55, [new UIntTag(ECTagName.EC_TAG_CLIENT_DOWN_SPEED, 900)]);
		const secondPacket = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [
			diffPartFile,
			new CustomTag(ECTagName.EC_TAG_CLIENT, Buffer.alloc(0), [diffPeer]),
		]);

		// Peer gone: client container empty
		const thirdPacket = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [
			new UIntTag(ECTagName.EC_TAG_PARTFILE, 123, []),
			new CustomTag(ECTagName.EC_TAG_CLIENT, Buffer.alloc(0), []),
		]);

		const { client } = createClientWithPackets([firstPacket, secondPacket, thirdPacket]);

		const first = await client.getUpdate();
		expect(first.downloadQueue[0].speed).toBe(1000);
		expect(first.downloadQueue[0].chunkInfo?.availability).toEqual([0, 2]);
		expect(first.downloadQueue[0].sources?.[0].downSpeed).toBe(500);
		expect(first.downloadQueue[0].sourceNames).toEqual([
			{ name: 'name-a', count: 3 },
			{ name: 'name-b', count: 1 },
		]);

		const second = await client.getUpdate();
		expect(second.downloadQueue.length).toBe(1);
		// Unchanged fields survive the merge, changed ones are updated
		expect(second.downloadQueue[0].fileName).toBe('file-a.iso');
		expect(second.downloadQueue[0].sizeFull).toBe(fullSize);
		expect(second.downloadQueue[0].speed).toBe(2000);
		expect(second.downloadQueue[0].chunkInfo?.availability).toEqual([1, 2]);
		expect(second.downloadQueue[0].sources?.length).toBe(1);
		expect(second.downloadQueue[0].sources?.[0].clientName).toBe('Peer-1');
		expect(second.downloadQueue[0].sources?.[0].downSpeed).toBe(900);
		// Source names map diff applied: count updated without resending the name, entry 2 removed
		expect(second.downloadQueue[0].sourceNames).toEqual([{ name: 'name-a', count: 5 }]);

		const third = await client.getUpdate();
		expect(third.downloadQueue[0].fileName).toBe('file-a.iso');
		expect(third.downloadQueue[0].sources).toEqual([]);
		expect(third.clients.length).toBe(0);
		// No source-names container in the packet: accumulated state is kept
		expect(third.downloadQueue[0].sourceNames).toEqual([{ name: 'name-a', count: 5 }]);
	});
});
