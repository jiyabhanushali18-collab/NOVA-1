import {
  getProductColorOptions,
  getGarmentColorImage,
  getGarmentColorModelBg,
  GarmentColorOption,
} from './arTryOnColors';
import { ProductItem } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

console.log('--- Testing arTryOnColors Unit Logic ---');

// 1. Garment with one colour -> selector hidden (less than 2 colors)
const singleColorProduct: ProductItem = {
  id: 'single-color-tee',
  name: 'Minimal Black Tee',
  category: 'Tops',
  price: 999,
  imageUrl: 'https://example.com/black-tee.jpg',
  colors: ['Black'],
  sizes: ['M'],
  inStock: true,
  details: [],
};
const singleColors = getProductColorOptions(singleColorProduct);
assert(singleColors.length === 1, 'Single-color product returns exactly 1 color option');
assert(singleColors.length <= 1, 'Garment with one colour results in hidden selector (length <= 1)');

// 2. Garment with multiple colours -> swatches displayed (length > 1)
const multiColorProduct: ProductItem = {
  id: 'hoodie-multi',
  name: 'Lavender Hoodie',
  category: 'Streetwear',
  price: 1499,
  imageUrl: 'https://example.com/lavender-hoodie.jpg',
  imageUrls: [
    'https://example.com/lavender-hoodie.jpg',
    'https://example.com/mint-hoodie.jpg',
    'https://example.com/beige-hoodie.jpg',
    'https://example.com/black-hoodie.jpg',
    'https://example.com/sky-blue-hoodie.jpg'
  ],
  colors: ['Lavender', 'Mint Green', 'Beige', 'Black', 'Sky Blue'],
  variants: [
    { id: 'lavender', colorName: 'Lavender', colorHex: '#C4B5FD', images: ['https://example.com/lavender-hoodie.jpg'], thumbnail: 'https://example.com/lavender-hoodie.jpg', isAvailable: true, displayOrder: 0 },
    { id: 'mint', colorName: 'Mint Green', colorHex: '#34D399', images: ['https://example.com/mint-hoodie.jpg'], thumbnail: 'https://example.com/mint-hoodie.jpg', isAvailable: true, displayOrder: 1 },
    { id: 'beige', colorName: 'Beige', colorHex: '#D6CDBA', images: ['https://example.com/beige-hoodie.jpg'], thumbnail: 'https://example.com/beige-hoodie.jpg', isAvailable: true, displayOrder: 2 },
    { id: 'black', colorName: 'Black', colorHex: '#000000', images: ['https://example.com/black-hoodie.jpg'], thumbnail: 'https://example.com/black-hoodie.jpg', isAvailable: true, displayOrder: 3 },
    { id: 'sky-blue', colorName: 'Sky Blue', colorHex: '#38BDF8', images: ['https://example.com/sky-blue-hoodie.jpg'], thumbnail: 'https://example.com/sky-blue-hoodie.jpg', isAvailable: true, displayOrder: 4 }
  ],
  sizes: ['M', 'L'],
  inStock: true,
  details: [],
};
const multiColors = getProductColorOptions(multiColorProduct);
assert(multiColors.length === 5, 'Multi-color product returns all 5 color options');
assert(multiColors.length > 1, 'Multi-color product displays colour selector (length > 1)');

// 3. Hex code accuracy
const lavenderOption = multiColors.find((c) => c.name === 'Lavender');
const blackOption = multiColors.find((c) => c.name === 'Black');
assert(Boolean(lavenderOption && lavenderOption.hex.toUpperCase() === '#C4B5FD'), 'Lavender has correct lavender hex code (#C4B5FD)');
assert(Boolean(blackOption && blackOption.hex.toUpperCase() === '#000000'), 'Black has correct black hex code (#000000)');

// 4. Variant has specific image -> preview image updates
const lavenderImg = getGarmentColorImage(multiColorProduct, 'Lavender');
const blackImg = getGarmentColorImage(multiColorProduct, 'Black');
assert(typeof lavenderImg === 'string' && lavenderImg.length > 0, 'Lavender resolves to a valid variant image URL');
assert(typeof blackImg === 'string' && blackImg.length > 0, 'Black resolves to a valid variant image URL');
assert(lavenderImg !== blackImg, 'Lavender and Black resolve to different variant images');

// 5. Variant has NO specific image -> no other color's product image is substituted
const plainProduct: ProductItem = {
  id: 'plain-jacket',
  name: 'Plain Jacket',
  category: 'Outerwear',
  price: 2999,
  imageUrl: 'https://example.com/plain-jacket.jpg',
  colors: ['Charcoal Grey', 'Navy Blue'],
  sizes: ['L'],
  inStock: true,
  details: [],
};
const missingImg = getGarmentColorImage(plainProduct, 'Navy Blue');
assert(missingImg === undefined, 'Missing variant image does not reuse another color or generic product image');

// 6. Unavailable / Out-of-stock colours cannot be selected
const productWithOutOfStockVariant: ProductItem = {
  id: 'variants-prod',
  name: 'Variant Jacket',
  category: 'Jackets',
  price: 3499,
  imageUrl: 'https://example.com/jacket.jpg',
  colors: ['Red', 'Blue'],
  variants: [
    {
      id: 'var-red',
      colorName: 'Red',
      colorHex: '#DC2626',
      images: ['https://example.com/red.jpg'],
      thumbnail: 'https://example.com/red-thumb.jpg',
      isAvailable: true,
      stock: 5,
      displayOrder: 1,
    },
    {
      id: 'var-blue',
      colorName: 'Blue',
      colorHex: '#2563EB',
      images: ['https://example.com/blue.jpg'],
      thumbnail: 'https://example.com/blue-thumb.jpg',
      isAvailable: false, // OUT OF STOCK
      stock: 0,
      displayOrder: 2,
    },
  ],
  sizes: ['M'],
  inStock: true,
  details: [],
};
const availableVariants = getProductColorOptions(productWithOutOfStockVariant);
assert(availableVariants.length === 1, 'Only in-stock variants are returned');
assert(availableVariants[0].name === 'Red', 'Available variant is Red');
assert(!availableVariants.some((v) => v.name === 'Blue'), 'Unavailable/out-of-stock Blue variant is omitted');

// 7. Model background fallback preview
const lavenderModel = getGarmentColorModelBg('Lavender');
const blackModel = getGarmentColorModelBg('Black');
assert(typeof lavenderModel === 'string' && lavenderModel.length > 0, 'Lavender model background resolved');
assert(typeof blackModel === 'string' && blackModel.length > 0, 'Black model background resolved');

// 8. Custom uploaded garment without variant data
const customUploadedItem = undefined;
const customOptions = getProductColorOptions(customUploadedItem);
assert(customOptions.length === 0, 'Undefined/custom garment safely returns 0 options (no crash, selector hidden)');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
