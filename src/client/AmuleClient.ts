/**
 * Main aMule EC Client
 */

import { AmuleConnection } from './AmuleConnection';
import type { AmuleFile, AmuleTransferringFile, AmuleCategory, AmuleServer, DownloadCommand, SearchType } from '../model';
import type { SearchFilters } from '../types';

export interface AmuleClientOptions {
	host: string;
	port: number;
	password: string;
	timeout?: number;
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
	files: Array<{
		fileName: string;
		hash: Buffer;
		sizeFull: number;
		downloadStatus: number;
		completeSourceCount: number;
		sourceCount: number;
	}>;
}

export class AmuleClient {
	private connection: AmuleConnection;

	constructor(options: AmuleClientOptions) {
		this.connection = new AmuleConnection(options.host, options.port, options.password, options.timeout || 0);
	}

	/**
	 * Reconnect to the server
	 */
	async reconnect(): Promise<void> {
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
	async connectToServer(ip: string, port: number): Promise<void> {
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
		// TODO: Implement category creation (requires complex tag structure)
		throw new Error('Not implemented yet');
	}

	/**
	 * Get all categories
	 */
	async getCategories(): Promise<AmuleCategory[]> {
		// TODO: Implement get categories (part of preferences)
		return [];
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
		const { DownloadCommand } = await import('../model');
		await this.sendDownloadCommand(hash, DownloadCommand.PAUSE);
	}

	/**
	 * Resume a download
	 */
	async resumeDownload(hash: Buffer): Promise<void> {
		const { DownloadCommand } = await import('../model');
		await this.sendDownloadCommand(hash, DownloadCommand.RESUME);
	}

	/**
	 * Stop a download
	 */
	async stopDownload(hash: Buffer): Promise<void> {
		const { DownloadCommand } = await import('../model');
		await this.sendDownloadCommand(hash, DownloadCommand.STOP);
	}

	/**
	 * Delete a download
	 */
	async deleteDownload(hash: Buffer): Promise<void> {
		const { DownloadCommand } = await import('../model');
		await this.sendDownloadCommand(hash, DownloadCommand.DELETE);
	}
}
