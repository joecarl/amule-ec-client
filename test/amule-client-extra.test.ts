import { describe, expect, it, vi } from 'vitest';
import { AmuleClient } from '../src/client/AmuleClient';
import { ECOpCode, ECTagName } from '../src/ec/Codes';
import { Flags } from '../src/ec/packet/Flags';
import { Packet } from '../src/ec/packet/Packet';
import { CustomTag, DoubleTag, Hash16Tag, Ipv4Tag, StringTag, UByteTag, UIntTag, findNumericTag } from '../src/ec/tag/Tag';
import { ServerListResponseParser } from '../src/response/ServerListResponse';
import { ServerPriority } from '../src/model';
import { ServerException } from '../src/exceptions';
import { PacketWriter } from '../src/ec/packet/PacketWriter';
import { PacketParser } from '../src/ec/packet/PacketParser';
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

/**
 * Byte-wise XOR of two equal-length arrays, as the daemon's differential RLE encoder
 * produces (RLE_Data::Encode with use_diff).
 */
function xorBytes(a: number[], b: number[]): number[] {
	if (a.length !== b.length) {
		throw new Error('xorBytes requires equal-length inputs');
	}
	return a.map((value, i) => value ^ b[i]);
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
			// aMule's internal packing: first octet in the least significant byte
			new UIntTag(ECTagName.EC_TAG_CLIENT_USER_IP, 0x0100007f),
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
			// The daemon sends per-client download speed as a double in kB/s
			new DoubleTag(ECTagName.EC_TAG_CLIENT_DOWN_SPEED, 0.5),
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
		const diffPeer = new UIntTag(ECTagName.EC_TAG_CLIENT, 55, [new DoubleTag(ECTagName.EC_TAG_CLIENT_DOWN_SPEED, 12.5)]);
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
		// 0.5 kB/s normalized to bytes/s
		expect(first.downloadQueue[0].sources?.[0].downSpeed).toBe(512);
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
		expect(second.downloadQueue[0].sources?.[0].downSpeed).toBe(12800);
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

describe('per-connection diff state shared across request types', () => {
	const hash = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
	const fullSize = PARTSIZE * 2;

	function updatePartFile(ecid: number, tags: any[]) {
		return new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [new UIntTag(ECTagName.EC_TAG_PARTFILE, ecid, tags)]);
	}

	it('getDownloadQueue between updates rebases the XOR baseline (daemon resets the shared encoder)', async () => {
		// First update of the connection: full buffers. Gap over chunk 0 only.
		const firstUpdate = updatePartFile(123, [
			new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, rleEncodeAsSingles([1, 1])),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_GAP_STATUS, rleEncodeAsSingles(toInterleavedUint64([0, PARTSIZE]))),
		]);

		// EC_OP_GET_DLOAD_QUEUE at full detail: the daemon resets the per-connection
		// encoders and re-encodes, so buffers are full again — and become the new baseline.
		const dloadGaps = [0, PARTSIZE + PARTSIZE / 2];
		const dloadQueue = new Packet(ECOpCode.EC_OP_DLOAD_QUEUE, Flags.useUtf8Numbers(), [
			new UIntTag(ECTagName.EC_TAG_PARTFILE, 123, [
				new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
				new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, rleEncodeAsSingles([1, 1])),
				new CustomTag(ECTagName.EC_TAG_PARTFILE_GAP_STATUS, rleEncodeAsSingles(toInterleavedUint64(dloadGaps))),
			]),
		]);

		// Next update: XOR diff relative to what the download-queue response encoded.
		const currentGaps = [PARTSIZE, PARTSIZE + PARTSIZE / 2];
		const secondUpdate = updatePartFile(123, [
			new CustomTag(ECTagName.EC_TAG_PARTFILE_GAP_STATUS, rleEncodeAsSingles(xorBytes(toInterleavedUint64(currentGaps), toInterleavedUint64(dloadGaps)))),
		]);

		const { client } = createClientWithPackets([firstUpdate, dloadQueue, secondUpdate]);

		const first = await client.getDownloadQueueWithSources();
		expect(first[0].chunkInfo?.chunks).toEqual([ChunkStatus.AVAILABLE, ChunkStatus.COMPLETE]);

		const queue = await client.getDownloadQueue();
		expect(queue[0].chunkInfo?.chunks).toEqual([ChunkStatus.AVAILABLE, ChunkStatus.AVAILABLE]);

		// Without rebasing, this diff would be XORed against the first update's state
		// and decode into garbage
		const second = await client.getDownloadQueueWithSources();
		expect(second[0].chunkInfo?.chunks).toEqual([ChunkStatus.COMPLETE, ChunkStatus.AVAILABLE]);
	});

	it('a present zero-length buffer resets the state to empty (RLE_Data::Decode semantics)', async () => {
		const firstUpdate = updatePartFile(123, [
			new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, rleEncodeAsSingles([1, 1])),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_GAP_STATUS, rleEncodeAsSingles(toInterleavedUint64([0, fullSize]))),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_REQ_STATUS, rleEncodeAsSingles(toInterleavedUint64([0, PARTSIZE / 2]))),
		]);

		// No requested blocks left: the daemon sends the tag with zero length
		const reqCleared = updatePartFile(123, [new CustomTag(ECTagName.EC_TAG_PARTFILE_REQ_STATUS, Buffer.alloc(0))]);

		// Blocks requested again: encoded against the now-empty baseline, i.e. full data
		const reqBack = updatePartFile(123, [new CustomTag(ECTagName.EC_TAG_PARTFILE_REQ_STATUS, rleEncodeAsSingles(toInterleavedUint64([PARTSIZE, PARTSIZE + PARTSIZE / 2])))]);

		const { client } = createClientWithPackets([firstUpdate, reqCleared, reqBack]);

		const first = await client.getDownloadQueueWithSources();
		expect(first[0].chunkInfo?.chunks).toEqual([ChunkStatus.DOWNLOADING, ChunkStatus.AVAILABLE]);

		const second = await client.getDownloadQueueWithSources();
		expect(second[0].chunkInfo?.chunks).toEqual([ChunkStatus.AVAILABLE, ChunkStatus.AVAILABLE]);

		const third = await client.getDownloadQueueWithSources();
		expect(third[0].chunkInfo?.chunks).toEqual([ChunkStatus.AVAILABLE, ChunkStatus.DOWNLOADING]);
	});

	it('repeated getDownloadQueue accumulates source-name diffs (the daemon never resets that map)', async () => {
		const firstQueue = new Packet(ECOpCode.EC_OP_DLOAD_QUEUE, Flags.useUtf8Numbers(), [
			new UIntTag(ECTagName.EC_TAG_PARTFILE, 77, [
				new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
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
			]),
		]);

		// Second full request: buffers are re-sent in full (encoder reset), but the
		// source-names container still only carries the diff since the previous request
		const secondQueue = new Packet(ECOpCode.EC_OP_DLOAD_QUEUE, Flags.useUtf8Numbers(), [
			new UIntTag(ECTagName.EC_TAG_PARTFILE, 77, [
				new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
				new CustomTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, Buffer.alloc(0), [
					new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 1, [new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 5)]),
					new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 2, [new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 0)]),
					new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 3, [
						new StringTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES, 'name-c'),
						new UIntTag(ECTagName.EC_TAG_PARTFILE_SOURCE_NAMES_COUNTS, 2),
					]),
				]),
			]),
		]);

		const { client } = createClientWithPackets([firstQueue, secondQueue]);

		const first = await client.getDownloadQueue();
		expect(first[0].sourceNames).toEqual([
			{ name: 'name-a', count: 3 },
			{ name: 'name-b', count: 1 },
		]);

		const second = await client.getDownloadQueue();
		expect(second[0].sourceNames).toEqual([
			{ name: 'name-a', count: 5 },
			{ name: 'name-c', count: 2 },
		]);
	});

	it('getSharedFiles rebases the baselines of shared partfiles', async () => {
		const firstUpdate = updatePartFile(123, [
			new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, rleEncodeAsSingles([1, 1])),
			new CustomTag(ECTagName.EC_TAG_PARTFILE_GAP_STATUS, rleEncodeAsSingles(toInterleavedUint64([0, PARTSIZE]))),
		]);

		// The shared partfile goes through the same per-connection encoder: reset + full re-encode
		const sharedGaps = [0, PARTSIZE + PARTSIZE / 2];
		const sharedFiles = new Packet(ECOpCode.EC_OP_SHARED_FILES, Flags.useUtf8Numbers(), [
			new UIntTag(ECTagName.EC_TAG_KNOWNFILE, 123, [
				new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
				new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, fullSize),
				new CustomTag(ECTagName.EC_TAG_PARTFILE_PART_STATUS, rleEncodeAsSingles([1, 1])),
				new CustomTag(ECTagName.EC_TAG_PARTFILE_GAP_STATUS, rleEncodeAsSingles(toInterleavedUint64(sharedGaps))),
			]),
		]);

		const currentGaps = [PARTSIZE, PARTSIZE + PARTSIZE / 2];
		const secondUpdate = updatePartFile(123, [
			new CustomTag(ECTagName.EC_TAG_PARTFILE_GAP_STATUS, rleEncodeAsSingles(xorBytes(toInterleavedUint64(currentGaps), toInterleavedUint64(sharedGaps)))),
		]);

		const { client } = createClientWithPackets([firstUpdate, sharedFiles, secondUpdate]);

		const first = await client.getDownloadQueueWithSources();
		expect(first[0].chunkInfo?.chunks).toEqual([ChunkStatus.AVAILABLE, ChunkStatus.COMPLETE]);

		await client.getSharedFiles();

		const second = await client.getDownloadQueueWithSources();
		expect(second[0].chunkInfo?.chunks).toEqual([ChunkStatus.COMPLETE, ChunkStatus.AVAILABLE]);
	});
});

describe('EC double tags', () => {
	it('parses the aMule wire format: a null-terminated ASCII decimal string', () => {
		const tag = new DoubleTag(ECTagName.EC_TAG_CLIENT_DOWN_SPEED);
		tag.parseValue(Buffer.from('12.5\0', 'latin1'));
		expect(tag.getValue()).toBe(12.5);

		// Short strings must not fall back to 0 (the old readDoubleBE(0) guard did)
		tag.parseValue(Buffer.from('0.5\0', 'latin1'));
		expect(tag.getValue()).toBe(0.5);
	});

	it('round-trips through PacketWriter/PacketParser and is found by findNumericTag', () => {
		const packet = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [new DoubleTag(ECTagName.EC_TAG_CLIENT_DOWN_SPEED, 350.25)]);

		const parsed = PacketParser.parse(PacketWriter.write(packet));

		const tag = findNumericTag(parsed.tags, ECTagName.EC_TAG_CLIENT_DOWN_SPEED);
		expect(tag).toBeDefined();
		expect(tag?.getValue()).toBe(350.25);
	});

	it('per-source download speed survives parsing and is normalized to bytes/s', async () => {
		const hash = Buffer.from('00112233445566778899aabbccddeeff', 'hex');

		const partFile = new UIntTag(ECTagName.EC_TAG_PARTFILE, 123, [
			new Hash16Tag(ECTagName.EC_TAG_PARTFILE_HASH, hash),
			new UIntTag(ECTagName.EC_TAG_PARTFILE_SIZE_FULL, PARTSIZE),
		]);
		const peer = new UIntTag(ECTagName.EC_TAG_CLIENT, 55, [
			new StringTag(ECTagName.EC_TAG_CLIENT_NAME, 'Peer-1'),
			new DoubleTag(ECTagName.EC_TAG_CLIENT_DOWN_SPEED, 350.25),
			new UIntTag(ECTagName.EC_TAG_CLIENT_UP_SPEED, 2048),
			new UIntTag(ECTagName.EC_TAG_CLIENT_REQUEST_FILE, 123),
		]);
		const update = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [partFile, new CustomTag(ECTagName.EC_TAG_CLIENT, Buffer.alloc(0), [peer])]);

		// Through the real wire encoding, like a daemon response
		const { client } = createClientWithPacket(PacketParser.parse(PacketWriter.write(update)));

		const queue = await client.getDownloadQueueWithSources();
		expect(queue[0].sources?.[0].downSpeed).toBe(Math.round(350.25 * 1024));
		expect(queue[0].sources?.[0].upSpeed).toBe(2048);
	});
});

describe('server management', () => {
	const noopPacket = () => new Packet(ECOpCode.EC_OP_NOOP, Flags.useUtf8Numbers(), []);

	it('addServer sends EC_OP_SERVER_ADD with "ip:port" address and name strings', async () => {
		const { client, sendRequest } = createClientWithPacket(noopPacket());
		await client.addServer('10.0.0.1', 4661, 'My server');

		const requestPacket = sendRequest.mock.calls[0][0].buildPacket();
		expect(requestPacket.opCode).toBe(ECOpCode.EC_OP_SERVER_ADD);

		const addressTag = requestPacket.tags.find((tag: { name: ECTagName }) => tag.name === ECTagName.EC_TAG_SERVER_ADDRESS);
		expect(addressTag?.getValue()).toBe('10.0.0.1:4661');
		const nameTag = requestPacket.tags.find((tag: { name: ECTagName }) => tag.name === ECTagName.EC_TAG_SERVER_NAME);
		expect(nameTag?.getValue()).toBe('My server');
	});

	it('removeServer sends EC_OP_SERVER_REMOVE with the server IPv4 tag', async () => {
		const { client, sendRequest } = createClientWithPacket(noopPacket());
		await client.removeServer('10.0.0.1', 4661);

		expect(sendRequest).toHaveBeenCalledTimes(1);
		const requestPacket = sendRequest.mock.calls[0][0].buildPacket();
		expect(requestPacket.opCode).toBe(ECOpCode.EC_OP_SERVER_REMOVE);

		const serverTag = requestPacket.tags.find((tag: { name: ECTagName }) => tag.name === ECTagName.EC_TAG_SERVER);
		expect(serverTag?.getValue()).toEqual({ address: '10.0.0.1', port: 4661 });
	});

	it('setServerPriority sends EC_OP_SERVER_SET_STATIC_PRIO keyed by ECID', async () => {
		const { client, sendRequest } = createClientWithPacket(noopPacket());
		await client.setServerPriority(42, ServerPriority.HIGH);

		const requestPacket = sendRequest.mock.calls[0][0].buildPacket();
		expect(requestPacket.opCode).toBe(ECOpCode.EC_OP_SERVER_SET_STATIC_PRIO);
		expect(findNumericTag(requestPacket.tags, ECTagName.EC_TAG_SERVER)?.getInt()).toBe(42);
		expect(findNumericTag(requestPacket.tags, ECTagName.EC_TAG_SERVER_PRIO)?.getInt()).toBe(ServerPriority.HIGH);
		expect(requestPacket.tags.some((tag: { name: ECTagName }) => tag.name === ECTagName.EC_TAG_SERVER_STATIC)).toBe(false);
	});

	it('setServerStatic sends only the static flag', async () => {
		const { client, sendRequest } = createClientWithPacket(noopPacket());
		await client.setServerStatic(42, true);

		const requestPacket = sendRequest.mock.calls[0][0].buildPacket();
		expect(requestPacket.opCode).toBe(ECOpCode.EC_OP_SERVER_SET_STATIC_PRIO);
		expect(findNumericTag(requestPacket.tags, ECTagName.EC_TAG_SERVER)?.getInt()).toBe(42);
		expect(findNumericTag(requestPacket.tags, ECTagName.EC_TAG_SERVER_STATIC)?.getInt()).toBe(1);
		expect(requestPacket.tags.some((tag: { name: ECTagName }) => tag.name === ECTagName.EC_TAG_SERVER_PRIO)).toBe(false);
	});

	it('surfaces EC_OP_FAILED responses as ServerException with the daemon reason', async () => {
		const failed = new Packet(ECOpCode.EC_OP_FAILED, Flags.useUtf8Numbers(), [new StringTag(ECTagName.EC_TAG_STRING, 'server not found: 10.0.0.1:4661')]);
		const { client } = createClientWithPacket(failed);

		const rejection = await client.removeServer('10.0.0.1', 4661).catch((error) => error);
		expect(rejection).toBeInstanceOf(ServerException);
		expect(rejection.message).toBe('server not found: 10.0.0.1:4661');
	});

	it('getUpdate merges incremental server diffs into full snapshots', async () => {
		// First update: full server data (first appearance sends every field)
		const firstUpdate = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [
			new CustomTag(ECTagName.EC_TAG_SERVER, Buffer.alloc(0), [
				new UIntTag(ECTagName.EC_TAG_SERVER, 42, [
					new StringTag(ECTagName.EC_TAG_SERVER_NAME, 'Test server'),
					// aMule's internal packing: first octet in the least significant byte
					new UIntTag(ECTagName.EC_TAG_SERVER_IP, 0x04030201),
					new UIntTag(ECTagName.EC_TAG_SERVER_PORT, 4661),
					new UIntTag(ECTagName.EC_TAG_SERVER_PRIO, ServerPriority.NORMAL),
				]),
			]),
		]);
		// Second update: only the changed field is resent (valuemap diff)
		const secondUpdate = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [
			new CustomTag(ECTagName.EC_TAG_SERVER, Buffer.alloc(0), [
				new UIntTag(ECTagName.EC_TAG_SERVER, 42, [new UIntTag(ECTagName.EC_TAG_SERVER_PRIO, ServerPriority.HIGH)]),
			]),
		]);

		const { client } = createClientWithPackets([firstUpdate, secondUpdate]);

		const first = await client.getUpdate();
		expect(first.servers[0].name).toBe('Test server');
		expect(first.servers[0].priority).toBe(ServerPriority.NORMAL);

		const second = await client.getUpdate();
		expect(second.servers.length).toBe(1);
		expect(second.servers[0].ecid).toBe(42);
		expect(second.servers[0].priority).toBe(ServerPriority.HIGH);
		// Unchanged fields must survive the merge instead of coming back undefined
		expect(second.servers[0].name).toBe('Test server');
		expect(second.servers[0].ip).toBe('1.2.3.4');
		expect(second.servers[0].port).toBe(4661);
	});

	it('getUpdate drops servers missing from the response', async () => {
		const twoServers = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [
			new CustomTag(ECTagName.EC_TAG_SERVER, Buffer.alloc(0), [
				new UIntTag(ECTagName.EC_TAG_SERVER, 42, [new StringTag(ECTagName.EC_TAG_SERVER_NAME, 'Server A')]),
				new UIntTag(ECTagName.EC_TAG_SERVER, 43, [new StringTag(ECTagName.EC_TAG_SERVER_NAME, 'Server B')]),
			]),
		]);
		const oneServer = new Packet(ECOpCode.EC_OP_STATS, Flags.useUtf8Numbers(), [
			new CustomTag(ECTagName.EC_TAG_SERVER, Buffer.alloc(0), [new UIntTag(ECTagName.EC_TAG_SERVER, 43, [])]),
		]);

		const { client } = createClientWithPackets([twoServers, oneServer]);

		const first = await client.getUpdate();
		expect(first.servers.map((s) => s.ecid)).toEqual([42, 43]);

		const second = await client.getUpdate();
		expect(second.servers.map((s) => s.ecid)).toEqual([43]);
		expect(second.servers[0].name).toBe('Server B');
	});

	it('server list parser exposes the ECID from update-style tags but not from IPv4-keyed tags', () => {
		// Incremental update style: the tag's own value is the ECID
		const updateStyle = new UIntTag(ECTagName.EC_TAG_SERVER, 42, [
			new StringTag(ECTagName.EC_TAG_SERVER_NAME, 'Update server'),
			new UIntTag(ECTagName.EC_TAG_SERVER_PRIO, ServerPriority.LOW),
		]);
		// Full server list style: the tag's own value is the IPv4 address
		const fullListStyle = new Ipv4Tag(ECTagName.EC_TAG_SERVER, { address: '1.2.3.4', port: 4661 }, [
			new StringTag(ECTagName.EC_TAG_SERVER_NAME, 'Listed server'),
		]);

		const { servers } = ServerListResponseParser.fromTags([updateStyle, fullListStyle]);

		expect(servers[0].ecid).toBe(42);
		expect(servers[0].name).toBe('Update server');
		expect(servers[0].priority).toBe(ServerPriority.LOW);
		expect(servers[1].ecid).toBeUndefined();
		expect(servers[1].ip).toBe('1.2.3.4');
		expect(servers[1].port).toBe(4661);
	});
});
