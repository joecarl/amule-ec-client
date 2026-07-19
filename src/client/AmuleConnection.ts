/**
 * AmuleConnection - Manages the low-level connection to aMule EC
 */

import * as net from 'net';
import { CommunicationException, ServerException } from '../exceptions';
import { Packet } from '../ec/packet/Packet';
import { PacketParser } from '../ec/packet/PacketParser';
import { PacketWriter } from '../ec/packet/PacketWriter';
import { ECOpCode, ECTagName } from '../ec/Codes';
import { findTag } from '../ec/tag/Tag';
import { AuthClientInfoRequest, AuthPasswordRequest } from '../request/AuthRequest';
import type { Request } from '../request/Request';
import { AuthSaltResponse } from '../response/AuthSaltResponse';
import { PasswordHasher } from '../auth/PasswordHasher';

interface IPendingResponse {
	resolve: (packet: Packet) => void;
	reject: (error: Error) => void;
	timeoutHandle?: NodeJS.Timeout;
}

export class AmuleConnection {
	private socket?: net.Socket;
	private connected = false;
	private buffer: Buffer = Buffer.allocUnsafe(0);
	private pendingResponses: IPendingResponse[] = [];
	private connectionPromise?: Promise<void>;
	private requestTimeout = 0;
	private sessionGeneration = 0;

	// Debug logging flag (disabled by default)
	private debug = false;

	/**
	 * Enable or disable debug logging
	 */
	public setDebug(enabled: boolean): void {
		this.debug = !!enabled;
	}

	/**
	 * Internal debug logger
	 */
	private log(...args: any[]): void {
		if (!this.debug) {
			return;
		}
		console.log('[DEBUG]', ...args);
	}

	constructor(
		private host: string,
		private port: number,
		private password: string,
		private timeout: number,
		requestTimeout: number = 0
	) {
		this.requestTimeout = Math.max(0, requestTimeout);
	}

	/**
	 * Set default timeout for a single request/response cycle.
	 * Use 0 to disable.
	 */
	public setRequestTimeout(timeoutMs: number): void {
		this.requestTimeout = Math.max(0, timeoutMs || 0);
	}

	/**
	 * Get current default timeout for requests.
	 */
	public getRequestTimeout(): number {
		return this.requestTimeout;
	}

	/**
	 * Monotonic counter incremented on every (re)connection attempt.
	 * Lets consumers detect that the daemon-side per-connection state was reset.
	 */
	public getSessionGeneration(): number {
		return this.sessionGeneration;
	}

	/**
	 * Reject and clear all pending responses.
	 */
	private rejectAllPending(error: Error): void {
		while (this.pendingResponses.length > 0) {
			const pending = this.pendingResponses.shift();
			if (pending?.timeoutHandle) {
				clearTimeout(pending.timeoutHandle);
			}
			pending?.reject(error);
		}
	}

	/**
	 * Reconnect to the server
	 */
	async reconnect(): Promise<void> {
		if (this.connectionPromise) {
			return this.connectionPromise;
		}

		this.connectionPromise = (async () => {
			this.connected = false;
			// The daemon keeps per-connection incremental state (EC_OP_GET_UPDATE); a new
			// connection starts from scratch, so consumers tracking state must reset too.
			this.sessionGeneration++;
			if (this.socket) {
				this.socket.destroy();
			}

			// Discard partial data left over from the previous connection: stale bytes
			// would desync packet framing for the whole new session.
			this.buffer = Buffer.allocUnsafe(0);

			// Create new socket
			this.socket = new net.Socket();
			if (this.timeout > 0) {
				this.socket.setTimeout(this.timeout);
			}

			// Setup event handlers
			this.socket.on('data', (data) => this.handleData(Buffer.isBuffer(data) ? data : Buffer.from(data)));
			this.socket.on('error', (error) => this.handleError(error));
			this.socket.on('timeout', () => this.handleTimeout());
			this.socket.on('close', () => this.handleClose());

			try {
				// Connect
				await this.connectSocket();

				// Perform authentication
				await this.authenticate();

				// The socket timeout is an *idle* timeout in Node; keeping it active would
				// kill healthy but quiet connections. It only guards connection establishment
				// and auth; per-request timeouts take over from here.
				this.socket?.setTimeout(0);

				this.connected = true;
			} finally {
				this.connectionPromise = undefined;
			}
		})();

		return this.connectionPromise;
	}

	/**
	 * Connect socket to server
	 */
	private connectSocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			const socket = this.socket;
			if (!socket) {
				return reject(new CommunicationException('Socket not initialized'));
			}

			const onError = (error: Error) => reject(error);
			socket.once('error', onError);

			socket.connect(this.port, this.host, () => {
				socket.removeListener('error', onError);
				resolve();
			});
		});
	}

	/**
	 * Perform authentication handshake
	 */
	private async authenticate(): Promise<void> {
		this.log('Starting authentication...');
		// Step 1: Send client info
		const clientInfoRequest = new AuthClientInfoRequest();
		this.log('Sending client info...');
		const saltPacket = await this.sendRequestNoAuth(clientInfoRequest);
		this.log('Received salt response');

		if (saltPacket.opCode === ECOpCode.EC_OP_AUTH_FAIL) {
			const fallbackReason =
				'connection refused with no reason; the daemon usually does this when its EC password is empty (external connections disabled)';
			throw new ServerException(`Authentication failed: ${AmuleConnection.authFailReason(saltPacket) ?? fallbackReason}`);
		}

		if (saltPacket.opCode !== ECOpCode.EC_OP_AUTH_SALT) {
			throw new ServerException(`Unexpected response to client info: ${saltPacket.opCode}`);
		}

		const saltResponse = AuthSaltResponse.fromPacket(saltPacket);
		this.log('Salt:', saltResponse.salt);

		// Step 2: Hash password with salt
		const hashedPassword = PasswordHasher.hash(this.password, saltResponse.salt);
		this.log('Hashed password:', hashedPassword.toString('hex'));

		// Step 3: Send hashed password
		const authRequest = new AuthPasswordRequest(hashedPassword);
		this.log('Sending hashed password...');
		const authPacket = await this.sendRequestNoAuth(authRequest);
		this.log('Received auth response');

		if (authPacket.opCode === ECOpCode.EC_OP_AUTH_FAIL) {
			throw new ServerException(`Authentication failed: ${AmuleConnection.authFailReason(authPacket) ?? 'unknown reason'}`);
		}

		if (authPacket.opCode !== ECOpCode.EC_OP_AUTH_OK) {
			throw new ServerException(`Unexpected auth response: ${authPacket.opCode}`);
		}
		this.log('Authentication successful!');
	}

	/**
	 * Extract the human-readable reason the daemon attaches to EC_OP_AUTH_FAIL packets.
	 */
	private static authFailReason(packet: Packet): string | undefined {
		const reason = findTag(packet.tags, ECTagName.EC_TAG_STRING)?.getValue();
		return typeof reason === 'string' && reason.length > 0 ? reason : undefined;
	}

	/**
	 * Handle incoming data
	 */
	private handleData(data: Buffer): void {
		this.log('Received data:', data.length, 'bytes, hex:', data.toString('hex').substring(0, 100));
		// Append to buffer
		this.buffer = Buffer.concat([this.buffer, data]);

		// Try to parse packets
		while (PacketParser.hasCompletePacket(this.buffer)) {
			try {
				const packet = PacketParser.parse(this.buffer);
				this.log('Parsed packet, opCode:', packet.opCode);

				// Calculate consumed bytes
				const consumedBytes = PacketParser.getExpectedPacketSize(this.buffer);
				this.buffer = this.buffer.subarray(consumedBytes);

				// Resolve pending response
				const pending = this.pendingResponses.shift();
				if (pending) {
					pending.resolve(packet);
				}
			} catch (error) {
				this.log('Parse error:', error);
				const pending = this.pendingResponses.shift();
				if (pending) {
					pending.reject(error as Error);
				}
				// If we have a parse error, the buffer might be corrupted for further packets
				this.buffer = Buffer.allocUnsafe(0);
				break;
			}
		}
	}

	/**
	 * Handle socket error
	 */
	private handleError(error: Error): void {
		this.connected = false;
		this.rejectAllPending(new CommunicationException(`Socket error: ${error.message}`));
	}

	/**
	 * Handle socket timeout
	 */
	private handleTimeout(): void {
		this.connected = false;
		this.rejectAllPending(new CommunicationException('Socket timeout'));
	}

	/**
	 * Handle socket close
	 */
	private handleClose(): void {
		this.log('Socket closed! connected:', this.connected, 'pendingResponses:', this.pendingResponses.length);
		this.connected = false;
		this.rejectAllPending(new CommunicationException('Socket closed'));
	}

	/**
	 * Send a request and wait for response
	 */
	async sendRequest(request: Request, timeoutMs?: number): Promise<Packet> {
		if (!this.connected) {
			await this.reconnect();
		}

		try {
			return await this.sendRequestNoAuth(request, timeoutMs);
		} catch (error) {
			this.connected = false;
			throw error;
		}
	}

	/**
	 * Send a request without checking authentication
	 */
	private async sendRequestNoAuth(request: Request, timeoutMs?: number): Promise<Packet> {
		if (!this.socket) {
			throw new CommunicationException('Socket not initialized');
		}

		// Build and write packet
		const packet = request.buildPacket();
		const buffer = PacketWriter.write(packet);
		this.log('Sending request:', packet.opCode.toString(16), 'Size:', buffer.length);

		// Create promise for response
		const responsePromise = new Promise<Packet>((resolve, reject) => {
			const pending: IPendingResponse = {
				resolve: (packet: Packet) => {
					if (pending.timeoutHandle) {
						clearTimeout(pending.timeoutHandle);
					}
					resolve(packet);
				},
				reject: (error: Error) => {
					if (pending.timeoutHandle) {
						clearTimeout(pending.timeoutHandle);
					}
					reject(error);
				},
			};

			const effectiveTimeout = timeoutMs ?? this.requestTimeout;
			if (effectiveTimeout > 0) {
				pending.timeoutHandle = setTimeout(() => {
					if (!this.pendingResponses.includes(pending)) {
						return;
					}
					this.connected = false;
					this.rejectAllPending(new CommunicationException(`Request timeout after ${effectiveTimeout}ms`));
					if (this.socket && !this.socket.destroyed) {
						this.socket.destroy();
					}
				}, effectiveTimeout);
			}

			this.pendingResponses.push(pending);
		});

		// Send packet
		this.socket.write(buffer);

		return responsePromise;
	}
}
