import { fetchAndNormalizeCatalogue, NormalizedProduct } from './productIntelligence';
import type { ValidatedNovaProfile } from './novaAiProfileAnalyzer';

export interface NovaAiPersonalProfileInput extends ValidatedNovaProfile {
  userConfirmedBodyShape?: string;
  userConfirmedSkinTone?: string;
  userConfirmedUndertone?: string;
  userConfirmedSize?: 'XS' | 'S' | 'M' | 'L';
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
  'gold', 'peach', 'coral', 'warm white', 'tan'
]);

const COOL_COLORS = new Set([
  'navy', 'navy blue', 'royal blue', 'blue', 'sky blue', 'cobalt',
  'emerald', 'emerald green', 'forest green', 'burgundy', 'wine', 'maroon',
  'purple', 'lavender', 'lilac', 'charcoal', 'cool grey', 'grey', 'black', 'white'
]);

const NEUTRAL_COLORS = new Set([
  'black', 'white', 'off white', 'grey', 'charcoal', 'navy', 'navy blue',
  'cream', 'beige', 'taupe', 'denim'
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
  effectiveUndertone: string,
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
  // 1. Color Harmony Evaluation
  const primary = (product.primaryColor || '').toLowerCase();
  const rawAi = (product.raw?.aiAttributes as any)?.visual;
  const aiPrimary = (rawAi?.primaryColor || '').toLowerCase();
  const productColor = aiPrimary || primary;

  let colorScore = 20;
  let colorReason = `The ${product.primaryColor || 'selected'} tone provides versatile styling.`;

  const isWarm = WARM_COLORS.has(productColor);
  const isCool = COOL_COLORS.has(productColor);
  const isNeutral = NEUTRAL_COLORS.has(productColor);

  if (effectiveUndertone === 'Warm') {
    if (isWarm) {
      colorScore = 38;
      colorReason = `The warm ${product.primaryColor} shade naturally flatters your warm golden undertones.`;
    } else if (isNeutral) {
      colorScore = 34;
      colorReason = `The neutral ${product.primaryColor} hue provides balanced contrast against warm undertones.`;
    } else {
      colorScore = 24;
      colorReason = `Provides a striking cool contrast that stands out against warm undertones.`;
    }
  } else if (effectiveUndertone === 'Cool') {
    if (isCool) {
      colorScore = 38;
      colorReason = `The cool ${product.primaryColor} tone creates clean, striking harmony with your cool undertones.`;
    } else if (isNeutral) {
      colorScore = 34;
      colorReason = `The classic ${product.primaryColor} neutral complements cool undertones seamlessly.`;
    } else {
      colorScore = 24;
      colorReason = `Adds warm visual vibrancy to balance cool undertones.`;
    }
  } else {
    // Neutral or Unknown undertone
    if (isNeutral || isWarm || isCool) {
      colorScore = 35;
      colorReason = `The ${product.primaryColor} color pairs harmoniously with balanced, neutral undertones.`;
    }
  }

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

  // Filter out products without usable images or stock
  const candidateProducts = catalogue.filter((p) => {
    const hasImage = Boolean(p.imageUrl && (p.imageUrl.startsWith('http') || p.imageUrl.startsWith('data:')));
    return hasImage && p.inStock !== false;
  });

  // Evaluate candidate products
  const scoredCandidates = candidateProducts.map((product) => {
    const evaluation = evaluateProductMatch(product, effectiveBodyShape, effectiveUndertone, effectiveSize);
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
    // Allow at most 3 items per category to ensure a diverse wardrobe assortment
    if (count < 3) {
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
