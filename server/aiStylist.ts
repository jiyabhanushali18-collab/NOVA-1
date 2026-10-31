import { DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODELS } from './wardrobeAnalyzer';
import { GarmentRecommendationQuery, rankProductsForGarment, ScoredProductRecommendation } from './recommendationEngine';
import { fetchAndNormalizeCatalogue, NormalizedProduct } from './productIntelligence';

export interface StylistQueryRequest {
  query: string;
  wardrobeGarment?: GarmentRecommendationQuery;
  limit?: number;
}

export interface StylistIntent {
  targetCategory?: string;
  desiredColors: string[];
  style?: string;
  occasion?: string;
  fitPreference?: string;
  stylistAdvice: string;
}

const parseQueryDeterministic = (query: string, wardrobeGarment?: GarmentRecommendationQuery): StylistIntent => {
  const q = query.toLowerCase();

  // Detect category intent
  let targetCategory: string | undefined;
  if (/pant|jeans|trouser|bottom|skirt|cargo|chino|short/i.test(q)) {
    targetCategory = 'Bottom Wear';
  } else if (/top|shirt|tee|hoodie|jacket|blazer|sweater/i.test(q)) {
    targetCategory = 'Top Wear';
  } else if (/shoe|sneaker|boot|loafer|heel/i.test(q)) {
    targetCategory = 'Footwear';
  }

  // Detect colors
  const knownColors = ['black', 'white', 'beige', 'cream', 'navy blue', 'blue', 'grey', 'olive', 'green', 'brown', 'rust', 'maroon', 'wine'];
  const desiredColors = knownColors.filter((c) => q.includes(c)).map((c) => c.replace(/\b\w/g, (ch) => ch.toUpperCase()));

  // Detect occasion
  let occasion: string | undefined;
  if (/date|dinner|night out/i.test(q)) occasion = 'Date Night';
  else if (/college|campus|uni/i.test(q)) occasion = 'College';
  else if (/office|work|formal|meeting/i.test(q)) occasion = 'Office';
  else if (/party|club/i.test(q)) occasion = 'Party';
  else if (/wedding|festive|traditional/i.test(q)) occasion = 'Wedding';
  else if (/casual|everyday/i.test(q)) occasion = 'Casual';

  // Detect style
  let style: string | undefined;
  if (/streetwear|baggy|oversize/i.test(q)) style = 'Streetwear';
  else if (/old money|classy|quiet luxury|elegant/i.test(q)) style = 'Old Money';
  else if (/boho|bohemian/i.test(q)) style = 'Bohemian';
  else if (/minimal/i.test(q)) style = 'Minimal';

  let stylistAdvice = 'Curated recommendations matching your styling request.';
  if (wardrobeGarment?.subcategory && targetCategory) {
    stylistAdvice = `Selected ${targetCategory} pieces designed to complement your ${wardrobeGarment.subcategory}.`;
  }

  return {
    targetCategory,
    desiredColors,
    style,
    occasion,
    stylistAdvice
  };
};

/**
 * Uses Gemini to interpret natural language styling queries,
 * with graceful fallback to deterministic parsing.
 */
export const consultAiStylist = async (
  userQuery: string,
  wardrobeGarment?: GarmentRecommendationQuery,
  limit = 8
): Promise<{
  success: boolean;
  stylistAdvice: string;
  intent: StylistIntent;
  recommendations: ScoredProductRecommendation[];
  source: 'gemini' | 'deterministic';
}> => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const models = [
    (process.env.GEMINI_MODEL || DEFAULT_PRIMARY_MODEL).trim(),
    ...DEFAULT_FALLBACK_MODELS
  ];

  let intent: StylistIntent | null = null;
  let source: 'gemini' | 'deterministic' = 'deterministic';

  if (apiKey) {
    const prompt = `
You are the NOVA AI Fashion Stylist.
Analyze the user's fashion styling query and provide structured fashion intent.
User query: "${userQuery}"
${wardrobeGarment ? `Reference Garment: ${JSON.stringify(wardrobeGarment)}` : ''}

Respond with valid JSON strictly matching:
{
  "targetCategory": "<one of: 'Top Wear', 'Bottom Wear', 'Full Body', 'Footwear', 'Outerwear', or null>",
  "desiredColors": ["<array of relevant colors mentioned or recommended, e.g. Beige, Black>"],
  "style": "<e.g. Streetwear, Old Money, Casual, Minimal, Bohemian, Formal, or null>",
  "occasion": "<e.g. Date Night, College, Office, Casual, Party, Wedding, or null>",
  "fitPreference": "<e.g. Relaxed, Straight, Slim, Oversized, or null>",
  "stylistAdvice": "<1-2 concise, expert styling sentences explaining how to complete this outfit>"
}
`;

    for (const model of models) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json'
              }
            })
          }
        );

        clearTimeout(timeout);

        if (response.ok) {
          const raw = await response.json();
          let text = raw?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (text.startsWith('```json')) text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          else if (text.startsWith('```')) text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');

          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') {
            intent = {
              targetCategory: parsed.targetCategory || undefined,
              desiredColors: Array.isArray(parsed.desiredColors) ? parsed.desiredColors : [],
              style: parsed.style || undefined,
              occasion: parsed.occasion || undefined,
              fitPreference: parsed.fitPreference || undefined,
              stylistAdvice: parsed.stylistAdvice || 'Styled for your requested look.'
            };
            source = 'gemini';
            break;
          }
        } else if (response.status === 404 || response.status === 429) {
          // Immediately try fallback model without retrying 404/429
          continue;
        }
      } catch {
        // Fallback to next model or deterministic parser
        continue;
      }
    }
  }

  // If Gemini was unavailable or errored, use deterministic parser
  if (!intent) {
    intent = parseQueryDeterministic(userQuery, wardrobeGarment);
    source = 'deterministic';
  }

  // Fetch normalized catalogue
  const catalogue = await fetchAndNormalizeCatalogue();

  // Merge intent with wardrobeGarment for deterministic ranking
  const mergedQuery: GarmentRecommendationQuery = {
    ...wardrobeGarment,
    primaryColor: intent.desiredColors[0] || wardrobeGarment?.primaryColor,
    style: intent.style || wardrobeGarment?.style,
    occasion: intent.occasion || wardrobeGarment?.occasion,
    fit: intent.fitPreference || wardrobeGarment?.fit
  };

  const recommendations = rankProductsForGarment(mergedQuery, catalogue, {
    targetCategory: intent.targetCategory,
    limit,
    gender: wardrobeGarment?.gender
  });

  return {
    success: true,
    stylistAdvice: intent.stylistAdvice,
    intent,
    recommendations,
    source
  };
};
