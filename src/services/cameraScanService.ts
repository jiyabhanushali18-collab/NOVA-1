import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db, waitForFirebaseAuthReady } from '../firebase';
import { ProductItem } from '../types';

export type ScanImageSource = 'camera' | 'gallery';
export type ScanMatchKind = 'exact' | 'similar' | 'recommendation';

export interface ClothingFeatureVector {
  dominantColor: string;
  colorHex: string;
  category: string;
  garmentType: string;
  pattern: string;
  shape: string;
  sleeveType: string;
  neckType: string;
  hasHood: boolean;
  fabric: string;
  tags: string[];
  histogram: number[];
  edgeDensity: number;
  aspectRatio: number;
}

export interface DetectedClothingItem {
  id: string;
  label: string;
  cropDataUrl: string;
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
  detectClothing(imageUrl: string): Promise<DetectedClothingItem[]>;
}

const canvasSize = 512;
const productCacheKey = 'nova_camera_scan_product_embeddings_v1';
const candidateCacheKey = 'nova_camera_scan_candidate_cache_v1';

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

const colorAliasMap = new Map<string, string>([
  ['white', 'white'], ['off white', 'white'], ['off-white', 'white'], ['ivory', 'white'], ['cream', 'white'], ['bone', 'white'], ['snow', 'white'], ['pearl', 'white'],
  ['black', 'black'], ['ebony', 'black'], ['charcoal', 'black'], ['grey', 'grey'], ['gray', 'grey'], ['silver', 'grey'],
  ['navy', 'blue'], ['denim', 'blue'], ['sky blue', 'blue'], ['royal blue', 'blue'], ['beige', 'beige'], ['tan', 'beige'], ['sand', 'beige']
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
    blue: ['Blue', 'Navy', 'Denim', 'Sky Blue', 'Royal Blue'],
    beige: ['Beige', 'Tan', 'Sand']
  };
  return [...new Set([color, normalized, ...(synonyms[normalized] || [])])].slice(0, 10);
};

const areColorsEquivalent = (a: string, b: string) => {
  const normalizedA = normalizeColor(a);
  const normalizedB = normalizeColor(b);
  return normalizedA === normalizedB || normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
};

const inferGarmentType = (categoryHint: string, edgeDensity: number, aspectRatio: number, dominantColor: string, pattern: string) => {
  const lowerCategory = normalizeText(categoryHint);
  if (lowerCategory.includes('footwear') || lowerCategory.includes('shoe')) return 'Shoes';
  // explicit kurta/ethnic hints win
  if (lowerCategory.includes('kurta') || lowerCategory.includes('ethnic') || lowerCategory.includes('kurtas')) return 'Kurta';

  // bottoms
  if (lowerCategory.includes('bottom') || lowerCategory.includes('pant') || lowerCategory.includes('jean') || lowerCategory.includes('trouser')) {
    if (lowerCategory.includes('short')) return 'Shorts';
    if (aspectRatio > 1.4) return 'Skirt';
    return 'Jeans';
  }

  // heuristics: kurta tends to be topwear with visible texture/embroidery (moderate edge density)
  if (lowerCategory.includes('top') || lowerCategory.includes('top wear') || lowerCategory.includes('topwear')) {
    if (edgeDensity >= 0.11) return 'Kurta';
    if (pattern === 'Printed' && edgeDensity >= 0.09) return 'Kurta';
  }

  if (lowerCategory.includes('dress')) return 'Dress';
  if (lowerCategory.includes('skirt')) return 'Skirt';
  if (lowerCategory.includes('short')) return 'Shorts';
  if (lowerCategory.includes('hood')) return 'Hoodie';
  if (lowerCategory.includes('jacket') || lowerCategory.includes('coat') || lowerCategory.includes('sweater')) return 'Jacket';
  if (lowerCategory.includes('polo')) return 'Polo Shirt';
  if (lowerCategory.includes('t shirt') || lowerCategory.includes('tee') || lowerCategory.includes('tshirt')) return 'T-Shirt';

  if (edgeDensity > 0.22) return 'Jacket';
  if (edgeDensity > 0.18) return 'Shirt';
  if (edgeDensity > 0.13) return 'Polo Shirt';
  if (edgeDensity >= 0.08) return 'T-Shirt';

  if (aspectRatio > 1.2) return 'Dress';

  return 'Unknown Clothing';
};

const normalizeProduct = (id: string, data: Record<string, any>): ProductItem | null => {
  const colors = safeArray(data.colors).length > 0 ? safeArray(data.colors) : ['Standard'];
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
  const palette = [
    { name: 'Black', rgb: [25, 25, 30] },
    { name: 'White', rgb: [240, 240, 235] },
    { name: 'Grey', rgb: [128, 128, 128] },
    { name: 'Lavender', rgb: [190, 185, 255] },
    { name: 'Blue', rgb: [55, 105, 190] },
    { name: 'Navy', rgb: [25, 45, 95] },
    { name: 'Denim', rgb: [70, 105, 145] },
    { name: 'Beige', rgb: [205, 180, 135] },
    { name: 'Brown', rgb: [120, 75, 45] },
    { name: 'Olive', rgb: [105, 120, 65] },
    { name: 'Green', rgb: [65, 145, 90] },
    { name: 'Red', rgb: [180, 55, 55] },
    { name: 'Pink', rgb: [220, 130, 170] },
    { name: 'Yellow', rgb: [220, 190, 70] }
  ];

  return palette
    .map((entry) => ({
      ...entry,
      distance: Math.hypot(r - entry.rgb[0], g - entry.rgb[1], b - entry.rgb[2])
    }))
    .sort((a, b) => a.distance - b.distance)[0].name;
};

const extractFeaturesFromCanvas = (canvas: HTMLCanvasElement, categoryHint = 'Top Wear'): ClothingFeatureVector => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Array(12).fill(0);
  let rTotal = 0;
  let gTotal = 0;
  let bTotal = 0;
  let sampleCount = 0;
  let edgeHits = 0;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const hueBucket = Math.min(11, Math.floor(((max === min ? 0 : max === r ? (60 * ((g - b) / (max - min)) + 360) % 360 : max === g ? 60 * ((b - r) / (max - min)) + 120 : 60 * ((r - g) / (max - min)) + 240) / 360) * 12));
    histogram[hueBucket] += 1;
    rTotal += r;
    gTotal += g;
    bTotal += b;
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
  const avgR = Math.round(rTotal / Math.max(1, sampleCount));
  const avgG = Math.round(gTotal / Math.max(1, sampleCount));
  const avgB = Math.round(bTotal / Math.max(1, sampleCount));
  const dominantColor = colorNameFromRgb(avgR, avgG, avgB);
  const edgeDensity = Number((edgeHits / Math.max(1, (width / 6) * (height / 6))).toFixed(3));
  const aspectRatio = Number((width / Math.max(1, height)).toFixed(2));
  const pattern = edgeDensity > 0.18 ? 'Printed' : edgeDensity > 0.11 ? 'Textured' : 'Solid';
  const garmentType = inferGarmentType(categoryHint, edgeDensity, aspectRatio, dominantColor, pattern);
  const sleeveType = garmentType === 'Hoodie' || garmentType === 'Jacket' || garmentType === 'Sweatshirt' ? 'Full Sleeve' : garmentType === 'Shorts' || garmentType === 'Skirt' ? 'Short Sleeve' : 'Regular';
  const neckType = garmentType === 'Hoodie' ? 'Hooded' : garmentType === 'Polo Shirt' ? 'Collared' : garmentType === 'Shirt' ? 'Collared' : 'Round';
  const fabric = dominantColor === 'Denim' || garmentType === 'Jeans' ? 'Denim' : edgeDensity > 0.16 ? 'Textured Blend' : 'Cotton Blend';

  return {
    dominantColor,
    colorHex: `#${[avgR, avgG, avgB].map((value) => value.toString(16).padStart(2, '0')).join('')}`,
    category: categoryHint,
    garmentType,
    pattern,
    shape: aspectRatio > 1.1 ? 'wide' : aspectRatio < 0.65 ? 'long' : 'regular',
    sleeveType,
    neckType,
    hasHood: garmentType === 'Hoodie',
    fabric,
    tags: [dominantColor, pattern, garmentType, categoryHint, garmentType === 'Hoodie' ? 'hooded' : 'style'].map(normalizeText),
    histogram: normalizedHistogram,
    edgeDensity,
    aspectRatio
  };
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

  async detectClothing(imageUrl: string) {
    const image = await loadImage(imageUrl);
    const portrait = image.naturalHeight > image.naturalWidth * 1.12;
    const crops = portrait
      ? [
          { label: 'Top Wear', category: 'Top Wear', x: 0.14, y: 0.12, width: 0.72, height: 0.42 },
          { label: 'Bottom Wear', category: 'Bottom Wear', x: 0.18, y: 0.48, width: 0.64, height: 0.34 },
          { label: 'Footwear', category: 'Footwear', x: 0.18, y: 0.78, width: 0.64, height: 0.18 }
        ]
      : [
          { label: 'Top Wear', category: 'Top Wear', x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
          // extra tighter center crop helps when image is a close-up of the top
          { label: 'Top Wear (center)', category: 'Top Wear', x: 0.18, y: 0.12, width: 0.64, height: 0.7 }
        ];

    const items = await Promise.all(crops.map(async (crop, index) => {
      const canvas = await drawToCanvas(imageUrl, {
        x: Math.round(image.naturalWidth * crop.x),
        y: Math.round(image.naturalHeight * crop.y),
        width: Math.round(image.naturalWidth * crop.width),
        height: Math.round(image.naturalHeight * crop.height)
      });
      const features = extractFeaturesFromCanvas(canvas, crop.category);
      return {
        id: `detected-${index + 1}`,
        label: features.garmentType || crop.label,
        cropDataUrl: canvas.toDataURL('image/jpeg', 0.82),
        features
      };
    }));

    return items.filter((item) => item.cropDataUrl);
  }
}

const visionProvider: VisionProvider = new BrowserVisionProvider();

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

const categoryCandidates = (category: string, garmentType: string, userGender?: string) => {
  const values = [category, garmentType];
  const lower = normalizeText(`${category} ${garmentType}`);
  if (lower.includes('top') || lower.includes('hoodie') || lower.includes('t shirt') || lower.includes('polo') || lower.includes('shirt') || lower.includes('jacket') || lower.includes('kurta')) values.push('Streetwear', 'Outerwear', 'Casual wear', 'Top Wear', 'Ethnic Wear', 'Kurta', 'Kurtas');
  // also add kurta when garmentType explicitly indicates kurta
  if (normalizeText(garmentType).includes('kurta')) values.push('Kurta', 'Kurtas', "Men's Kurtas", "Women's Kurtas");
  if (lower.includes('bottom') || lower.includes('jeans') || lower.includes('pant') || lower.includes('trouser')) values.push('Casual', 'Bottom Wear', 'Jeans', 'Trousers');
  if (lower.includes('dress') || lower.includes('skirt') || lower.includes('shorts')) values.push('Dresses', 'Skirts', 'Shorts');
  if (lower.includes('kurta')) values.push('Kurta', 'Kurtas', "Men's Kurtas", "Women's Kurtas", 'Ethnic Wear');
  if (lower.includes('shoe') || lower.includes('foot')) values.push('Footwear', 'Shoes');
  if (userGender === 'Women') values.push('Women', 'Womenswear', "Women's", "Womens Clothing");
  if (userGender === 'Men') values.push('Men', 'Menswear', "Men's", "Mens Clothing");
  return values.filter((value, index, arr) => value && arr.indexOf(value) === index).slice(0, 10);
};

const fetchCandidates = async (features: ClothingFeatureVector, userGender?: string): Promise<ProductItem[]> => {
  await waitForFirebaseAuthReady();
  const cache = getStoredJson<Record<string, { at: number; products: ProductItem[] }>>(candidateCacheKey, {});
  const cacheKey = `${features.category}|${normalizeColor(features.dominantColor)}|${features.tags.slice(0, 4).join(',')}|${userGender || 'any'}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.at < 1000 * 60 * 8) return cached.products;

  const productsRef = collection(db, 'products');
  const colorQueries = getColorQueryValues(features.dominantColor);
  const tagsForQuery = [...features.tags.slice(0, 10), ...colorQueries.map(normalizeText)];
  if (userGender) tagsForQuery.push(normalizeText(userGender));

  const queries = [
    query(productsRef, where('category', 'in', categoryCandidates(features.category, features.garmentType, userGender)), limit(24)),
    query(productsRef, where('colors', 'array-contains-any', colorQueries), limit(24)),
    query(productsRef, where('tags', 'array-contains-any', tagsForQuery), limit(24))
  ];

  const snapshots = await Promise.allSettled(queries.map((candidateQuery) => getDocs(candidateQuery)));
  const productMap = new Map<string, ProductItem>();
  snapshots.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach((docSnap) => {
      const product = normalizeProduct(docSnap.id, docSnap.data());
      if (product) productMap.set(product.id, product);
    });
  });

  if (productMap.size === 0) {
    const fallbackSnapshot = await getDocs(query(productsRef, limit(40)));
    fallbackSnapshot.forEach((docSnap) => {
      const product = normalizeProduct(docSnap.id, docSnap.data());
      if (product) productMap.set(product.id, product);
    });
  }

  let products = Array.from(productMap.values());
  if (userGender) {
    const genderFiltered = products.filter((product) => {
      const actualGender = product.gender || inferProductGender(product);
      return !actualGender || actualGender === 'Unisex' || normalizeText(actualGender) === normalizeText(userGender);
    });
    if (genderFiltered.length > 0) products = genderFiltered;
  }

  // If our detected garment type is Kurta, prefer products that explicitly reference 'kurta' in category/name/tags
  try {
    if (normalizeText(features.garmentType) === 'kurta') {
      const kurtaFiltered = products.filter((p) => {
        const hay = normalizeText([p.category, p.name, ...(p.tags || [])].join(' '));
        return hay.includes('kurta') || hay.includes('kurtas') || hay.includes('ethnic');
      });
      if (kurtaFiltered.length > 0) products = kurtaFiltered;
    }
  } catch (e) {
    // ignore
  }

  // For male users, deprioritize or exclude products that are clearly dresses/kurti/saree
  try {
    if (normalizeText(userGender || '') === 'men') {
      const filtered = products.filter((p) => {
        const hay = normalizeText([p.category, p.name, ...(p.tags || [])].join(' '));
        if (hay.includes('dress') || hay.includes('kurti') || hay.includes('saree') || hay.includes('lehenga') || hay.includes('gown')) return false;
        return true;
      });
      if (filtered.length > 0) products = filtered;
    }
  } catch (e) {
    // ignore
  }

  products = products.slice(0, 40);
  cache[cacheKey] = { at: Date.now(), products };
  setStoredJson(candidateCacheKey, cache);
  return products;
};

const productFeatureFromMetadata = (product: ProductItem): ClothingFeatureVector => {
  const text = normalizeText([
    product.name,
    product.category,
    product.description,
    ...(product.details || []),
    ...(product.tags || [])
  ].join(' '));
  const color = product.colors?.[0] || 'Standard';
  const category = product.category || 'Uncategorized';
  let garmentType = category;
  if (text.includes('kurta') || text.includes('kurtas')) garmentType = 'Kurta';
  if (text.includes('shoe') || text.includes('sneaker')) garmentType = 'Shoes';
  else if (text.includes('jean') || text.includes('pant') || text.includes('trouser')) garmentType = 'Jeans';
  else if (text.includes('dress')) garmentType = 'Dress';
  else if (text.includes('skirt')) garmentType = 'Skirt';
  else if (text.includes('short')) garmentType = 'Shorts';
  else if (text.includes('hood')) garmentType = 'Hoodie';
  else if (text.includes('polo')) garmentType = 'Polo Shirt';
  else if (text.includes('t shirt') || text.includes('tee')) garmentType = 'T-Shirt';
  else if (text.includes('jacket')) garmentType = 'Jacket';
  else if (text.includes('blazer')) garmentType = 'Blazer';
  else if (text.includes('sweatshirt')) garmentType = 'Sweatshirt';
  else if (text.includes('shirt')) garmentType = 'Shirt';
  const pattern = product.pattern || (text.includes('print') || text.includes('graphic') ? 'Printed' : text.includes('stripe') ? 'Striped' : 'Solid');
  const genderTag = product.gender ? [product.gender] : [];

  return {
    dominantColor: color,
    colorHex: '#999999',
    category,
    garmentType,
    pattern,
    shape: text.includes('oversized') ? 'wide' : text.includes('slim') ? 'long' : 'regular',
    sleeveType: product.sleeveType || (text.includes('sleeve') ? 'Full Sleeve' : 'Regular'),
    neckType: product.neckType || (text.includes('hood') ? 'Hooded' : text.includes('v neck') ? 'V Neck' : 'Standard'),
    hasHood: text.includes('hood'),
    fabric: product.fabric || (text.includes('denim') ? 'Denim' : text.includes('cotton') ? 'Cotton Blend' : 'Blend'),
    tags: [category, garmentType, pattern, color, ...(product.tags || []), ...genderTag].map(normalizeText),
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

const getProductImageEmbedding = async (product: ProductItem) => {
  const cache = getStoredJson<Record<string, ClothingFeatureVector>>(productCacheKey, {});
  const cacheId = `${product.id}:${product.imageUrl}`;
  if (cache[cacheId]) return cache[cacheId];
  try {
    const canvas = await drawToCanvas(product.imageUrl);
    const features = extractFeaturesFromCanvas(canvas, product.category);
    cache[cacheId] = { ...productFeatureFromMetadata(product), ...features };
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
  const productFeatures = await getProductImageEmbedding(product);
  const color = Math.max(
    textScore(item.features.dominantColor, productFeatures.dominantColor),
    product.colors?.some((productColor) => areColorsEquivalent(productColor, item.features.dominantColor)) ? 1 : 0
  );
  const category = Math.max(textScore(item.features.category, product.category), textScore(item.features.garmentType, productFeatures.garmentType));
  const pattern = textScore(item.features.pattern, productFeatures.pattern);
  const shape = textScore(item.features.shape, productFeatures.shape);
  const sleeve = textScore(item.features.sleeveType, productFeatures.sleeveType);
  const neck = textScore(item.features.neckType, productFeatures.neckType);
  const hood = item.features.hasHood === productFeatures.hasHood ? 1 : 0;
  const fabric = textScore(item.features.fabric, productFeatures.fabric);
  const histogram = cosineSimilarity(item.features.histogram, productFeatures.histogram);
  const edge = Math.max(0, 1 - Math.abs(item.features.edgeDensity - productFeatures.edgeDensity));
  const whitePrintedBonus = areColorsEquivalent(item.features.dominantColor, 'white') && areColorsEquivalent(productFeatures.dominantColor, 'white') && (item.features.pattern === 'Printed' || productFeatures.pattern === 'Printed') ? 0.15 : 0;
  const inferredGender = product.gender || inferProductGender(product);
  const genderMatch = userGender && inferredGender
    ? (inferredGender === 'Unisex' || normalizeText(inferredGender) === normalizeText(userGender) ? 1 : -0.3)
    : 0;

  // heavy penalty for dress-category when scanning as Men and detected item isn't a dress
  const dressPenalty = (userGender && normalizeText(userGender) === 'men') && (normalizeText(product.category || '').includes('dress') || normalizeText(product.name || '').includes('dress')) ? -0.4 : 0;

  // boost when garment type matches strongly (e.g., detected Kurta -> product Kurta)
  const garmentMatch = (normalizeText(item.features.garmentType || '') === normalizeText(productFeatures.garmentType || '')) ? 1 : 0;
  const garmentCategoryMatch = normalizeText(product.category || '').includes(normalizeText(item.features.garmentType || '')) ? 1 : 0;
  const garmentBoost = Math.max(garmentMatch, garmentCategoryMatch) ? 0.10 : 0;

  return Math.round(100 * (
    color * 0.22 +
    category * 0.20 +
    pattern * 0.12 +
    genderMatch * 0.12 +
    dressPenalty +
    shape * 0.08 +
    sleeve * 0.07 +
    neck * 0.07 +
    hood * 0.05 +
    fabric * 0.05 +
    histogram * 0.04 +
    edge * 0.02 +
    whitePrintedBonus +
    garmentBoost
  ));
};

const reasonsForRecommendation = (item: DetectedClothingItem, product: ProductItem) => {
  const reasons = new Set<string>();
  if (product.colors?.some((color) => normalizeText(color).includes(normalizeText(item.features.dominantColor)))) reasons.add('Color');
  if (textScore(product.category, item.features.category) > 0 || textScore(product.category, item.features.garmentType) > 0) reasons.add('Category');
  if (textScore(product.pattern || '', item.features.pattern) > 0 || item.features.pattern === 'Solid') reasons.add('Pattern');
  if (textScore([product.name, product.description, ...(product.details || [])].join(' '), item.features.garmentType) > 0) reasons.add('Style');
  if (reasons.size === 0) ['Color', 'Style', 'Pattern', 'Category'].forEach((reason) => reasons.add(reason));
  return Array.from(reasons).slice(0, 4);
};

const findPairedProducts = (products: ProductItem[], selected: ProductItem) => (
  products
    .filter((product) => product.id !== selected.id)
    .slice(0, 5)
);

const matchItem = async (item: DetectedClothingItem, userGender?: string): Promise<ScanProductResult> => {
  const candidates = await fetchCandidates(item.features, userGender);
  if (candidates.length === 0) throw new Error('Unable to fetch products.');

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
    recommendationReasons: kind === 'recommendation' ? reasonsForRecommendation(item, best.product) : [],
    pairedWith: findPairedProducts(scored.map((entry) => entry.product), best.product)
  };
};

export const runCameraScan = async (file: File, source: ScanImageSource, onProgress?: ScanProgress, userGender?: string): Promise<CameraScanResult> => {
  onProgress?.('Scanning Outfit...');
  const compressedImageUrl = await visionProvider.compressImage(file);
  const items = await visionProvider.detectClothing(compressedImageUrl);
  if (items.length === 0) throw new Error("Couldn't detect clothing.");

  onProgress?.('Finding Similar Products...');
  const results = await Promise.all(items.map((item) => matchItem(item, userGender)));
  return {
    source,
    compressedImageUrl,
    items,
    results
  };
};
