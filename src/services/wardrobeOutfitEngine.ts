import { WardrobeItem } from '../types';

export interface WardrobeOutfitRecommendation {
  id: string;
  itemIds: string[];
  items: WardrobeItem[];
  title: string;
  compatibilityScore: number; // 0 - 100
  explanations: string[];
  suggestedOccasion: string;
  styleDescription: string;
  structureType: 'top_bottom_footwear' | 'top_bottom_footwear_outerwear' | 'fullbody_footwear' | 'top_bottom_duo' | 'partial';
  breakdown: {
    colorScore: number;
    patternScore: number;
    fitScore: number;
    styleScore: number;
    occasionScore: number;
  };
}

export interface WardrobeOutfitEngineResult {
  outfits: WardrobeOutfitRecommendation[];
  totalGenerated: number;
  wardrobeItemCount: number;
  statusMessage?: string;
}

const TOP_CATEGORIES = new Set([
  't-shirt', 't-shirts', 'tshirt', 'shirt', 'shirts', 'top', 'tops', 'wrap top',
  'blouse', 'kurti', 'kurta', 'crop top', 'tank top', 'polo', 'polo shirt',
  'sweatshirt', 'sweater', 'henley', 'hoodie'
]);

const BOTTOM_CATEGORIES = new Set([
  'jeans', 'pants', 'trousers', 'cargo pants', 'cargo', 'joggers', 'shorts',
  'skirt', 'skirts', 'chinos', 'palazzo', 'leggings', 'dhoti', 'track pants'
]);

const FOOTWEAR_CATEGORIES = new Set([
  'sneakers', 'shoes', 'loafers', 'boots', 'sandals', 'heels', 'slides', 'footwear', 'flats'
]);

const OUTERWEAR_CATEGORIES = new Set([
  'jacket', 'jackets', 'blazer', 'blazers', 'nehru jacket', 'coat', 'coats',
  'cardigan', 'outerwear', 'oversized hoodie', 'denim jacket', 'leather jacket'
]);

const FULLBODY_CATEGORIES = new Set([
  'dress', 'dresses', 'saree', 'sari', 'jumpsuit', 'co-ord set', 'salwar suit',
  'lehenga', 'ethnic wear', 'gown', 'suit', 'maxi dress', 'mini dress'
]);

const ACCESSORY_CATEGORIES = new Set([
  'accessories', 'accessory', 'watch', 'cap', 'hat', 'bag', 'belt', 'jewelry', 'chain', 'scarf', 'sunglasses'
]);

const NEUTRAL_COLORS = new Set([
  'black', 'white', 'off white', 'grey', 'gray', 'charcoal',
  'beige', 'cream', 'navy blue', 'navy', 'tan', 'silver'
]);

const CURATED_COLOR_COMBOS: Array<[string, string]> = [
  ['white', 'black'],
  ['black', 'beige'],
  ['white', 'beige'],
  ['white', 'navy blue'],
  ['white', 'navy'],
  ['black', 'grey'],
  ['charcoal', 'black'],
  ['olive green', 'black'],
  ['olive', 'black'],
  ['burgundy', 'black'],
  ['wine', 'black'],
  ['sky blue', 'white'],
  ['lavender', 'grey'],
  ['beige', 'brown'],
  ['navy blue', 'tan'],
  ['cream', 'olive green'],
  ['mustard', 'navy blue'],
  ['rust', 'cream']
];

interface ExtractedGarmentDetails {
  categoryType: 'top' | 'bottom' | 'footwear' | 'outerwear' | 'fullbody' | 'accessory' | 'other';
  primaryColor: string;
  secondaryColor: string | null;
  pattern: string;
  fit: string;
  style: string;
  occasions: string[];
  gender: string;
}

const classifyCategory = (category: string, subcategory?: string): ExtractedGarmentDetails['categoryType'] => {
  const combined = `${category} ${subcategory || ''}`.toLowerCase();
  for (const cat of OUTERWEAR_CATEGORIES) {
    if (combined.includes(cat)) return 'outerwear';
  }
  for (const cat of FOOTWEAR_CATEGORIES) {
    if (combined.includes(cat)) return 'footwear';
  }
  for (const cat of FULLBODY_CATEGORIES) {
    if (combined.includes(cat)) return 'fullbody';
  }
  for (const cat of TOP_CATEGORIES) {
    if (combined.includes(cat)) return 'top';
  }
  for (const cat of BOTTOM_CATEGORIES) {
    if (combined.includes(cat)) return 'bottom';
  }
  for (const cat of ACCESSORY_CATEGORIES) {
    if (combined.includes(cat)) return 'accessory';
  }
  return 'other';
};

const extractGarmentDetails = (item: WardrobeItem): ExtractedGarmentDetails => {
  const canonical = item.canonical;
  const attributes = item.attributes || {};

  const rawCategory = canonical?.category || attributes.category || item.category || 'Top';
  const rawSubcategory = canonical?.subcategory || attributes.subcategory || '';
  const categoryType = classifyCategory(rawCategory, rawSubcategory);

  const primaryColor = (
    canonical?.visual?.primaryColor ||
    attributes.primaryColor ||
    item.colors?.[0] ||
    'Black'
  ).trim();

  const secondaryColor = canonical?.visual?.secondaryColor || attributes.secondaryColor || item.colors?.[1] || null;

  const rawPattern = canonical?.visual?.pattern ||
    (item.pattern && item.pattern.toLowerCase() !== 'solid' ? item.pattern : attributes.pattern) ||
    'Solid';
  const pattern = rawPattern.toLowerCase().includes('solid') || rawPattern.toLowerCase().includes('plain')
    ? 'Solid'
    : rawPattern;

  const fit = (
    canonical?.construction?.fit ||
    attributes.fit ||
    'Regular'
  ).trim();

  const style = (
    canonical?.style?.primary ||
    attributes.style ||
    item.tags?.[0] ||
    'Casual'
  ).trim();

  const occasions = Array.from(new Set([
    ...(canonical?.usage?.occasions || []),
    ...(attributes.occasions || []),
    ...((attributes as any).occasion ? [(attributes as any).occasion] : []),
    ...(item.tags || [])
  ])).filter(Boolean);

  const gender = canonical?.gender || item.gender || 'Unisex';

  return {
    categoryType,
    primaryColor,
    secondaryColor,
    pattern,
    fit,
    style,
    occasions: occasions.length > 0 ? occasions : ['Casual'],
    gender
  };
};

/**
 * Evaluates color compatibility between two garments (0 - 35 points)
 */
const evaluatePairColorScore = (colorA: string, colorB: string): { score: number; reason: string } => {
  const a = colorA.toLowerCase().trim();
  const b = colorB.toLowerCase().trim();

  if (a === b) {
    return {
      score: 30,
      reason: `Monochrome harmony: matching ${colorA} tones create an elongated silhouette.`
    };
  }

  for (const [c1, c2] of CURATED_COLOR_COMBOS) {
    if ((a.includes(c1) && b.includes(c2)) || (a.includes(c2) && b.includes(c1))) {
      return {
        score: 35,
        reason: `Curated color synergy: ${colorA} and ${colorB} form a high-contrast classic pair.`
      };
    }
  }

  const isANeutral = NEUTRAL_COLORS.has(a);
  const isBNeutral = NEUTRAL_COLORS.has(b);

  if (isANeutral && isBNeutral) {
    return {
      score: 33,
      reason: `Clean neutral balance: ${colorA} and ${colorB} harmonize cleanly.`
    };
  }

  if (isANeutral || isBNeutral) {
    const neutral = isANeutral ? colorA : colorB;
    const accent = isANeutral ? colorB : colorA;
    return {
      score: 31,
      reason: `Balanced focal point: ${neutral} grounds ${accent} as the accent piece.`
    };
  }

  return {
    score: 24,
    reason: `Complementary palette: ${colorA} pairs smoothly with ${colorB}.`
  };
};

/**
 * Evaluates pattern compatibility (0 - 15 points)
 */
const evaluatePatternScore = (detailsList: ExtractedGarmentDetails[]): { score: number; reason: string } => {
  const patternedItems = detailsList.filter((d) => d.pattern !== 'Solid');

  if (patternedItems.length === 0) {
    return {
      score: 15,
      reason: 'Clean solid textures create a versatile, timeless appearance.'
    };
  }

  if (patternedItems.length === 1) {
    return {
      score: 15,
      reason: `Statement focus: ${patternedItems[0].pattern} pattern stands out against solid grounding pieces.`
    };
  }

  return {
    score: 8,
    reason: 'Multi-pattern combination adds bold, creative visual interest.'
  };
};

/**
 * Evaluates silhouette and fit balance (0 - 15 points)
 */
const evaluateFitScore = (top?: ExtractedGarmentDetails, bottom?: ExtractedGarmentDetails): { score: number; reason: string } => {
  if (!top || !bottom) return { score: 12, reason: 'Balanced overall proportions.' };

  const topFit = top.fit.toLowerCase();
  const bottomFit = bottom.fit.toLowerCase();

  if (topFit.includes('oversized') || topFit.includes('boxy') || topFit.includes('relaxed')) {
    if (bottomFit.includes('straight') || bottomFit.includes('slim') || bottomFit.includes('tapered')) {
      return {
        score: 15,
        reason: 'Proportional balance: Relaxed top is balanced by structured bottoms.'
      };
    }
  }

  if (topFit.includes('fitted') || topFit.includes('slim') || topFit.includes('cropped')) {
    if (bottomFit.includes('wide') || bottomFit.includes('relaxed') || bottomFit.includes('straight') || bottomFit.includes('loose')) {
      return {
        score: 15,
        reason: 'Silhouette harmony: Fitted top pairs cleanly with relaxed wide bottoms.'
      };
    }
  }

  return {
    score: 12,
    reason: 'Harmonious silhouette and natural fit proportions.'
  };
};

/**
 * Evaluates style and occasion alignment (0 - 35 points total: style 20 + occasion 15)
 */
const evaluateStyleAndOccasion = (
  detailsList: ExtractedGarmentDetails[]
): {
  styleScore: number;
  occasionScore: number;
  suggestedOccasion: string;
  styleDescription: string;
  styleReason: string;
  occasionReason: string;
} => {
  // Styles
  const styleCounts: Record<string, number> = {};
  detailsList.forEach((d) => {
    styleCounts[d.style] = (styleCounts[d.style] || 0) + 1;
  });
  const topStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Casual';

  const isCohesive = detailsList.every((d) => d.style.toLowerCase() === topStyle.toLowerCase());
  const styleScore = isCohesive ? 20 : 16;
  const styleReason = isCohesive
    ? `Consistent aesthetic: all items share ${topStyle} styling.`
    : `Cohesive fusion centered around ${topStyle} style.`;

  // Occasions
  const occasionSets = detailsList.map((d) => new Set(d.occasions.map((o) => o.toLowerCase())));
  const commonOccasions: string[] = [];

  if (occasionSets.length > 0) {
    const first = Array.from(occasionSets[0]);
    for (const occ of first) {
      if (occasionSets.every((s) => s.has(occ))) {
        commonOccasions.push(occ);
      }
    }
  }

  let suggestedOccasion = 'Casual Everyday';
  let occasionScore = 12;
  if (commonOccasions.length > 0) {
    suggestedOccasion = commonOccasions[0].replace(/\b\w/g, (ch) => ch.toUpperCase());
    occasionScore = 15;
  } else if (detailsList[0]?.occasions?.[0]) {
    suggestedOccasion = detailsList[0].occasions[0].replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  const occasionReason = `Ideal for ${suggestedOccasion} settings.`;

  return {
    styleScore,
    occasionScore,
    suggestedOccasion,
    styleDescription: `${topStyle} Ensemble`,
    styleReason,
    occasionReason
  };
};

/**
 * Scores a combination of wardrobe items as a complete outfit
 */
export const scoreWardrobeOutfit = (
  items: WardrobeItem[],
  structureType: WardrobeOutfitRecommendation['structureType']
): WardrobeOutfitRecommendation => {
  const details = items.map(extractGarmentDetails);
  const explanations: string[] = [];

  // 1. Color Harmony (0 - 35 pts)
  let colorScore = 30;
  if (details.length >= 2) {
    const topItem = details.find((d) => d.categoryType === 'top' || d.categoryType === 'fullbody');
    const bottomItem = details.find((d) => d.categoryType === 'bottom' || d.categoryType === 'footwear');
    if (topItem && bottomItem) {
      const pairColor = evaluatePairColorScore(topItem.primaryColor, bottomItem.primaryColor);
      colorScore = pairColor.score;
      explanations.push(pairColor.reason);
    }
  }

  // Check 3-color rule across all items
  const uniqueColors = new Set(details.map((d) => d.primaryColor.toLowerCase()));
  if (uniqueColors.size <= 3) {
    colorScore = Math.min(35, colorScore + 2);
  } else {
    colorScore = Math.max(15, colorScore - 4);
    explanations.push('Color restraint: multiple accent colors provide vibrant contrast.');
  }

  // 2. Pattern Score (0 - 15 pts)
  const patternResult = evaluatePatternScore(details);
  const patternScore = patternResult.score;
  explanations.push(patternResult.reason);

  // 3. Fit Score (0 - 15 pts)
  const topDetails = details.find((d) => d.categoryType === 'top');
  const bottomDetails = details.find((d) => d.categoryType === 'bottom');
  const fitResult = evaluateFitScore(topDetails, bottomDetails);
  const fitScore = fitResult.score;
  explanations.push(fitResult.reason);

  // 4. Style & Occasion (0 - 35 pts)
  const styleOccasionResult = evaluateStyleAndOccasion(details);
  const styleScore = styleOccasionResult.styleScore;
  const occasionScore = styleOccasionResult.occasionScore;
  explanations.push(styleOccasionResult.styleReason);
  explanations.push(styleOccasionResult.occasionReason);

  // Total Score (0 - 100)
  const compatibilityScore = Math.min(100, Math.max(40, colorScore + patternScore + fitScore + styleScore + occasionScore));

  const outfitId = `outfit_${items.map((i) => i.id).sort().join('_')}`;
  const title = items.map((i) => `${i.colors[0] || ''} ${i.category}`.trim()).join(' + ');

  return {
    id: outfitId,
    itemIds: items.map((i) => i.id),
    items,
    title,
    compatibilityScore,
    explanations: Array.from(new Set(explanations)),
    suggestedOccasion: styleOccasionResult.suggestedOccasion,
    styleDescription: styleOccasionResult.styleDescription,
    structureType,
    breakdown: {
      colorScore,
      patternScore,
      fitScore,
      styleScore,
      occasionScore
    }
  };
};

/**
 * Main Entry Point: Generates prioritized outfit recommendations from the user's wardrobe items.
 * Guaranteed 100% active user isolation (only operates on the provided items array).
 */
export const generateWardrobeOutfits = (
  userWardrobeItems: WardrobeItem[],
  options: {
    limit?: number;
    occasionFilter?: string;
    seedItemId?: string;
  } = {}
): WardrobeOutfitEngineResult => {
  const { limit = 10, occasionFilter, seedItemId } = options;

  if (!Array.isArray(userWardrobeItems) || userWardrobeItems.length === 0) {
    return {
      outfits: [],
      totalGenerated: 0,
      wardrobeItemCount: 0,
      statusMessage: 'Your wardrobe is empty. Scan garments to unlock personalized outfit recommendations.'
    };
  }

  // Categorize items
  const tops: WardrobeItem[] = [];
  const bottoms: WardrobeItem[] = [];
  const footwear: WardrobeItem[] = [];
  const outerwear: WardrobeItem[] = [];
  const fullBody: WardrobeItem[] = [];
  const accessories: WardrobeItem[] = [];

  for (const item of userWardrobeItems) {
    const details = extractGarmentDetails(item);
    switch (details.categoryType) {
      case 'top': tops.push(item); break;
      case 'bottom': bottoms.push(item); break;
      case 'footwear': footwear.push(item); break;
      case 'outerwear': outerwear.push(item); break;
      case 'fullbody': fullBody.push(item); break;
      case 'accessory': accessories.push(item); break;
      default:
        // Fallback: examine raw category string
        const cat = (item.category || '').toLowerCase();
        if (cat.includes('top') || cat.includes('shirt') || cat.includes('tee')) tops.push(item);
        else if (cat.includes('bottom') || cat.includes('pant') || cat.includes('jean')) bottoms.push(item);
        else if (cat.includes('shoe') || cat.includes('sneaker')) footwear.push(item);
        else tops.push(item);
        break;
    }
  }

  const candidateOutfits: WardrobeOutfitRecommendation[] = [];
  const seenCombos = new Set<string>();

  const addOutfit = (items: WardrobeItem[], type: WardrobeOutfitRecommendation['structureType']) => {
    // If seedItemId is specified, ensure this outfit includes the seed item
    if (seedItemId && !items.some((i) => i.id === seedItemId)) return;

    const key = items.map((i) => i.id).sort().join('_');
    if (seenCombos.has(key)) return;
    seenCombos.add(key);

    const scored = scoreWardrobeOutfit(items, type);

    // Apply occasion filter if requested
    if (occasionFilter) {
      const occLower = occasionFilter.toLowerCase();
      const matchesOccasion = scored.suggestedOccasion.toLowerCase().includes(occLower) ||
        items.some((i) => (i.tags || []).some((t) => t.toLowerCase().includes(occLower)));
      if (!matchesOccasion) return;
    }

    candidateOutfits.push(scored);
  };

  // 1. Structure: Top + Bottom + Footwear + Outerwear
  if (tops.length > 0 && bottoms.length > 0 && footwear.length > 0 && outerwear.length > 0) {
    for (const top of tops) {
      for (const bottom of bottoms) {
        for (const shoes of footwear) {
          for (const jacket of outerwear) {
            addOutfit([top, bottom, shoes, jacket], 'top_bottom_footwear_outerwear');
          }
        }
      }
    }
  }

  // 2. Structure: Top + Bottom + Footwear
  if (tops.length > 0 && bottoms.length > 0 && footwear.length > 0) {
    for (const top of tops) {
      for (const bottom of bottoms) {
        for (const shoes of footwear) {
          addOutfit([top, bottom, shoes], 'top_bottom_footwear');
        }
      }
    }
  }

  // 3. Structure: Full-body + Footwear + Accessories
  if (fullBody.length > 0 && footwear.length > 0) {
    for (const dress of fullBody) {
      for (const shoes of footwear) {
        if (accessories.length > 0) {
          for (const acc of accessories) {
            addOutfit([dress, shoes, acc], 'fullbody_footwear');
          }
        } else {
          addOutfit([dress, shoes], 'fullbody_footwear');
        }
      }
    }
  }

  // 4. Fallback Structure: Top + Bottom + Outerwear (when user has outerwear but no footwear saved)
  if (tops.length > 0 && bottoms.length > 0 && footwear.length === 0 && outerwear.length > 0) {
    for (const top of tops) {
      for (const bottom of bottoms) {
        for (const jacket of outerwear) {
          addOutfit([top, bottom, jacket], 'top_bottom_footwear_outerwear');
        }
      }
    }
  }

  // 5. Fallback Structure: Top + Bottom Duo (when user has no footwear saved)
  if (tops.length > 0 && bottoms.length > 0 && candidateOutfits.length === 0) {
    for (const top of tops) {
      for (const bottom of bottoms) {
        addOutfit([top, bottom], 'top_bottom_duo');
      }
    }
  }

  // 6. Fallback Structure: Full-body single piece (when user has only dresses saved)
  if (fullBody.length > 0 && candidateOutfits.length === 0) {
    for (const dress of fullBody) {
      addOutfit([dress], 'partial');
    }
  }

  // 6. Wardrobe with too few pieces to form full looks
  if (candidateOutfits.length === 0) {
    let msg = 'Add more pieces to your wardrobe.';
    if (tops.length > 0 && bottoms.length === 0) {
      msg = 'You have tops saved! Add bottoms (such as a pair of jeans, pants, or a skirt) to generate complete outfits.';
    } else if (bottoms.length > 0 && tops.length === 0) {
      msg = 'You have bottoms saved! Add tops or shirts to generate complete outfits.';
    }
    return {
      outfits: [],
      totalGenerated: 0,
      wardrobeItemCount: userWardrobeItems.length,
      statusMessage: msg
    };
  }

  // Sort by compatibility score descending
  candidateOutfits.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  return {
    outfits: candidateOutfits.slice(0, limit),
    totalGenerated: candidateOutfits.length,
    wardrobeItemCount: userWardrobeItems.length
  };
};
