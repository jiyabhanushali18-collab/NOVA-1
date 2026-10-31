import { NormalizedProduct } from './productIntelligence';
import { colorCombos, fashionRules } from './fashionKnowledge';

export interface GarmentRecommendationQuery {
  category?: string;
  subcategory?: string;
  primaryColor?: string;
  secondaryColor?: string;
  pattern?: string;
  fit?: string;
  sleeveType?: string;
  neckType?: string;
  fabric?: string;
  style?: string;
  styles?: string[];
  occasion?: string;
  occasions?: string[];
  season?: string;
  gender?: 'Men' | 'Women' | 'Unisex' | string;
}

export interface RecommendationOptions {
  targetCategory?: string; // e.g. 'Bottom Wear' or 'Top Wear'
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  gender?: string;
  inStockOnly?: boolean;
}

export interface ScoredProductRecommendation {
  product: NormalizedProduct;
  score: number; // 0 - 100
  matchConfidence: 'High' | 'Good' | 'Moderate';
  explanations: string[];
  breakdown: {
    categoryScore: number;
    colorScore: number;
    styleScore: number;
    occasionScore: number;
    fitScore: number;
  };
}

// Neutral colors that pair versatilely with almost anything
const NEUTRAL_COLORS = new Set([
  'black', 'white', 'off white', 'grey', 'gray', 'charcoal',
  'beige', 'cream', 'navy blue', 'navy', 'tan', 'silver'
]);

// Determine complementary categories
export const getComplementaryCategories = (category: string, subcategory?: string): string[] => {
  const cat = (category || '').toLowerCase();
  const sub = (subcategory || '').toLowerCase();

  if (cat.includes('top') || sub.includes('top') || sub.includes('shirt') || sub.includes('hoodie')) {
    return ['Bottom Wear', 'Footwear', 'Outerwear'];
  }
  if (cat.includes('bottom') || sub.includes('pant') || sub.includes('jean') || sub.includes('trouser')) {
    return ['Top Wear', 'Footwear', 'Outerwear'];
  }
  if (cat.includes('full') || sub.includes('dress') || sub.includes('jumpsuit') || sub.includes('suit')) {
    return ['Footwear', 'Accessories', 'Outerwear'];
  }
  if (cat.includes('footwear') || sub.includes('shoe') || sub.includes('sneaker')) {
    return ['Top Wear', 'Bottom Wear', 'Full Body'];
  }
  return ['Bottom Wear', 'Top Wear'];
};

/**
 * Calculates color harmony score between two colors (0 - 35 points)
 */
export const calculateColorHarmonyScore = (
  colorA: string,
  colorB: string
): { score: number; reason: string } => {
  const normA = (colorA || '').trim().toLowerCase();
  const normB = (colorB || '').trim().toLowerCase();

  if (!normA || !normB) {
    return { score: 18, reason: 'Versatile neutral color pairing.' };
  }

  // Exact match (Monochrome look)
  if (normA === normB) {
    return {
      score: 30,
      reason: `Monochrome harmony: matching ${colorA} creates an elongated, cohesive silhouette.`
    };
  }

  // Check known curated color combinations from fashionKnowledge
  for (const combo of colorCombos) {
    const comboStr = combo.combination.join(' ').toLowerCase();
    if (
      (comboStr.includes(normA) && comboStr.includes(normB)) ||
      (combo.tags && combo.tags.some((t) => t.includes(normA) && t.includes(normB)))
    ) {
      return {
        score: 35,
        reason: `Curated color synergy: ${colorA} paired with ${colorB} is a proven, high-harmony combination.`
      };
    }
  }

  const isANeutral = NEUTRAL_COLORS.has(normA);
  const isBNeutral = NEUTRAL_COLORS.has(normB);

  // Both neutral (Classic minimalist look)
  if (isANeutral && isBNeutral) {
    return {
      score: 33,
      reason: `Classic neutral balance: ${colorA} and ${colorB} create a clean, elegant look.`
    };
  }

  // One neutral + one color (Balanced focal point)
  if (isANeutral || isBNeutral) {
    const neutral = isANeutral ? colorA : colorB;
    const accent = isANeutral ? colorB : colorA;
    return {
      score: 31,
      reason: `Balanced contrast: ${neutral} grounds ${accent} as the stylish focal piece.`
    };
  }

  // Complementary or warm/cool pairs
  const warmColors = new Set(['beige', 'brown', 'tan', 'rust', 'orange', 'mustard', 'peach', 'coral', 'olive green', 'olive', 'maroon', 'wine', 'burgundy']);
  const coolColors = new Set(['navy blue', 'navy', 'sky blue', 'blue', 'mint green', 'lavender', 'lilac', 'green', 'purple', 'grey', 'gray']);

  if ((warmColors.has(normA) && warmColors.has(normB)) || (coolColors.has(normA) && coolColors.has(normB))) {
    return {
      score: 28,
      reason: `Tonal temperature harmony: ${colorA} and ${colorB} share an organic seasonal palette.`
    };
  }

  // Standard safe contrast
  return {
    score: 22,
    reason: `Complementary pairing: ${colorA} coordinates smoothly with ${colorB}.`
  };
};

/**
 * Calculates silhouette & fit harmony score (0 - 10 points)
 */
export const calculateFitHarmonyScore = (
  garmentFit?: string,
  candidateFit?: string,
  garmentCat?: string,
  candidateCat?: string
): { score: number; reason?: string } => {
  const gFit = (garmentFit || '').toLowerCase();
  const cFit = (candidateFit || '').toLowerCase();

  if (!gFit || !cFit) return { score: 7 };

  // Rule: Oversized top + Straight/Slim bottom
  if (gFit.includes('oversized') || gFit.includes('boxy')) {
    if (cFit.includes('straight') || cFit.includes('slim') || cFit.includes('tapered') || cFit.includes('cargo')) {
      return {
        score: 10,
        reason: 'Proportional balance: Relaxed top is balanced by structured, straight-fit trousers.'
      };
    }
  }

  // Rule: Fitted top + Relaxed/Wide bottom
  if (gFit.includes('fitted') || gFit.includes('slim') || gFit.includes('cropped')) {
    if (cFit.includes('relaxed') || cFit.includes('wide') || cFit.includes('straight') || cFit.includes('loose')) {
      return {
        score: 10,
        reason: 'Silhouette harmony: Fitted top pairs perfectly with relaxed, wide-leg bottoms.'
      };
    }
  }

  return { score: 7 };
};

/**
 * Calculates style alignment score (0 - 20 points)
 */
export const calculateStyleScore = (
  garmentStyles: string[],
  productStyles: string[]
): { score: number; reason?: string } => {
  if (garmentStyles.length === 0 || productStyles.length === 0) {
    return { score: 14 };
  }

  const gSet = new Set(garmentStyles.map((s) => s.toLowerCase()));
  const matches = productStyles.filter((s) => gSet.has(s.toLowerCase()));

  if (matches.length > 0) {
    return {
      score: 20,
      reason: `Aesthetic cohesion: Both garments share ${matches.join(', ')} styling.`
    };
  }

  // Compatible style overlaps
  const isCasual = (styles: string[]) => styles.some((s) => /casual|streetwear|minimal|everyday/i.test(s));
  const isFormal = (styles: string[]) => styles.some((s) => /formal|office|old money|quiet luxury/i.test(s));

  if (isCasual(garmentStyles) && isCasual(productStyles)) {
    return { score: 16, reason: 'Versatile casual styling matches effortlessly.' };
  }
  if (isFormal(garmentStyles) && isFormal(productStyles)) {
    return { score: 18, reason: 'Smart/formal aesthetics align for sophisticated occasions.' };
  }

  return { score: 12 };
};

/**
 * Calculates occasion alignment score (0 - 10 points)
 */
export const calculateOccasionScore = (
  garmentOccasions: string[],
  productOccasions: string[]
): { score: number; reason?: string } => {
  if (garmentOccasions.length === 0 || productOccasions.length === 0) {
    return { score: 7 };
  }

  const gSet = new Set(garmentOccasions.map((o) => o.toLowerCase()));
  const matches = productOccasions.filter((o) => gSet.has(o.toLowerCase()));

  if (matches.length > 0) {
    return {
      score: 10,
      reason: `Occasion match: Suitable for ${matches.join(', ')} wear.`
    };
  }

  return { score: 6 };
};

/**
 * Core Deterministic Recommendation Engine.
 * Evaluates a query item against the normalized catalogue and ranks items by fashion compatibility.
 */
export const rankProductsForGarment = (
  garment: GarmentRecommendationQuery,
  catalogue: NormalizedProduct[],
  options: RecommendationOptions = {}
): ScoredProductRecommendation[] => {
  const {
    targetCategory,
    limit = 10,
    minPrice,
    maxPrice,
    gender,
    inStockOnly = true
  } = options;

  // 1. Determine eligible categories
  const complementaryCategories = targetCategory
    ? [targetCategory]
    : getComplementaryCategories(garment.category || 'Top Wear', garment.subcategory);

  const targetCategorySet = new Set(complementaryCategories.map((c) => c.toLowerCase()));

  const garmentStyles = [
    ...(garment.style ? [garment.style] : []),
    ...(garment.styles || [])
  ];

  const garmentOccasions = [
    ...(garment.occasion ? [garment.occasion] : []),
    ...(garment.occasions || [])
  ];

  const garmentPrimaryColor = garment.primaryColor || 'Black';
  const garmentGender = (garment.gender || gender || '').toLowerCase();

  // 2. Score candidate products
  const scoredList: ScoredProductRecommendation[] = [];

  for (const product of catalogue) {
    // Basic stock and price filters
    if (inStockOnly && !product.inStock) continue;
    if (minPrice !== undefined && product.price < minPrice) continue;
    if (maxPrice !== undefined && product.price > maxPrice) continue;

    // Gender compatibility filter
    if (garmentGender && garmentGender !== 'unisex') {
      const prodGender = product.gender.toLowerCase();
      if (prodGender !== 'unisex' && prodGender !== garmentGender) {
        continue;
      }
    }

    const explanations: string[] = [];

    // A. Category Score (0 - 25 points)
    let categoryScore = 15;
    const prodCategoryLower = product.category.toLowerCase();
    if (targetCategorySet.has(prodCategoryLower)) {
      categoryScore = 25;
      explanations.push(`Complete outfit pairing: ${product.category} coordinates with your ${garment.subcategory || garment.category || 'item'}.`);
    } else if (targetCategory && !targetCategorySet.has(prodCategoryLower)) {
      // If user explicitly asked for a target category and this isn't it, penalize heavily
      continue;
    }

    // B. Color Harmony Score (0 - 35 points)
    const colorResult = calculateColorHarmonyScore(garmentPrimaryColor, product.primaryColor);
    const colorScore = colorResult.score;
    if (colorResult.reason) {
      explanations.push(colorResult.reason);
    }

    // C. Style Alignment Score (0 - 20 points)
    const styleResult = calculateStyleScore(garmentStyles, product.styles);
    const styleScore = styleResult.score;
    if (styleResult.reason) {
      explanations.push(styleResult.reason);
    }

    // D. Occasion Score (0 - 10 points)
    const occasionResult = calculateOccasionScore(garmentOccasions, product.occasions);
    const occasionScore = occasionResult.score;
    if (occasionResult.reason) {
      explanations.push(occasionResult.reason);
    }

    // E. Fit / Silhouette Harmony Score (0 - 10 points)
    const fitResult = calculateFitHarmonyScore(garment.fit, product.fit, garment.category, product.category);
    const fitScore = fitResult.score;
    if (fitResult.reason) {
      explanations.push(fitResult.reason);
    }

    // Total Score
    const totalScore = Math.min(100, Math.round(categoryScore + colorScore + styleScore + occasionScore + fitScore));

    const matchConfidence = totalScore >= 80 ? 'High' : totalScore >= 65 ? 'Good' : 'Moderate';

    scoredList.push({
      product,
      score: totalScore,
      matchConfidence,
      explanations: Array.from(new Set(explanations)),
      breakdown: {
        categoryScore,
        colorScore,
        styleScore,
        occasionScore,
        fitScore
      }
    });
  }

  // 3. Sort by score descending and rating
  scoredList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.product.rating - a.product.rating;
  });

  return scoredList.slice(0, limit);
};
