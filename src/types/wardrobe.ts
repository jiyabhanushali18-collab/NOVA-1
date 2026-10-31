/**
 * NOVA Virtual Wardrobe - Canonical Garment Data Schema & Taxonomy
 * Version: 1.0
 *
 * This canonical schema represents the single source of truth for garment
 * intelligence in NOVA. It is produced by Gemini vision analysis, validated
 * at runtime, and consumed by NOVA AI modules (outfit generation, garment
 * matching, color coordination, occasion recommendations, etc.).
 */

export type GarmentGender = 'men' | 'women' | 'unisex';

export interface CanonicalVisualDetails {
  primaryColor: string;
  secondaryColor: string | null;
  colorFamily: string[];
  pattern: string;
  texture: string | null;
  visibleDetails: string[];
}

export interface CanonicalConstruction {
  sleeveType: string;
  neckType: string;
  fit: string;
  length: string;
  silhouette: string;
  rise: string | null;
}

export interface CanonicalMaterial {
  fabric: string;
  fabricConfidence: 'low' | 'medium' | 'high' | 'inferred';
  composition: string | null;
}

export interface CanonicalStyle {
  primary: string;
  secondary: string[];
  tags: string[];
}

export interface CanonicalUsage {
  occasions: string[];
  seasons: string[];
  formality: string;
}

export interface CanonicalMatching {
  compatibleCategories: string[];
  compatibleStyles: string[];
  colorCompatibility: string[];
}

export interface CanonicalAiMetadata {
  description: string;
  searchTags: string[];
  unknownFields: string[];
  extractionSource: 'gemini' | 'manual' | 'hybrid';
  schemaVersion: '1.0';
  confidenceScore?: number;
}

export interface CanonicalGarmentData {
  schemaVersion: '1.0';
  id?: string;
  category: string;
  subcategory: string;
  gender: GarmentGender;
  visual: CanonicalVisualDetails;
  construction: CanonicalConstruction;
  material: CanonicalMaterial;
  style: CanonicalStyle;
  usage: CanonicalUsage;
  matching: CanonicalMatching;
  aiMetadata: CanonicalAiMetadata;
}

// -------------------------------------------------------------
// Controlled Taxonomies (Aligns with cameraScanService & NOVA data)
// -------------------------------------------------------------

export const CANONICAL_CATEGORIES = [
  'top',
  'bottom',
  'one_piece',
  'outerwear',
  'footwear',
  'accessory'
] as const;
export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

export const CANONICAL_SUBCATEGORIES = [
  'top',
  'blouse',
  'wrap_top',
  'tshirt',
  'shirt',
  'polo',
  'hoodie',
  'sweatshirt',
  'jacket',
  'blazer',
  'kurti',
  'kurta',
  'crop_top',
  'jeans',
  'trousers',
  'shorts',
  'cargo_pants',
  'joggers',
  'leggings',
  'palazzo',
  'skirt',
  'dress',
  'jumpsuit',
  'saree',
  'co_ord_set',
  'ethnic_wear',
  'other'
] as const;
export type CanonicalSubcategory = typeof CANONICAL_SUBCATEGORIES[number];

export const CANONICAL_COLORS = [
  'Black',
  'White',
  'Grey',
  'Charcoal',
  'Silver',
  'Off White',
  'Cream',
  'Beige',
  'Tan',
  'Brown',
  'Navy Blue',
  'Royal Blue',
  'Sky Blue',
  'Baby Blue',
  'Denim Blue',
  'Olive Green',
  'Forest Green',
  'Mint Green',
  'Maroon',
  'Wine',
  'Red',
  'Coral',
  'Peach',
  'Pink',
  'Lavender',
  'Lilac',
  'Purple',
  'Mustard',
  'Yellow',
  'Orange',
  'Multicolor'
] as const;

export const CANONICAL_COLOR_FAMILIES = [
  'neutral',
  'warm',
  'cool',
  'earth_tone',
  'pastel',
  'vibrant',
  'metallic'
] as const;

export const CANONICAL_PATTERNS = [
  'Solid',
  'Striped',
  'Plaid',
  'Checked',
  'Floral',
  'Graphic',
  'Printed',
  'Polka Dot',
  'Camouflage',
  'Tie-Dye',
  'Geometric',
  'Abstract',
  'Embroidered',
  'Color Blocked',
  'Textured',
  'Other'
] as const;

export const CANONICAL_FABRICS = [
  'Cotton',
  'Linen',
  'Denim',
  'Wool',
  'Silk',
  'Satin',
  'Polyester',
  'Nylon',
  'Leather',
  'Fleece',
  'Knit',
  'Velvet',
  'Chiffon',
  'Corduroy',
  'Rayon',
  'Viscose',
  'Spandex',
  'Cotton Blend',
  'Synthetic Blend',
  'Unknown'
] as const;

export const CANONICAL_SLEEVE_TYPES = [
  'Sleeveless',
  'Short Sleeve',
  'Half Sleeve',
  'Three Quarter',
  'Long Sleeve',
  'Cap Sleeve',
  'Not Applicable'
] as const;

export const CANONICAL_NECK_TYPES = [
  'Round Neck',
  'Crew Neck',
  'V-Neck',
  'Collar',
  'Polo Collar',
  'Hooded',
  'Turtleneck',
  'Mock Neck',
  'Square Neck',
  'Sweetheart',
  'Boat Neck',
  'Off Shoulder',
  'Scoop Neck',
  'Henley',
  'Not Applicable'
] as const;

export const CANONICAL_FITS = [
  'Slim',
  'Fitted',
  'Regular',
  'Relaxed',
  'Oversized',
  'Loose',
  'Tight',
  'Tailored',
  'Unknown'
] as const;

export const CANONICAL_STYLES = [
  'Casual',
  'Formal',
  'Smart Casual',
  'Streetwear',
  'Ethnic',
  'Athletic',
  'Party',
  'Bohemian',
  'Minimalist',
  'Vintage',
  'Preppy',
  'Lounge'
] as const;

export const CANONICAL_OCCASIONS = [
  'Casual',
  'Work / Office',
  'College',
  'Party',
  'Formal',
  'Festive',
  'Sports / Gym',
  'Travel',
  'Lounge',
  'Date Night'
] as const;

export const CANONICAL_SEASONS = [
  'Summer',
  'Winter',
  'Monsoon',
  'Spring',
  'Autumn',
  'All Season'
] as const;

export const CANONICAL_FORMALITIES = [
  'Casual',
  'Smart Casual',
  'Business Casual',
  'Formal'
] as const;

// -------------------------------------------------------------
// Bidirectional mapping between NOVA UI Category & Canonical
// -------------------------------------------------------------

export const SUBCATEGORY_TO_DISPLAY_MAP: Record<string, string> = {
  top: 'Top',
  blouse: 'Blouse',
  wrap_top: 'Top',
  tshirt: 'T-Shirt',
  shirt: 'Shirt',
  polo: 'Polo',
  hoodie: 'Hoodie',
  sweatshirt: 'Sweatshirt',
  jacket: 'Jacket',
  blazer: 'Blazer',
  kurti: 'Kurti',
  kurta: 'Kurta',
  crop_top: 'Crop Top',
  jeans: 'Jeans',
  trousers: 'Trousers',
  shorts: 'Shorts',
  cargo_pants: 'Cargo Pants',
  joggers: 'Joggers',
  leggings: 'Leggings',
  palazzo: 'Palazzo',
  skirt: 'Skirt',
  dress: 'Dress',
  jumpsuit: 'Jumpsuit',
  saree: 'Saree',
  co_ord_set: 'Co-ord Set',
  ethnic_wear: 'Ethnic Wear',
  other: 'Clothing'
};

/**
 * Resolves a display category cleanly avoiding generic or misclassified fallbacks.
 * For instance, a garment classified with category: "top" and subcategory: "other"
 * (such as a wrap-style top) resolves to "Top" instead of "Clothing" or "T-Shirt".
 */
export function resolveDisplayCategory(category?: string, subcategory?: string): string {
  const normSub = (subcategory || '').toLowerCase().trim();
  const normCat = (category || '').toLowerCase().trim();

  if (normSub && SUBCATEGORY_TO_DISPLAY_MAP[normSub]) {
    if (normSub === 'other' || normSub === 'top' || normSub === 'wrap_top') {
      if (normCat === 'top') return 'Top';
      if (normCat === 'bottom') return 'Trousers';
      if (normCat === 'outerwear') return 'Jacket';
      if (normCat === 'one_piece') return 'Dress';
      return 'Top';
    }
    return SUBCATEGORY_TO_DISPLAY_MAP[normSub];
  }

  if (normCat === 'top') return 'Top';
  if (normCat === 'bottom') return 'Trousers';
  if (normCat === 'outerwear') return 'Jacket';
  if (normCat === 'one_piece') return 'Dress';

  return 'Top';
}

export const DISPLAY_TO_SUBCATEGORY_MAP: Record<string, CanonicalSubcategory> = {
  'Top': 'top',
  'Blouse': 'blouse',
  'T-Shirt': 'tshirt',
  'Shirt': 'shirt',
  'Polo': 'polo',
  'Hoodie': 'hoodie',
  'Sweatshirt': 'sweatshirt',
  'Jacket': 'jacket',
  'Blazer': 'blazer',
  'Kurti': 'kurti',
  'Kurta': 'kurta',
  'Crop Top': 'crop_top',
  'Jeans': 'jeans',
  'Trousers': 'trousers',
  'Shorts': 'shorts',
  'Cargo Pants': 'cargo_pants',
  'Joggers': 'joggers',
  'Leggings': 'leggings',
  'Palazzo': 'palazzo',
  'Skirt': 'skirt',
  'Dress': 'dress',
  'Jumpsuit': 'jumpsuit',
  'Saree': 'saree',
  'Co-ord Set': 'co_ord_set',
  'Ethnic Wear': 'ethnic_wear'
};

export const SUBCATEGORY_TO_BODY_SECTION_MAP: Record<string, CanonicalCategory> = {
  top: 'top',
  blouse: 'top',
  wrap_top: 'top',
  tshirt: 'top',
  shirt: 'top',
  polo: 'top',
  hoodie: 'top',
  sweatshirt: 'top',
  jacket: 'outerwear',
  blazer: 'outerwear',
  kurti: 'top',
  kurta: 'top',
  crop_top: 'top',
  jeans: 'bottom',
  trousers: 'bottom',
  shorts: 'bottom',
  cargo_pants: 'bottom',
  joggers: 'bottom',
  leggings: 'bottom',
  palazzo: 'bottom',
  skirt: 'bottom',
  dress: 'one_piece',
  jumpsuit: 'one_piece',
  saree: 'one_piece',
  co_ord_set: 'one_piece',
  ethnic_wear: 'one_piece',
  other: 'top'
};

// -------------------------------------------------------------
// Runtime Schema Validation & Sanitization
// -------------------------------------------------------------

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const safeStringArray = (v: unknown): string[] => {
  if (Array.isArray(v)) {
    return v.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((s) => s.trim());
  }
  if (typeof v === 'string' && v.trim()) {
    return [v.trim()];
  }
  return [];
};

/**
 * Validates and normalizes raw model output into a valid CanonicalGarmentData object.
 * Rejects corrupt or invalid objects and returns a clean, safe model.
 */
export function validateCanonicalGarmentData(raw: unknown): {
  valid: boolean;
  data?: CanonicalGarmentData;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Garment data payload must be a non-null object.'] };
  }

  const r = raw as Record<string, any>;

  // Category & Subcategory resolution
  let subcategory: string = isNonEmptyString(r.subcategory) ? r.subcategory.toLowerCase().replace(/[^a-z0-9_]/g, '_') : '';
  if (!subcategory && isNonEmptyString(r.category)) {
    subcategory = DISPLAY_TO_SUBCATEGORY_MAP[r.category] || r.category.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }
  if (!subcategory) {
    subcategory = 'other';
    errors.push('Subcategory could not be identified, defaulted to other.');
  }

  const category = SUBCATEGORY_TO_BODY_SECTION_MAP[subcategory] || 'top';

  // Gender
  let gender: GarmentGender = 'unisex';
  if (typeof r.gender === 'string') {
    const g = r.gender.toLowerCase();
    if (g === 'men' || g === 'male') gender = 'men';
    else if (g === 'women' || g === 'female') gender = 'women';
  }

  // Visual
  const v = (r.visual && typeof r.visual === 'object') ? r.visual : {};
  const primaryColor = isNonEmptyString(v.primaryColor) ? v.primaryColor : (isNonEmptyString(r.primaryColor) ? r.primaryColor : 'Custom');
  const secondaryColor = isNonEmptyString(v.secondaryColor) ? v.secondaryColor : (isNonEmptyString(r.secondaryColor) ? r.secondaryColor : null);
  const colorFamily = safeStringArray(v.colorFamily || r.colorFamily);
  const pattern = isNonEmptyString(v.pattern) ? v.pattern : (isNonEmptyString(r.pattern) ? r.pattern : 'Solid');
  const texture = isNonEmptyString(v.texture) ? v.texture : null;
  const visibleDetails = safeStringArray(v.visibleDetails || r.visibleDetails);

  // Construction
  const c = (r.construction && typeof r.construction === 'object') ? r.construction : {};
  const sleeveType = isNonEmptyString(c.sleeveType) ? c.sleeveType : (isNonEmptyString(r.sleeveType) ? r.sleeveType : 'Regular');
  const neckType = isNonEmptyString(c.neckType) ? c.neckType : (isNonEmptyString(r.neckType) ? r.neckType : 'Standard');
  const fit = isNonEmptyString(c.fit) ? c.fit : (isNonEmptyString(r.fit) ? r.fit : 'Regular');
  const length = isNonEmptyString(c.length) ? c.length : 'Regular';
  const silhouette = isNonEmptyString(c.silhouette) ? c.silhouette : 'Straight';
  const rise = isNonEmptyString(c.rise) ? c.rise : null;

  // Material
  const m = (r.material && typeof r.material === 'object') ? r.material : {};
  const fabric = isNonEmptyString(m.fabric) ? m.fabric : (isNonEmptyString(r.fabric) ? r.fabric : (isNonEmptyString(r.material) ? r.material : 'Cotton'));
  let fabricConfidence: 'low' | 'medium' | 'high' | 'inferred' = 'medium';
  if (m.fabricConfidence === 'low' || m.fabricConfidence === 'medium' || m.fabricConfidence === 'high' || m.fabricConfidence === 'inferred') {
    fabricConfidence = m.fabricConfidence;
  }
  const composition = isNonEmptyString(m.composition) ? m.composition : null;

  // Style
  const s = (r.style && typeof r.style === 'object') ? r.style : {};
  const primaryStyle = isNonEmptyString(s.primary) ? s.primary : (isNonEmptyString(r.style) ? r.style : 'Casual');
  const secondaryStyle = safeStringArray(s.secondary || r.secondaryStyles);
  const styleTags = safeStringArray(s.tags || r.tags);

  // Usage
  const u = (r.usage && typeof r.usage === 'object') ? r.usage : {};
  const occasions = safeStringArray(u.occasions || r.occasions);
  if (!occasions.length) occasions.push('Casual');
  const seasons = safeStringArray(u.seasons || r.seasons);
  if (!seasons.length) seasons.push('All Season');
  const formality = isNonEmptyString(u.formality) ? u.formality : 'Casual';

  // Matching
  const match = (r.matching && typeof r.matching === 'object') ? r.matching : {};
  const compatibleCategories = safeStringArray(match.compatibleCategories || (category === 'top' ? ['bottom', 'footwear'] : ['top', 'footwear']));
  const compatibleStyles = safeStringArray(match.compatibleStyles || [primaryStyle]);
  const colorCompatibility = safeStringArray(match.colorCompatibility || [primaryColor]);

  // AI Metadata
  const meta = (r.aiMetadata && typeof r.aiMetadata === 'object') ? r.aiMetadata : {};
  const description = isNonEmptyString(meta.description)
    ? meta.description
    : `${primaryColor} ${pattern !== 'Solid' ? pattern + ' ' : ''}${SUBCATEGORY_TO_DISPLAY_MAP[subcategory] || subcategory}`;
  const searchTags = safeStringArray(meta.searchTags || [primaryColor, pattern, subcategory, primaryStyle, ...styleTags]);

  const cleanData: CanonicalGarmentData = {
    schemaVersion: '1.0',
    id: isNonEmptyString(r.id) ? r.id : undefined,
    category,
    subcategory,
    gender,
    visual: {
      primaryColor,
      secondaryColor,
      colorFamily,
      pattern,
      texture,
      visibleDetails
    },
    construction: {
      sleeveType,
      neckType,
      fit,
      length,
      silhouette,
      rise
    },
    material: {
      fabric,
      fabricConfidence,
      composition
    },
    style: {
      primary: primaryStyle,
      secondary: secondaryStyle,
      tags: styleTags
    },
    usage: {
      occasions,
      seasons,
      formality
    },
    matching: {
      compatibleCategories,
      compatibleStyles,
      colorCompatibility
    },
    aiMetadata: {
      description,
      searchTags,
      unknownFields: safeStringArray(meta.unknownFields),
      extractionSource: (meta.extractionSource === 'gemini' || meta.extractionSource === 'manual' || meta.extractionSource === 'hybrid')
        ? meta.extractionSource
        : 'gemini',
      schemaVersion: '1.0',
      confidenceScore: typeof meta.confidenceScore === 'number' ? meta.confidenceScore : undefined
    }
  };

  return { valid: true, data: cleanData, errors };
}

/**
 * Converts CanonicalGarmentData into the flattened WardrobeDetectedAttributes
 * for 100% backward-compatibility with existing Virtual Wardrobe components.
 */
export function canonicalToDisplayAttributes(canonical: CanonicalGarmentData): Record<string, any> {
  const displayCategory = resolveDisplayCategory(canonical.category, canonical.subcategory);
  return {
    category: displayCategory,
    subcategory: canonical.subcategory,
    primaryColor: canonical.visual.primaryColor,
    secondaryColor: canonical.visual.secondaryColor || null,
    colorFamily: canonical.visual.colorFamily || [],
    pattern: canonical.visual.pattern,
    texture: canonical.visual.texture || null,
    visibleDetails: canonical.visual.visibleDetails || [],
    sleeveType: canonical.construction.sleeveType,
    neckType: canonical.construction.neckType,
    fit: canonical.construction.fit,
    length: canonical.construction.length,
    silhouette: canonical.construction.silhouette,
    rise: canonical.construction.rise || null,
    fabric: canonical.material.fabric,
    material: canonical.material.fabric,
    fabricConfidence: canonical.material.fabricConfidence,
    style: canonical.style.primary,
    secondaryStyles: canonical.style.secondary || [],
    occasions: canonical.usage.occasions || [],
    seasons: canonical.usage.seasons || [],
    formality: canonical.usage.formality,
    compatibleCategories: canonical.matching.compatibleCategories || [],
    compatibleStyles: canonical.matching.compatibleStyles || [],
    colorCompatibility: canonical.matching.colorCompatibility || [],
    aiDescription: canonical.aiMetadata.description || '',
    schemaVersion: canonical.schemaVersion
  };
}
