/**
 * Main aMule EC Client
 */

import { AmuleConnection } from './AmuleConnection';
import type { UpdateState } from './UpdateState';
import type { AmuleFile, AmuleTransferringFile, AmuleCategory, AmuleServer, SearchType, AmuleUpDownClient, AmuleFriend } from '../model';
import { DownloadCommand } from '../model';
import type { SearchFilters } from '../types';
import { EcPrefs, ECDetailLevel } from '../ec/Codes';
import type { AmulePreferences } from '../types/preferences';

export interface AmuleClientOptions {
	host: string;
	port: number;
	password: string;
	timeout?: number;
	requestTimeout?: number;
}

export interface StatsResponse {
	id: number;
	ed2kId: number;
	kadId?: string;
	connectedServer?: {
		name?: string;
		description?: string;
		ip: string;
		port: number;
	};
	connectionState?: any; // Will be properly typed later
	uploadOverhead: number;
	downloadOverhead: number;
	bannedCount: number;
	loggerMessage: string[];
	totalSentBytes: number;
	totalReceivedBytes: number;
	sharedFileCount: number;
	uploadSpeed: number;
	downloadSpeed: number;
	uploadSpeedLimit: number;
	downloadSpeedLimit: number;
	uploadQueueLength: number;
	totalSourceCount: number;
	ed2kUsers: number;
	kadUsers: number;
	ed2kFiles: number;
	kadFiles: number;
	kadNodes: number;
}

export interface SearchResultsResponse {
	files: {
		fileName: string;
		hash: Buffer;
		sizeFull: number;
		downloadStatus: number;
		completeSourceCount: number;
		sourceCount: number;
	}[];
}

export interface UpdateResponse {
	sharedFiles: AmuleFile[];
	downloadQueue: AmuleTransferringFile[];
	clients: AmuleUpDownClient[];
	servers: AmuleServer[];
	friends: AmuleFriend[];
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
		const { UpdateState } = await import('./UpdateState');

		const request = new UpdateRequest(detailLevel);
		const packet = await this.connection.sendRequest(request);

		// sendRequest may have (re)connected: daemon-side diff state started over
		const generation = this.connection.getSessionGeneration();
		if (!this.updateState || this.updateState.sessionGeneration !== generation) {
			this.updateState = new UpdateState(generation);
		}

		return this.updateState.apply(packet);
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
	 * Get download queue
	 */
	async getDownloadQueue(): Promise<AmuleTransferringFile[]> {
		const { DownloadQueueRequest } = await import('../request/DownloadQueueRequest');
		const { DownloadQueueResponseParser } = await import('../response/DownloadQueueResponse');

		const request = new DownloadQueueRequest();
		const packet = await this.connection.sendRequest(request);

		return DownloadQueueResponseParser.fromPacket(packet).files;
	}

	/**
	 * Get shared files
	 */
	async getSharedFiles(): Promise<AmuleFile[]> {
		const { SharedFilesRequest } = await import('../request/SharedFilesRequest');
		const { SharedFilesResponseParser } = await import('../response/SharedFilesResponse');

		const request = new SharedFilesRequest();
		const packet = await this.connection.sendRequest(request);

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
	 * Get client upload/download queue (clients we are uploading to/downloading from)
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
	 * Connect to a specific server
	 */
	async connectToServer(ip?: string, port?: number): Promise<void> {
		const { ServerConnectRequest } = await import('../request/ServerConnectRequest');

		const request = new ServerConnectRequest(ip, port);
		await this.connection.sendRequest(request);
	}

	/**
	 * Disconnect from the current server
	 */
	async disconnectFromServer(): Promise<void> {
		const { ServerDisconnectRequest } = await import('../request/ServerDisconnectRequest');

		const request = new ServerDisconnectRequest();
		await this.connection.sendRequest(request);
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
	 */
	async updateServerListFromUrl(url: string): Promise<void> {
		const { ServerUpdateFromUrlRequest } = await import('../request/ServerUpdateFromUrlRequest');

		const request = new ServerUpdateFromUrlRequest(url);
		await this.connection.sendRequest(request);
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
