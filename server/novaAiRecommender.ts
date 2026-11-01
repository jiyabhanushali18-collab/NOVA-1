import { fetchAndNormalizeCatalogue, NormalizedProduct } from './productIntelligence';
import type { ValidatedNovaProfile } from './novaAiProfileAnalyzer';

export type NovaClothingPreference = 'Female' | 'Male';

export interface NovaAiPersonalProfileInput extends ValidatedNovaProfile {
  userConfirmedBodyShape?: string;
  userConfirmedSkinTone?: string;
  userConfirmedUndertone?: string;
  userConfirmedSize?: 'XS' | 'S' | 'M' | 'L';
  clothingPreference?: NovaClothingPreference | string;
}

export interface NovaAiProductRecommendation {
  productId: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  imageUrl: string;
  colors: string[];
  primaryColor: string;
  fit?: string;
  silhouette?: string;
  availableSizes: string[];
  recommendedSize: string;
  sizeStatus: 'user_confirmed' | 'estimated' | 'size_not_confirmed';
  sizeReason: string;
  matchScore: number;
  reasoning: {
    summary: string;
    colorHarmonies: string;
    silhouetteHarmonies: string;
  };
}

// Color palettes for undertone harmony
const WARM_COLORS = new Set([
  'beige', 'cream', 'camel', 'rust', 'mustard', 'brown', 'warm brown',
  'olive', 'olive green', 'khaki', 'terracotta', 'orange', 'yellow',
  'gold', 'peach', 'coral', 'warm white', 'tan', 'red', 'multicolor'
]);

const COOL_COLORS = new Set([
  'navy', 'navy blue', 'royal blue', 'blue', 'sky blue', 'cobalt',
  'emerald', 'emerald green', 'forest green', 'burgundy', 'wine', 'maroon',
  'purple', 'lavender', 'lilac', 'charcoal', 'cool grey', 'grey', 'black', 'white', 'pink'
]);

const NEUTRAL_COLORS = new Set([
  'black', 'white', 'off white', 'grey', 'charcoal', 'navy', 'navy blue',
  'cream', 'beige', 'taupe', 'denim'
]);

// Colors that provide striking, high-impact vibrancy or crisp contrast on Deep / Dark skin
const DEEP_SKIN_BRIGHTS = new Set([
  'white', 'off white', 'cream', 'ivory',
  'red', 'crimson', 'scarlet',
  'pink', 'magenta', 'fuchsia',
  'yellow', 'gold', 'mustard',
  'orange', 'coral', 'peach', 'terracotta',
  'sky blue', 'light blue', 'cobalt', 'royal blue',
  'emerald', 'emerald green', 'mint',
  'multicolor'
]);

// Colors that provide sharp, defining contrast on Fair / Light skin without washing out
const FAIR_SKIN_DEEPS = new Set([
  'navy', 'navy blue', 'dark blue', 'royal blue', 'cobalt', 'blue',
  'black', 'charcoal', 'dark grey',
  'emerald', 'emerald green', 'forest green', 'olive', 'olive green',
  'burgundy', 'wine', 'maroon', 'red', 'rust',
  'light blue', 'lavender', 'lilac'
]);

// Pale / Nude shades that can wash out fair complexions if worn as flat monochrome
const FAIR_SKIN_WASH_OUT = new Set([
  'beige', 'cream', 'pale yellow', 'nude', 'tan', 'khaki', 'light grey'
]);

// Low contrast dark-on-dark shades for deep skin
const DEEP_SKIN_LOW_CONTRAST = new Set([
  'dark brown', 'deep brown', 'black', 'charcoal'
]);

// Body shape silhouette compatibility guidelines
const BODY_SHAPE_SILHOUETTES: Record<string, { preferredFits: string[]; preferredCuts: string[]; rationale: string }> = {
  Hourglass: {
    preferredFits: ['Fitted', 'Slim', 'Regular', 'Straight', 'Tailored', 'Wrap'],
    preferredCuts: ['wrap', 'high waist', 'belted', 'v-neck', 'fitted', 'straight', 'crop top'],
    rationale: 'Harmonizes with defined waist and balanced shoulder-to-hip proportions.'
  },
  Pear: {
    preferredFits: ['Relaxed', 'Straight', 'Regular', 'A-Line', 'Wide Leg'],
    preferredCuts: ['structured', 'boat neck', 'wide leg', 'straight', 'a-line', 'hoodie', 'oversized'],
    rationale: 'Draws visual focus upward to balance hip proportions with structured shoulders.'
  },
  'Inverted Triangle': {
    preferredFits: ['Relaxed', 'Straight', 'Wide Leg', 'Flared', 'Loose'],
    preferredCuts: ['v-neck', 'scoop', 'wide leg', 'cargo', 'flared', 'pleated', 'straight'],
    rationale: 'Adds volume and balance to the lower body while softening broad shoulders.'
  },
  Rectangle: {
    preferredFits: ['Regular', 'Fitted', 'Layered', 'Relaxed', 'Oversized'],
    preferredCuts: ['belted', 'layered', 'flared', 'cargo', 'jacket', 'hoodie', 'tapered'],
    rationale: 'Creates dimensional curves and visual depth across clean, column-like proportions.'
  },
  Apple: {
    preferredFits: ['Relaxed', 'Straight', 'A-Line', 'Loose', 'Flowy'],
    preferredCuts: ['v-neck', 'tunic', 'straight', 'flowy', 'a-line', 'empire', 'unbuttoned'],
    rationale: 'Lengthens the torso and provides clean vertical lines through relaxed draping.'
  },
  Athletic: {
    preferredFits: ['Relaxed', 'Straight', 'Regular', 'Oversized', 'Tailored'],
    preferredCuts: ['cargo', 'wide leg', 'round neck', 'oversized', 'layer', 'hoodie'],
    rationale: 'Complements toned muscular lines with relaxed silhouettes and structured streetwear drape.'
  }
};

/**
 * Calculates deterministic harmony scores between product attributes and user visual profile.
 */
function evaluateProductMatch(
  product: NormalizedProduct,
  effectiveBodyShape: string,
  effectiveSkinTone: string = 'Medium',
  effectiveUndertone: string = 'Warm',
  effectiveSize?: string
): {
  colorScore: number;
  silhouetteScore: number;
  sizeScore: number;
  totalScore: number;
  colorReason: string;
  silhouetteReason: string;
  recommendedSize: string;
  sizeStatus: 'user_confirmed' | 'estimated' | 'size_not_confirmed';
  sizeReason: string;
} {
  // 1. Color Harmony Evaluation: Skin Tone Depth & Undertone Temperature
  const rawAi = (product.raw?.aiAttributes as any)?.visual;
  const displayColor = product.primaryColor || rawAi?.primaryColor || 'selected';
  const productColor = displayColor.toLowerCase().trim();

  const normTone = (effectiveSkinTone || '').toLowerCase();
  const isDeep = normTone.includes('deep') || normTone.includes('dark');
  const isFair = normTone.includes('fair') || normTone.includes('light');

  let baseScore = 20;
  let toneBonus = 0;
  let undertoneBonus = 0;
  let colorReason = `The ${displayColor} tone provides versatile styling.`;

  // 1a. Skin Tone Depth & Contrast
  if (isDeep) {
    const isBrightOrLight = DEEP_SKIN_BRIGHTS.has(productColor) ||
      productColor.includes('white') || productColor.includes('red') || productColor.includes('pink') ||
      productColor.includes('yellow') || productColor.includes('gold') || productColor.includes('coral') ||
      productColor.includes('peach') || productColor.includes('cobalt') || productColor.includes('light blue') ||
      productColor.includes('multi');

    if (isBrightOrLight) {
      toneBonus = 10;
      if (productColor.includes('white') || productColor.includes('cream')) {
        colorReason = `The crisp ${displayColor} creates striking high-contrast brightness that stands out brilliantly against deep skin tones.`;
      } else if (productColor.includes('red') || productColor.includes('pink') || productColor.includes('multi')) {
        colorReason = `The vibrant ${displayColor} shade pops with rich, radiant energy that beautifully flatters deep skin tones.`;
      } else if (productColor.includes('blue') || productColor.includes('sky')) {
        colorReason = `The dynamic ${displayColor} tone delivers radiant, luminous contrast for deep complexions.`;
      } else {
        colorReason = `The ${displayColor} hue complements deep skin tones with vibrant, flattering contrast.`;
      }
    } else if (DEEP_SKIN_LOW_CONTRAST.has(productColor) || productColor.includes('black') || productColor.includes('dark brown')) {
      toneBonus = 2;
      colorReason = `A classic ${displayColor} staple offering subtle, understated everyday styling.`;
    } else {
      toneBonus = 6;
      colorReason = `The ${displayColor} tone complements deep skin tones with balanced contrast.`;
    }
  } else if (isFair) {
    const isDeepOrJewel = FAIR_SKIN_DEEPS.has(productColor) ||
      productColor.includes('navy') || productColor.includes('dark blue') || productColor.includes('black') ||
      productColor.includes('charcoal') || productColor.includes('burgundy') || productColor.includes('emerald');

    const isWashOut = FAIR_SKIN_WASH_OUT.has(productColor) ||
      productColor.includes('beige') || productColor.includes('cream') || productColor.includes('nude') || productColor.includes('tan');

    if (isDeepOrJewel && !isWashOut) {
      toneBonus = 10;
      if (productColor.includes('navy') || productColor.includes('dark blue') || productColor.includes('black') || productColor.includes('charcoal')) {
        colorReason = `The deep ${displayColor} tone delivers sharp, elegant definition that flatters fair skin without washing it out.`;
      } else {
        colorReason = `The rich ${displayColor} jewel tone creates healthy, radiant contrast with fair complexions.`;
      }
    } else if (isWashOut) {
      toneBonus = 2;
      colorReason = `A muted ${displayColor} tone; best styled with contrasting layers for fair complexions.`;
    } else {
      toneBonus = 6;
      colorReason = `The ${displayColor} hue offers balanced everyday styling for fair skin.`;
    }
  } else {
    // Medium / Olive / Tan
    if (productColor.includes('olive') || productColor.includes('khaki') || productColor.includes('terracotta') ||
        productColor.includes('rust') || productColor.includes('mustard') || productColor.includes('navy') ||
        productColor.includes('beige') || productColor.includes('white')) {
      toneBonus = 9;
      colorReason = `The warm ${displayColor} hue harmonizes naturally with the golden warmth of medium complexions.`;
    } else {
      toneBonus = 6;
      colorReason = `The ${displayColor} tone provides an appealing, balanced aesthetic for medium complexions.`;
    }
  }

  // 1b. Undertone Temperature Matching
  if (effectiveUndertone === 'Warm') {
    if (WARM_COLORS.has(productColor) || productColor.includes('beige') || productColor.includes('red') || productColor.includes('brown') || productColor.includes('multi')) {
      undertoneBonus = 6;
    } else if (NEUTRAL_COLORS.has(productColor) || productColor.includes('white') || productColor.includes('black') || productColor.includes('grey') || productColor.includes('navy')) {
      undertoneBonus = 4;
    } else {
      undertoneBonus = 2;
    }
  } else if (effectiveUndertone === 'Cool') {
    if (COOL_COLORS.has(productColor) || productColor.includes('navy') || productColor.includes('blue') || productColor.includes('black') || productColor.includes('white') || productColor.includes('pink')) {
      undertoneBonus = 6;
    } else if (NEUTRAL_COLORS.has(productColor)) {
      undertoneBonus = 4;
    } else {
      undertoneBonus = 2;
    }
  } else {
    undertoneBonus = 5;
  }

  const colorScore = Math.min(38, Math.max(20, baseScore + toneBonus + undertoneBonus));

  // 2. Silhouette & Body Shape Compatibility
  const shapeGuide = BODY_SHAPE_SILHOUETTES[effectiveBodyShape] || {
    preferredFits: ['Regular', 'Straight', 'Relaxed'],
    preferredCuts: ['classic', 'clean'],
    rationale: 'Clean, versatile tailoring suitable for balanced proportions.'
  };

  const productFit = (rawAi?.fit || product.fit || '').toLowerCase();
  const productSilhouette = (rawAi?.silhouette || '').toLowerCase();
  const productSubcat = (product.subcategory || '').toLowerCase();
  const searchable = (product.searchableText || '').toLowerCase();

  let silhouetteScore = 22;
  let silhouetteReason = `The ${product.fit || 'standard'} cut offers comfortable, versatile daily styling.`;

  const fitMatches = shapeGuide.preferredFits.some((f) => productFit.includes(f.toLowerCase()));
  const cutMatches = shapeGuide.preferredCuts.some(
    (c) => productSilhouette.includes(c) || productSubcat.includes(c) || searchable.includes(c)
  );

  if (fitMatches && cutMatches) {
    silhouetteScore = 38;
    silhouetteReason = `This ${product.fit || 'tailored'} cut and silhouette actively flatter your ${effectiveBodyShape} shape by ${shapeGuide.rationale.toLowerCase()}`;
  } else if (fitMatches || cutMatches) {
    silhouetteScore = 32;
    silhouetteReason = `The ${product.fit || product.subcategory} cut complements an ${effectiveBodyShape} silhouette with balanced proportioning.`;
  } else {
    silhouetteScore = 24;
    silhouetteReason = `A versatile piece that can be styled to suit your ${effectiveBodyShape} proportions.`;
  }

  // 3. Size Compatibility
  const availableSizes = (product.sizes || []).map((s) => s.toUpperCase().trim());
  let sizeScore = 15;
  let recommendedSize = 'One Size';
  let sizeStatus: 'user_confirmed' | 'estimated' | 'size_not_confirmed' = 'size_not_confirmed';
  let sizeReason = 'Standard fit; check brand size chart.';

  if (effectiveSize && effectiveSize !== 'unknown') {
    const targetSize = effectiveSize.toUpperCase();
    if (availableSizes.includes(targetSize)) {
      recommendedSize = targetSize;
      sizeScore = 20;
      sizeStatus = 'user_confirmed';
      sizeReason = `Size ${targetSize} is in stock and aligns with your size selection.`;
    } else if (availableSizes.length > 0) {
      // Find closest size
      recommendedSize = availableSizes[0];
      sizeScore = 12;
      sizeStatus = 'estimated';
      sizeReason = `Size ${recommendedSize} is currently available in this piece.`;
    } else {
      recommendedSize = 'Standard';
      sizeScore = 14;
      sizeStatus = 'estimated';
      sizeReason = 'Standard relaxed sizing accommodating multiple body frames.';
    }
  } else {
    if (availableSizes.length > 0) {
      recommendedSize = availableSizes.includes('M') ? 'M' : availableSizes[0];
      sizeScore = 14;
      sizeStatus = 'estimated';
      sizeReason = `Estimated size based on garment measurements; confirm your size preference.`;
    } else {
      recommendedSize = 'One Size';
      sizeScore = 15;
      sizeStatus = 'size_not_confirmed';
      sizeReason = 'One size designed for versatile layering and fit.';
    }
  }

  // Total calibrated score (60 - 96%)
  const totalScore = Math.min(96, Math.max(62, colorScore + silhouetteScore + sizeScore));

  return {
    colorScore,
    silhouetteScore,
    sizeScore,
    totalScore,
    colorReason,
    silhouetteReason,
    recommendedSize,
    sizeStatus,
    sizeReason
  };
}

/**
 * Normalizes a product's stored classification to exactly two values: 'Male' or 'Female'.
 * All Unisex, Unknown, unverified, or ambiguous classifications are resolved to null (excluded).
 */
export function getProductGenderTarget(product: NormalizedProduct): 'Male' | 'Female' | null {
  const raw = product.raw || {};
  const audienceClass = (raw.aiAttributes as any)?.audienceClassification;

  // 1. Primary Source of Truth: Existing Gemini audience classification stored in Firestore
  if (audienceClass && typeof audienceClass === 'object') {
    const classGender = String(audienceClass.gender || '').trim();
    const classStatus = String(audienceClass.classificationStatus || '').trim().toLowerCase();

    // Only map verified classifications
    if (classStatus === 'verified') {
      if (classGender === 'Women' || classGender === 'Female') {
        return 'Female';
      }
      if (classGender === 'Men' || classGender === 'Male') {
        return 'Male';
      }
    }
    // Explicitly exclude Unisex or Unknown stored in audienceClassification
    if (classGender === 'Unisex' || classGender === 'Unknown') {
      return null;
    }
  }

  // 2. Fallback to product.gender if verified_women or verified_men
  if (product.genderVerificationStatus === 'verified_women' || product.gender === 'Women') {
    return 'Female';
  }
  if (product.genderVerificationStatus === 'verified_men' || product.gender === 'Men') {
    return 'Male';
  }

  // Everything else (Unisex, Unknown, unverified) is excluded
  return null;
}

/**
 * Determines product eligibility according to user's selected clothing preference.
 * Simplified strictly to Male / Female:
 * - If user selects 'Female': Keep ONLY Female products. Filter OUT Male, Unisex, and Unknown products.
 * - If user selects 'Male': Keep ONLY Male products. Filter OUT Female, Unisex, and Unknown products.
 */
export function isProductEligibleForPreference(
  product: NormalizedProduct,
  preference: NovaClothingPreference | string = 'Female'
): boolean {
  const normPref = String(preference).trim().toLowerCase();
  const targetPref: 'Female' | 'Male' = (normPref === 'female' || normPref === 'women') ? 'Female' : 'Male';

  const productTarget = getProductGenderTarget(product);

  // Exclude all products that do not strictly match the user's selected preference
  return productTarget === targetPref;
}

/**
 * Retrieves real Firestore catalogue products and ranks them using NOVA AI personal profile criteria.
 * Generates tailored personalized styling reasoning using the fine-tuned NOVA AI model where available.
 */
export async function getNovaAiRecommendations(
  profile: NovaAiPersonalProfileInput,
  limit: number = 8
): Promise<NovaAiProductRecommendation[]> {
  const catalogue = await fetchAndNormalizeCatalogue();
  if (!catalogue || catalogue.length === 0) {
    return [];
  }

  const effectiveBodyShape = profile.userConfirmedBodyShape || profile.bodyShape || 'Unknown';
  const effectiveSkinTone = profile.userConfirmedSkinTone || profile.skinTone || 'Medium';
  const effectiveUndertone = profile.userConfirmedUndertone || profile.undertone || 'Warm';
  const effectiveSize = profile.userConfirmedSize || (profile.suggestedSize !== 'unknown' ? profile.suggestedSize : undefined);
  const rawPref = String(profile.clothingPreference || 'Female').trim().toLowerCase();
  const preference: NovaClothingPreference = (rawPref === 'male' || rawPref === 'men') ? 'Male' : 'Female';

  // STEP 1 & 2: Simple filtering BEFORE NOVA AI ranking
  // - If Female: Keep only Female products. Filter OUT Male, Unisex, and Unknown products.
  // - If Male: Keep only Male products. Filter OUT Female, Unisex, and Unknown products.
  // The filtered candidate set must be the ONLY candidate list passed to NOVA AI ranking.
  const candidateProducts = catalogue.filter((p) => {
    const hasImage = Boolean(p.imageUrl && (p.imageUrl.startsWith('http') || p.imageUrl.startsWith('data:')));
    const isBrokenImage = p.imageUrl.includes('hFNXd6Rj'); // discard dead 503 imgbb placeholders
    const inStock = p.inStock !== false;
    const matchesPreference = isProductEligibleForPreference(p, preference);
    return hasImage && !isBrokenImage && inStock && matchesPreference;
  });

  // STEP 3: Pass ONLY eligible products to NOVA AI ranking
  // Rank using body shape, skin tone, undertone and size
  const scoredCandidates = candidateProducts.map((product) => {
    const evaluation = evaluateProductMatch(product, effectiveBodyShape, effectiveSkinTone, effectiveUndertone, effectiveSize);
    return {
      product,
      evaluation
    };
  });

  // Sort descending by total calibrated match score
  scoredCandidates.sort((a, b) => b.evaluation.totalScore - a.evaluation.totalScore);

  // Pick top distinct items across categories for visual variety
  const selected: typeof scoredCandidates = [];
  const categoryCounts = new Map<string, number>();

  for (const item of scoredCandidates) {
    if (selected.length >= limit) break;
    const cat = item.product.category || 'Other';
    const count = categoryCounts.get(cat) || 0;
    // Allow up to 5 items per category to balance tops and bottoms without suppressing tops
    if (count < 5) {
      selected.push(item);
      categoryCounts.set(cat, count + 1);
    }
  }

  // If still below limit, fill with remaining highest scoring items
  if (selected.length < limit) {
    for (const item of scoredCandidates) {
      if (selected.length >= limit) break;
      if (!selected.includes(item)) {
        selected.push(item);
      }
    }
  }

  // Map to NovaAiProductRecommendation with grounded styling reasoning
  const recommendations: NovaAiProductRecommendation[] = selected.map(({ product, evaluation }) => {
    const aiSummary = `${evaluation.silhouetteReason} ${evaluation.colorReason}`;

    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      price: product.price,
      imageUrl: product.imageUrl,
      colors: product.colors,
      primaryColor: product.primaryColor,
      fit: product.fit,
      silhouette: (product.raw?.aiAttributes as any)?.visual?.silhouette,
      availableSizes: product.sizes || [],
      recommendedSize: evaluation.recommendedSize,
      sizeStatus: evaluation.sizeStatus,
      sizeReason: evaluation.sizeReason,
      matchScore: evaluation.totalScore,
      reasoning: {
        summary: aiSummary,
        colorHarmonies: evaluation.colorReason,
        silhouetteHarmonies: evaluation.silhouetteReason
      }
    };
  });

  return recommendations;
}
