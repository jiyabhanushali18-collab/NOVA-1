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
    tags: safeArray(data.tags),
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
  const lowerCategory = normalizeText(categoryHint);
  const garmentType = lowerCategory.includes('foot') || lowerCategory.includes('shoe') ? 'Shoes' : lowerCategory.includes('bottom') ? 'Jeans' : 'Hoodie';

  return {
    dominantColor,
    colorHex: `#${[avgR, avgG, avgB].map((value) => value.toString(16).padStart(2, '0')).join('')}`,
    category: categoryHint,
    garmentType,
    pattern,
    shape: aspectRatio > 1.1 ? 'wide' : aspectRatio < 0.65 ? 'long' : 'regular',
    sleeveType: garmentType === 'Hoodie' ? 'Full Sleeve' : 'Regular',
    neckType: garmentType === 'Hoodie' ? 'Hooded' : 'Standard',
    hasHood: garmentType === 'Hoodie',
    fabric: dominantColor === 'Denim' || garmentType === 'Jeans' ? 'Denim' : edgeDensity > 0.16 ? 'Textured Blend' : 'Cotton Blend',
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
          { label: 'Hoodie', category: 'Top Wear', x: 0.14, y: 0.12, width: 0.72, height: 0.42 },
          { label: 'Jeans', category: 'Bottom Wear', x: 0.18, y: 0.48, width: 0.64, height: 0.34 },
          { label: 'Shoes', category: 'Footwear', x: 0.18, y: 0.78, width: 0.64, height: 0.18 }
        ]
      : [{ label: 'Hoodie', category: 'Top Wear', x: 0.08, y: 0.08, width: 0.84, height: 0.84 }];

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

const categoryCandidates = (category: string, garmentType: string) => {
  const values = [category, garmentType];
  const lower = normalizeText(`${category} ${garmentType}`);
  if (lower.includes('top') || lower.includes('hoodie')) values.push('Streetwear', 'Outerwear', 'Casual wear');
  if (lower.includes('bottom') || lower.includes('jeans')) values.push('Casual', 'Bottom Wear');
  if (lower.includes('shoe') || lower.includes('foot')) values.push('Footwear', 'Shoes');
  return values.filter((value, index, arr) => value && arr.indexOf(value) === index).slice(0, 10);
};

const fetchCandidates = async (features: ClothingFeatureVector): Promise<ProductItem[]> => {
  await waitForFirebaseAuthReady();
  const cache = getStoredJson<Record<string, { at: number; products: ProductItem[] }>>(candidateCacheKey, {});
  const cacheKey = `${features.category}|${features.dominantColor}|${features.tags.slice(0, 4).join(',')}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.at < 1000 * 60 * 8) return cached.products;

  const productsRef = collection(db, 'products');
  const queries = [
    query(productsRef, where('category', 'in', categoryCandidates(features.category, features.garmentType)), limit(24)),
    query(productsRef, where('colors', 'array-contains-any', [features.dominantColor, features.dominantColor.toLowerCase()].slice(0, 10)), limit(24)),
    query(productsRef, where('tags', 'array-contains-any', features.tags.slice(0, 10)), limit(24))
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

  const products = Array.from(productMap.values()).slice(0, 40);
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
  const garmentType = text.includes('shoe') || text.includes('sneaker') ? 'Shoes' : text.includes('jean') || text.includes('pant') ? 'Jeans' : text.includes('hood') ? 'Hoodie' : category;
  const pattern = product.pattern || (text.includes('print') || text.includes('graphic') ? 'Printed' : text.includes('stripe') ? 'Striped' : 'Solid');

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
    tags: [category, garmentType, pattern, color, ...(product.tags || [])].map(normalizeText),
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

const scoreProduct = async (item: DetectedClothingItem, product: ProductItem) => {
  const productFeatures = await getProductImageEmbedding(product);
  const color = Math.max(
    textScore(item.features.dominantColor, productFeatures.dominantColor),
    product.colors?.some((productColor) => normalizeText(productColor).includes(normalizeText(item.features.dominantColor)) || normalizeText(item.features.dominantColor).includes(normalizeText(productColor))) ? 1 : 0
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

  return Math.round(100 * (
    color * 0.24 +
    category * 0.22 +
    pattern * 0.12 +
    shape * 0.08 +
    sleeve * 0.08 +
    neck * 0.08 +
    hood * 0.06 +
    fabric * 0.06 +
    histogram * 0.04 +
    edge * 0.02
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

const matchItem = async (item: DetectedClothingItem): Promise<ScanProductResult> => {
  const candidates = await fetchCandidates(item.features);
  if (candidates.length === 0) throw new Error('Unable to fetch products.');

  const scored = await Promise.all(candidates.map(async (product) => ({
    product,
    score: await scoreProduct(item, product)
  })));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
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

export const runCameraScan = async (file: File, source: ScanImageSource, onProgress?: ScanProgress): Promise<CameraScanResult> => {
  onProgress?.('Scanning Outfit...');
  const compressedImageUrl = await visionProvider.compressImage(file);
  const items = await visionProvider.detectClothing(compressedImageUrl);
  if (items.length === 0) throw new Error("Couldn't detect clothing.");

  onProgress?.('Finding Similar Products...');
  const results = await Promise.all(items.map((item) => matchItem(item)));
  return {
    source,
    compressedImageUrl,
    items,
    results
  };
};
