import 'dotenv/config';
import { adminDb } from './firebaseAdmin';
import { GEMINI_MODEL, DEFAULT_FALLBACK_MODELS } from './wardrobeAnalyzer';

export interface AudienceClassificationResult {
  gender: 'Women' | 'Men' | 'Unisex' | 'Unknown';
  confidence: number;
  reason: string;
  classificationStatus: 'verified' | 'unknown';
  model?: string;
  analyzedAt?: string;
}

export interface ProductAuditItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  imageUrl: string;
  existingRawGender?: string;
  existingAiGender?: string;
  existingAudienceClassification?: AudienceClassificationResult;
  imageAccessible: boolean;
  imageByteSize?: number;
  imageError?: string;
  classification?: AudienceClassificationResult;
  error?: string;
}

export const CLASSIFICATION_PROMPT = `
You are the NOVA Fashion Intelligence Core.
Visually analyse the primary clothing garment in the provided photo and classify its intended clothing audience.

Allowed classifications for "gender":
- "Women"
- "Men"
- "Unisex"
- "Unknown"

EVALUATION CRITERIA:
1. Examine garment design and construction: cut, silhouette, tailoring, neckline, drape, closure orientation, proportions, waist shaping, and styling.
2. Consider product category and title/description as supportive context, but prioritize visual evidence of the actual garment.
3. CRITICAL RULES:
   - Do NOT classify solely based on the gender of the model wearing the garment. (A man can model unisex or women's garments, and a woman can model unisex or men's garments).
   - Do NOT assume that every T-shirt, hoodie, polo, or shirt is unisex. Many have distinctive men's broad-shoulder boxy tailoring or women's contoured tailoring.
   - Do NOT classify products based only on colour.
   - Use "Unisex" ONLY when the garment design, fit, and construction are genuinely universal and suitable across all genders without gendered tailoring.
   - Use "Unknown" when the intended audience cannot be established with confidence, or when the image is ambiguous, obscured, or lacks clear tailoring cues. Do NOT guess.
4. "classificationStatus":
   - Use "verified" only when there is sufficient, clear visual and product evidence supporting the classification.
   - If confidence is below 70 or evidence is ambiguous, use "Unknown" for gender and "unknown" for classificationStatus.

Return strictly valid JSON matching this schema:
{
  "gender": "Women | Men | Unisex | Unknown",
  "confidence": 92,
  "reason": "Detailed concise explanation of garment construction, cut, and design cues supporting the decision.",
  "classificationStatus": "verified | unknown"
}
`;

/**
 * Downloads and validates an image payload, converting to base64 for Gemini vision API.
 */
export async function fetchImageForVision(imageUrl: string): Promise<{ base64: string; mimeType: string; byteSize: number }> {
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Image URL is empty or invalid');
  }

  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid data URI format');
    const buffer = Buffer.from(match[2], 'base64');
    return {
      base64: match[2],
      mimeType: match[1],
      byteSize: buffer.byteLength
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NOVA-Fashion/1.0'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();
    const byteSize = buffer.byteLength;

    // Check for imgbb 503 or empty responses (imgbb service unavailable is ~1115 bytes)
    if (byteSize < 1500 && contentType.includes('image/png') && imageUrl.includes('ibb.co')) {
      throw new Error(`Broken image hosting: received error placeholder (${byteSize} bytes)`);
    }

    if (byteSize === 0) {
      throw new Error('Downloaded 0 bytes from image URL');
    }

    const base64 = Buffer.from(buffer).toString('base64');
    return {
      base64,
      mimeType: contentType.split(';')[0].trim(),
      byteSize
    };
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Calls Gemini Vision with model fallback and structured parsing.
 */
export async function classifyProductWithGemini(
  productName: string,
  category: string,
  subcategory: string,
  description: string,
  imagePayload: { base64: string; mimeType: string }
): Promise<AudienceClassificationResult> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }

  const models = Array.from(new Set([
    (process.env.GEMINI_MODEL || GEMINI_MODEL).trim(),
    ...DEFAULT_FALLBACK_MODELS
  ].filter(Boolean)));

  const productContext = `
PRODUCT METADATA FOR CONTEXT:
- Title / Name: "${productName || 'Unknown'}"
- Product Category: "${category || 'Unknown'}"
- Subcategory: "${subcategory || 'Unknown'}"
- Description: "${description || 'None'}"
`;

  let lastError: Error | null = null;

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: CLASSIFICATION_PROMPT + '\n' + productContext },
                {
                  inlineData: {
                    mimeType: imagePayload.mimeType.startsWith('image/') ? imagePayload.mimeType : 'image/jpeg',
                    data: imagePayload.base64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Gemini ${model} HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      }

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error(`Gemini ${model} returned empty content parts`);
      }

      const parsed = JSON.parse(rawText);
      const rawGender = String(parsed.gender || 'Unknown').trim();
      let gender: AudienceClassificationResult['gender'] = 'Unknown';
      if (/^women$/i.test(rawGender)) gender = 'Women';
      else if (/^men$/i.test(rawGender)) gender = 'Men';
      else if (/^unisex$/i.test(rawGender)) gender = 'Unisex';
      else gender = 'Unknown';

      const confidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
        : 60;

      const reason = typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim()
        : 'Garment design and construction analysis.';

      let classificationStatus: 'verified' | 'unknown' =
        parsed.classificationStatus === 'verified' && gender !== 'Unknown' && confidence >= 70
          ? 'verified'
          : 'unknown';

      return {
        gender,
        confidence,
        reason,
        classificationStatus,
        model,
        analyzedAt: new Date().toISOString()
      };
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      console.warn(`[Gemini Classifier] Model ${model} failed: ${err.message}. Retrying fallback...`);
    }
  }

  throw lastError || new Error('All Gemini models failed to classify product');
}
