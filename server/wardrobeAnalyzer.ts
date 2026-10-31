import express, { Request, Response } from 'express';
import {
  CanonicalGarmentData,
  CANONICAL_CATEGORIES,
  CANONICAL_COLORS,
  CANONICAL_FABRICS,
  CANONICAL_FITS,
  CANONICAL_FORMALITIES,
  CANONICAL_NECK_TYPES,
  CANONICAL_OCCASIONS,
  CANONICAL_PATTERNS,
  CANONICAL_SEASONS,
  CANONICAL_SLEEVE_TYPES,
  CANONICAL_STYLES,
  CANONICAL_SUBCATEGORIES,
  canonicalToDisplayAttributes,
  validateCanonicalGarmentData
} from '../src/types/wardrobe';
import { generateWardrobeOutfits } from '../src/services/wardrobeOutfitEngine';

const router = express.Router();
export const MAX_IMAGE_PAYLOAD_BYTES = 6 * 1024 * 1024;
export const DEFAULT_PRIMARY_MODEL = 'gemini-2.5-flash';
export const DEFAULT_FALLBACK_MODELS = ['gemini-3.1-flash-lite'];
export const GEMINI_MODEL = (process.env.GEMINI_MODEL || DEFAULT_PRIMARY_MODEL).trim();
export const REQUEST_TIMEOUT_MS = 45000;
export const MAX_TRANSIENT_RETRIES = 2;

/**
 * Builds the structured vision prompt for Gemini garment intelligence.
 * Explicitly instructs the model on taxonomy constraints, distinction between
 * visual facts and conservative inferences, and strict JSON format.
 */
export const buildGarmentAnalysisPrompt = (garmentHint?: string): string => {
  const hintText = garmentHint && typeof garmentHint === 'string' && garmentHint.trim()
    ? `User hints the garment might be in category: "${garmentHint.trim()}". Verify visually.`
    : '';

  return `
You are the NOVA AI Fashion Intelligence Core.
Analyze the primary clothing garment in the provided photo.
${hintText}

Identify the primary garment only. Do not combine attributes from multiple garments or people.
Distinguish between visually detected facts (color, pattern, neckline, sleeve) and inferred attributes (fabric, style, occasion, season).
If an attribute cannot be reliably identified from the visual data, use "Unknown" or null. Do not invent brands, composition percentages, or unseen features.

Produce a single valid JSON object strictly matching this schema:
{
  "schemaVersion": "1.0",
  "category": "<one of: ${CANONICAL_CATEGORIES.join(', ')}>",
  "subcategory": "<one of: ${CANONICAL_SUBCATEGORIES.join(', ')}>",
  "gender": "<one of: men, women, unisex>",
  "visual": {
    "primaryColor": "<one of: ${CANONICAL_COLORS.join(', ')}>",
    "secondaryColor": "<one of: ${CANONICAL_COLORS.join(', ')} or null>",
    "colorFamily": ["<array of: neutral, warm, cool, earth_tone, pastel, vibrant, metallic>"],
    "pattern": "<one of: ${CANONICAL_PATTERNS.join(', ')}>",
    "texture": "<short texture description, e.g. matte, denim twill, rib knit, or null>",
    "visibleDetails": ["<array of observed details, e.g. front pocket, graphic print, ribbing>"]
  },
  "construction": {
    "sleeveType": "<one of: ${CANONICAL_SLEEVE_TYPES.join(', ')}>",
    "neckType": "<one of: ${CANONICAL_NECK_TYPES.join(', ')}>",
    "fit": "<one of: ${CANONICAL_FITS.join(', ')}>",
    "length": "<one of: Cropped, Regular, Longline, Knee Length, Midi, Maxi, Ankle Length, Short, Unknown>",
    "silhouette": "<e.g. Straight, Boxy, Fitted, A-Line, Flared, Tapered, Oversized, Unknown>",
    "rise": "<for bottoms: High Rise, Mid Rise, Low Rise, or null for tops>"
  },
  "material": {
    "fabric": "<one of: ${CANONICAL_FABRICS.join(', ')}>",
    "fabricConfidence": "<one of: low, medium, high, inferred>",
    "composition": null
  },
  "style": {
    "primary": "<one of: ${CANONICAL_STYLES.join(', ')}>",
    "secondary": ["<array of secondary style tags from: ${CANONICAL_STYLES.join(', ')}>"],
    "tags": ["<descriptive keywords, e.g. minimal, everyday, casual, trendy>"]
  },
  "usage": {
    "occasions": ["<array from: ${CANONICAL_OCCASIONS.join(', ')}>"],
    "seasons": ["<array from: ${CANONICAL_SEASONS.join(', ')}>"],
    "formality": "<one of: ${CANONICAL_FORMALITIES.join(', ')}>"
  },
  "matching": {
    "compatibleCategories": ["<garment categories that pair well with this, e.g. bottom, footwear, outerwear>"],
    "compatibleStyles": ["<compatible styling moods, e.g. Casual, Streetwear, Smart Casual>"],
    "colorCompatibility": ["<complementary color families or colors that coordinate naturally>"]
  },
  "aiMetadata": {
    "description": "<one clear, concise sentence describing the garment>",
    "searchTags": ["<searchable tags for closet filtering>"],
    "unknownFields": ["<list of any attributes that could not be determined>"],
    "extractionSource": "gemini",
    "schemaVersion": "1.0"
  }
}

Return ONLY the raw JSON object. Do not include markdown formatting, backticks, or explanatory text.
`.trim();
};

export interface GarmentAnalysisResult {
  success: boolean;
  garment?: CanonicalGarmentData;
  displayAttributes?: Record<string, any>;
  error?: string;
  statusCode?: number;
  modelUsed?: string;
}

/**
 * Executes a call to Google Gemini vision with bounded exponential backoff with jitter on transient errors (503, 5xx, timeout),
 * respecting Retry-After headers, never retrying 429 quota exhaustion on the same model,
 * and failing over to compatible fallback models (e.g. gemini-3.1-flash-lite) if the primary model is unavailable or exhausted.
 */
export async function callGeminiVision(
  mimeType: string,
  base64Data: string,
  apiKey: string,
  prompt: string,
  fetchFn: typeof fetch = fetch,
  modelsToTry: string[] = [GEMINI_MODEL]
): Promise<{ ok: boolean; status: number; text?: string; error?: string; modelUsed?: string }> {
  let lastStatus = 503;
  let lastError = 'AI garment recognition could not be completed.';
  const uniqueModels = Array.from(new Set(modelsToTry));

  for (let mIdx = 0; mIdx < uniqueModels.length; mIdx++) {
    const currentModel = uniqueModels[mIdx];
    let attempt = 0;
    let delay = 1000;

    while (attempt <= MAX_TRANSIENT_RETRIES) {
      attempt++;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetchFn(
          `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64Data } }
                ]
              }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
              }
            })
          }
        );

        clearTimeout(timeout);
        lastStatus = response.status;

        if (response.ok) {
          const rawJson = await response.json();
          const text = rawJson?.candidates?.[0]?.content?.parts
            ?.map((part: { text?: string }) => part.text || '')
            .join('')
            .trim();
          if (mIdx > 0) {
            console.log(`[Wardrobe Analyzer] Garment analyzed successfully using fallback model: ${currentModel}`);
          }
          return { ok: true, status: response.status, text, modelUsed: currentModel };
        }

        // Parse error response safely without logging API key
        let errorBodyText = '';
        let retryAfterHeader = response.headers?.get ? response.headers.get('retry-after') : null;
        try {
          const errJson = await response.json();
          errorBodyText = errJson?.error?.message || '';
          if (!retryAfterHeader && errJson?.error?.details) {
            const retryInfo = errJson.error.details.find((d: any) => d['@type']?.includes('RetryInfo'));
            if (retryInfo?.retryDelay) {
              const match = String(retryInfo.retryDelay).match(/^(\d+)s$/);
              if (match) retryAfterHeader = match[1];
            }
          }
        } catch {
          // Non-JSON error body
        }

        // 429 Quota Exceeded or 404 Model Unavailable: NEVER retry the same model
        if (response.status === 429) {
          console.warn(`[Wardrobe Analyzer] Model ${currentModel} quota exceeded (429): ${errorBodyText.slice(0, 120)}.`);
          lastError = 'AI garment recognition quota exceeded. Please try again later or enter garment details manually.';
          break; // break retry loop to try fallback model if available
        }

        if (response.status === 404) {
          console.warn(`[Wardrobe Analyzer] Model ${currentModel} unavailable for this API key (404): ${errorBodyText.slice(0, 120)}.`);
          lastError = `AI model ${currentModel} is unavailable for this API key.`;
          break; // break retry loop to try fallback model if available
        }

        // 503 or transient 5xx: retry with exponential backoff, jitter, and Retry-After
        const isTransient = response.status === 503 || (response.status >= 500 && response.status !== 501);
        if (isTransient && attempt <= MAX_TRANSIENT_RETRIES) {
          let waitTime = delay;
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0 && parsedSeconds <= 10) {
              waitTime = parsedSeconds * 1000;
            }
          }
          const jitter = Math.floor(Math.random() * 350);
          waitTime = Math.min(waitTime + jitter, 10000);

          console.warn(`[Wardrobe Analyzer] Model ${currentModel} returned HTTP ${response.status}. Retrying in ${waitTime}ms (attempt ${attempt}/${MAX_TRANSIENT_RETRIES})...`);
          await new Promise((r) => setTimeout(r, waitTime));
          delay *= 2;
          continue;
        }

        lastError = response.status === 503
          ? 'Gemini garment intelligence is temporarily unavailable due to high demand.'
          : `AI service returned error HTTP ${response.status}.`;
        break;
      } catch (err: any) {
        clearTimeout(timeout);
        const isAbort = err?.name === 'AbortError';
        lastStatus = isAbort ? 504 : 502;
        lastError = isAbort
          ? 'AI garment analysis timed out. You may retry or enter garment details manually.'
          : 'Network error connecting to Gemini AI.';

        if (attempt <= MAX_TRANSIENT_RETRIES) {
          const jitter = Math.floor(Math.random() * 350);
          const waitTime = Math.min(delay + jitter, 10000);
          console.warn(`[Wardrobe Analyzer] Request error on ${currentModel} (${isAbort ? 'timeout' : err?.message}). Retrying in ${waitTime}ms (attempt ${attempt}/${MAX_TRANSIENT_RETRIES})...`);
          await new Promise((r) => setTimeout(r, waitTime));
          delay *= 2;
          continue;
        }
        break;
      }
    }

    if (mIdx < uniqueModels.length - 1) {
      console.log(`[Wardrobe Analyzer] Model ${currentModel} was unable to complete request (${lastStatus}). Falling back to ${uniqueModels[mIdx + 1]}...`);
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}

/**
 * Core analysis engine: validates image, invokes Gemini, and parses/validates canonical schema.
 */
export async function analyzeGarmentImagePayload(
  imageDataUrl: string,
  garmentHint?: string,
  apiKeyOverride?: string,
  fetchFn: typeof fetch = fetch
): Promise<GarmentAnalysisResult> {
  // 1. Validate payload length
  if (!imageDataUrl || typeof imageDataUrl !== 'string' || imageDataUrl.length > MAX_IMAGE_PAYLOAD_BYTES) {
    return {
      success: false,
      statusCode: 400,
      error: 'Garment image data is required and must be under 6MB.'
    };
  }

  // 2. Validate MIME type & base64 encoding
  const imageMatch = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp|jpg));base64,([A-Za-z0-9+/=]+)$/);
  if (!imageMatch) {
    return {
      success: false,
      statusCode: 400,
      error: 'Invalid image format. Must be a valid JPEG, PNG, or WebP base64 data URL.'
    };
  }

  const mimeType = imageMatch[1] === 'image/jpg' ? 'image/jpeg' : imageMatch[1];
  const base64Data = imageMatch[2];

  // 3. Obtain API key strictly from server-side environment (never VITE_GEMINI_API_KEY)
  const apiKey = (apiKeyOverride || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      success: false,
      statusCode: 503,
      error: 'AI garment recognition is not configured on this server.'
    };
  }

  // 4. Build prompt & call Gemini vision with fallback model cascade
  const prompt = buildGarmentAnalysisPrompt(garmentHint);
  const modelsToTry = [GEMINI_MODEL, ...DEFAULT_FALLBACK_MODELS];
  const geminiResponse = await callGeminiVision(mimeType, base64Data, apiKey, prompt, fetchFn, modelsToTry);

  if (!geminiResponse.ok || !geminiResponse.text) {
    return {
      success: false,
      statusCode: geminiResponse.status || 502,
      error: geminiResponse.error || 'AI garment analysis could not extract attributes.'
    };
  }

  // 5. Parse and validate JSON against canonical schema
  let parsedJson: unknown;
  try {
    let cleanText = geminiResponse.text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    parsedJson = JSON.parse(cleanText);
  } catch (parseErr) {
    console.warn('[Wardrobe Analyzer] Gemini returned malformed JSON, applying fallback parser.');
    return {
      success: false,
      statusCode: 502,
      error: 'AI service returned an unreadable response format. Please retry or enter details manually.'
    };
  }

  const validation = validateCanonicalGarmentData(parsedJson);
  if (!validation.valid || !validation.data) {
    return {
      success: false,
      statusCode: 502,
      error: `Garment attributes failed validation: ${validation.errors.join(', ')}`
    };
  }

  const displayAttributes = canonicalToDisplayAttributes(validation.data);

  return {
    success: true,
    statusCode: 200,
    garment: validation.data,
    displayAttributes
  };
}

// -------------------------------------------------------------
// POST /api/wardrobe/analyze-garment route handler
// -------------------------------------------------------------
router.post('/wardrobe/analyze-garment', async (req: Request, res: Response) => {
  try {
    const { image, imageDataUrl, garmentHint } = req.body || {};
    const payload = (typeof image === 'string' && image) || (typeof imageDataUrl === 'string' && imageDataUrl) || '';

    const result = await analyzeGarmentImagePayload(payload, garmentHint);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      garment: result.garment,
      displayAttributes: result.displayAttributes
    });
  } catch (err: any) {
    console.error('[Wardrobe Analyzer] Internal handler error:', err);
    // Never expose stack trace or internal credentials
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while processing the garment image.'
    });
  }
});

/**
 * POST /api/wardrobe/outfit-recommendations
 * Generates coordinated outfit combinations using only garments in the user's wardrobe.
 * Guarantees strict user isolation.
 */
router.post('/wardrobe/outfit-recommendations', (req: Request, res: Response) => {
  try {
    const { items, limit, occasionFilter, seedItemId } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'items array is required for wardrobe outfit recommendations'
      });
    }

    const result = generateWardrobeOutfits(items, {
      limit: typeof limit === 'number' ? limit : 8,
      occasionFilter: typeof occasionFilter === 'string' ? occasionFilter : undefined,
      seedItemId: typeof seedItemId === 'string' ? seedItemId : undefined
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    console.error('[Wardrobe Outfit Engine] Error generating outfits:', err);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while generating outfit recommendations.'
    });
  }
});

export default router;
