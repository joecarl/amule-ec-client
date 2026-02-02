/**
 * AmuleConnection - Manages the low-level connection to aMule EC
 */

import * as net from 'net';
import { CommunicationException, ServerException } from '../exceptions';
import { Packet } from '../ec/packet/Packet';
import { PacketParser } from '../ec/packet/PacketParser';
import { PacketWriter } from '../ec/packet/PacketWriter';
import { Flags } from '../ec/packet/Flags';
import { ECOpCode } from '../ec/Codes';
import { AuthClientInfoRequest, AuthPasswordRequest } from '../request/AuthRequest';
import type { Request } from '../request/Request';
import { AuthSaltResponse } from '../response/AuthSaltResponse';
import { PasswordHasher } from '../auth/PasswordHasher';

export class AmuleConnection {
	private socket?: net.Socket;
	private connected = false;
	private buffer: Buffer = Buffer.allocUnsafe(0);
	private pendingResponse?: {
		resolve: (packet: Packet) => void;
		reject: (error: Error) => void;
	};

	constructor(
		private host: string,
		private port: number,
		private password: string,
		private timeout: number
	) {}

	/**
	 * Reconnect to the server
	 */
	async reconnect(): Promise<void> {
		this.connected = false;
		if (this.socket) {
			this.socket.destroy();
		}

		// Create new socket
		this.socket = new net.Socket();
		if (this.timeout > 0) {
			this.socket.setTimeout(this.timeout);
		}

		// Setup event handlers
		this.socket.on('data', (data) => this.handleData(data));
		this.socket.on('error', (error) => this.handleError(error));
		this.socket.on('timeout', () => this.handleTimeout());
		this.socket.on('close', () => this.handleClose());

		// Connect
		await this.connectSocket();

		// Perform authentication
		await this.authenticate();

		this.connected = true;
	}

	/**
	 * Connect socket to server
	 */
	private connectSocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				return reject(new CommunicationException('Socket not initialized'));
			}

			this.socket.connect(this.port, this.host, () => {
				resolve();
			});

			this.socket.once('error', reject);
		});
	}

	/**
	 * Perform authentication handshake
	 */
	private async authenticate(): Promise<void> {
		console.log('[DEBUG] Starting authentication...');
		// Step 1: Send client info
		const clientInfoRequest = new AuthClientInfoRequest();
		console.log('[DEBUG] Sending client info...');
		const saltPacket = await this.sendRequestNoAuth(clientInfoRequest);
		console.log('[DEBUG] Received salt response');

		if (saltPacket.opCode === ECOpCode.EC_OP_AUTH_FAIL) {
			throw new ServerException('Authentication failed: server rejected client');
		}

		if (saltPacket.opCode !== ECOpCode.EC_OP_AUTH_SALT) {
			throw new ServerException(`Unexpected response to client info: ${saltPacket.opCode}`);
		}

		const saltResponse = AuthSaltResponse.fromPacket(saltPacket);
		console.log('[DEBUG] Salt:', saltResponse.salt);

		// Step 2: Hash password with salt
		const hashedPassword = PasswordHasher.hash(this.password, saltResponse.salt);
		console.log('[DEBUG] Hashed password:', hashedPassword.toString('hex'));

		// Step 3: Send hashed password
		const authRequest = new AuthPasswordRequest(hashedPassword);
		console.log('[DEBUG] Sending hashed password...');
		const authPacket = await this.sendRequestNoAuth(authRequest);
		console.log('[DEBUG] Received auth response');

		if (authPacket.opCode === ECOpCode.EC_OP_AUTH_FAIL) {
			throw new ServerException('Authentication failed: invalid password');
		}

		if (authPacket.opCode !== ECOpCode.EC_OP_AUTH_OK) {
			throw new ServerException(`Unexpected auth response: ${authPacket.opCode}`);
		}
		console.log('[DEBUG] Authentication successful!');
	}

	/**
	 * Handle incoming data
	 */
	private handleData(data: Buffer): void {
		console.log('[DEBUG] Received data:', data.length, 'bytes, hex:', data.toString('hex').substring(0, 100));
		// Append to buffer
		this.buffer = Buffer.concat([this.buffer, data]);

		// Try to parse packet
		if (PacketParser.hasCompletePacket(this.buffer)) {
			try {
				const packet = PacketParser.parse(this.buffer);
				console.log('[DEBUG] Parsed packet, opCode:', packet.opCode);

				// Calculate consumed bytes
				const consumedBytes = PacketParser.getExpectedPacketSize(this.buffer);
				this.buffer = this.buffer.subarray(consumedBytes);

				// Resolve pending response
				if (this.pendingResponse) {
					this.pendingResponse.resolve(packet);
					this.pendingResponse = undefined;
				}
			} catch (error) {
				console.log('[DEBUG] Parse error:', error);
				if (this.pendingResponse) {
					this.pendingResponse.reject(error as Error);
					this.pendingResponse = undefined;
				}
			}
		} else {
			console.log('[DEBUG] Incomplete packet, waiting for more data...');
		}
	}

	/**
	 * Handle socket error
	 */
	private handleError(error: Error): void {
		this.connected = false;
		if (this.pendingResponse) {
			this.pendingResponse.reject(new CommunicationException(`Socket error: ${error.message}`));
			this.pendingResponse = undefined;
		}
	}

	/**
	 * Handle socket timeout
	 */
	private handleTimeout(): void {
		this.connected = false;
		if (this.pendingResponse) {
			this.pendingResponse.reject(new CommunicationException('Socket timeout'));
			this.pendingResponse = undefined;
		}
	}

	/**
	 * Handle socket close
	 */
	private handleClose(): void {
		console.log('[DEBUG] Socket closed! connected:', this.connected, 'pendingResponse:', !!this.pendingResponse);
		this.connected = false;
		if (this.pendingResponse) {
			this.pendingResponse.reject(new CommunicationException('Socket closed'));
			this.pendingResponse = undefined;
		}
	}

	/**
	 * Send a request and wait for response
	 */
	async sendRequest(request: Request): Promise<Packet> {
		if (!this.connected) {
			await this.reconnect();
		}

		try {
			return await this.sendRequestNoAuth(request);
		} catch (error) {
			this.connected = false;
			throw error;
		}
	}

	/**
	 * Send a request without checking authentication
	 */
	private async sendRequestNoAuth(request: Request): Promise<Packet> {
		if (!this.socket) {
			throw new CommunicationException('Socket not initialized');
		}

		// Build and write packet
		const packet = request.buildPacket();
		const buffer = PacketWriter.write(packet);
		console.log('[DEBUG] Sending packet: opCode', packet.opCode, 'flags', packet.flags.getValue(), 'tags', packet.tags.length, 'bytes', buffer.length);
		console.log('[DEBUG] Packet hex:', buffer.toString('hex'));

		// Create promise for response
		const responsePromise = new Promise<Packet>((resolve, reject) => {
			this.pendingResponse = { resolve, reject };
		});

		// Send packet
		this.socket.write(buffer);

		return responsePromise;
	}
}
