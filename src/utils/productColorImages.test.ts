import { getGarmentColorImage } from './arTryOnColors';
import { buildProductColorImages, normalizeProductVariants } from './productVariants';
import type { ProductItem } from '../types';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const colors = ['Beige', 'Black', 'Pink', 'Lavender'];
const record = {
  name: 'Co-ord Set',
  colors,
  variants: [
    { color: 'Beige', images: ['https://example.com/beige-front.jpg', 'https://example.com/beige-back.jpg'] },
    { color: 'Black', images: ['https://example.com/black.jpg'] },
    { color: 'Pink', images: ['https://example.com/pink.jpg'] },
    { color: 'Lavender', images: ['https://example.com/lavender.jpg'] }
  ]
};
const colorImages = buildProductColorImages(record, colors);
const variants = normalizeProductVariants(record, colors, colorImages);
const product = {
  id: 'color-test',
  name: 'Co-ord Set',
  category: 'Sets',
  price: 2499,
  imageUrl: 'https://example.com/beige-front.jpg',
  colors,
  variants,
  colorImages,
  sizes: ['M'],
  inStock: true,
  details: []
} satisfies ProductItem;

assert(variants.length === 4, 'all color variants are retained');
assert(getGarmentColorImage(product, 'Beige') === 'https://example.com/beige-front.jpg', 'Beige selects its first gallery image');
assert(getGarmentColorImage(product, 'Black') === 'https://example.com/black.jpg', 'Black selects its own image');
assert(getGarmentColorImage(product, 'Pink') === 'https://example.com/pink.jpg', 'Pink selects its own image');
assert(getGarmentColorImage(product, 'Lavender') === 'https://example.com/lavender.jpg', 'Lavender selects its own image');

const partialRecord = {
  colors: ['Beige', 'Black'],
  variants: [{ color: 'Beige', images: ['https://example.com/beige.jpg'] }],
  colorImages: { Black: ['https://example.com/black.jpg'] }
};
const partialImages = buildProductColorImages(partialRecord, partialRecord.colors);
const partialVariants = normalizeProductVariants(partialRecord, partialRecord.colors, partialImages);
assert(partialVariants.length === 2, 'image maps fill variants missing from explicit variant entries');
assert(partialVariants.find((variant) => variant.colorName === 'Black')?.images[0] === 'https://example.com/black.jpg', 'mapped missing variant keeps its own image');

const parallelRecord = {
  colors,
  imageUrls: colors.map((color) => `https://example.com/${color.toLowerCase()}.jpg`)
};
const parallelImages = buildProductColorImages(parallelRecord, colors);
assert(parallelImages.lavender?.[0] === 'https://example.com/lavender.jpg', 'parallel color and image arrays are associated by index');

const legacyRecord = {
  colors: ['Beige', 'Black', 'Pink', 'Lavender'],
  imageUrl: 'https://example.com/beige.jpg',
  imageUrl2: 'https://example.com/beige-back.jpg',
  blackImage: 'https://example.com/expired-black-image.jpg',
  blackImage2: 'https://example.com/black.jpg',
  pinkImage: 'https://example.com/pink.jpg',
  lavenderImage: 'https://example.com/lavender.jpg'
};
const legacyImages = buildProductColorImages(legacyRecord, legacyRecord.colors);
const legacyVariants = normalizeProductVariants(legacyRecord, legacyRecord.colors, legacyImages);
const legacyProduct = { ...product, variants: legacyVariants, colorImages: legacyImages } satisfies ProductItem;
assert(getGarmentColorImage(legacyProduct, 'Beige') === 'https://example.com/beige.jpg', 'legacy generic images map to a color missing a named image field');
assert(getGarmentColorImage(legacyProduct, 'Black') === 'https://example.com/black.jpg', 'legacy BlackImage fields map to Black');
assert(getGarmentColorImage(legacyProduct, 'Pink') === 'https://example.com/pink.jpg', 'legacy pinkImage field maps to Pink');
assert(getGarmentColorImage(legacyProduct, 'Lavender') === 'https://example.com/lavender.jpg', 'legacy lavenderImage field maps to Lavender');

const singleImageProduct = { ...product, variants: undefined, colorImages: undefined, colors: ['Beige', 'Black'], imageUrl: 'https://example.com/one-image.jpg' };
assert(getGarmentColorImage(singleImageProduct, 'Black') === undefined, 'missing variant images do not invent a color-specific photo');

console.log('Product color image checks passed.');
