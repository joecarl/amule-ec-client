/**
 * Auth OK Response - Indicates successful authentication
 */

import { Packet } from '../ec/packet/Packet';

export class AuthOkResponse {
	static fromPacket(packet: Packet): AuthOkResponse {
		return new AuthOkResponse();
	}
}
