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

/**
 * Read the own numeric value of a tag (e.g. the ECID carried by EC_TAG_PARTFILE / EC_TAG_CLIENT container tags).
 * Returns undefined when the tag value is not numeric (string, buffer, ...).
 */
export function tagOwnNumericValue(tag: { getValue(): unknown } | undefined): number | undefined {
	if (!tag) return undefined;
	const value = tag.getValue();
	if (typeof value === 'number') return value;
	if (typeof value === 'bigint') return Number(value);
	return undefined;
}
