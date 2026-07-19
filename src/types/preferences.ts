export interface AmulePrefsGeneral {
	userNick: string;
	checkNewVersion: boolean;
}

export interface AmulePrefsConnection {
	uploadCapacity: number;
	downloadCapacity: number;
	maxUploadSpeed: number;
	maxDownloadSpeed: number;
	slotAllocation: number;
	tcpPort: number;
	udpPort: number;
	maxFileSources: number;
	maxConnections: number;
	autoconnect: boolean;
	reconnect: boolean;
	networkED2K: boolean;
	networkKademlia: boolean;
}

export interface AmulePrefsServers {
	removeDead: boolean;
	deadRetries: number;
	useScoreSystem: boolean;
	smartIdCheck: boolean;
	updateUrl: string;
}

export interface AmulePrefsSecurity {
	canSeeShares: number;
	ipFilterClients: boolean;
	ipFilterServers: boolean;
	ipFilterAutoUpdate: boolean;
	ipFilterUpdateUrl: string;
	ipFilterLevel: number;
	filterLan: boolean;
	useSecIdent: boolean;
	obfuscationSupported: boolean;
	obfuscationRequested: boolean;
	obfuscationRequired: boolean;
}

export interface AmulePreferences {
	general: AmulePrefsGeneral;
	connection: AmulePrefsConnection;
	servers: AmulePrefsServers;
	security: AmulePrefsSecurity;
}
