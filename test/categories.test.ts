import { describe, it, expect } from 'vitest';
import { ECTagName, ECTagType, ECOpCode, EcPrefs } from '../src/ec/Codes';
import { StringTag, UByteTag, UIntTag, CustomTag } from '../src/ec/tag/Tag';
import { Packet } from '../src/ec/packet/Packet';
import { Flags } from '../src/ec/packet/Flags';
import { PreferencesResponseParser } from '../src/response/PreferencesResponse';
import { CreateCategoryRequest } from '../src/request/CreateCategoryRequest';

describe('Category Management', () => {
	describe('CreateCategoryRequest', () => {
		it('should correctly structure the create category request tags', () => {
			const category = {
				id: 0,
				name: 'Test Category',
				path: '/downloads/test',
				comment: 'This is a test',
				color: 16711680, // Red
				priority: 1,
			};

			const request = new CreateCategoryRequest(category);
			const packet = request.buildPacket();

			expect(packet.opCode).toBe(ECOpCode.EC_OP_CREATE_CATEGORY);
			expect(packet.tags.length).toBe(1);

			const categoryTag = packet.tags[0];
			expect(categoryTag.name).toBe(ECTagName.EC_TAG_CATEGORY);
			expect(categoryTag.nestedTags?.length).toBe(5);

			const titleTag = categoryTag.nestedTags?.find((t) => t.name === ECTagName.EC_TAG_CATEGORY_TITLE);
			expect(titleTag?.getValue()).toBe('Test Category');

			const colorTag = categoryTag.nestedTags?.find((t) => t.name === ECTagName.EC_TAG_CATEGORY_COLOR);
			expect(colorTag?.getValue()).toBe(16711680);
		});
	});

	describe('PreferencesResponseParser', () => {
		it('should correctly parse categories from preferences packet', () => {
			// Mock a packet that looks like a Preferences response with categories
			const categorySubtags = [
				new StringTag(ECTagName.EC_TAG_CATEGORY_TITLE, 'Movies'),
				new StringTag(ECTagName.EC_TAG_CATEGORY_PATH, '/ext/movies'),
				new StringTag(ECTagName.EC_TAG_CATEGORY_COMMENT, 'Favorite movies'),
				new UIntTag(ECTagName.EC_TAG_CATEGORY_COLOR, 255),
				new UByteTag(ECTagName.EC_TAG_CATEGORY_PRIO, 2),
			];

			const categoryTag = new UIntTag(ECTagName.EC_TAG_CATEGORY, 1, categorySubtags);
			const prefsCategoriesTag = new CustomTag(ECTagName.EC_TAG_PREFS_CATEGORIES, Buffer.alloc(0), [categoryTag]);

			const packet = new Packet(ECOpCode.EC_OP_GET_PREFERENCES, Flags.useUtf8Numbers(), [prefsCategoriesTag]);

			const response = PreferencesResponseParser.fromPacket(packet);

			expect(response.categories.length).toBe(1);
			expect(response.categories[0].name).toBe('Movies');
			expect(response.categories[0].id).toBe(1);
			expect(response.categories[0].path).toBe('/ext/movies');
			expect(response.categories[0].comment).toBe('Favorite movies');
			expect(response.categories[0].color).toBe(255);
			expect(response.categories[0].priority).toBe(2);
		});
	});
});
