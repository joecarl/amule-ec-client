export function formatIp(ip: number | undefined): string {
	if (ip === undefined) return '';
	// EC protocol uses network byte order (big-endian) for IP addresses in UINT32
	return [(ip >>> 24) & 0xff, (ip >>> 16) & 0xff, (ip >>> 8) & 0xff, ip & 0xff].join('.');
}
