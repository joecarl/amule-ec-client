/**
 * Main aMule EC Client
 */

import { AmuleConnection } from './AmuleConnection';
import type { UpdateState } from './UpdateState';
import type { AmuleFile, AmuleTransferringFile, AmuleCategory, AmuleServer, SearchType, AmuleUpDownClient, ServerPriority } from '../model';
import { DownloadCommand } from '../model';
import type { SearchFilters } from '../types';
import { EcPrefs, ECDetailLevel, ECOpCode, ECTagName } from '../ec/Codes';
import { findTag } from '../ec/tag/Tag';
import { ServerException } from '../exceptions';
import type { Request } from '../request/Request';
import type { AmulePreferences } from '../types/preferences';
import type { StatsResponse } from '../response/StatsResponse';
import type { SearchResultsResponse } from '../response/SearchResultsResponse';
import type { UpdateResponse } from '../response/UpdateResponse';

// Response shapes live next to their parsers; re-exported here for backwards compatibility
export type { StatsResponse, SearchResultsResponse, UpdateResponse };

export interface AmuleClientOptions {
	host: string;
	port: number;
	password: string;
	timeout?: number;
	requestTimeout?: number;
}

export class AmuleClient {
	private connection: AmuleConnection;
	private updateState?: UpdateState;

	constructor(options: AmuleClientOptions) {
		this.connection = new AmuleConnection(options.host, options.port, options.password, options.timeout || 0, options.requestTimeout || 0);
	}

	/**
	 * Set default timeout for individual request/response cycles.
	 * Use 0 to disable request timeout.
	 */
	setRequestTimeout(timeoutMs: number): void {
		this.connection.setRequestTimeout(timeoutMs);
	}

	/**
	 * Get current default timeout for requests.
	 */
	getRequestTimeout(): number {
		return this.connection.getRequestTimeout();
	}

	/**
	 * Reconnect to the server
	 */
	async reconnect(): Promise<void> {
		// The daemon tracks incremental update state per connection, so ours must go too
		this.updateState = undefined;
		await this.connection.reconnect();
	}

	/**
	 * Get server statistics
	 */
	async getStats(): Promise<StatsResponse> {
		const { StatsRequest } = await import('../request/StatsRequest');
		const { StatsResponseParser } = await import('../response/StatsResponse');

		const request = new StatsRequest();
		const packet = await this.connection.sendRequest(request);

		return StatsResponseParser.fromPacket(packet);
	}

	/**
	 * Per-connection file-detail state (diff baselines, source names, merged snapshots).
	 * The daemon diffs per connection and shares the diff state between the update,
	 * download-queue and shared-files requests, so this state must be fed by all of
	 * them (see UpdateState). Call only after sendRequest: connecting may have started
	 * a new session, which invalidates the previous state.
	 */
	private async getFileState(): Promise<UpdateState> {
		const { UpdateState } = await import('./UpdateState');

		const generation = this.connection.getSessionGeneration();
		if (!this.updateState || this.updateState.sessionGeneration !== generation) {
			this.updateState = new UpdateState(generation);
		}
		return this.updateState;
	}

	/**
	 * Get updates for files, clients, servers, and friends.
	 *
	 * The underlying EC_OP_GET_UPDATE request is incremental per connection: the daemon
	 * only sends the fields that changed since the previous call. This method keeps a
	 * client-side cache and merges those diffs, so it always returns full snapshots.
	 * Downloads carry their connected peers in `sources` (linked via client requestFileId
	 * and file ecid). The cache is reset whenever the connection is re-established.
	 */
	async getUpdate(detailLevel: ECDetailLevel = ECDetailLevel.EC_DETAIL_INC_UPDATE): Promise<UpdateResponse> {
		const { UpdateRequest } = await import('../request/UpdateRequest');

		const request = new UpdateRequest(detailLevel);
		const packet = await this.connection.sendRequest(request);

		const state = await this.getFileState();
		return state.apply(packet);
	}

	/**
	 * Get the download queue including per-peer source details.
	 *
	 * Unlike getDownloadQueue() (EC_OP_GET_DLOAD_QUEUE, which never includes peers),
	 * this uses the incremental update mechanism (see getUpdate), the only way the
	 * daemon exposes the clients each download is fed from. Each returned file has
	 * `sources` filled with the currently connected peers for that download.
	 */
	async getDownloadQueueWithSources(): Promise<AmuleTransferringFile[]> {
		const update = await this.getUpdate();
		return update.downloadQueue;
	}

	/**
	 * Start an asynchronous search
	 */
	async searchAsync(query: string, searchType?: SearchType, filters?: SearchFilters): Promise<string> {
		const { SearchRequest } = await import('../request/SearchRequest');

		const request = new SearchRequest(query, searchType, filters);
		await this.connection.sendRequest(request);

		return query;
	}

	/**
	 * Get search status (0-1)
	 */
	async searchStatus(): Promise<number> {
		const { SearchStatusRequest } = await import('../request/SearchStatusRequest');
		const { SearchProgressResponse } = await import('../response/SearchProgressResponse');

		const request = new SearchStatusRequest();
		const packet = await this.connection.sendRequest(request);

		const response = SearchProgressResponse.fromPacket(packet);
		return response.progress;
	}

	/**
	 * Get search results
	 */
	async searchResults(): Promise<SearchResultsResponse> {
		const { SearchResultsRequest } = await import('../request/SearchResultsRequest');
		const { SearchResultsResponseParser } = await import('../response/SearchResultsResponse');

		const request = new SearchResultsRequest();
		const packet = await this.connection.sendRequest(request);

		return SearchResultsResponseParser.fromPacket(packet);
	}

	/**
	 * Perform a synchronous search (waits for results)
	 */
	async searchSync(query: string, searchType?: SearchType, filters?: SearchFilters, timeout: number = 30000): Promise<SearchResultsResponse> {
		// Start search
		await this.searchAsync(query, searchType, filters);

		// Wait for completion
		const startTime = Date.now();
		while (Date.now() - startTime < timeout) {
			const progress = await this.searchStatus();

			if (progress >= 1.0) {
				return await this.searchResults();
			}

			// Wait a bit before checking again
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		throw new Error('Search timeout');
	}

	/**
	 * Stop current search
	 */
	async searchStop(): Promise<void> {
		const { SearchStopRequest } = await import('../request/SearchStopRequest');

		const request = new SearchStopRequest();
		await this.connection.sendRequest(request);
	}

	/**
	 * Download a file from search results
	 */
	async downloadSearchResult(hash: Buffer): Promise<void> {
		const { DownloadFileRequest } = await import('../request/DownloadFileRequest');

		const request = new DownloadFileRequest(hash);
		await this.connection.sendRequest(request);
	}

	/**
	 * Download from an ed2k link
	 */
	async downloadEd2kLink(link: string): Promise<void> {
		const { AddLinkRequest } = await import('../request/AddLinkRequest');

		const request = new AddLinkRequest(link);
		await this.connection.sendRequest(request);
	}

	/**
	 * Get download queue (EC_OP_GET_DLOAD_QUEUE, full detail).
	 *
	 * The response rebases the per-connection diff state the daemon shares with
	 * getUpdate()/getDownloadQueueWithSources(), so it is fed into the same
	 * client-side state: both methods stay consistent however they are interleaved,
	 * and chunkInfo/sourceNames are correct across repeated calls.
	 */
	async getDownloadQueue(): Promise<AmuleTransferringFile[]> {
		const { DownloadQueueRequest } = await import('../request/DownloadQueueRequest');

		const request = new DownloadQueueRequest();
		const packet = await this.connection.sendRequest(request);

		const state = await this.getFileState();
		return state.applyDownloadQueue(packet);
	}

	/**
	 * Get shared files
	 */
	async getSharedFiles(): Promise<AmuleFile[]> {
		const { SharedFilesRequest } = await import('../request/SharedFilesRequest');
		const { SharedFilesResponseParser } = await import('../response/SharedFilesResponse');

		const request = new SharedFilesRequest();
		const packet = await this.connection.sendRequest(request);

		// Shared partfiles are encoded through the same per-connection diff encoders
		// as the download paths; record the rebased baselines
		const state = await this.getFileState();
		state.applySharedFiles(packet);

		return SharedFilesResponseParser.fromPacket(packet).files;
	}

	/**
	 * Reload shared files list
	 */
	async reloadSharedFiles(): Promise<void> {
		const { ReloadSharedFilesRequest } = await import('../request/ReloadSharedFilesRequest');

		const request = new ReloadSharedFilesRequest();
		await this.connection.sendRequest(request);
	}

	/**
	 * Get the upload queue: clients we are uploading to or that wait in our queue
	 * (EC_OP_GET_ULOAD_QUEUE). For download sources use getDownloadQueueWithSources().
	 */
	async getClientQueue(): Promise<AmuleUpDownClient[]> {
		const { ClientQueueRequest } = await import('../request/ClientQueueRequest');
		const { ClientQueueResponseParser } = await import('../response/ClientQueueResponse');

		const request = new ClientQueueRequest();
		const packet = await this.connection.sendRequest(request);

		return ClientQueueResponseParser.fromPacket(packet).clients;
	}

	/**
	 * Get the list of servers
	 */
	async getServerList(): Promise<AmuleServer[]> {
		const { ServerListRequest } = await import('../request/ServerListRequest');
		const { ServerListResponseParser } = await import('../response/ServerListResponse');

		const request = new ServerListRequest();
		const packet = await this.connection.sendRequest(request);

		return ServerListResponseParser.fromPacket(packet).servers;
	}

	/**
	 * Send a command-style request (one answered with EC_OP_NOOP) and surface a
	 * daemon rejection: an EC_OP_FAILED response carries the reason in an
	 * EC_TAG_STRING tag, which becomes the ServerException message.
	 */
	private async sendCommand(request: Request): Promise<void> {
		const packet = await this.connection.sendRequest(request);

		if (packet.opCode === ECOpCode.EC_OP_FAILED) {
			const reason = findTag(packet.tags, ECTagName.EC_TAG_STRING)?.getValue();
			throw new ServerException(typeof reason === 'string' ? reason : 'Request failed');
		}
	}

	/**
	 * Connect to a specific server, or to any server when ip/port are omitted.
	 *
	 * @throws ServerException if the daemon rejects the request (server not in the
	 * list, or eD2k disabled in preferences).
	 */
	async connectToServer(ip?: string, port?: number): Promise<void> {
		const { ServerConnectRequest } = await import('../request/ServerConnectRequest');

		await this.sendCommand(new ServerConnectRequest(ip, port));
	}

	/**
	 * Disconnect from the current server
	 */
	async disconnectFromServer(): Promise<void> {
		const { ServerDisconnectRequest } = await import('../request/ServerDisconnectRequest');

		await this.sendCommand(new ServerDisconnectRequest());
	}

	/**
	 * Add a server to the server list.
	 *
	 * @throws ServerException ("Server not added") if the daemon rejects it, e.g.
	 * the server is already listed or its IP is blocked by the IP filter.
	 */
	async addServer(ip: string, port: number, name?: string): Promise<void> {
		const { ServerAddRequest } = await import('../request/ServerAddRequest');

		await this.sendCommand(new ServerAddRequest(ip, port, name));
	}

	/**
	 * Remove a server from the server list.
	 *
	 * @throws ServerException ("server not found: ip:port") if no listed server
	 * matches the given address.
	 */
	async removeServer(ip: string, port: number): Promise<void> {
		const { ServerRemoveRequest } = await import('../request/ServerRemoveRequest');

		await this.sendCommand(new ServerRemoveRequest(ip, port));
	}

	/**
	 * Set a server's connection priority.
	 *
	 * The daemon identifies the server by its ECID, which is only reported through
	 * the incremental update mechanism: take it from getUpdate().servers
	 * (getServerList() responses identify servers by IP and don't carry the ECID).
	 *
	 * Note the daemon always answers EC_OP_NOOP, even for an unknown ECID: a stale
	 * ECID makes this a silent no-op, so verify through getUpdate() when it matters.
	 */
	async setServerPriority(ecid: number, priority: ServerPriority): Promise<void> {
		const { ServerSetStaticPrioRequest } = await import('../request/ServerSetStaticPrioRequest');

		await this.sendCommand(new ServerSetStaticPrioRequest(ecid, { priority }));
	}

	/**
	 * Set or clear a server's static flag (static servers are never auto-removed).
	 * See setServerPriority for how to obtain the ECID and the silent no-op caveat.
	 */
	async setServerStatic(ecid: number, isStatic: boolean): Promise<void> {
		const { ServerSetStaticPrioRequest } = await import('../request/ServerSetStaticPrioRequest');

		await this.sendCommand(new ServerSetStaticPrioRequest(ecid, { isStatic }));
	}

	/**
	 * Create a category
	 */
	async createCategory(category: AmuleCategory): Promise<void> {
		const { CreateCategoryRequest } = await import('../request/CreateCategoryRequest');

		const request = new CreateCategoryRequest(category);
		await this.connection.sendRequest(request);
	}

	/**
	 * Update a category
	 */
	async updateCategory(id: number, category: AmuleCategory): Promise<void> {
		const { UpdateCategoryRequest } = await import('../request/UpdateCategoryRequest');

		const request = new UpdateCategoryRequest(id, category);
		await this.connection.sendRequest(request);
	}

	/**
	 * Delete a category
	 */
	async deleteCategory(id: number): Promise<void> {
		const { DeleteCategoryRequest } = await import('../request/DeleteCategoryRequest');

		const request = new DeleteCategoryRequest(id);
		await this.connection.sendRequest(request);
	}

	/**
	 * Get all categories
	 */
	async getCategories(): Promise<AmuleCategory[]> {
		const { GetPreferencesRequest } = await import('../request/GetPreferencesRequest');
		const { PreferencesResponseParser } = await import('../response/PreferencesResponse');

		const request = new GetPreferencesRequest(EcPrefs.EC_PREFS_CATEGORIES);
		const packet = await this.connection.sendRequest(request);
		return PreferencesResponseParser.fromPacket(packet).categories;
	}

	/**
	 * Set file category
	 */
	async setFileCategory(hash: Buffer, categoryId: number): Promise<void> {
		const { SetFileCategoryRequest } = await import('../request/SetFileCategoryRequest');

		const request = new SetFileCategoryRequest(hash, categoryId);
		await this.connection.sendRequest(request);
	}

	/**
	 * Send a download command (PAUSE, RESUME, STOP, DELETE, etc.)
	 */
	async sendDownloadCommand(hash: Buffer, command: DownloadCommand): Promise<void> {
		const { DownloadCommandRequest } = await import('../request/DownloadCommandRequest');

		const request = new DownloadCommandRequest(hash, command);
		await this.connection.sendRequest(request);
	}

	/**
	 * Pause a download
	 */
	async pauseDownload(hash: Buffer): Promise<void> {
		await this.sendDownloadCommand(hash, DownloadCommand.PAUSE);
	}

	/**
	 * Resume a download
	 */
	async resumeDownload(hash: Buffer): Promise<void> {
		await this.sendDownloadCommand(hash, DownloadCommand.RESUME);
	}

	/**
	 * Stop a download
	 */
	async stopDownload(hash: Buffer): Promise<void> {
		await this.sendDownloadCommand(hash, DownloadCommand.STOP);
	}

	/**
	 * Delete a download
	 */
	async deleteDownload(hash: Buffer): Promise<void> {
		await this.sendDownloadCommand(hash, DownloadCommand.DELETE);
	}

	/**
	 * Trigger a server list update from an URL.
	 *
	 * Fire-and-forget: the daemon saves the URL as the new server.met source, answers
	 * EC_OP_NOOP right away and downloads in a background thread, so success here only
	 * means the request was accepted. Failures (invalid URL, unreachable host) are just
	 * logged daemon-side; observe the outcome through getServerList()/getUpdate().
	 */
	async updateServerListFromUrl(url: string): Promise<void> {
		const { ServerUpdateFromUrlRequest } = await import('../request/ServerUpdateFromUrlRequest');

		await this.sendCommand(new ServerUpdateFromUrlRequest(url));
	}

	/**
	 * Set upload priority for a shared file.
	 */
	async setSharedFilePriority(hash: Buffer, priority: number): Promise<void> {
		const { SharedFilePriorityRequest } = await import('../request/SharedFilePriorityRequest');

		const request = new SharedFilePriorityRequest(hash, priority);
		await this.connection.sendRequest(request);
	}

	/**
	 * Get daemon preferences for general/connection/servers/security sections.
	 */
	async getPreferences(): Promise<AmulePreferences> {
		const { GetPreferencesRequest } = await import('../request/GetPreferencesRequest');
		const { PreferencesDetailsResponseParser } = await import('../response/PreferencesDetailsResponse');

		const prefMask = EcPrefs.EC_PREFS_GENERAL | EcPrefs.EC_PREFS_CONNECTIONS | EcPrefs.EC_PREFS_SERVERS | EcPrefs.EC_PREFS_SECURITY;

		const request = new GetPreferencesRequest(prefMask);
		const packet = await this.connection.sendRequest(request);
		return PreferencesDetailsResponseParser.fromPacket(packet).preferences;
	}

	/**
	 * Set daemon preferences. Only sections present in the input object are sent.
	 */
	async setPreferences(preferences: Partial<AmulePreferences>): Promise<void> {
		if (!preferences.general && !preferences.connection && !preferences.servers && !preferences.security) {
			return;
		}

		const { SetPreferencesRequest } = await import('../request/SetPreferencesRequest');

		const request = new SetPreferencesRequest(preferences);
		await this.connection.sendRequest(request);
	}
}
