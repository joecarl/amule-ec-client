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

export enum SearchFileDownloadStatus {
	NEW = 0,
	DOWNLOADED = 1,
	QUEUED = 2,
	CANCELED = 3,
	QUEUEDCANCELED = 4,
}

export enum BuddyState {
	Disconnected = 0,
	Connecting = 1,
	Connected = 2,
}
