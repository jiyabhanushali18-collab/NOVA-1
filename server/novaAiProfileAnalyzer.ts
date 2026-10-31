import { DEFAULT_FALLBACK_MODELS, GEMINI_MODEL } from './wardrobeAnalyzer';

export interface RawGeminiProfileOutput {
  bodyShape?: string;
  bodyShapeConfidence?: number;
  bodyShapeExplanation?: string;
  skinTone?: string;
  undertone?: string;
  skinToneConfidence?: number;
  skinToneExplanation?: string;
  suggestedSize?: string;
  sizeConfidence?: number;
  sizeExplanation?: string;
}

export interface ValidatedNovaProfile {
  bodyShape: 'Hourglass' | 'Pear' | 'Inverted Triangle' | 'Rectangle' | 'Apple' | 'Athletic' | 'Unknown';
  bodyShapeConfidence: number;
  bodyShapeExplanation: string;
  skinTone: 'Fair' | 'Light' | 'Medium' | 'Olive' | 'Tan' | 'Deep' | 'Unknown';
  undertone: 'Warm' | 'Cool' | 'Neutral' | 'Unknown';
  skinToneConfidence: number;
  skinToneExplanation: string;
  suggestedSize: 'XS' | 'S' | 'M' | 'L' | 'unknown';
  sizeConfidence: number;
  sizeExplanation: string;
  analyzedAt: string;
}

const SUPPORTED_BODY_SHAPES = [
  'Hourglass',
  'Pear',
  'Inverted Triangle',
  'Rectangle',
  'Apple',
  'Athletic',
  'Unknown'
] as const;

const SUPPORTED_SKIN_TONES = [
  'Fair',
  'Light',
  'Medium',
  'Olive',
  'Tan',
  'Deep',
  'Unknown'
] as const;

const SUPPORTED_UNDERTONES = [
  'Warm',
  'Cool',
  'Neutral',
  'Unknown'
] as const;

const SUPPORTED_SIZES = ['XS', 'S', 'M', 'L', 'unknown'] as const;

const normalizeBodyShape = (value?: string): ValidatedNovaProfile['bodyShape'] => {
  if (!value) return 'Unknown';
  const lower = value.toLowerCase().trim();
  if (lower.includes('hourglass')) return 'Hourglass';
  if (lower.includes('pear') || lower.includes('triangle') && !lower.includes('inverted')) return 'Pear';
  if (lower.includes('inverted')) return 'Inverted Triangle';
  if (lower.includes('rectangle') || lower.includes('straight') || lower.includes('column')) return 'Rectangle';
  if (lower.includes('apple') || lower.includes('round') || lower.includes('oval')) return 'Apple';
  if (lower.includes('athletic') || lower.includes('muscular')) return 'Athletic';
  return 'Unknown';
};

const normalizeSkinTone = (value?: string): ValidatedNovaProfile['skinTone'] => {
  if (!value) return 'Unknown';
  const lower = value.toLowerCase().trim();
  if (lower.includes('fair') || lower.includes('porcelain') || lower.includes('pale')) return 'Fair';
  if (lower.includes('light')) return 'Light';
  if (lower.includes('olive')) return 'Olive';
  if (lower.includes('tan') || lower.includes('bronze') || lower.includes('wheatish') || lower.includes('honey')) return 'Tan';
  if (lower.includes('deep') || lower.includes('dark') || lower.includes('rich') || lower.includes('ebony')) return 'Deep';
  if (lower.includes('medium')) return 'Medium';
  return 'Unknown';
};

const normalizeUndertone = (value?: string): ValidatedNovaProfile['undertone'] => {
  if (!value) return 'Unknown';
  const lower = value.toLowerCase().trim();
  if (lower.includes('warm') || lower.includes('golden') || lower.includes('yellow')) return 'Warm';
  if (lower.includes('cool') || lower.includes('pink') || lower.includes('red') || lower.includes('blue')) return 'Cool';
  if (lower.includes('neutral') || lower.includes('olive')) return 'Neutral';
  return 'Unknown';
};

const normalizeSuggestedSize = (value?: string): ValidatedNovaProfile['suggestedSize'] => {
  if (!value) return 'unknown';
  const upper = value.toUpperCase().trim();
  if (upper === 'XS') return 'XS';
  if (upper === 'S') return 'S';
  if (upper === 'M') return 'M';
  if (upper === 'L') return 'L';
  if (upper === 'UNKNOWN' || upper === 'UNKNOWN/UNSURE') return 'unknown';
  return 'unknown';
};

const clampConfidence = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return Math.max(10, Math.min(100, Math.round(value)));
  }
  return fallback;
};

/**
 * Analyses a user photograph using Gemini Vision strictly for personal style profile.
 * - Extracts body shape, skin tone, undertone, and tentative size estimate.
 * - Adheres strictly to visual styling guidelines without demographic inference or false tape measurements.
 */
export async function analyzeUserProfileWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<ValidatedNovaProfile> {
  // Strip data URL header if present and validate payload first
  const base64Data = imageBase64 && imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  if (!base64Data || base64Data.trim().length < 50) {
    throw new Error('Invalid or empty image payload.');
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const prompt = `
You are the NOVA AI Visual Fashion Intelligence Specialist.
Analyze the person in this photograph solely for personal fashion styling, colour harmony, and silhouette compatibility.

Strict Guidelines:
1. BODY SHAPE: Analyze visible geometric silhouette proportions (shoulder width, waist definition, hip line).
   - Supported categories: "Hourglass", "Pear", "Inverted Triangle", "Rectangle", "Apple", "Athletic", "Unknown".
   - Account for camera angle, pose, and obscuring clothing.
   - Do NOT invent or claim precise physical tape measurements.
2. SKIN TONE & UNDERTONE: Analyze visible skin coloration under available ambient lighting strictly for clothing colour compatibility.
   - Skin tone categories: "Fair", "Light", "Medium", "Olive", "Tan", "Deep", "Unknown".
   - Undertone categories: "Warm", "Cool", "Neutral", "Unknown".
   - Do NOT infer ethnicity, race, ancestry, nationality, or any sensitive demographic attributes.
3. CLOTHING SIZE: Provide a tentative visual clothing size estimate only if sufficient visual evidence exists.
   - Allowed values: "XS", "S", "M", "L", or "unknown".
   - Explain clearly that this is a tentative visual estimate as photographs cannot reliably establish exact garment sizing.
4. CONFIDENCE & EXPLANATIONS: Return honest confidence percentages (0-100) and brief, objective fashion-styling explanations.

Respond strictly with valid JSON matching this schema:
{
  "bodyShape": "Hourglass | Pear | Inverted Triangle | Rectangle | Apple | Athletic | Unknown",
  "bodyShapeConfidence": 85,
  "bodyShapeExplanation": "Shoulders and hips appear roughly balanced with defined waistline.",
  "skinTone": "Medium | Fair | Light | Olive | Tan | Deep | Unknown",
  "undertone": "Warm | Cool | Neutral | Unknown",
  "skinToneConfidence": 80,
  "skinToneExplanation": "Warm golden undertones visible under natural light, harmonious with earth tones.",
  "suggestedSize": "XS | S | M | L | unknown",
  "sizeConfidence": 65,
  "sizeExplanation": "Tentative visual estimate based on frame; verify with garment measurements."
}
`;

  const models = Array.from(new Set([
    (process.env.GEMINI_MODEL || GEMINI_MODEL).trim(),
    ...DEFAULT_FALLBACK_MODELS
  ].filter(Boolean)));

  let lastError: Error | null = null;

  for (const model of models) {
    const modelStart = Date.now();
    try {
      console.log(`[NOVA AI Profile Analyzer] Attempting Gemini model: ${model}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
                    data: base64Data
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
      const elapsed = Date.now() - modelStart;

      console.log(`[NOVA AI Profile Analyzer] Model ${model} responded with HTTP ${response.status} in ${elapsed}ms`);

      if (response.status === 404 || response.status === 429) {
        console.warn(`[NOVA AI Profile Analyzer] Model ${model} unavailable (HTTP ${response.status}). Trying next model...`);
        lastError = new Error(`Model ${model} returned HTTP ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const responseBody = await response.json();
      let text = responseBody?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      if (text.startsWith('```json')) text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      else if (text.startsWith('```')) text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');

      const parsed: RawGeminiProfileOutput = JSON.parse(text);

      const validated: ValidatedNovaProfile = {
        bodyShape: normalizeBodyShape(parsed.bodyShape),
        bodyShapeConfidence: clampConfidence(parsed.bodyShapeConfidence, 70),
        bodyShapeExplanation: parsed.bodyShapeExplanation?.trim() || 'Visual proportions analyzed for silhouette harmony.',
        skinTone: normalizeSkinTone(parsed.skinTone),
        undertone: normalizeUndertone(parsed.undertone),
        skinToneConfidence: clampConfidence(parsed.skinToneConfidence, 70),
        skinToneExplanation: parsed.skinToneExplanation?.trim() || 'Analyzed under available ambient lighting for color pairing.',
        suggestedSize: normalizeSuggestedSize(parsed.suggestedSize),
        sizeConfidence: clampConfidence(parsed.sizeConfidence, 50),
        sizeExplanation: parsed.sizeExplanation?.trim() || 'Tentative visual estimate; confirm using garment size charts.',
        analyzedAt: new Date().toISOString()
      };

      console.log(`[NOVA AI Profile Analyzer] Analysis completed successfully via ${model}: Shape=${validated.bodyShape}, Tone=${validated.skinTone}/${validated.undertone}, Size=${validated.suggestedSize}`);
      return validated;
    } catch (err: any) {
      const elapsed = Date.now() - modelStart;
      console.warn(`[NOVA AI Profile Analyzer] Model ${model} failed after ${elapsed}ms:`, err.message || err);
      lastError = err;
      continue;
    }
  }

  throw new Error(
    lastError?.message || 'NOVA AI profile visual analysis failed across all available Gemini models.'
  );
}
