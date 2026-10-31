import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';

export interface NormalizedProduct {
  id: string;
  name: string;
  category: 'Top Wear' | 'Bottom Wear' | 'Full Body' | 'Footwear' | 'Accessories' | 'Outerwear' | string;
  subcategory: string;
  price: number;
  originalPrice?: number;
  discountedPrice?: number;
  colors: string[];
  primaryColor: string;
  secondaryColor?: string;
  sizes: string[];
  imageUrl: string;
  images: string[];
  vendorId: string;
  vendorName?: string;
  gender: 'Men' | 'Women' | 'Unisex';
  fabric?: string;
  fit?: string;
  pattern?: string;
  sleeveType?: string;
  neckType?: string;
  occasions: string[];
  seasons: string[];
  styles: string[];
  tags: string[];
  inStock: boolean;
  stockQuantity: number;
  rating: number;
  reviewsCount: number;
  description?: string;
  searchableText: string;
  raw: Record<string, unknown>;
}

// Aliases for inconsistent catalogue field names
const ALIASES = {
  name: ['name', 'Name', 'productName', 'namde', 'title'],
  category: ['category', 'Category', 'productCategory', 'mainCategory'],
  subcategory: ['subcategory', 'subCategory', 'SubCategory', 'type'],
  colors: ['colors', 'Colors', 'Collors', 'color', 'Color', 'colour', 'colours'],
  sizes: ['sizes', 'Sizes', 'size', 'Size'],
  price: ['price', 'Price', 'discountedPrice', 'discountPrice', 'salePrice'],
  originalPrice: ['originalPrice', 'Original Price', 'OriginalPrice', 'originalprice', 'mrp', 'MRP'],
  imageUrl: ['imageUrl', 'mainImage', 'imageurl', 'imageurl1', 'image', 'img1', 'image_url'],
  images: ['images', 'imageUrls', 'imagesList', 'gallery', 'additionalImages'],
  vendorId: ['vendorId', 'vendorId ', 'vendor_id', 'sellerId'],
  vendorName: ['vendorName', 'vendor', 'brand', 'Brand', 'sellerName'],
  gender: ['gender', 'Gender', 'targetGender'],
  fabric: ['fabric', 'material', 'composition', 'Fabric'],
  fit: ['fit', 'Fit', 'silhouette', 'Silhouette'],
  pattern: ['pattern', 'Pattern', 'print'],
  sleeveType: ['sleeveType', 'sleeve', 'SleeveType', 'sleeves'],
  neckType: ['neckType', 'neck', 'NeckType', 'neckline'],
  occasions: ['occasions', 'occasionTags', 'occasion', 'Occasion'],
  seasons: ['seasons', 'seasonTags', 'season', 'Season'],
  styles: ['styles', 'styleTags', 'style', 'Style', 'tags', 'Tags'],
  stock: ['stockQuantity', 'stock', 'quantity', 'inventory']
};

const topWearSubcategories = new Set([
  't shirt', 't-shirt', 'tee', 'oversized t shirt', 'oversized t-shirt', 'polo shirt', 'polo',
  'henley', 'casual shirt', 'formal shirt', 'shirt', 'kurta', 'kurti', 'hoodie', 'oversized hoodie',
  'sweatshirt', 'sweater', 'jacket', 'blazer', 'nehru jacket', 'crop top', 'tank top', 'tube top',
  'blouse', 'wrap top', 'top'
]);

const bottomWearSubcategories = new Set([
  'jeans', 'denim', 'cargo pants', 'cargos', 'joggers', 'track pants', 'shorts', 'trousers',
  'chinos', 'palazzo', 'leggings', 'skirt', 'dhoti', 'pants', 'bottom'
]);

const fullBodySubcategories = new Set([
  'saree', 'sari', 'lehenga', 'salwar suit', 'dress', 'maxi dress', 'mini dress', 'gown',
  'jumpsuit', 'sherwani', 'pathani suit', 'suit'
]);

const footwearSubcategories = new Set([
  'sneakers', 'shoes', 'boots', 'loafers', 'sandals', 'slides', 'heels', 'flats'
]);

const colorAliases: Record<string, string> = {
  navy: 'Navy Blue',
  navyblue: 'Navy Blue',
  'navy blue': 'Navy Blue',
  sky: 'Sky Blue',
  skyblue: 'Sky Blue',
  'sky blue': 'Sky Blue',
  olive: 'Olive Green',
  'olive green': 'Olive Green',
  forest: 'Forest Green',
  'forest green': 'Forest Green',
  offwhite: 'Off White',
  'off white': 'Off White',
  ivory: 'Off White',
  cream: 'Cream',
  creme: 'Cream',
  gray: 'Grey',
  grey: 'Grey',
  charcoal: 'Charcoal',
  beige: 'Beige',
  black: 'Black',
  white: 'White',
  blue: 'Blue',
  green: 'Green',
  red: 'Red',
  pink: 'Pink',
  purple: 'Purple',
  yellow: 'Yellow',
  orange: 'Orange',
  brown: 'Brown',
  tan: 'Tan',
  burgundy: 'Burgundy',
  wine: 'Wine',
  maroon: 'Maroon',
  mustard: 'Mustard',
  lavender: 'Lavender',
  lavander: 'Lavender',
  peach: 'Peach',
  coral: 'Coral',
  rust: 'Rust'
};

const titleCase = (str: string): string =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());

const safeString = (val: unknown): string => {
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
  return '';
};

const safeNumber = (val: unknown, fallback = 0): number => {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    const parsed = Number(val.replace(/[₹,\s]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const safeArray = (val: unknown): string[] => {
  if (Array.isArray(val)) {
    return val
      .flatMap((item) => (typeof item === 'string' ? item.split(',') : [String(item)]))
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0 && item !== '[object Object]');
  }
  if (typeof val === 'string' && val.trim()) {
    if (val.trim().startsWith('data:image/')) return [val.trim()];
    return val.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return [];
};

const getFirstField = (raw: Record<string, unknown>, fieldNames: string[]): unknown => {
  for (const name of fieldNames) {
    if (raw[name] !== undefined && raw[name] !== null && raw[name] !== '') {
      return raw[name];
    }
  }
  return undefined;
};

const getAllFields = (raw: Record<string, unknown>, fieldNames: string[]): unknown[] => {
  const result: unknown[] = [];
  for (const name of fieldNames) {
    if (raw[name] !== undefined && raw[name] !== null && raw[name] !== '') {
      result.push(raw[name]);
    }
  }
  return result;
};

const normalizeColorName = (col: string): string => {
  const normalized = col.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return colorAliases[normalized] || titleCase(col.trim());
};

const inferSubcategoryAndCategory = (rawCategory: string, rawSubcategory: string, text: string): { category: string; subcategory: string } => {
  const combined = `${rawCategory} ${rawSubcategory} ${text}`.toLowerCase();

  for (const sub of topWearSubcategories) {
    if (combined.includes(sub)) {
      return { category: 'Top Wear', subcategory: titleCase(sub) };
    }
  }
  for (const sub of bottomWearSubcategories) {
    if (combined.includes(sub)) {
      return { category: 'Bottom Wear', subcategory: titleCase(sub) };
    }
  }
  for (const sub of fullBodySubcategories) {
    if (combined.includes(sub)) {
      return { category: 'Full Body', subcategory: titleCase(sub) };
    }
  }
  for (const sub of footwearSubcategories) {
    if (combined.includes(sub)) {
      return { category: 'Footwear', subcategory: titleCase(sub) };
    }
  }

  // Fallback to raw category mapping
  const catLower = rawCategory.toLowerCase();
  if (catLower.includes('top') || catLower.includes('shirt') || catLower.includes('tee')) {
    return { category: 'Top Wear', subcategory: titleCase(rawSubcategory || rawCategory || 'Top') };
  }
  if (catLower.includes('bottom') || catLower.includes('pant') || catLower.includes('jean')) {
    return { category: 'Bottom Wear', subcategory: titleCase(rawSubcategory || rawCategory || 'Bottom') };
  }
  if (catLower.includes('dress') || catLower.includes('suit') || catLower.includes('ethnic')) {
    return { category: 'Full Body', subcategory: titleCase(rawSubcategory || rawCategory || 'Dress') };
  }

  return {
    category: titleCase(rawCategory || 'General'),
    subcategory: titleCase(rawSubcategory || rawCategory || 'Garment')
  };
};

/**
 * Normalizes a raw Firestore catalogue product into the standardized NormalizedProduct representation.
 * Handles schema variations without mutating or updating the source Firestore document.
 */
export const normalizeProductRecord = (raw: Record<string, unknown>, id: string): NormalizedProduct | null => {
  if (!raw || typeof raw !== 'object') return null;

  // Filter out non-product test documents (e.g. { test: true })
  const rawName = safeString(getFirstField(raw, ALIASES.name));
  const rawPriceVal = getFirstField(raw, ALIASES.price);
  const rawImageVal = getFirstField(raw, ALIASES.imageUrl);

  if (!rawName && rawPriceVal === undefined && !rawImageVal) {
    return null; // Not a valid product record
  }

  const name = rawName || `Product #${id.slice(-6)}`;
  const price = safeNumber(rawPriceVal, 999);
  const originalPriceRaw = getFirstField(raw, ALIASES.originalPrice);
  const originalPrice = originalPriceRaw !== undefined ? safeNumber(originalPriceRaw) : undefined;
  const discountedPrice = originalPrice && originalPrice > price ? price : undefined;

  // Resolve Images
  const primaryImage = safeString(rawImageVal);
  const extraImages = getAllFields(raw, ALIASES.images).flatMap(safeArray);
  const allImages = Array.from(new Set([primaryImage, ...extraImages].filter((img) => img.length > 0)));
  const imageUrl = primaryImage || allImages[0] || '';

  // Resolve Colors
  const rawColorValues = getAllFields(raw, ALIASES.colors).flatMap(safeArray);
  const normalizedColors = Array.from(
    new Set(
      rawColorValues
        .map(normalizeColorName)
        .filter((c) => c && c.toLowerCase() !== 'standard' && c.toLowerCase() !== 'custom')
    )
  );

  // Searchable text for attribute extraction
  const rawDesc = safeString(raw.description || raw.details);
  const searchableText = `${name} ${rawDesc} ${normalizedColors.join(' ')} ${safeArray(raw.tags).join(' ')}`.toLowerCase();

  // Infer colors if not explicitly provided
  if (normalizedColors.length === 0) {
    for (const [alias, canonical] of Object.entries(colorAliases)) {
      if (searchableText.includes(alias) && !normalizedColors.includes(canonical)) {
        normalizedColors.push(canonical);
      }
    }
  }

  const primaryColor = normalizedColors[0] || 'Black';
  const secondaryColor = normalizedColors[1] || undefined;

  // Resolve Sizes
  const sizes = Array.from(new Set(getAllFields(raw, ALIASES.sizes).flatMap(safeArray)));

  // Resolve Subcategory and Category
  const rawCategory = safeString(getFirstField(raw, ALIASES.category));
  const rawSubcategory = safeString(getFirstField(raw, ALIASES.subcategory));
  const { category, subcategory } = inferSubcategoryAndCategory(rawCategory, rawSubcategory, searchableText);

  // Gender
  const rawGender = safeString(getFirstField(raw, ALIASES.gender)).toLowerCase();
  let gender: 'Men' | 'Women' | 'Unisex' = 'Unisex';
  if (rawGender.includes('women') || rawGender.includes('female') || rawGender.includes('ladies')) {
    gender = 'Women';
  } else if (rawGender.includes('men') || rawGender.includes('male') || rawGender.includes('gents')) {
    gender = 'Men';
  } else if (searchableText.includes('women') || searchableText.includes('female')) {
    gender = 'Women';
  } else if (searchableText.includes('men') || searchableText.includes('gents')) {
    gender = 'Men';
  }

  // Clothing details
  const fabric = safeString(getFirstField(raw, ALIASES.fabric)) || undefined;
  const fit = safeString(getFirstField(raw, ALIASES.fit)) || undefined;
  const pattern = safeString(getFirstField(raw, ALIASES.pattern)) || undefined;
  const sleeveType = safeString(getFirstField(raw, ALIASES.sleeveType)) || undefined;
  const neckType = safeString(getFirstField(raw, ALIASES.neckType)) || undefined;

  // Occasions, Seasons, Styles, Tags
  const occasions = Array.from(new Set(getAllFields(raw, ALIASES.occasions).flatMap(safeArray)));
  const seasons = Array.from(new Set(getAllFields(raw, ALIASES.seasons).flatMap(safeArray)));
  const styles = Array.from(new Set(getAllFields(raw, ALIASES.styles).flatMap(safeArray)));
  const tags = Array.from(new Set([...occasions, ...seasons, ...styles, ...safeArray(raw.tags)]));

  // Vendor & Stock
  const vendorId = safeString(getFirstField(raw, ALIASES.vendorId)) || 'NOVA_CORE';
  const vendorName = safeString(getFirstField(raw, ALIASES.vendorName)) || undefined;
  const rawStock = getFirstField(raw, ALIASES.stock);
  const stockQuantity = rawStock !== undefined ? safeNumber(rawStock) : 50;
  const inStock = raw.inStock !== false && stockQuantity > 0;

  // Rating & Reviews
  const rating = safeNumber(raw.rating, 4.5);
  const reviewsCount = safeNumber(raw.reviewsCount, 12);

  return {
    id,
    name,
    category,
    subcategory,
    price,
    originalPrice,
    discountedPrice,
    colors: normalizedColors,
    primaryColor,
    secondaryColor,
    sizes,
    imageUrl,
    images: allImages,
    vendorId,
    vendorName,
    gender,
    fabric,
    fit,
    pattern,
    sleeveType,
    neckType,
    occasions,
    seasons,
    styles,
    tags,
    inStock,
    stockQuantity,
    rating,
    reviewsCount,
    description: rawDesc || undefined,
    searchableText,
    raw
  };
};

// In-memory catalogue cache with TTL to avoid hammering Firestore
let cachedCatalogue: NormalizedProduct[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Fetches products from Firestore and normalizes them into NormalizedProduct format.
 * Caches in-memory for fast recommendation ranking.
 */
export const fetchAndNormalizeCatalogue = async (forceRefresh = false): Promise<NormalizedProduct[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedCatalogue && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedCatalogue;
  }

  try {
    const productsRef = collection(firestore, 'products');
    const snapshot = await getDocs(productsRef);

    const normalizedList: NormalizedProduct[] = [];
    snapshot.forEach((docSnap) => {
      const normalized = normalizeProductRecord(docSnap.data() as Record<string, unknown>, docSnap.id);
      if (normalized) {
        normalizedList.push(normalized);
      }
    });

    cachedCatalogue = normalizedList;
    lastCacheTime = now;
    return normalizedList;
  } catch (err) {
    console.warn('[Product Intelligence] Error fetching catalogue from Firestore, using cache if available:', err);
    if (cachedCatalogue) return cachedCatalogue;
    return [];
  }
};

/**
 * Fetches a single product by ID and normalizes it.
 */
export const fetchNormalizedProductById = async (productId: string): Promise<NormalizedProduct | null> => {
  try {
    const docRef = doc(firestore, 'products', productId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return normalizeProductRecord(docSnap.data() as Record<string, unknown>, docSnap.id);
  } catch (err) {
    console.error(`[Product Intelligence] Error fetching product ${productId}:`, err);
    return null;
  }
};
