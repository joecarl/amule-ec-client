// Additional type definitions

export interface SearchFilters {
	minSize?: number;
	maxSize?: number;
	fileType?: string;
	extension?: string;
	availability?: number;
}

export interface ConnectionState {
	ed2kConnected: boolean;
	ed2kConnecting: boolean;
	kadConnected: boolean;
	kadFirewalled: boolean;
	kadRunning: boolean;
	serverIpv4?: {
		address: string;
		port: number;
	};
	serverPing?: number;
	serverPrio?: number;
	serverFailed?: number;
	serverStatic?: boolean;
	serverVersion?: string;
	serverName?: string;
	serverDescription?: string;
	serverUsers?: number;
	serverUsersMax?: number;
	serverFiles?: number;
	ed2kId?: number;
	kadId?: number;
	clientId?: number;
}

// Backwards-compatible alias: the canonical enum lives with the other EC protocol codes
export { ECSearchFileDownloadStatus as SearchFileDownloadStatus } from '../ec/Codes';

export enum BuddyState {
	Disconnected = 0,
	Connecting = 1,
	Connected = 2,
}

export * from './preferences';
export * from './download-details';
