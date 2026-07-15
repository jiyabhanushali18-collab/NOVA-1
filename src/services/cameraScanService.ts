import { collection, getDocsFromServer, limit, query, where } from 'firebase/firestore';
import { db, waitForFirebaseAuthReady } from '../firebase';
import { ProductItem } from '../types';
import { RuntimeProductMetadata, getRuntimeProductMetadata, primeRuntimeProductMetadata } from './productMetadataService';

export type ScanImageSource = 'camera' | 'gallery';
export type ScanMatchKind = 'exact' | 'similar' | 'recommendation';

export interface ClothingFeatureVector {
  dominantColor: string;
  secondaryColor: string;
  colorHex: string;
  category: string;
  subcategory: string;
  garmentType: string;
  bodySection: 'Top Wear' | 'Bottom Wear' | 'Full Body' | 'Footwear' | 'Accessory' | 'Unknown';
  pattern: string;
  shape: string;
  sleeveType: string;
  neckType: string;
  fit: string;
  hasHood: boolean;
  fabric: string;
  genderCategory: string;
  confidence: Record<string, number>;
  tags: string[];
  histogram: number[];
  edgeDensity: number;
  aspectRatio: number;
}

export interface DetectedClothingItem {
  id: string;
  label: string;
  cropDataUrl: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  features: ClothingFeatureVector;
}

export interface ScanProductResult {
  item: DetectedClothingItem;
  product: ProductItem;
  kind: ScanMatchKind;
  score: number;
  title: string;
  recommendationReasons: string[];
  pairedWith: ProductItem[];
}

export interface CameraScanResult {
  source: ScanImageSource;
  compressedImageUrl: string;
  items: DetectedClothingItem[];
  results: ScanProductResult[];
}

export type ScanProgress = (message: string) => void;

interface VisionProvider {
  compressImage(file: File): Promise<string>;
  detectClothing(imageUrl: string, userGender?: string): Promise<DetectedClothingItem[]>;
}

const canvasSize = 512;
const productCacheKey = 'nova_camera_scan_product_embeddings_v1';

const safeArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const inferProductGender = (product: ProductItem): ProductItem['gender'] | undefined => {
  if (product.gender) return product.gender;
  const text = normalizeText([product.category, product.name, product.description, ...(product.tags || [])].join(' '));
  if (text.includes('women') || text.includes('female') || text.includes('ladies') || text.includes('womens') || text.includes("women s")) return 'Women';
  if (text.includes('men') || text.includes('male') || text.includes('gentlemen') || text.includes('mens') || text.includes("men s")) return 'Men';
  return undefined;
};

const fashionPalette = [
  { name: 'Black', rgb: [20, 20, 24] },
  { name: 'Charcoal', rgb: [55, 58, 63] },
  { name: 'Grey', rgb: [128, 128, 128] },
  { name: 'Silver', rgb: [188, 190, 192] },
  { name: 'White', rgb: [244, 244, 240] },
  { name: 'Off White', rgb: [232, 228, 214] },
  { name: 'Cream', rgb: [242, 226, 190] },
  { name: 'Beige', rgb: [205, 185, 148] },
  { name: 'Tan', rgb: [180, 138, 92] },
  { name: 'Brown', rgb: [115, 74, 45] },
  { name: 'Navy Blue', rgb: [20, 38, 92] },
  { name: 'Royal Blue', rgb: [36, 86, 196] },
  { name: 'Sky Blue', rgb: [100, 170, 225] },
  { name: 'Baby Blue', rgb: [176, 213, 238] },
  { name: 'Denim Blue', rgb: [72, 104, 145] },
  { name: 'Olive Green', rgb: [105, 118, 64] },
  { name: 'Forest Green', rgb: [32, 92, 56] },
  { name: 'Mint Green', rgb: [160, 210, 180] },
  { name: 'Maroon', rgb: [115, 28, 44] },
  { name: 'Wine', rgb: [92, 24, 50] },
  { name: 'Red', rgb: [186, 42, 42] },
  { name: 'Coral', rgb: [232, 104, 86] },
  { name: 'Peach', rgb: [238, 170, 136] },
  { name: 'Pink', rgb: [224, 130, 170] },
  { name: 'Lavender', rgb: [185, 172, 226] },
  { name: 'Lilac', rgb: [204, 178, 222] },
  { name: 'Purple', rgb: [112, 70, 155] },
  { name: 'Mustard', rgb: [202, 154, 42] },
  { name: 'Yellow', rgb: [224, 196, 64] },
  { name: 'Orange', rgb: [214, 118, 44] }
];

const colorAliasMap = new Map<string, string>([
  ['white', 'white'], ['off white', 'white'], ['off-white', 'white'], ['ivory', 'white'], ['cream', 'white'], ['bone', 'white'], ['snow', 'white'], ['pearl', 'white'],
  ['black', 'black'], ['ebony', 'black'], ['charcoal', 'black'], ['grey', 'grey'], ['gray', 'grey'], ['silver', 'grey'],
  ['navy', 'blue'], ['navy blue', 'blue'], ['denim', 'blue'], ['denim blue', 'blue'], ['sky blue', 'blue'], ['royal blue', 'blue'], ['baby blue', 'blue'],
  ['olive', 'green'], ['olive green', 'green'], ['forest green', 'green'], ['mint green', 'green'],
  ['beige', 'beige'], ['tan', 'beige'], ['sand', 'beige'], ['cream', 'beige'],
  ['maroon', 'red'], ['wine', 'red'], ['coral', 'red'], ['peach', 'pink'],
  ['lavender', 'purple'], ['lilac', 'purple']
]);

const normalizeColor = (color: string) => {
  const normalized = normalizeText(color);
  return colorAliasMap.get(normalized) || normalized;
};

const getColorQueryValues = (color: string) => {
  const normalized = normalizeColor(color);
  const synonyms: Record<string, string[]> = {
    white: ['White', 'Off-White', 'Ivory', 'Cream', 'Bone', 'Snow', 'Pearl'],
    black: ['Black', 'Charcoal', 'Ebony'],
    grey: ['Grey', 'Gray', 'Silver'],
    blue: ['Blue', 'Navy', 'Navy Blue', 'Denim', 'Denim Blue', 'Sky Blue', 'Royal Blue', 'Baby Blue'],
    green: ['Green', 'Olive', 'Olive Green', 'Forest Green', 'Mint Green'],
    beige: ['Beige', 'Tan', 'Sand', 'Cream', 'Off White'],
    red: ['Red', 'Maroon', 'Wine', 'Coral'],
    pink: ['Pink', 'Peach', 'Coral'],
    purple: ['Purple', 'Lavender', 'Lilac']
  };
  return [...new Set([color, normalized, ...(synonyms[normalized] || [])])].slice(0, 10);
};

const areColorsEquivalent = (a: string, b: string) => {
  const normalizedA = normalizeColor(a);
  const normalizedB = normalizeColor(b);
  return normalizedA === normalizedB || normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
};

const novaTaxonomy = {
  Men: {
    'Top Wear': ['T-Shirt', 'Polo Shirt', 'Shirt', 'Kurta', 'Hoodie', 'Sweatshirt', 'Jacket'],
    'Bottom Wear': ['Jeans', 'Cargo Pants', 'Joggers', 'Trousers']
  },
  Women: {
    'Top Wear': ['Crop Top', 'T-Shirt', 'Polo Shirt', 'Shirt', 'Kurti', 'Hoodie', 'Sweatshirt', 'Jacket'],
    'Bottom Wear': ['Jeans', 'Palazzo', 'Leggings', 'Skirt', 'Trousers', 'Joggers', 'Cargo Pants'],
    'One Piece': ['Dress', 'Jumpsuit']
  },
  Unisex: {
    'Top Wear': ['T-Shirt', 'Polo Shirt', 'Shirt', 'Hoodie', 'Sweatshirt', 'Jacket'],
    'Bottom Wear': ['Jeans', 'Trousers', 'Joggers', 'Cargo Pants']
  }
} as const;

const canonicalCategoryNames = Array.from(new Set(Object.values(novaTaxonomy).flatMap((groups) => Object.values(groups).flat())));

const novaSubcategoryMeta = new Map<string, { subcategory: string; category: ClothingFeatureVector['bodySection']; gender: string }>();
Object.entries(novaTaxonomy).forEach(([gender, groups]) => {
  Object.entries(groups).forEach(([category, subcategories]) => {
    subcategories.forEach((subcategory) => {
      const key = normalizeText(subcategory);
      if (!novaSubcategoryMeta.has(key)) {
        novaSubcategoryMeta.set(key, {
          subcategory,
          category: category === 'One Piece' ? 'Full Body' : category as ClothingFeatureVector['bodySection'],
          gender
        });
      } else if (gender === 'Unisex') {
        novaSubcategoryMeta.set(key, { subcategory, category: novaSubcategoryMeta.get(key)!.category, gender });
      }
    });
  });
});

const topWearCategories = new Set(['t shirt', 'oversized t shirt', 'polo shirt', 'henley', 'casual shirt', 'formal shirt', 'shirt', 'polo', 'hoodie', 'oversized hoodie', 'sweatshirt', 'sweater', 'jacket', 'blazer', 'nehru jacket', 'crop top', 'tank top', 'tube top', 'sleeveless top', 'kurti', 'kurta', 'blouse']);
const bottomWearCategories = new Set(['jeans', 'cargo pants', 'joggers', 'track pants', 'shorts', 'trousers', 'chinos', 'palazzo', 'leggings', 'skirt', 'dhoti']);
const fullBodyCategories = new Set(['dress', 'maxi dress', 'mini dress', 'gown', 'jumpsuit', 'saree', 'lehenga', 'salwar suit', 'sherwani', 'pathani suit']);

const taxonomyMetaFor = (subcategory: string) => novaSubcategoryMeta.get(normalizeText(subcategory));

const supportedNovaSubcategories = new Set(canonicalCategoryNames.map(normalizeText));

const unsupportedSubcategoryMap = new Map<string, string>([
  ['henley', 'T-Shirt'],
  ['oversized t shirt', 'T-Shirt'],
  ['oversized tee', 'T-Shirt'],
  ['oversized tshirt', 'T-Shirt'],
  ['oversized hoodie', 'Hoodie'],
  ['tube top', 'Crop Top'],
  ['tank top', 'Crop Top'],
  ['sleeveless top', 'Crop Top'],
  ['blouse', 'Shirt'],
  ['casual shirt', 'Shirt'],
  ['formal shirt', 'Shirt'],
  ['sweater', 'Sweatshirt'],
  ['blazer', 'Jacket'],
  ['nehru jacket', 'Jacket'],
  ['shorts', 'Trousers'],
  ['chinos', 'Trousers'],
  ['track pants', 'Joggers'],
  ['maxi dress', 'Dress'],
  ['mini dress', 'Dress'],
  ['gown', 'Dress'],
  ['saree', 'Dress'],
  ['sari', 'Dress'],
  ['lehenga', 'Dress'],
  ['salwar suit', 'Kurti'],
  ['dupatta', 'Kurti'],
  ['sherwani', 'Kurta'],
  ['pathani suit', 'Kurta'],
  ['dhoti', 'Trousers']
]);

const normalizeSupportedSubcategory = (value: string, genderHint?: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  const mapped = unsupportedSubcategoryMap.get(normalized);
  if (mapped) return mapped;
  const exact = canonicalCategoryNames.find((category) => normalizeText(category) === normalized);
  if (exact && supportedNovaSubcategories.has(normalizeText(exact))) return exact;
  if (normalized.includes('oversized') && (normalized.includes('t shirt') || normalized.includes('tshirt') || normalized.includes('tee'))) return 'T-Shirt';
  if (normalized.includes('henley')) return 'T-Shirt';
  if (normalized.includes('tube') || normalized.includes('tank') || normalized.includes('sleeveless top')) return 'Crop Top';
  if (normalized.includes('blouse')) return 'Shirt';
  if (normalized.includes('sweater')) return 'Sweatshirt';
  if (normalized.includes('blazer') || normalized.includes('nehru')) return 'Jacket';
  if (normalized.includes('short') || normalized.includes('chino')) return 'Trousers';
  if (normalized.includes('saree') || normalized.includes('sari') || normalized.includes('lehenga') || normalized.includes('gown')) return 'Dress';
  if (normalized.includes('sherwani') || normalized.includes('pathani')) return 'Kurta';
  if (normalized.includes('salwar')) return normalizeText(genderHint || '') === 'men' ? 'Kurta' : 'Kurti';
  return '';
};

const canonicalSubcategoryFromText = (value: string, genderHint?: string) => {
  const text = normalizeText(value);
  if (!text) return '';
  const supported = normalizeSupportedSubcategory(text, genderHint);
  if (supported) return supported;
  const exact = taxonomyMetaFor(text);
  if (exact) return exact.subcategory;
  if (text.includes('oversized') && text.includes('hood')) return 'Hoodie';
  if (text.includes('oversized') && (text.includes('t shirt') || text.includes('tshirt') || text.includes('tee'))) return 'T-Shirt';
  if (text.includes('crop')) return 'Crop Top';
  if (text.includes('tube')) return 'Crop Top';
  if (text.includes('tank')) return 'Crop Top';
  if (text.includes('sleeveless') && (text.includes('top') || text.includes('tee'))) return 'Crop Top';
  if (text.includes('polo')) return 'Polo Shirt';
  if (text.includes('henley')) return 'T-Shirt';
  if (text.includes('formal') && text.includes('shirt')) return 'Shirt';
  if (text.includes('casual') && text.includes('shirt')) return 'Shirt';
  if (text.includes('t shirt') || text.includes('tshirt') || text.includes('tee')) return 'T-Shirt';
  if (text.includes('hoodie') || text.includes('hooded')) return 'Hoodie';
  if (text.includes('sweatshirt')) return 'Sweatshirt';
  if (text.includes('sweater')) return 'Sweatshirt';
  if (text.includes('nehru')) return 'Jacket';
  if (text.includes('blazer')) return 'Jacket';
  if (text.includes('jacket') || text.includes('coat')) return 'Jacket';
  if (text.includes('kurti')) return 'Kurti';
  if (text.includes('kurta')) return normalizeText(genderHint || '') === 'women' ? 'Kurti' : 'Kurta';
  if (text.includes('sherwani')) return 'Kurta';
  if (text.includes('pathani')) return 'Kurta';
  if (text.includes('dhoti')) return 'Trousers';
  if (text.includes('saree') || text.includes('sari')) return 'Dress';
  if (text.includes('lehenga')) return 'Dress';
  if (text.includes('salwar')) return normalizeText(genderHint || '') === 'men' ? 'Kurta' : 'Kurti';
  if (text.includes('dupatta')) return 'Kurti';
  if (text.includes('maxi')) return 'Dress';
  if (text.includes('mini')) return 'Dress';
  if (text.includes('gown')) return 'Dress';
  if (text.includes('jumpsuit')) return 'Jumpsuit';
  if (text.includes('dress')) return 'Dress';
  if (text.includes('cargo')) return 'Cargo Pants';
  if (text.includes('jogger')) return 'Joggers';
  if (text.includes('track')) return 'Joggers';
  if (text.includes('chino')) return 'Trousers';
  if (text.includes('palazzo')) return 'Palazzo';
  if (text.includes('legging')) return 'Leggings';
  if (text.includes('jean') || text.includes('denim pant')) return 'Jeans';
  if (text.includes('trouser') || text.includes('pant')) return 'Trousers';
  if (text.includes('shorts') || text.includes('short pant')) return 'Trousers';
  if (text.includes('skirt')) return 'Skirt';
  if (text.includes('blouse')) return 'Shirt';
  if (text.includes('shirt')) return 'Shirt';
  return canonicalCategoryNames.find((category) => normalizeText(category) === text) || '';
};

const fallbackSupportedSubcategoryForCategory = (categoryHint: string, genderHint?: string) => {
  const category = normalizeText(categoryHint);
  const gender = normalizeText(genderHint || '');
  if (category.includes('bottom')) return 'Trousers';
  if (category.includes('full') || category.includes('one piece')) return 'Dress';
  if (gender === 'women') return 'Crop Top';
  return 'T-Shirt';
};

const canonicalCategoryFromText = (value: string) => {
  return canonicalSubcategoryFromText(value);
};

const bodySectionForCategory = (category: string): ClothingFeatureVector['bodySection'] => {
  const normalized = normalizeText(category);
  if (normalized.includes('top wear') || normalized === 'tops') return 'Top Wear';
  if (normalized.includes('bottom wear')) return 'Bottom Wear';
  if (topWearCategories.has(normalized)) return 'Top Wear';
  if (bottomWearCategories.has(normalized)) return 'Bottom Wear';
  if (fullBodyCategories.has(normalized)) return 'Full Body';
  if (normalized === 'shoes') return 'Footwear';
  return 'Unknown';
};

const inferGarmentType = (categoryHint: string, edgeDensity: number, aspectRatio: number, dominantColor: string, pattern: string): string => {
  const lowerCategory = normalizeText(categoryHint);
  if (lowerCategory.includes('footwear') || lowerCategory.includes('shoe')) return 'Shoes';
  if (lowerCategory.includes('kurti')) return 'Kurti';
  if (lowerCategory.includes('kurta') || lowerCategory.includes('ethnic') || lowerCategory.includes('kurtas')) return 'Kurta';

  // bottoms
  if (lowerCategory.includes('bottom') || lowerCategory.includes('pant') || lowerCategory.includes('jean') || lowerCategory.includes('trouser')) {
    if (lowerCategory.includes('short')) return 'Trousers';
    if (aspectRatio > 1.4) return 'Skirt';
    return normalizeColor(dominantColor) === 'blue' ? 'Jeans' : 'Trousers';
  }

  if (lowerCategory.includes('top') || lowerCategory.includes('top wear') || lowerCategory.includes('topwear')) {
    if (aspectRatio >= 0.78 && aspectRatio <= 1.18 && edgeDensity >= 0.12 && edgeDensity <= 0.22 && pattern !== 'Printed') return 'Hoodie';
    if (aspectRatio >= 0.95 && edgeDensity < 0.16) return 'Crop Top';
    if (aspectRatio >= 0.82 && edgeDensity < 0.12) return 'Crop Top';
    if (pattern === 'Embroidered' || pattern === 'Floral') return 'Kurta';
    if (edgeDensity >= 0.18) return 'Shirt';
    if (edgeDensity >= 0.11) return 'T-Shirt';
  }

  if (lowerCategory.includes('dress')) return 'Dress';
  if (lowerCategory.includes('skirt')) return 'Skirt';
  if (lowerCategory.includes('short')) return 'Trousers';
  if (lowerCategory.includes('hood')) return 'Hoodie';
  if (lowerCategory.includes('jacket') || lowerCategory.includes('coat') || lowerCategory.includes('sweater')) return 'Jacket';
  if (lowerCategory.includes('polo')) return 'Polo Shirt';
  if (lowerCategory.includes('t shirt') || lowerCategory.includes('tee') || lowerCategory.includes('tshirt')) return 'T-Shirt';

  if (aspectRatio >= 0.78 && aspectRatio <= 1.18 && edgeDensity >= 0.12 && edgeDensity <= 0.22 && pattern !== 'Printed') return 'Hoodie';
  if (edgeDensity > 0.22) return 'Jacket';
  if (edgeDensity > 0.18) return 'Shirt';
  if (edgeDensity > 0.13) return 'Polo Shirt';
  if (edgeDensity >= 0.08) return 'T-Shirt';

  return 'Unknown Clothing';
};

const inferGenderForDetectedGarment = (garmentType: string, userGender?: string) => {
  const normalizedUserGender = normalizeText(userGender || '');
  if (normalizedUserGender === 'men' || normalizedUserGender === 'women') return normalizedUserGender === 'men' ? 'Men' : 'Women';
  const meta = taxonomyMetaFor(garmentType);
  if (meta?.gender === 'Men' || meta?.gender === 'Women' || meta?.gender === 'Unisex') return meta.gender;
  const normalized = normalizeText(garmentType);
  if (['crop top', 'kurti', 'dress', 'jumpsuit', 'palazzo', 'leggings', 'skirt'].includes(normalized)) return 'Women';
  if (['kurta'].includes(normalized)) return 'Men';
  return 'Unisex';
};

const normalizeProduct = (id: string, data: Record<string, any>): ProductItem | null => {
  const metadataColors = [
    firstString(data.primaryColor, data.primary_colour, data.color, data.colour),
    firstString(data.secondaryColor, data.secondary_colour)
  ].filter(Boolean);
  const colors = safeArray(data.colors).length > 0 ? safeArray(data.colors) : metadataColors.length > 0 ? metadataColors : ['Standard'];
  const imageList = [
    ...safeArray(data.images),
    ...safeArray(data.imageUrls),
    firstString(data.mainImage, data.imageUrl, data.image, data.imageurl, data.imageurl1)
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);
  const imageUrl = firstString(data.mainImage, data.imageUrl, data.image, data.imageurl, data.imageurl1, imageList[0]);
  const name = firstString(data.name, data.title, data.productName, data.Name);
  const price = Number(data.discountPrice || data.price || data.Price || 0);
  const productGender = firstString(data.gender) as ProductItem['gender'] | undefined;

  if (!name || !imageUrl) return null;

  return {
    id,
    productId: firstString(data.productId, id) || id,
    vendorId: firstString(data.vendorId) || undefined,
    vendorName: firstString(data.vendorName, data.vendor, data.brandName, data.brand) || undefined,
    vendorLogoUrl: firstString(data.vendorLogoUrl, data.logoUrl) || undefined,
    name,
    category: firstString(data.category, data.Category) || 'Uncategorized',
    subcategory: firstString(data.subcategory, data.subCategory, data.Subcategory) || undefined,
    description: firstString(data.description),
    price,
    originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : undefined,
    discountPrice: data.discountPrice !== undefined ? Number(data.discountPrice) : undefined,
    rating: Number(data.rating || 0),
    reviewsCount: Number(data.reviewsCount || data.reviewCount || 0),
    imageUrl,
    mainImage: imageUrl,
    images: imageList.length > 0 ? imageList : [imageUrl],
    imageUrls: imageList.length > 0 ? imageList : [imageUrl],
    colors,
    sizes: safeArray(data.sizes).length > 0 ? safeArray(data.sizes) : ['One Size'],
    inStock: data.inStock !== undefined ? Boolean(data.inStock) : true,
    stockLeft: data.stockLeft !== undefined ? Number(data.stockLeft) : undefined,
    isTopRated: Boolean(data.isTopRated),
    isFeatured: Boolean(data.isFeatured),
    badge: firstString(data.badge) || undefined,
    details: safeArray(data.details).length > 0 ? safeArray(data.details) : firstString(data.description) ? [firstString(data.description)] : [],
    fabric: firstString(data.fabric, data.material) as ProductItem['fabric'],
    pattern: firstString(data.pattern) as ProductItem['pattern'],
    sleeveType: firstString(data.sleeveType) as ProductItem['sleeveType'],
    neckType: firstString(data.neckType) as ProductItem['neckType'],
    gender: productGender,
    tags: [...safeArray(data.tags), productGender].filter(Boolean),
    createdAt: data.createdAt
  };
};

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Image could not be loaded'));
  image.src = src;
});

const drawToCanvas = async (imageUrl: string, crop?: { x: number; y: number; width: number; height: number }) => {
  const image = await loadImage(imageUrl);
  const source = crop || { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  const canvas = document.createElement('canvas');
  const scale = Math.min(canvasSize / source.width, canvasSize / source.height, 1);
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const colorNameFromRgb = (r: number, g: number, b: number) => {
  return fashionPalette
    .map((entry) => ({
      ...entry,
      distance: Math.hypot(r - entry.rgb[0], g - entry.rgb[1], b - entry.rgb[2])
    }))
    .sort((a, b) => a.distance - b.distance)[0].name;
};

const extractFeaturesFromCanvas = (canvas: HTMLCanvasElement, categoryHint = 'Top Wear', userGender?: string): ClothingFeatureVector => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Array(12).fill(0);
  let sampleCount = 0;
  let edgeHits = 0;
  const colorBuckets = new Map<string, { name: string; r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];
    if (alpha < 180) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (max > 248 || max < 8) continue;
    const hueBucket = Math.min(11, Math.floor(((max === min ? 0 : max === r ? (60 * ((g - b) / (max - min)) + 360) % 360 : max === g ? 60 * ((b - r) / (max - min)) + 120 : 60 * ((r - g) / (max - min)) + 240) / 360) * 12));
    histogram[hueBucket] += 1;
    if (saturation > 0.08 || max < 235) {
      const bucketKey = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`;
      const existing = colorBuckets.get(bucketKey) || { name: '', r: 0, g: 0, b: 0, count: 0 };
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count += 1;
      colorBuckets.set(bucketKey, existing);
    }
    sampleCount += 1;
  }

  for (let y = 1; y < height; y += 6) {
    for (let x = 1; x < width; x += 6) {
      const idx = (y * width + x) * 4;
      const left = (y * width + x - 1) * 4;
      const up = ((y - 1) * width + x) * 4;
      const diff = Math.abs(data[idx] - data[left]) + Math.abs(data[idx + 1] - data[left + 1]) + Math.abs(data[idx + 2] - data[left + 2])
        + Math.abs(data[idx] - data[up]) + Math.abs(data[idx + 1] - data[up + 1]) + Math.abs(data[idx + 2] - data[up + 2]);
      if (diff > 150) edgeHits += 1;
    }
  }

  const normalizedHistogram = histogram.map((value) => Number((value / Math.max(1, sampleCount)).toFixed(4)));
  const dominantBuckets = Array.from(colorBuckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((bucket) => {
      const avgR = Math.round(bucket.r / Math.max(1, bucket.count));
      const avgG = Math.round(bucket.g / Math.max(1, bucket.count));
      const avgB = Math.round(bucket.b / Math.max(1, bucket.count));
      return {
        r: avgR,
        g: avgG,
        b: avgB,
        name: colorNameFromRgb(avgR, avgG, avgB),
        share: bucket.count / Math.max(1, sampleCount)
      };
    });
  const primaryBucket = dominantBuckets[0] || { r: 153, g: 153, b: 153, name: 'Grey', share: 0 };
  const secondaryBucket = dominantBuckets.find((bucket) => normalizeColor(bucket.name) !== normalizeColor(primaryBucket.name)) || dominantBuckets[1] || primaryBucket;
  const dominantColor = primaryBucket.name;
  const secondaryColor = secondaryBucket.name;
  const edgeDensity = Number((edgeHits / Math.max(1, (width / 6) * (height / 6))).toFixed(3));
  const aspectRatio = Number((width / Math.max(1, height)).toFixed(2));
  const colorSpread = dominantBuckets.length > 1 ? Math.abs((dominantBuckets[0]?.share || 0) - (dominantBuckets[1]?.share || 0)) : 1;
  const pattern = edgeDensity > 0.26 ? 'Graphic' : edgeDensity > 0.22 ? 'Printed' : edgeDensity > 0.17 ? 'Textured' : colorSpread < 0.09 ? 'Abstract' : edgeDensity > 0.11 ? 'Textured' : 'Solid';
  const rawGarmentType = inferGarmentType(categoryHint, edgeDensity, aspectRatio, dominantColor, pattern);
  const garmentType = canonicalSubcategoryFromText(rawGarmentType, userGender) || fallbackSupportedSubcategoryForCategory(categoryHint, userGender);
  const taxonomyMeta = taxonomyMetaFor(garmentType);
  const bodySection = taxonomyMeta?.category || bodySectionForCategory(garmentType) || bodySectionForCategory(categoryHint);
  const detectedGender = inferGenderForDetectedGarment(garmentType, userGender);
  const sleeveType = bodySection === 'Bottom Wear' || bodySection === 'Footwear'
    ? 'Not applicable'
    : garmentType === 'Crop Top'
      ? 'Sleeveless'
      : garmentType === 'Hoodie' || garmentType === 'Jacket' || garmentType === 'Sweatshirt' || garmentType === 'Kurti' || garmentType === 'Kurta'
        ? 'Full Sleeve'
        : 'Half Sleeve';
  const neckType = garmentType === 'Hoodie' ? 'Hooded' : garmentType === 'Polo Shirt' ? 'Polo Collar' : garmentType === 'Shirt' || garmentType === 'Jacket' ? 'Collar' : garmentType === 'Kurta' || garmentType === 'Kurti' ? 'Mandarin Collar' : aspectRatio > 0.95 ? 'Square Neck' : 'Round Neck';
  const fit = aspectRatio > 1.1 ? 'Relaxed' : aspectRatio < 0.62 ? 'Slim' : 'Regular';
  const fabric = normalizeColor(dominantColor) === 'blue' && garmentType === 'Jeans' ? 'Denim' : edgeDensity > 0.16 ? 'Textured Blend' : 'Cotton Blend';
  const categoryConfidence = garmentType === 'Unknown Clothing' ? 0.45 : bodySection !== 'Unknown' ? 0.84 : 0.68;

  return {
    dominantColor,
    secondaryColor,
    colorHex: `#${[primaryBucket.r, primaryBucket.g, primaryBucket.b].map((value) => value.toString(16).padStart(2, '0')).join('')}`,
    category: bodySection,
    subcategory: garmentType,
    garmentType,
    bodySection,
    pattern,
    shape: aspectRatio > 1.1 ? 'wide' : aspectRatio < 0.65 ? 'long' : 'regular',
    sleeveType,
    neckType,
    fit,
    hasHood: garmentType === 'Hoodie',
    fabric,
    genderCategory: detectedGender,
    confidence: {
      category: categoryConfidence,
      bodySection: bodySection === 'Unknown' ? 0.52 : 0.82,
      sleeveType: sleeveType === 'Not applicable' ? 0.95 : 0.7,
      neckType: 0.62,
      fit: 0.58,
      primaryColor: Math.min(0.95, Math.max(0.55, primaryBucket.share * 2.4)),
      secondaryColor: secondaryBucket === primaryBucket ? 0.3 : Math.min(0.82, Math.max(0.42, secondaryBucket.share * 2)),
      pattern: pattern === 'Solid' ? 0.72 : 0.62,
      material: 0.52,
      genderCategory: detectedGender === 'Unisex' ? 0.55 : 0.78
    },
    tags: [dominantColor, secondaryColor, pattern, garmentType, bodySection, sleeveType, neckType, fabric].map(normalizeText),
    histogram: normalizedHistogram,
    edgeDensity,
    aspectRatio
  };
};

interface GarmentCandidate {
  label: string;
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
  areaShare: number;
  confidence: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const saturationForRgb = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};

const inferCandidateCategory = (candidate: Pick<GarmentCandidate, 'x' | 'y' | 'width' | 'height'>, imageWidth: number, imageHeight: number) => {
  const centerY = (candidate.y + candidate.height / 2) / Math.max(1, imageHeight);
  const aspectRatio = candidate.width / Math.max(1, candidate.height);
  const areaShare = (candidate.width * candidate.height) / Math.max(1, imageWidth * imageHeight);
  if (centerY > 0.66 && aspectRatio < 1.25) return 'Bottom Wear';
  if (areaShare > 0.5 && candidate.height > imageHeight * 0.62) return 'Full Body';
  return 'Top Wear';
};

const locateGarmentCandidates = (canvas: HTMLCanvasElement): GarmentCandidate[] => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gridW = 72;
  const gridH = 72;
  const cellW = width / gridW;
  const cellH = height / gridH;
  const cornerSamples = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ].map(([x, y]) => {
    const idx = (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4;
    return [data[idx], data[idx + 1], data[idx + 2]];
  });
  const bg = cornerSamples.reduce((acc, rgb) => [acc[0] + rgb[0], acc[1] + rgb[1], acc[2] + rgb[2]], [0, 0, 0]).map((value) => value / cornerSamples.length);
  const occupied = new Array(gridW * gridH).fill(false);
  let occupiedCells = 0;

  for (let gy = 0; gy < gridH; gy += 1) {
    for (let gx = 0; gx < gridW; gx += 1) {
      const px = Math.min(width - 1, Math.max(0, Math.floor((gx + 0.5) * cellW)));
      const py = Math.min(height - 1, Math.max(0, Math.floor((gy + 0.5) * cellH)));
      const idx = (py * width + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];
      const brightness = (r + g + b) / 3;
      const bgBrightness = (bg[0] + bg[1] + bg[2]) / 3;
      const bgDistance = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
      const saturation = saturationForRgb(r, g, b);
      const isVisiblePixel = alpha > 50 && (
        bgDistance > 34 ||
        Math.abs(brightness - bgBrightness) > 30 ||
        saturation > 0.16 ||
        brightness < 42
      );
      if (isVisiblePixel) {
        occupied[gy * gridW + gx] = true;
        occupiedCells += 1;
      }
    }
  }

  const visited = new Array(gridW * gridH).fill(false);
  const components: GarmentCandidate[] = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let start = 0; start < occupied.length; start += 1) {
    if (!occupied[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = true;
    let minX = gridW;
    let minY = gridH;
    let maxX = 0;
    let maxY = 0;
    let count = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const cx = current % gridW;
      const cy = Math.floor(current / gridW);
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx);
      maxY = Math.max(maxY, cy);
      count += 1;

      neighbors.forEach(([dx, dy]) => {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) return;
        const next = ny * gridW + nx;
        if (!occupied[next] || visited[next]) return;
        visited[next] = true;
        queue.push(next);
      });
    }

    const areaShare = count / (gridW * gridH);
    if (areaShare < 0.025) continue;
    const padX = 3;
    const padY = 3;
    const x = Math.max(0, Math.floor((minX - padX) * cellW));
    const y = Math.max(0, Math.floor((minY - padY) * cellH));
    const right = Math.min(width, Math.ceil((maxX + 1 + padX) * cellW));
    const bottom = Math.min(height, Math.ceil((maxY + 1 + padY) * cellH));
    const boxAreaShare = ((right - x) * (bottom - y)) / Math.max(1, width * height);
    if (boxAreaShare < 0.08) continue;
    const category = inferCandidateCategory({ x, y, width: right - x, height: bottom - y }, width, height);
    components.push({
      label: category,
      category,
      x,
      y,
      width: right - x,
      height: bottom - y,
      areaShare: boxAreaShare,
      confidence: clamp01(0.42 + areaShare * 2.2 + Math.min(0.22, occupiedCells / (gridW * gridH)))
    });
  }

  const overallShare = occupiedCells / (gridW * gridH);
  if (components.length === 0 && overallShare > 0.15) {
    components.push({
      label: 'Detected Garment',
      category: 'Top Wear',
      x: Math.round(width * 0.04),
      y: Math.round(height * 0.04),
      width: Math.round(width * 0.92),
      height: Math.round(height * 0.92),
      areaShare: 0.85,
      confidence: 0.62
    });
  }

  return components
    .sort((a, b) => (b.confidence * b.areaShare) - (a.confidence * a.areaShare))
    .slice(0, 5);
};

class BrowserVisionProvider implements VisionProvider {
  async compressImage(file: File) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const canvas = await drawToCanvas(objectUrl);
      return canvas.toDataURL('image/jpeg', 0.78);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async detectClothing(imageUrl: string, userGender?: string) {
    const image = await loadImage(imageUrl);
    const fullCanvas = await drawToCanvas(imageUrl);
    const localizedCandidates = locateGarmentCandidates(fullCanvas);
    const portrait = image.naturalHeight > image.naturalWidth * 1.12;
    const ratioX = image.naturalWidth / Math.max(1, fullCanvas.width);
    const ratioY = image.naturalHeight / Math.max(1, fullCanvas.height);
    const fallbackCrops = portrait
      ? [
          { label: 'Top Wear', category: 'Top Wear', x: Math.round(image.naturalWidth * 0.14), y: Math.round(image.naturalHeight * 0.12), width: Math.round(image.naturalWidth * 0.72), height: Math.round(image.naturalHeight * 0.42), areaShare: 0.3, confidence: 0.52 },
          { label: 'Bottom Wear', category: 'Bottom Wear', x: Math.round(image.naturalWidth * 0.18), y: Math.round(image.naturalHeight * 0.48), width: Math.round(image.naturalWidth * 0.64), height: Math.round(image.naturalHeight * 0.34), areaShare: 0.22, confidence: 0.48 },
          { label: 'Full Body', category: 'Full Body', x: Math.round(image.naturalWidth * 0.08), y: Math.round(image.naturalHeight * 0.06), width: Math.round(image.naturalWidth * 0.84), height: Math.round(image.naturalHeight * 0.82), areaShare: 0.69, confidence: 0.46 }
        ]
      : [
          { label: 'Detected Garment', category: 'Top Wear', x: Math.round(image.naturalWidth * 0.06), y: Math.round(image.naturalHeight * 0.06), width: Math.round(image.naturalWidth * 0.88), height: Math.round(image.naturalHeight * 0.88), areaShare: 0.77, confidence: 0.5 },
          { label: 'Detected Garment (center)', category: 'Top Wear', x: Math.round(image.naturalWidth * 0.16), y: Math.round(image.naturalHeight * 0.1), width: Math.round(image.naturalWidth * 0.68), height: Math.round(image.naturalHeight * 0.76), areaShare: 0.52, confidence: 0.46 }
        ];

    const localizedCrops = localizedCandidates.map((candidate) => ({
      ...candidate,
      x: Math.round(candidate.x * ratioX),
      y: Math.round(candidate.y * ratioY),
      width: Math.round(candidate.width * ratioX),
      height: Math.round(candidate.height * ratioY)
    }));
    const crops = [...localizedCrops, ...fallbackCrops]
      .filter((crop) => crop.width * crop.height >= image.naturalWidth * image.naturalHeight * 0.08)
      .sort((a, b) => (b.confidence * b.areaShare) - (a.confidence * a.areaShare))
      .slice(0, localizedCrops.length > 0 ? 5 : 3);

    const items = await Promise.all(crops.map(async (crop, index) => {
      const cropX = Math.max(0, Math.min(image.naturalWidth - 1, crop.x));
      const cropY = Math.max(0, Math.min(image.naturalHeight - 1, crop.y));
      const cropWidth = Math.max(1, Math.min(image.naturalWidth - cropX, crop.width));
      const cropHeight = Math.max(1, Math.min(image.naturalHeight - cropY, crop.height));
      const canvas = await drawToCanvas(imageUrl, {
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight
      });
      const features = extractFeaturesFromCanvas(canvas, crop.category, userGender);
      return {
        id: `detected-${index + 1}`,
        label: features.garmentType || crop.label,
        cropDataUrl: canvas.toDataURL('image/jpeg', 0.82),
        boundingBox: {
          x: cropX / Math.max(1, image.naturalWidth),
          y: cropY / Math.max(1, image.naturalHeight),
          width: cropWidth / Math.max(1, image.naturalWidth),
          height: cropHeight / Math.max(1, image.naturalHeight)
        },
        confidence: Math.max(crop.confidence, features.confidence.category || 0),
        features
      };
    }));

    const meaningfulItems = items.filter((item) => item.cropDataUrl && item.confidence >= 0.42);
    if (meaningfulItems.length > 0) {
      return meaningfulItems
        .sort((a, b) => (b.confidence * b.boundingBox.width * b.boundingBox.height) - (a.confidence * a.boundingBox.width * a.boundingBox.height))
        .slice(0, 1);
    }

    const fullFeatures = extractFeaturesFromCanvas(fullCanvas, 'Top Wear', userGender);
    const hasVisibleGarment = fullFeatures.edgeDensity > 0.035 || localizedCandidates.length > 0;
    if (!hasVisibleGarment) return [];
    return [{
      id: 'detected-1',
      label: fullFeatures.garmentType || 'Detected Garment',
      cropDataUrl: fullCanvas.toDataURL('image/jpeg', 0.82),
      boundingBox: { x: 0, y: 0, width: 1, height: 1 },
      confidence: Math.max(0.5, fullFeatures.confidence.category),
      features: fullFeatures
    }];
  }
}

interface GeminiDetectedGarment {
  garmentType?: string;
  category?: string;
  subcategory?: string;
  gender?: string;
  genderCategory?: string;
  primaryColor?: string;
  dominantColor?: string;
  secondaryColor?: string;
  pattern?: string;
  sleeveType?: string;
  neckType?: string;
  fit?: string;
  material?: string;
  confidence?: number;
}

const geminiFashionPrompt = `
You are NOVA Vision AI, a professional fashion recognition engine.
Your only job is to identify the PRIMARY clothing item in the image.
Return ONLY valid JSON. Do not include markdown, prose, or explanations.

If multiple garments are visible, identify the largest and most visible garment only.
Ignore face, hair, background, trees, buildings, furniture, bags, shoes, jewellery, and sunglasses.
Never invent a category. The returned subcategory must be one of the supported NOVA subcategories.

Supported NOVA subcategories:
Top Wear: T-Shirt, Polo Shirt, Shirt, Hoodie, Sweatshirt, Jacket, Crop Top, Kurta, Kurti.
Bottom Wear: Jeans, Trousers, Joggers, Cargo Pants, Skirt, Leggings, Palazzo.
One Piece: Dress, Jumpsuit.

Never return these unsupported subcategories:
Henley, Oversized T-Shirt, Tube Top, Tank Top, Blouse, Sweater, Blazer, Nehru Jacket, Shorts, Saree, Lehenga, Sherwani, Pathani Suit, Salwar Suit, Dhoti, Casual Shirt, Formal Shirt, Chinos, Track Pants, Maxi Dress, Mini Dress, Gown, Dupatta.

Map unsupported lookalikes to supported categories:
Henley -> T-Shirt.
Oversized T-Shirt -> T-Shirt.
Tube Top -> Crop Top.
Tank Top -> Crop Top.
Blouse -> Shirt.
Sweater -> Sweatshirt.
Blazer -> Jacket.
Nehru Jacket -> Jacket.
Shorts -> Trousers if absolutely necessary.
Saree, Lehenga, Gown, Maxi Dress, Mini Dress -> Dress.
Sherwani, Pathani Suit -> Kurta.
Salwar Suit, Dupatta -> Kurti.

Category knowledge:
T-Shirt: round neck, hip length, casual, no button placket. Never classify Kurta as T-Shirt.
Polo Shirt: must have polo collar and short front placket. Never classify normal Shirt as Polo Shirt.
Shirt: front buttons and fold collar. Never classify Kurta as Shirt.
Kurta: long traditional Indian top, mandarin/band collar, ethnic prints, straight cut, knee length or longer.
Kurti: women's ethnic top, traditional silhouette, longer than Crop Top.
Crop Top: ends above waist. Never classify as Hoodie or Kurti.
Hoodie: must contain a visible hood. If hood is absent, do not classify as Hoodie.
Sweatshirt: similar to Hoodie but has no hood.
Jacket: outerwear, usually open front, often layered.

Allowed colors: Black, White, Grey, Charcoal, Brown, Tan, Beige, Cream, Maroon, Wine, Red, Orange, Coral, Peach, Pink, Purple, Lavender, Lilac, Sky Blue, Royal Blue, Navy Blue, Olive, Forest Green, Green, Mustard, Yellow.
Allowed patterns: Solid, Printed, Graphic, Striped, Checked, Floral, Paisley, Ethnic Print, Abstract, Tie Dye, Textured.
Allowed neck types: Round Neck, V Neck, Mandarin Collar, Collar, Polo Collar, Square Neck, Boat Neck, Sweetheart Neck, Hooded.
Allowed sleeve types: Sleeveless, Half Sleeve, Three Quarter Sleeve, Full Sleeve, Puff Sleeve.
Allowed fits: Slim, Regular, Relaxed.
Allowed materials: Cotton, Cotton Blend, Polyester, Polyester Blend, Denim, Linen, Silk, Unknown.
Allowed gender values: Men, Women, Unisex. Infer gender only from the garment.

Return this exact JSON shape:
{
  "category": "Top Wear",
  "subcategory": "Crop Top",
  "gender": "Women",
  "primaryColor": "Tan",
  "secondaryColor": "Black",
  "pattern": "Printed",
  "neckType": "Square Neck",
  "sleeveType": "Full Sleeve",
  "fit": "Regular",
  "material": "Polyester Blend",
  "confidence": 98
}
`;

const extractJsonObject = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
};

const getGeminiApiKey = () => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return env.VITE_GEMINI_API_KEY || env.VITE_GOOGLE_API_KEY || env.GEMINI_API_KEY || '';
};

class GeminiVisionProvider implements VisionProvider {
  private fallback = new BrowserVisionProvider();

  async compressImage(file: File) {
    return this.fallback.compressImage(file);
  }

  async detectClothing(imageUrl: string, userGender?: string) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return this.fallback.detectClothing(imageUrl, userGender);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: geminiFashionPrompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) throw new Error(`Gemini vision request failed: ${response.status}`);
      const payload = await response.json();
      const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
      const parsed = JSON.parse(extractJsonObject(text)) as GeminiDetectedGarment & { items?: GeminiDetectedGarment[] };
      const garments = Array.isArray(parsed.items) ? parsed.items : [parsed];
      if (garments.length === 0) return [];

      const canvas = await drawToCanvas(imageUrl);
      const lowLevelFeatures = extractFeaturesFromCanvas(canvas, 'Top Wear', userGender);

      return garments.slice(0, 1).map((garment, index): DetectedClothingItem => {
        const genderCategory = garment.genderCategory || garment.gender || userGender;
        const garmentType = canonicalSubcategoryFromText(garment.subcategory || garment.garmentType || '', genderCategory)
          || fallbackSupportedSubcategoryForCategory(garment.category || '', genderCategory);
        const category = (normalizeText(garment.category || '') === 'one piece' ? 'Full Body' : garment.category || taxonomyMetaFor(garmentType)?.category || bodySectionForCategory(garmentType) || 'Unknown') as ClothingFeatureVector['bodySection'];
        const confidence = Math.max(0.1, Math.min(1, Number(garment.confidence || 72) / 100));
        const features: ClothingFeatureVector = {
          ...lowLevelFeatures,
          dominantColor: garment.primaryColor || garment.dominantColor || lowLevelFeatures.dominantColor,
          secondaryColor: garment.secondaryColor || lowLevelFeatures.secondaryColor,
          category,
          subcategory: garmentType,
          garmentType,
          bodySection: category,
          pattern: garment.pattern || lowLevelFeatures.pattern,
          sleeveType: garment.sleeveType || lowLevelFeatures.sleeveType,
          neckType: garment.neckType || lowLevelFeatures.neckType,
          fit: garment.fit || lowLevelFeatures.fit,
          hasHood: normalizeText(garmentType).includes('hood') || normalizeText(garment.neckType || '').includes('hood'),
          fabric: garment.material || lowLevelFeatures.fabric,
          genderCategory: genderCategory || inferGenderForDetectedGarment(garmentType, userGender),
          confidence: {
            ...lowLevelFeatures.confidence,
            category: confidence,
            bodySection: confidence,
            sleeveType: garment.sleeveType ? confidence : lowLevelFeatures.confidence.sleeveType,
            neckType: garment.neckType ? confidence : lowLevelFeatures.confidence.neckType,
            fit: garment.fit ? confidence : lowLevelFeatures.confidence.fit,
            primaryColor: garment.primaryColor || garment.dominantColor ? confidence : lowLevelFeatures.confidence.primaryColor,
            secondaryColor: garment.secondaryColor ? confidence : lowLevelFeatures.confidence.secondaryColor,
            pattern: garment.pattern ? confidence : lowLevelFeatures.confidence.pattern,
            material: garment.material ? confidence : lowLevelFeatures.confidence.material,
            genderCategory: genderCategory ? confidence : lowLevelFeatures.confidence.genderCategory
          },
          tags: [
            garment.primaryColor || garment.dominantColor || lowLevelFeatures.dominantColor,
            garment.secondaryColor || lowLevelFeatures.secondaryColor,
            garment.pattern || lowLevelFeatures.pattern,
            garmentType,
            category,
            garment.sleeveType || lowLevelFeatures.sleeveType,
            garment.neckType || lowLevelFeatures.neckType,
            garment.material || lowLevelFeatures.fabric
          ].map(normalizeText)
        };

        return {
          id: `gemini-detected-${index + 1}`,
          label: garmentType,
          cropDataUrl: imageUrl,
          boundingBox: { x: 0, y: 0, width: 1, height: 1 },
          confidence,
          features
        };
      }).sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.warn('[scan] Gemini vision failed, falling back to browser vision.', error);
      return this.fallback.detectClothing(imageUrl, userGender);
    }
  }
}

const visionProvider: VisionProvider = new GeminiVisionProvider();

const getStoredJson = <T>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const setStoredJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage is a best-effort performance cache
  }
};

const categoryCandidates = (category: string, garmentType: string) => {
  const detected = canonicalSubcategoryFromText(garmentType) || canonicalSubcategoryFromText(category) || garmentType || category;
  const normalized = normalizeText(detected);
  const values = [detected];

  if (normalized === 'crop top') values.push('Crop Tops');
  if (normalized === 'tank top') values.push('Tank Tops', 'Sleeveless Top', 'Sleeveless Tops');
  if (normalized === 'tube top') values.push('Tube Tops');
  if (normalized === 't shirt') values.push('T-Shirts', 'Tees');
  if (normalized === 'oversized t shirt') values.push('Oversized T-Shirts');
  if (normalized === 'polo shirt') values.push('Polo', 'Polo Shirts');
  if (normalized === 'casual shirt') values.push('Casual Shirts');
  if (normalized === 'formal shirt') values.push('Formal Shirts');
  if (normalized === 'hoodie') values.push('Hoodies');
  if (normalized === 'oversized hoodie') values.push('Oversized Hoodies');
  if (normalized === 'sweatshirt') values.push('Sweatshirts');
  if (normalized === 'sweater') values.push('Sweaters');
  if (normalized === 'jacket') values.push('Jackets');
  if (normalized === 'blazer') values.push('Blazers');
  if (normalized === 'nehru jacket') values.push('Nehru Jackets');
  if (normalized === 'kurta') values.push('Kurtas');
  if (normalized === 'kurti') values.push('Kurtis');
  if (normalized === 'dress') values.push('Dresses');
  if (normalized === 'maxi dress') values.push('Maxi Dresses');
  if (normalized === 'mini dress') values.push('Mini Dresses');
  if (normalized === 'saree') values.push('Sarees');
  if (normalized === 'lehenga') values.push('Lehengas');
  if (normalized === 'salwar suit') values.push('Salwar Suits');
  if (normalized === 'jumpsuit') values.push('Jumpsuits');
  if (normalized === 'jeans') values.push('Jeans');
  if (normalized === 'trousers') values.push('Trousers');
  if (normalized === 'cargo pants') values.push('Cargo Pants', 'Cargos');
  if (normalized === 'joggers') values.push('Jogger');
  if (normalized === 'track pants') values.push('Track Pants');
  if (normalized === 'chinos') values.push('Chino');
  if (normalized === 'palazzo') values.push('Palazzos');
  if (normalized === 'leggings') values.push('Legging');
  if (normalized === 'shorts') values.push('Shorts');
  if (normalized === 'skirt') values.push('Skirts');

  return values.filter((value, index, arr) => value && arr.indexOf(value) === index).slice(0, 10);
};

const productCategoryText = (product: ProductItem) => normalizeText([
  product.category,
  product.subcategory,
  product.name,
  product.description,
  ...(product.tags || [])
].join(' '));

const productCoreCategoryText = (product: ProductItem) => normalizeText([
  product.category,
  product.subcategory,
  product.name,
  ...(product.tags || [])
].join(' '));

const metadataCategoryText = (metadata: RuntimeProductMetadata) => normalizeText([
  metadata.category,
  metadata.subcategory,
  metadata.gender,
  metadata.searchableText
].join(' '));

const productCanonicalSubcategory = (product: ProductItem) => {
  const metadata = getRuntimeProductMetadata(product);
  return canonicalSubcategoryFromText(metadata.subcategory, metadata.gender)
    || canonicalSubcategoryFromText(metadata.searchableText, metadata.gender)
    || canonicalSubcategoryFromText(metadata.category, metadata.gender);
};

const detectedCanonicalSubcategory = (features: ClothingFeatureVector) => (
  canonicalSubcategoryFromText(features.garmentType, features.genderCategory)
    || canonicalSubcategoryFromText(features.subcategory, features.genderCategory)
    || canonicalSubcategoryFromText(features.category, features.genderCategory)
    || features.garmentType
);

const hardCategoryConflicts: Record<string, string[]> = {
  'crop top': ['dress', 'gown', 'saree', 'kurti', 'kurta', 'jean', 'trouser', 'shorts', 'skirt'],
  'tank top': ['dress', 'gown', 'saree', 'kurti', 'kurta', 'jean', 'trouser', 'shorts', 'skirt'],
  'tube top': ['dress', 'gown', 'saree', 'kurti', 'kurta', 'jean', 'trouser', 'shorts', 'skirt'],
  't shirt': ['dress', 'gown', 'saree', 'kurti', 'jean', 'trouser', 'shorts', 'skirt'],
  hoodie: ['t shirt', 'tee', 'shirt', 'dress', 'jean', 'trouser', 'shorts', 'skirt'],
  sweatshirt: ['t shirt', 'tee', 'shirt', 'dress', 'jean', 'trouser', 'shorts', 'skirt'],
  jacket: ['t shirt', 'tee', 'dress', 'jean', 'trouser', 'shorts', 'skirt'],
  blazer: ['t shirt', 'tee', 'dress', 'jean', 'trouser', 'shorts', 'skirt'],
  shirt: ['kurti', 'saree', 'dress', 'jean', 'trouser', 'shorts', 'skirt'],
  'polo shirt': ['kurti', 'saree', 'dress', 'jean', 'trouser', 'shorts', 'skirt'],
  jeans: ['trouser', 'pant', 'dress', 'skirt', 'shorts'],
  trousers: ['jean', 'denim', 'dress', 'skirt', 'shorts'],
  dress: ['crop top', 'tank top', 't shirt', 'jean', 'trouser', 'shorts'],
  kurta: ['crop top', 'tank top', 't shirt', 'dress', 'jean', 'trouser', 'shorts'],
  kurti: ['crop top', 'tank top', 't shirt', 'dress', 'jean', 'trouser', 'shorts'],
  saree: ['dress', 'jean', 'trouser', 'shorts'],
  shorts: ['jean', 'trouser', 'dress', 'skirt'],
  skirt: ['jean', 'trouser', 'shorts', 'dress']
};

const productMatchesDetectedCategory = (product: ProductItem, features: ClothingFeatureVector) => {
  const detected = normalizeText(detectedCanonicalSubcategory(features));
  const metadata = getRuntimeProductMetadata(product);
  const categoryText = metadataCategoryText(metadata);
  const coreCategoryText = normalizeText([metadata.category, metadata.subcategory].join(' '));
  const productCanonical = productCanonicalSubcategory(product);
  if (productCanonical && normalizeText(productCanonical) === detected) return true;
  const allowed = categoryCandidates(features.category, features.garmentType).map(normalizeText);
  const productCategory = normalizeText(metadata.category || '');
  const productSubcategory = normalizeText(metadata.subcategory || '');
  if (allowed.some((value) => value === productCategory || value === productSubcategory)) return true;
  if (detected === 'crop top') {
    return categoryText.includes('crop') || categoryText.includes('tank') || categoryText.includes('tube') || categoryText.includes('sleeveless top');
  }
  if (detected === 'jeans') return categoryText.includes('jean') || categoryText.includes('denim');
  if (detected === 'trousers') return (categoryText.includes('trouser') || categoryText.includes('pant') || categoryText.includes('chino')) && !categoryText.includes('jean');
  if (detected === 'shirt') return categoryText.includes('shirt') && !categoryText.includes('kurti') && !categoryText.includes('kurta') && !categoryText.includes('t shirt');
  const conflicts = hardCategoryConflicts[detected] || [];
  return !conflicts.some((conflict) => coreCategoryText.includes(conflict)) && textScore(features.garmentType, metadata.category) >= 0.5;
};

const productIsAcceptableFallback = (product: ProductItem, features: ClothingFeatureVector) => {
  const detected = normalizeText(detectedCanonicalSubcategory(features));
  const metadata = getRuntimeProductMetadata(product);
  const coreCategoryText = normalizeText([metadata.category, metadata.subcategory].join(' '));
  const conflicts = hardCategoryConflicts[detected] || [];
  const productCanonical = productCanonicalSubcategory(product);
  if (productCanonical && normalizeText(productCanonical) !== detected) return false;
  if (conflicts.some((conflict) => coreCategoryText.includes(conflict))) return false;
  const productBodySection = bodySectionForCategory(canonicalSubcategoryFromText(metadata.subcategory, metadata.gender) || metadata.category);
  return productBodySection === 'Unknown' || features.bodySection === 'Unknown' || productBodySection === features.bodySection;
};

const getDocsWithRetry = async (candidateQuery: ReturnType<typeof query>) => {
  try {
    return await getDocsFromServer(candidateQuery);
  } catch (error) {
    console.warn('[scan] Firestore candidate query failed once, retrying.', error);
    return getDocsFromServer(candidateQuery);
  }
};

const fetchCandidates = async (features: ClothingFeatureVector, userGender?: string): Promise<ProductItem[]> => {
  await waitForFirebaseAuthReady();
  const allowedCategories = categoryCandidates(features.category, features.garmentType);
  const cacheKey = `${features.garmentType}|${allowedCategories.join(',')}|${normalizeColor(features.dominantColor)}|${userGender || 'any'}`;

  const productsRef = collection(db, 'products');
  const allowedTags = allowedCategories.map(normalizeText).filter(Boolean).slice(0, 10);
  const queries = [
    query(productsRef, where('subcategory', 'in', allowedCategories), limit(48)),
    query(productsRef, where('category', 'in', allowedCategories), limit(48)),
    query(productsRef, where('tags', 'array-contains-any', allowedTags), limit(48))
  ];

  const snapshots = await Promise.allSettled(queries.map((candidateQuery) => getDocsWithRetry(candidateQuery)));
  const productMap = new Map<string, ProductItem>();
  console.debug('[scan] Firestore product candidate snapshots received:', {
    cacheKey,
    snapshotCount: snapshots.length,
    fulfilledSnapshots: snapshots.filter((result) => result.status === 'fulfilled').length,
    documentCounts: snapshots.map((result) => result.status === 'fulfilled' ? result.value.size : 0)
  });
  snapshots.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach((docSnap) => {
      const product = normalizeProduct(docSnap.id, docSnap.data());
      if (product) productMap.set(product.id, product);
    });
  });

  primeRuntimeProductMetadata(Array.from(productMap.values()));
  let products = Array.from(productMap.values()).filter((product) => productMatchesDetectedCategory(product, features));

  if (products.length === 0) {
    const fallbackSnapshot = await getDocsWithRetry(query(productsRef, limit(120)));
    fallbackSnapshot.forEach((docSnap) => {
      const product = normalizeProduct(docSnap.id, docSnap.data());
      if (product) productMap.set(product.id, product);
    });
    primeRuntimeProductMetadata(Array.from(productMap.values()));
    products = Array.from(productMap.values()).filter((product) => productMatchesDetectedCategory(product, features));
  }

  if (userGender) {
    const genderFiltered = products.filter((product) => {
      const actualGender = getRuntimeProductMetadata(product).gender || product.gender || inferProductGender(product);
      return !actualGender || actualGender === 'Unisex' || normalizeText(actualGender) === normalizeText(userGender);
    });
    if (genderFiltered.length > 0) products = genderFiltered;
  }

  // For male users, deprioritize or exclude products that are clearly dresses/kurti/saree
  try {
    if (normalizeText(userGender || '') === 'men') {
      const filtered = products.filter((p) => {
        const metadata = getRuntimeProductMetadata(p);
        const hay = normalizeText([metadata.category, metadata.subcategory, metadata.gender, metadata.searchableText].join(' '));
        if (hay.includes('dress') || hay.includes('kurti') || hay.includes('saree') || hay.includes('lehenga') || hay.includes('gown')) return false;
        return true;
      });
      if (filtered.length > 0) products = filtered;
    }
  } catch (e) {
    // ignore
  }

  products = products.slice(0, 40);
  console.debug('[scan] Firestore product candidates loaded:', {
    cacheKey,
    productsLoaded: products.length,
    productIds: products.map((product) => product.id)
  });
  return products;
};

const productFeatureFromMetadata = (product: ProductItem): ClothingFeatureVector => {
  const text = normalizeText([
    product.name,
    product.category,
    product.subcategory,
    product.description,
    ...(product.details || []),
    ...(product.tags || [])
  ].join(' '));
  const color = product.colors?.[0] || 'Standard';
  const secondaryColor = product.colors?.[1] || color;
  const garmentType = canonicalSubcategoryFromText(product.subcategory || '', product.gender)
    || canonicalSubcategoryFromText(text, product.gender)
    || canonicalSubcategoryFromText(product.category || '', product.gender)
    || product.subcategory
    || product.category
    || 'Uncategorized';
  const bodySection = taxonomyMetaFor(garmentType)?.category || bodySectionForCategory(garmentType);
  const pattern = product.pattern || (
    text.includes('floral') ? 'Floral'
      : text.includes('graphic') ? 'Graphic'
        : text.includes('stripe') ? 'Striped'
          : text.includes('check') ? 'Checked'
            : text.includes('embroider') ? 'Embroidered'
              : text.includes('print') ? 'Printed'
                : text.includes('abstract') ? 'Abstract'
                  : text.includes('texture') ? 'Textured'
                    : 'Solid'
  );
  const genderTag = product.gender ? [product.gender] : [];
  const fit = product.fit || (text.includes('oversized') ? 'Oversized' : text.includes('relaxed') ? 'Relaxed' : text.includes('slim') ? 'Slim' : 'Regular');

  return {
    dominantColor: color,
    secondaryColor,
    colorHex: '#999999',
    category: bodySection,
    subcategory: garmentType,
    garmentType,
    bodySection,
    pattern,
    shape: text.includes('oversized') ? 'wide' : text.includes('slim') ? 'long' : 'regular',
    sleeveType: product.sleeveType || (text.includes('sleeveless') || text.includes('tank') ? 'Sleeveless' : text.includes('half sleeve') || text.includes('short sleeve') ? 'Half Sleeve' : text.includes('sleeve') ? 'Full Sleeve' : 'Regular'),
    neckType: product.neckType || (text.includes('hood') ? 'Hooded' : text.includes('v neck') ? 'V Neck' : text.includes('square neck') ? 'Square' : text.includes('collar') ? 'Collar' : 'Round'),
    fit,
    hasHood: text.includes('hood'),
    fabric: product.fabric || (text.includes('denim') ? 'Denim' : text.includes('cotton') ? 'Cotton Blend' : 'Blend'),
    genderCategory: product.gender || 'Unisex',
    confidence: {
      category: 0.9,
      bodySection: 0.86,
      sleeveType: product.sleeveType ? 0.9 : 0.55,
      neckType: product.neckType ? 0.9 : 0.55,
      fit: product.fit ? 0.9 : 0.55,
      primaryColor: product.colors?.[0] ? 0.9 : 0.5,
      secondaryColor: product.colors?.[1] ? 0.85 : 0.35,
      pattern: product.pattern ? 0.9 : 0.58,
      material: product.fabric ? 0.9 : 0.55,
      genderCategory: product.gender ? 0.9 : 0.5
    },
    tags: [bodySection, product.category, product.subcategory || '', garmentType, pattern, color, secondaryColor, fit, ...(product.tags || []), ...genderTag].map(normalizeText),
    histogram: new Array(12).fill(0),
    edgeDensity: pattern === 'Solid' ? 0.04 : 0.16,
    aspectRatio: 0.75
  };
};

const textScore = (a: string, b: string) => {
  const aWords = new Set(normalizeText(a).split(' ').filter(Boolean));
  const bWords = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (aWords.size === 0 || bWords.size === 0) return 0;
  let hits = 0;
  aWords.forEach((word) => {
    if (bWords.has(word)) hits += 1;
  });
  return hits / Math.max(aWords.size, bWords.size);
};

const cosineSimilarity = (a: number[], b: number[]) => {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const exactCatalogMatchScore = (item: DetectedClothingItem, product: ProductItem, userGender?: string) => {
  const metadata = getRuntimeProductMetadata(product);
  const detectedSubcategory = normalizeText(detectedCanonicalSubcategory(item.features));
  const productSubcategory = normalizeText(productCanonicalSubcategory(product));
  const sameSubcategory = Boolean(detectedSubcategory && productSubcategory && detectedSubcategory === productSubcategory);
  const samePrimaryColor = areColorsEquivalent(metadata.primaryColor, item.features.dominantColor);
  const sameSecondaryColor = areColorsEquivalent(metadata.secondaryColor, item.features.secondaryColor)
    || areColorsEquivalent(metadata.secondaryColor, item.features.dominantColor);
  const samePattern = normalizeText(metadata.pattern) === normalizeText(item.features.pattern);
  const sameSleeve = item.features.sleeveType === 'Not applicable' || textScore(metadata.sleeveType, item.features.sleeveType) > 0;
  const sameNeck = item.features.neckType === 'Not applicable' || textScore(metadata.neckType, item.features.neckType) > 0;
  const inferredGender = metadata.gender || product.gender || inferProductGender(product);
  const sameGender = !userGender || !inferredGender || inferredGender === 'Unisex' || normalizeText(inferredGender) === normalizeText(userGender);
  const exactSignals = [sameSubcategory, samePrimaryColor, samePattern, sameSleeve, sameNeck, sameGender].filter(Boolean).length;

  if (sameSubcategory && samePrimaryColor && samePattern && sameGender) return 98;
  if (sameSubcategory && (samePrimaryColor || sameSecondaryColor) && sameGender && exactSignals >= 4) return 94;
  if (sameSubcategory && sameGender && exactSignals >= 3) return 90;
  return 0;
};

const getProductImageEmbedding = async (product: ProductItem) => {
  const cache = getStoredJson<Record<string, ClothingFeatureVector>>(productCacheKey, {});
  const cacheId = `${product.id}:${product.imageUrl}`;
  if (cache[cacheId]) return cache[cacheId];
  try {
    const canvas = await drawToCanvas(product.imageUrl);
    const features = extractFeaturesFromCanvas(canvas, product.category);
    const metadata = productFeatureFromMetadata(product);
    const metadataHasUsableColor = product.colors?.some((color) => normalizeText(color) !== 'standard');
    cache[cacheId] = {
      ...features,
      ...metadata,
      dominantColor: metadataHasUsableColor ? metadata.dominantColor : features.dominantColor,
      secondaryColor: metadataHasUsableColor ? metadata.secondaryColor : features.secondaryColor,
      histogram: features.histogram,
      edgeDensity: features.edgeDensity,
      aspectRatio: features.aspectRatio,
      colorHex: features.colorHex
    };
    setStoredJson(productCacheKey, cache);
    return cache[cacheId];
  } catch {
    const fallback = productFeatureFromMetadata(product);
    cache[cacheId] = fallback;
    setStoredJson(productCacheKey, cache);
    return fallback;
  }
};

const scoreProduct = async (item: DetectedClothingItem, product: ProductItem, userGender?: string) => {
  const productMetadata = getRuntimeProductMetadata(product);
  const exactScore = exactCatalogMatchScore(item, product, userGender);
  const color = Math.max(
    textScore(item.features.dominantColor, productMetadata.primaryColor),
    textScore(item.features.secondaryColor, productMetadata.secondaryColor),
    areColorsEquivalent(productMetadata.primaryColor, item.features.dominantColor) ? 1 : 0,
    areColorsEquivalent(productMetadata.secondaryColor, item.features.dominantColor) ? 0.85 : 0
  );
  const pattern = normalizeText(item.features.pattern) === normalizeText(productMetadata.pattern)
    ? 1
    : textScore(item.features.pattern, productMetadata.pattern) || (item.features.pattern === 'Solid' ? 0.15 : 0.25);
  const fit = textScore(item.features.fit, productMetadata.fit);
  const sleeve = item.features.sleeveType === 'Not applicable' ? 1 : textScore(item.features.sleeveType, productMetadata.sleeveType);
  const neck = item.features.neckType === 'Not applicable' ? 1 : textScore(item.features.neckType, productMetadata.neckType);
  const itemMaterial = normalizeText(item.features.fabric);
  const productMaterial = normalizeText(productMetadata.material);
  const material = Math.max(textScore(item.features.fabric, productMetadata.material), itemMaterial && productMaterial && itemMaterial.includes(productMaterial) ? 1 : 0);
  const inferredGender = productMetadata.gender || product.gender || inferProductGender(product);
  const genderMatch = userGender && inferredGender
    ? (inferredGender === 'Unisex' || normalizeText(inferredGender) === normalizeText(userGender) ? 1 : 0.7)
    : 1;
  const category = productMatchesDetectedCategory(product, item.features) ? 1 : productIsAcceptableFallback(product, item.features) ? 0.45 : 0;
  const detectedSubcategory = normalizeText(detectedCanonicalSubcategory(item.features));
  const productSubcategory = normalizeText(productCanonicalSubcategory(product));
  const wrongKnownSubcategoryPenalty = detectedSubcategory && productSubcategory && detectedSubcategory !== productSubcategory ? 0.55 : 1;

  const weightedSimilarity = (
    category * 0.50 +
    color * 0.18 +
    pattern * 0.15 +
    sleeve * 0.07 +
    neck * 0.05 +
    fit * 0.03 +
    material * 0.05
  );
  const strictScore = weightedSimilarity * genderMatch * wrongKnownSubcategoryPenalty;
  return Math.max(exactScore, Math.max(0, Math.min(100, Math.round(strictScore * 100))));
};

const reasonsForRecommendation = (item: DetectedClothingItem, product: ProductItem) => {
  const reasons = new Set<string>();
  const productMetadata = getRuntimeProductMetadata(product);
  if (productMatchesDetectedCategory(product, item.features)) reasons.add('Same category');
  if (textScore(productMetadata.neckType, item.features.neckType) > 0) reasons.add('Same neckline');
  if (areColorsEquivalent(productMetadata.primaryColor, item.features.dominantColor)) reasons.add('Same color');
  if (textScore(productMetadata.fit, item.features.fit) > 0) reasons.add('Same silhouette');
  if (textScore(productMetadata.material, item.features.fabric) > 0) reasons.add('Similar fabric');
  if (textScore(productMetadata.pattern, item.features.pattern) > 0) reasons.add('Same pattern');
  if (reasons.size === 0) ['Same category', 'Same color', 'Similar fabric'].forEach((reason) => reasons.add(reason));
  return Array.from(reasons).slice(0, 5);
};

const findPairedProducts = (products: ProductItem[], selected: ProductItem) => (
  products
    .filter((product) => product.id !== selected.id)
    .slice(0, 5)
);

const createDetectedProductPlaceholder = (item: DetectedClothingItem): ProductItem => ({
  id: `detected-placeholder-${item.id}`,
  productId: `detected-placeholder-${item.id}`,
  name: `${item.features.dominantColor} ${item.features.garmentType || 'Garment'}`,
  category: item.features.garmentType || item.features.category || 'Detected Garment',
  subcategory: item.features.garmentType || undefined,
  description: 'Detected garment. No exact catalog product found.',
  price: 0,
  rating: 0,
  reviewsCount: 0,
  imageUrl: item.cropDataUrl,
  mainImage: item.cropDataUrl,
  images: [item.cropDataUrl],
  imageUrls: [item.cropDataUrl],
  colors: [item.features.dominantColor, item.features.secondaryColor].filter(Boolean),
  sizes: ['One Size'],
  inStock: false,
  details: [item.features.pattern, item.features.fabric, item.features.fit].filter(Boolean),
  fabric: item.features.fabric as ProductItem['fabric'],
  pattern: item.features.pattern as ProductItem['pattern'],
  sleeveType: item.features.sleeveType as ProductItem['sleeveType'],
  neckType: item.features.neckType as ProductItem['neckType'],
  gender: item.features.genderCategory as ProductItem['gender'],
  tags: item.features.tags
});

const matchItem = async (item: DetectedClothingItem, userGender?: string): Promise<ScanProductResult> => {
  const candidates = await fetchCandidates(item.features, userGender);
  if (candidates.length === 0) {
    const placeholder = createDetectedProductPlaceholder(item);
    return {
      item,
      product: placeholder,
      kind: 'recommendation',
      score: 0,
      title: 'No Exact Match Found',
      recommendationReasons: ['Detected clothing', 'No catalog product found'],
      pairedWith: []
    };
  }

  const scored = await Promise.all(candidates.map(async (product) => ({
    product,
    score: await scoreProduct(item, product, userGender)
  })));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Diagnostic logging for problematic gender/category matches
  try {
    const top = scored.slice(0, 6).map((s) => ({ id: s.product.id, name: s.product.name, category: s.product.category, gender: s.product.gender || inferProductGender(s.product), score: s.score }));
    console.debug('[scan-diagnostics] item:', {
      detectedGarment: item.features.garmentType,
      aspectRatio: item.features.aspectRatio,
      edgeDensity: item.features.edgeDensity,
      dominantColor: item.features.dominantColor,
      userGender
    });
    console.debug('[scan-diagnostics] topCandidates:', top);
  } catch (e) {
    // ignore logging errors
  }
  const kind: ScanMatchKind = best.score >= 90 ? 'exact' : best.score >= 70 ? 'similar' : 'recommendation';

  return {
    item,
    product: best.product,
    kind,
    score: best.score,
    title: kind === 'exact' ? 'Exact Match Found' : kind === 'similar' ? 'Similar Product Found' : 'No Exact Match Found',
    recommendationReasons: reasonsForRecommendation(item, best.product),
    pairedWith: findPairedProducts(scored.map((entry) => entry.product), best.product)
  };
};

export const runCameraScan = async (file: File, source: ScanImageSource, onProgress?: ScanProgress, userGender?: string): Promise<CameraScanResult> => {
  onProgress?.('Analyzing Clothing...');
  const compressedImageUrl = await visionProvider.compressImage(file);
  const items = await visionProvider.detectClothing(compressedImageUrl, userGender);
  if (items.length === 0) throw new Error("Couldn't detect clothing.");

  onProgress?.('Filtering Category Matches...');
  const results = await Promise.all(items.map((item) => matchItem(item, userGender)));
  return {
    source,
    compressedImageUrl,
    items,
    results
  };
};
