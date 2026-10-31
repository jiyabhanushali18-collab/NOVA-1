import {
  CATALOGUE_SCHEMA_VERSION,
  CanonicalImage,
  CanonicalProduct,
  CanonicalVariant,
  FieldConflict,
  ImageAudit,
  ProductMigrationRecord,
  REQUIRED_REVIEW_FIELDS
} from './catalogueSchema.js';

type RawProduct = Record<string, unknown>;

const aliases: Record<string, string[]> = {
  name: ['name', 'Name', 'productName', 'namde'],
  category: ['category', 'Category'],
  colors: ['colors', 'Colors', 'Collors', 'color'],
  sizes: ['sizes', 'Sizes', 'size'],
  originalPrice: ['originalPrice', 'Original Price', 'OriginalPrice', 'originalprice'],
  discountedPrice: ['discountedPrice', 'discountPrice'],
  imageUrl: ['imageUrl', 'mainImage', 'imageurl', 'imageurl1', 'image', 'img1'],
  description: ['description', 'details'],
  vendorId: ['vendorId', 'vendorId '],
  stock: ['stock', 'stockQuantity'],
  styleTags: ['styleTags', 'style', 'tags'],
  occasionTags: ['occasionTags', 'occasion'],
  seasonTags: ['seasonTags', 'season']
};

const firstValue = (raw: RawProduct, fields: string[]) =>
  fields.map((field) => raw[field]).find((value) => isPresent(value));

const valuesFor = (raw: RawProduct, fields: string[]) =>
  fields.filter((field) => isPresent(raw[field])).map((field) => ({ field, value: raw[field] }));

const isPresent = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === 'string' && value.trim() === '') &&
  !(Array.isArray(value) && value.length === 0);

const asString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

export const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap((item) => asStringArray(item));
  if (typeof value === 'string' && value.trim()) {
    if (value.trim().startsWith('data:image/')) return [value.trim()];
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  const stringValue = asString(value);
  return stringValue ? [stringValue] : [];
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[₹,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) return value.trim().toLowerCase() === 'true';
  return null;
};

const normalizeColor = (value: string) => {
  const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  const aliasesByValue: Record<string, string> = {
    white: 'White',
    'off white': 'Off White',
    navyblue: 'Navy Blue',
    navy: 'Navy Blue',
    grey: 'Grey',
    gray: 'Grey',
    lavender: 'Lavender',
    lavander: 'Lavender',
    creme: 'Cream',
    default: 'Unknown'
  };
  return aliasesByValue[key] || value.trim();
};

const colorArray = (raw: RawProduct) =>
  [...new Set(valuesFor(raw, aliases.colors).flatMap(({ value }) => asStringArray(value)).map(normalizeColor))]
    .filter((color) => color !== 'Unknown');

const imageIdentity = (url: string) => {
  if (!url.startsWith('data:')) return url;
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `data-image:${url.slice(0, url.indexOf(',') + 1)}${url.length}:${(hash >>> 0).toString(16)}`;
};

const collectImages = (raw: RawProduct, variants: CanonicalVariant[]): CanonicalImage[] => {
  const images: CanonicalImage[] = [];
  const add = (value: unknown, sourceField: string, role: CanonicalImage['role']) => {
    for (const url of asStringArray(value)) {
      if (!images.some((image) => image.url === url && image.role === role)) {
        images.push({ url, role, sourceField });
      }
    }
  };

  for (const field of ['imageUrl', 'mainImage', 'imageurl', 'imageurl1', 'image', 'img1']) {
    add(raw[field], field, images.length === 0 ? 'primary' : 'additional');
  }
  for (const field of ['images', 'imageUrls', 'imageUrl2', 'imageurl2', 'image2']) {
    add(raw[field], field, 'additional');
  }
  for (const field of Object.keys(raw).filter((field) => /image/i.test(field) && !images.some((image) => image.sourceField === field))) {
    add(raw[field], field, 'additional');
  }
  variants.forEach((variant) => variant.images.forEach((image) => add(image.url, image.sourceField, 'variant')));
  return images;
};

const variantsFrom = (raw: RawProduct): CanonicalVariant[] => {
  if (!Array.isArray(raw.variants)) return [];
  return raw.variants.map((variant) => {
    const value = (variant && typeof variant === 'object' ? variant : {}) as RawProduct;
    const images = asStringArray(value.images).map((url) => ({
      url,
      role: 'variant' as const,
      sourceField: 'variants[].images'
    }));
    return {
      id: asString(value.id),
      color: asString(value.color || value.colorName) || 'Unknown',
      sizes: asStringArray(value.sizes),
      stock: asNumber(value.stock),
      sku: asString(value.sku),
      images,
      raw: variant
    };
  });
};

const conflictFor = (raw: RawProduct, canonicalField: string, fields: string[], conflicts: FieldConflict[]) => {
  const values = valuesFor(raw, fields);
  const distinct = new Set(values.map(({ value }) => JSON.stringify(value)));
  if (distinct.size > 1) {
    conflicts.push({
      canonicalField,
      sourceFields: values.map(({ field }) => field),
      values: values.map(({ value }) => value),
      reason: 'Multiple populated source fields contain different values.'
    });
  }
};

const imageAuditFor = (images: CanonicalImage[]): ImageAudit[] => images.map((image) => {
  if (image.url.startsWith('data:image/')) {
    return { ...image, status: 'inline' };
  }
  try {
    const parsed = new URL(image.url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ...image, status: 'invalid', reason: 'Unsupported URL protocol.' };
    }
    return { ...image, status: 'pending' };
  } catch {
    return { ...image, status: 'invalid', reason: 'Not a valid URL or data image.' };
  }
});

export const normalizeProduct = (productId: string, raw: RawProduct): ProductMigrationRecord => {
  const conflicts: FieldConflict[] = [];
  for (const [canonicalField, fields] of Object.entries(aliases)) {
    conflictFor(raw, canonicalField, fields, conflicts);
  }

  const variants = variantsFrom(raw);
  const images = collectImages(raw, variants);
  const secondaryColors = colorArray(raw).slice(1);
  const canonical: CanonicalProduct = {
    productId,
    name: asString(firstValue(raw, aliases.name)),
    description: asString(firstValue(raw, aliases.description)),
    brand: asString(raw.brand),
    vendorId: asString(firstValue(raw, aliases.vendorId)),
    sku: asString(raw.sku),
    category: asString(firstValue(raw, aliases.category)),
    subcategory: asString(raw.subcategory),
    gender: asString(raw.gender),
    primaryColor: colorArray(raw)[0] || null,
    secondaryColors,
    pattern: asString(raw.pattern),
    texture: asString(raw.texture),
    silhouette: asString(raw.silhouette),
    visibleDetails: asStringArray(raw.visibleDetails),
    fabric: asString(raw.fabric),
    fit: asString(raw.fit),
    sleeveType: asString(raw.sleeveType),
    neckType: asString(raw.neckType),
    length: asString(raw.length),
    styleTags: asStringArray(firstValue(raw, aliases.styleTags)),
    occasionTags: asStringArray(firstValue(raw, aliases.occasionTags)),
    seasonTags: asStringArray(firstValue(raw, aliases.seasonTags)),
    formality: asString(raw.formality),
    price: asNumber(raw.price ?? raw.Price),
    originalPrice: asNumber(firstValue(raw, aliases.originalPrice)),
    discountedPrice: asNumber(firstValue(raw, aliases.discountedPrice)),
    sizes: asStringArray(firstValue(raw, aliases.sizes)),
    variants,
    stock: asNumber(firstValue(raw, aliases.stock)),
    inStock: asBoolean(raw.inStock) ?? (asNumber(firstValue(raw, aliases.stock)) !== null
      ? asNumber(firstValue(raw, aliases.stock))! > 0
      : null),
    imageUrl: images.find((image) => image.role === 'primary')?.url || null,
    images,
    imageMetadata: {
      primaryPresent: images.some((image) => image.role === 'primary'),
      additionalCount: images.filter((image) => image.role === 'additional').length,
      variantCount: images.filter((image) => image.role === 'variant').length,
      duplicateUrls: [...new Set(images.map((image) => imageIdentity(image.url)))]
        .filter((identity) => images.filter((image) => imageIdentity(image.url) === identity).length > 1)
    },
    aiMetadata: {
      schemaVersion: CATALOGUE_SCHEMA_VERSION,
      analysisStatus: 'pending',
      source: 'unknown',
      confidence: null,
      analyzedAt: null,
      modelVersion: null,
      normalized: Object.fromEntries([
        ['category', canonicalValue(asString(firstValue(raw, aliases.category)))],
        ['subcategory', canonicalValue(asString(raw.subcategory))],
        ['gender', canonicalValue(asString(raw.gender))],
        ['primaryColor', canonicalValue(colorArray(raw)[0] || null)],
        ['secondaryColors', canonicalValue(secondaryColors)],
        ['pattern', canonicalValue(asString(raw.pattern))],
        ['texture', canonicalValue(asString(raw.texture))],
        ['silhouette', canonicalValue(asString(raw.silhouette))],
        ['styleTags', canonicalValue(asStringArray(firstValue(raw, aliases.styleTags)))],
        ['occasionTags', canonicalValue(asStringArray(firstValue(raw, aliases.occasionTags)))],
        ['seasonTags', canonicalValue(asStringArray(firstValue(raw, aliases.seasonTags)))],
        ['formality', canonicalValue(asString(raw.formality))]
      ]) as CanonicalProduct['aiMetadata']['normalized']
    }
  };

  const missingFields = REQUIRED_REVIEW_FIELDS.filter((field) => {
    const value = canonical[field];
    return !isPresent(value);
  });
  const flags = [...new Set([
    ...(canonical.name === null || canonical.price === null ? ['invalid_catalogue_record'] : []),
    ...(canonical.imageUrl === null ? ['missing_primary_image'] : []),
    ...(canonical.imageMetadata.duplicateUrls.length > 0 ? ['duplicate_images'] : []),
    ...(conflicts.length > 0 ? ['source_field_conflict'] : []),
    ...(missingFields.includes('subcategory') || missingFields.includes('styleTags') ? ['requires_gemini_enrichment'] : [])
  ])];

  return {
    productId,
    raw,
    canonical,
    missingFields,
    conflicts,
    imageAudit: imageAuditFor(images),
    flags
  };
};

const canonicalValue = <T>(value: T | null): { value: T | null; confidence: number | null; source: 'vendor' | 'unknown' } => ({
  value,
  confidence: value === null ? null : 1,
  source: value === null ? 'unknown' : 'vendor'
});

export const markImageAudit = (record: ProductMigrationRecord, results: Map<string, ImageAudit>) => {
  record.imageAudit = record.imageAudit.map((image) => results.get(`${record.productId}:${image.sourceField}:${image.url}`) || image);
  return record;
};
