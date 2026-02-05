/**
 * Example: Category Creation and Retrieval
 *
 * This example tests the real connection to aMule to create a category
 * and then retrieve the list of categories to verify it was created.
 */

import { AmuleClient } from '../../src';

async function main() {
	// Create the client (using default credentials from setup-amule.sh)
	const client = new AmuleClient({
		host: 'localhost',
		port: 4712,
		password: 'secret',
	});

	try {
		console.log('Connecting to aMule...');

		// 1. Get current categories
		const initialCategories = await client.getCategories();
		console.log(`Initial category count: ${initialCategories.length}`);
		console.log(
			'Current categories:',
			initialCategories.map((c) => c)
		);

		// 2. Create a new test category
		const testCategoryName = `Test_${Date.now()}`;
		console.log(`Creating category: ${testCategoryName}...`);

		await client.createCategory({
			id: 0, // aMule will assign an ID
			name: testCategoryName,
			path: '',
			comment: 'Created by integration test',
			color: 0x23,
			priority: 0, // Default
		});

		// Wait a moment for aMule to process
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// 3. Verify creation
		const updatedCategories = await client.getCategories();
		console.log(`Updated category count: ${updatedCategories.length}`);

		const found = updatedCategories.find((c) => c.name === testCategoryName);
		if (found) {
			console.log('✅ Success: Category found in the list!');
			console.log(`   Internal ID: ${found.id}`);
			console.log(`   Path: ${found.path}`);
			console.log(`   Comment: ${found.comment}`);
		} else {
			console.error('❌ Error: Category not found after creation.');
			// Let's print the categories we found
			console.log(
				'Categories found:',
				updatedCategories.map((c) => c.name)
			);
		}

		// 4. Update the category (optional, just to test update functionality)
		if (found) {
			const newComment = 'Updated comment';
			console.log('Updating the test category comment...');
			await client.updateCategory(found.id, {
				...found,
				comment: newComment,
			});

			// Wait for update to process
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Verify update
			const postUpdateCategories = await client.getCategories();
			const updatedCategory = postUpdateCategories.find((c) => c.id === found?.id);
			if (updatedCategory && updatedCategory.comment === newComment) {
				console.log('✅ Update verified: Comment is now:', updatedCategory.comment);
			} else {
				console.error('❌ Error: Updated category not found or comment did not update.');
			}
		}

		// 5. Cleanup: Delete the test category
		console.log('Cleaning up: Deleting the test category...');
		if (found) {
			await client.deleteCategory(found.id);
			console.log('Test category deleted.');
		} else {
			console.log('No category to delete.');
		}

		// 6. Final verification
		const finalCategories = await client.getCategories();
		console.log(`Final category count: ${finalCategories.length}`);
	} catch (error) {
		console.error('An error occurred:', error);
	}
}

main();
