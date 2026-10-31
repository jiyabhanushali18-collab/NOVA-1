import crypto from 'node:crypto';
import {
  analyzeGarmentImagePayload,
  DEFAULT_FALLBACK_MODELS,
  GEMINI_MODEL
} from './wardrobeAnalyzer';
import type { CanonicalGarmentData } from '../src/types/wardrobe';

export const AI_ATTRIBUTES_SCHEMA_VERSION = '1.0';
export const AI_ATTRIBUTES_ANALYZER = 'gemini-product-visual';

export type ProductAiAnalysisStatus = 'pending' | 'complete' | 'failed';
export type ProductAiAttributeSource = 'gemini' | 'hybrid';

export interface ProductAiAttributes {
  schemaVersion: string;
  status: ProductAiAnalysisStatus;
  source: ProductAiAttributeSource;
  model: string | null;
  analyzedAt: string | null;
  imageFingerprint: string | null;
  confidence: number | null;
  visual: {
    category: string | null;
    subcategory: string | null;
    gender: string | null;
    primaryColor: string | null;
    secondaryColors: string[];
    pattern: string | null;
    texture: string | null;
    visibleDetails: string[];
    fabric: string | null;
    sleeveType: string | null;
    neckType: string | null;
    fit: string | null;
    length: string | null;
    silhouette: string | null;
    styleTags: string[];
    occasionTags: string[];
    seasonTags: string[];
    formality: string | null;
  };
  error?: {
    code: string;
    message: string;
    at: string;
  };
}

export interface ProductImageCandidate {
  url: string;
  sourceField: string;
  role: 'primary' | 'additional' | 'variant';
}

export interface ProductBackfillRecord {
  productId: string;
  name: string | null;
  image: ProductImageCandidate | null;
  aiAttributes: ProductAiAttributes | null;
  needsAnalysis: boolean;
  reason: 'missing_ai_attributes' | 'failed_analysis' | 'image_changed' | 'already_current' | 'missing_image' | 'invalid_record';
}

export interface BackfillOptions {
  batchSize: number;
  concurrency: number;
  retryFailed: boolean;
  dryRun: boolean;
  now?: () => Date;
}

export interface BackfillSummary {
  discovered: number;
  alreadyAnalysed: number;
  requiringAnalysis: number;
  missingUsableImages: number;
  successful: number;
  failed: number;
  estimatedGeminiRequests: number;
  skippedUnchangedImages: number;
}

const isPresent = (value: unknown) =>
  value !== null &&
  value !== undefined &&
  !(typeof value === 'string' && value.trim() === '') &&
  !(Array.isArray(value) && value.length === 0);

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(asStringArray);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const getImageUrl = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return getImageUrl(record.imageUrl || record.url || record.src || record.image || record.mainImage);
};

export const findProductImage = (raw: Record<string, unknown>): ProductImageCandidate | null => {
  const primaryFields = ['imageUrl', 'mainImage', 'imageurl', 'imageurl1', 'image'];
  for (const sourceField of primaryFields) {
    const url = getImageUrl(raw[sourceField]);
    if (url) return { url, sourceField, role: 'primary' };
  }
  if (Array.isArray(raw.images)) {
    const url = raw.images.map(getImageUrl).find(Boolean) as string | undefined;
    if (url) return { url, sourceField: 'images[0]', role: 'primary' };
  }
  if (Array.isArray(raw.imageUrls)) {
    const url = raw.imageUrls.map(getImageUrl).find(Boolean) as string | undefined;
    if (url) return { url, sourceField: 'imageUrls[0]', role: 'primary' };
  }
  return null;
};

export const fingerprintImage = (image: ProductImageCandidate): string =>
  crypto.createHash('sha256').update(image.url).digest('hex');

const existingAttributes = (raw: Record<string, unknown>): ProductAiAttributes | null => {
  const value = raw.aiAttributes;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const attributes = value as Partial<ProductAiAttributes>;
  if (
    attributes.schemaVersion !== AI_ATTRIBUTES_SCHEMA_VERSION ||
    !attributes.status ||
    !attributes.visual
  ) return null;
  return value as ProductAiAttributes;
};

export const planProductBackfill = (productId: string, raw: Record<string, unknown>): ProductBackfillRecord => {
  const image = findProductImage(raw);
  const existing = existingAttributes(raw);
  if (!asString(raw.name) && !asString(raw.Name)) {
    return { productId, name: null, image, aiAttributes: existing, needsAnalysis: false, reason: 'invalid_record' };
  }
  if (!image) {
    return { productId, name: asString(raw.name || raw.Name), image: null, aiAttributes: existing, needsAnalysis: false, reason: 'missing_image' };
  }
  const currentFingerprint = fingerprintImage(image);
  if (existing?.status === 'complete' && existing.imageFingerprint === currentFingerprint) {
    return { productId, name: asString(raw.name || raw.Name), image, aiAttributes: existing, needsAnalysis: false, reason: 'already_current' };
  }
  if (existing?.status === 'failed') {
    return { productId, name: asString(raw.name || raw.Name), image, aiAttributes: existing, needsAnalysis: true, reason: 'failed_analysis' };
  }
  return {
    productId,
    name: asString(raw.name || raw.Name),
    image,
    aiAttributes: existing,
    needsAnalysis: true,
    reason: existing ? 'image_changed' : 'missing_ai_attributes'
  };
};

const toDataUrl = async (url: string, fetchFn: typeof fetch): Promise<string> => {
  if (url.startsWith('data:image/')) return url;
  const response = await fetchFn(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Image fetch failed with HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  if (!/^image\/(jpeg|png|webp|jpg)$/i.test(contentType)) {
    throw new Error(`Unsupported image content type: ${contentType}.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType === 'image/jpg' ? 'image/jpeg' : contentType};base64,${buffer.toString('base64')}`;
};

const toAiAttributes = (
  garment: CanonicalGarmentData,
  model: string | null,
  imageFingerprint: string,
  analyzedAt: string
): ProductAiAttributes => ({
  schemaVersion: AI_ATTRIBUTES_SCHEMA_VERSION,
  status: 'complete',
  source: 'gemini',
  model,
  analyzedAt,
  imageFingerprint,
  confidence: garment.aiMetadata.confidenceScore ?? null,
  visual: {
    category: garment.category || null,
    subcategory: garment.subcategory || null,
    gender: garment.gender || null,
    primaryColor: garment.visual.primaryColor || null,
    secondaryColors: garment.visual.secondaryColor ? [garment.visual.secondaryColor] : [],
    pattern: garment.visual.pattern || null,
    texture: garment.visual.texture || null,
    visibleDetails: garment.visual.visibleDetails || [],
    fabric: garment.material.fabric || null,
    sleeveType: garment.construction.sleeveType || null,
    neckType: garment.construction.neckType || null,
    fit: garment.construction.fit || null,
    length: garment.construction.length || null,
    silhouette: garment.construction.silhouette || null,
    styleTags: [garment.style.primary, ...garment.style.secondary, ...garment.style.tags].filter(Boolean),
    occasionTags: garment.usage.occasions || [],
    seasonTags: garment.usage.seasons || [],
    formality: garment.usage.formality || null
  }
});

export const analyseProductImage = async (
  product: ProductBackfillRecord,
  options: { fetchFn?: typeof fetch; apiKey?: string; now?: () => Date }
): Promise<ProductAiAttributes> => {
  if (!product.image) throw new Error('No usable product image.');
  const imageFingerprint = fingerprintImage(product.image);
  const imageDataUrl = await toDataUrl(product.image.url, options.fetchFn || fetch);
  const result = await analyzeGarmentImagePayload(
    imageDataUrl,
    product.name || undefined,
    options.apiKey,
    options.fetchFn || fetch
  );
  if (!result.success || !result.garment) {
    throw new Error(result.error || 'Gemini product analysis failed.');
  }
  return toAiAttributes(
    result.garment,
    result.modelUsed || GEMINI_MODEL,
    imageFingerprint,
    (options.now || (() => new Date()))().toISOString()
  );
};

export const createFailedAiAttributes = (
  imageFingerprint: string,
  error: string,
  analyzedAt = new Date().toISOString()
): ProductAiAttributes => ({
  schemaVersion: AI_ATTRIBUTES_SCHEMA_VERSION,
  status: 'failed',
  source: 'gemini',
  model: null,
  analyzedAt: null,
  imageFingerprint,
  confidence: null,
  visual: {
    category: null,
    subcategory: null,
    gender: null,
    primaryColor: null,
    secondaryColors: [],
    pattern: null,
    texture: null,
    visibleDetails: [],
    fabric: null,
    sleeveType: null,
    neckType: null,
    fit: null,
    length: null,
    silhouette: null,
    styleTags: [],
    occasionTags: [],
    seasonTags: [],
    formality: null
  },
  error: {
    code: 'ANALYSIS_FAILED',
    message: error.slice(0, 500),
    at: analyzedAt
  }
});

export const getBackfillSummary = (records: ProductBackfillRecord[]): BackfillSummary => ({
  discovered: records.length,
  alreadyAnalysed: records.filter((record) => record.reason === 'already_current').length,
  requiringAnalysis: records.filter((record) => record.needsAnalysis).length,
  missingUsableImages: records.filter((record) => record.reason === 'missing_image' || (record.reason === 'invalid_record' && !record.image)).length,
  successful: 0,
  failed: 0,
  estimatedGeminiRequests: records.filter((record) => record.needsAnalysis).length,
  skippedUnchangedImages: records.filter((record) => record.reason === 'already_current').length
});

export const backfillConfiguration = {
  primaryModel: GEMINI_MODEL,
  fallbackModels: DEFAULT_FALLBACK_MODELS,
  defaultBatchSize: 5,
  defaultConcurrency: 2,
  minimumInterRequestDelayMs: 350
};
