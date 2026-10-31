import { getGarmentColorImage } from './arTryOnColors';
import { buildProductColorImages, getProductColorNames, getProductDefaultColor, getProductField, getProductVendorId, normalizeProductVariants } from './productVariants';
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

const sharedImage = 'https://example.com/navy-default.jpg';
const sharedVariantProduct = {
  ...product,
  colors: ['White', 'Black'],
  colorImages: {},
  variants: [
    { ...variants[0], id: 'white', colorName: 'White', images: [sharedImage], thumbnail: sharedImage },
    { ...variants[1], id: 'black', colorName: 'Black', images: [sharedImage], thumbnail: sharedImage }
  ]
} satisfies ProductItem;
assert(getGarmentColorImage(sharedVariantProduct, 'White') === undefined, 'shared default image is not misrepresented as the White variant');
assert(getGarmentColorImage(sharedVariantProduct, 'Black') === undefined, 'shared default image is not misrepresented as the Black variant');
const defaultVariantProduct = {
  ...sharedVariantProduct,
  colors: ['Dark Blue', 'Black', 'White'],
  variants: [
    { ...variants[0], id: 'dark-blue', colorName: 'Dark Blue', images: [sharedImage], thumbnail: sharedImage },
    { ...variants[1], id: 'black', colorName: 'Black', images: [sharedImage], thumbnail: sharedImage },
    { ...variants[2], id: 'white', colorName: 'White', images: [sharedImage], thumbnail: sharedImage }
  ],
  defaultVariantId: 'dark-blue'
} satisfies ProductItem;
assert(getGarmentColorImage(defaultVariantProduct, 'Dark Blue') === sharedImage, 'designated default variant keeps its own primary image');

const cargoColors = getProductColorNames({ colors: 'Dark Blue, Black, White' });
const cargoDefaultImage = 'https://example.com/cargo-dark-blue.jpg';
const cargoRecord = {
  colors: 'Dark Blue, Black, White',
  imageUrl: cargoDefaultImage,
  variants: cargoColors.map((color) => ({ colorName: color, images: [cargoDefaultImage] })),
  BlackImage: 'https://example.com/cargo-black.jpg',
  WhiteImage: 'https://example.com/cargo-white.jpg'
};
assert(getProductDefaultColor(cargoRecord, cargoColors) === 'Dark Blue', 'the sole color without a named image is inferred as the primary image color');
const cargoColorImages = buildProductColorImages(cargoRecord, cargoColors);
const cargoVariants = normalizeProductVariants(cargoRecord, cargoColors, cargoColorImages);
const cargoProduct = { ...product, colors: cargoColors, variants: cargoVariants, colorImages: cargoColorImages } satisfies ProductItem;
assert(getGarmentColorImage(cargoProduct, 'Black') === 'https://example.com/cargo-black.jpg', 'named BlackImage takes priority over a shared base photo');
assert(getGarmentColorImage(cargoProduct, 'White') === 'https://example.com/cargo-white.jpg', 'named WhiteImage takes priority over a shared base photo');

const skirtRecord = {
  namde: 'Skirt',
  Category: 'Bottomwear',
  Price: 1299,
  Colors: 'Black, Beige, White, Pink',
  blackImage: undefined,
  beigeImage: 'https://example.com/skirt-beige.jpg',
  whiteImage: 'https://example.com/skirt-white.jpg',
  pinkImage: 'https://example.com/skirt-pink.jpg',
  imageUrl: 'https://example.com/skirt-black.jpg',
  imageUrl2: 'https://example.com/skirt-black-back.jpg'
};
const skirtColors = getProductColorNames(skirtRecord);
const skirtImages = buildProductColorImages(skirtRecord, skirtColors);
assert(getProductDefaultColor(skirtRecord, skirtColors) === 'Black', 'a uniquely unmatched legacy color is linked to the primary product gallery');
assert(skirtImages.black?.[0] === 'https://example.com/skirt-black.jpg', 'the Skirt primary image maps to its only unnamed color');

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
assert(!parallelImages.lavender, 'unkeyed image arrays are not assigned to colors by position');
assert(getProductColorNames({ colors: 'Dark Blue, Black, White' }).join('|') === 'Dark Blue|Black|White', 'legacy comma-separated color names are parsed without positional image mapping');
const legacySkirt = { namde: 'Skirt', Category: 'Bottomwear', Price: 1299, imageUrl: 'https://example.com/skirt.jpg', Colors: 'Black, Beige, White, Pink' };
assert(getProductField(legacySkirt, 'name', 'productName', 'namde') === 'Skirt', 'legacy misspelled name field is recognized');
assert(getProductField(legacySkirt, 'category') === 'Bottomwear', 'capitalized category field is recognized');
assert(getProductField(legacySkirt, 'price') === 1299, 'capitalized price field is recognized');
assert(getProductColorNames(legacySkirt).length === 4, 'capitalized color list is recognized');
assert(getProductVendorId({}, 'printed_tshirt_3 VK') === 'VK', 'legacy VK product ID retains its vendor code');
assert(getProductVendorId({}, 'printed_tshirt_4 HP') === 'HP', 'legacy HP product ID retains its vendor code');

const legacyRecord = {
  colors: ['Beige', 'Black', 'Pink', 'Lavender'],
  defaultColorName: 'Beige',
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
assert(legacyImages.black.includes('https://example.com/black.jpg'), 'legacy BlackImage2 field remains mapped to Black without changing its URL');
assert(getGarmentColorImage(legacyProduct, 'Pink') === 'https://example.com/pink.jpg', 'legacy pinkImage field maps to Pink');
assert(getGarmentColorImage(legacyProduct, 'Lavender') === 'https://example.com/lavender.jpg', 'legacy lavenderImage field maps to Lavender');

const singleImageProduct = { ...product, variants: undefined, colorImages: undefined, colors: ['Beige', 'Black'], imageUrl: 'https://example.com/one-image.jpg' };
assert(getGarmentColorImage(singleImageProduct, 'Black') === undefined, 'missing variant images do not invent a color-specific photo');

console.log('Product color image checks passed.');
