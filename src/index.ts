/**
 * aMule EC Client for TypeScript
 *
 * A TypeScript client library for interacting with aMule's External Connection (EC) protocol.
 *
 * @packageDocumentation
 */

// Main client
export { AmuleClient } from './client/AmuleClient';
export type { AmuleClientOptions, StatsResponse, SearchResultsResponse } from './client/AmuleClient';

// Models
export * from './model';

// Enums and constants
export { ECOpCode, ECTagName, ECDetailLevel, ECSearchType, EcPrefs, ProtocolVersion } from './ec/Codes';

// Exceptions
export { AmuleException, InvalidECException, CommunicationException, ServerException } from './exceptions';

// Types
export type { SearchFilters, ConnectionState, SearchFileDownloadStatus } from './types';

// Protocol components (for advanced usage)
export { Packet } from './ec/packet/Packet';
export { Flags } from './ec/packet/Flags';
export { PacketWriter } from './ec/packet/PacketWriter';
export { PacketParser } from './ec/packet/PacketParser';

// Tags (for advanced usage)
export { Tag, CustomTag, UByteTag, UShortTag, UIntTag, ULongTag, UInt128Tag, StringTag, DoubleTag, Ipv4Tag, Hash16Tag } from './ec/tag/Tag';
