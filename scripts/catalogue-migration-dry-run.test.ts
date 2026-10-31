import assert from 'node:assert/strict';
import { normalizeProduct } from './catalogueMigration.js';

const record = normalizeProduct('example', {
  Name: 'Example Shirt',
  name: 'Conflicting Shirt',
  Category: 'Shirts',
  colors: 'White, Navy',
  color: 'Black',
  Sizes: 'S, M',
  'Original Price': '2,000',
  imageurl: 'https://example.com/primary.jpg',
  imageurl2: 'https://example.com/primary.jpg',
  vendorId: 'vendor-1',
  'vendorId ': 'vendor-2',
  price: 1500,
  stockQuantity: 3
});

assert.equal(record.canonical.productId, 'example');
assert.equal(record.canonical.name, 'Conflicting Shirt');
assert.deepEqual(record.canonical.secondaryColors, ['Navy Blue', 'Black']);
assert.deepEqual(record.canonical.sizes, ['S', 'M']);
assert.equal(record.canonical.originalPrice, 2000);
assert.equal(record.canonical.stock, 3);
assert.equal(record.canonical.inStock, true);
assert.ok(record.conflicts.some((conflict) => conflict.canonicalField === 'name'));
assert.ok(record.conflicts.some((conflict) => conflict.canonicalField === 'vendorId'));
assert.ok(record.flags.includes('source_field_conflict'));
assert.deepEqual(record.canonical.imageMetadata.duplicateUrls, ['https://example.com/primary.jpg']);

console.log('catalogue-migration-dry-run tests passed');
