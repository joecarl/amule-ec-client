import { describe, it, expect } from 'vitest';
import { ECTagName, ECTagType, ECOpCode } from '../src/ec/Codes';
import { FilePriority } from '../src/model';
import { PartFilePriorityRequest } from '../src/request/PartFilePriorityRequest';

describe('PartFilePriorityRequest', () => {
	it('should build a partfile priority set request with the priority as the hash tag child', () => {
		const hash = Buffer.from('00112233445566778899aabbccddeeff', 'hex');

		const request = new PartFilePriorityRequest(hash, FilePriority.HIGH);
		const packet = request.buildPacket();

		expect(packet.opCode).toBe(ECOpCode.EC_OP_PARTFILE_PRIO_SET);

		const partFileTags = packet.tags.filter((tag) => tag.name === ECTagName.EC_TAG_PARTFILE);
		expect(partFileTags.length).toBe(1);

		const partFileTag = partFileTags[0];
		expect(partFileTag.type).toBe(ECTagType.EC_TAGTYPE_HASH16);
		expect(partFileTag.getValue()).toEqual(hash);

		expect(partFileTag.nestedTags?.length).toBe(1);

		const priorityTag = partFileTag.nestedTags?.[0];
		expect(priorityTag?.name).toBe(ECTagName.EC_TAG_PARTFILE_PRIO);
		expect(priorityTag?.type).toBe(ECTagType.EC_TAGTYPE_UINT8);
		expect(priorityTag?.getValue()).toBe(FilePriority.HIGH);
	});
});
