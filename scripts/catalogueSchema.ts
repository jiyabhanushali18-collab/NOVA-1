export const CATALOGUE_SCHEMA_VERSION = '1.0';

export type AnalysisStatus = 'pending' | 'complete' | 'needs_review' | 'failed';
export type AttributeSource = 'vendor' | 'gemini' | 'inferred' | 'unknown';

export interface CanonicalImage {
  url: string;
  role: 'primary' | 'additional' | 'variant';
  sourceField: string;
  reachable?: boolean;
  contentType?: string;
}

export interface CanonicalVariant {
  id?: string;
  color: string;
  sizes: string[];
  stock?: number;
  sku?: string;
  images: CanonicalImage[];
  raw: unknown;
}

export interface ConfidenceValue<T> {
  value: T | null;
  confidence: number | null;
  source: AttributeSource;
}

export interface CanonicalAiMetadata {
  schemaVersion: string;
  analysisStatus: AnalysisStatus;
  source: AttributeSource;
  confidence: number | null;
  analyzedAt: string | null;
  modelVersion: string | null;
  normalized: {
    category: ConfidenceValue<string>;
    subcategory: ConfidenceValue<string>;
    gender: ConfidenceValue<string>;
    primaryColor: ConfidenceValue<string>;
    secondaryColors: ConfidenceValue<string[]>;
    pattern: ConfidenceValue<string>;
    texture: ConfidenceValue<string>;
    silhouette: ConfidenceValue<string>;
    styleTags: ConfidenceValue<string[]>;
    occasionTags: ConfidenceValue<string[]>;
    seasonTags: ConfidenceValue<string[]>;
    formality: ConfidenceValue<string>;
  };
}

export interface CanonicalProduct {
  productId: string;
  name: string | null;
  description: string | null;
  brand: string | null;
  vendorId: string | null;
  sku: string | null;
  category: string | null;
  subcategory: string | null;
  gender: string | null;
  primaryColor: string | null;
  secondaryColors: string[];
  pattern: string | null;
  texture: string | null;
  silhouette: string | null;
  visibleDetails: string[];
  fabric: string | null;
  fit: string | null;
  sleeveType: string | null;
  neckType: string | null;
  length: string | null;
  styleTags: string[];
  occasionTags: string[];
  seasonTags: string[];
  formality: string | null;
  price: number | null;
  originalPrice: number | null;
  discountedPrice: number | null;
  sizes: string[];
  variants: CanonicalVariant[];
  stock: number | null;
  inStock: boolean | null;
  imageUrl: string | null;
  images: CanonicalImage[];
  imageMetadata: {
    primaryPresent: boolean;
    additionalCount: number;
    variantCount: number;
    duplicateUrls: string[];
  };
  aiMetadata: CanonicalAiMetadata;
}

export interface FieldConflict {
  canonicalField: string;
  sourceFields: string[];
  values: unknown[];
  reason: string;
}

export interface ImageAudit {
  sourceField: string;
  url: string;
  role: CanonicalImage['role'];
  status: 'pending' | 'reachable' | 'unreachable' | 'inline' | 'invalid';
  httpStatus?: number;
  contentType?: string;
  reason?: string;
}

export interface ProductMigrationRecord {
  productId: string;
  raw: Record<string, unknown>;
  canonical: CanonicalProduct;
  missingFields: string[];
  conflicts: FieldConflict[];
  imageAudit: ImageAudit[];
  flags: string[];
}

export const REQUIRED_REVIEW_FIELDS = [
  'name',
  'category',
  'subcategory',
  'gender',
  'primaryColor',
  'fabric',
  'pattern',
  'styleTags',
  'occasionTags',
  'sizes',
  'imageUrl'
] as const;

