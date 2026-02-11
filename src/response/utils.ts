export function formatIp(ip: number | undefined): string {
	if (ip === undefined) return '';
	// EC protocol uses network byte order (big-endian) for IP addresses in UINT32
	return [(ip >>> 24) & 0xff, (ip >>> 16) & 0xff, (ip >>> 8) & 0xff, ip & 0xff].join('.');
}

// Helper to convert bigint to number safely
export function toOptionalNumber(value: bigint | number | undefined): number | undefined {
	if (value === undefined) return undefined;
	return typeof value === 'bigint' ? Number(value) : value;
}

export function toOptionalBool(value: number | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	return value !== 0;
}

export function toOptionalIp(value: number | undefined): string | undefined {
	if (value === undefined) return undefined;
	return formatIp(value);
}
