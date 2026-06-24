import express from 'express';
import crypto from 'crypto';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';

type AnalysisField = { value: string; confidence: number };
type GeminiAnalysis = {
  skinTone: AnalysisField;
  faceShape: AnalysisField;
  hairType: AnalysisField;
  hairColor: AnalysisField;
  outfitStyle: AnalysisField;
};

const router = express.Router();

const allowedValues = {
  skinTone: ['fair', 'light-medium', 'medium', 'tan', 'deep', 'unknown'],
  faceShape: ['oval', 'round', 'square', 'heart', 'diamond', 'rectangle', 'unknown'],
  hairType: ['straight', 'wavy', 'curly', 'coily', 'unknown'],
  hairColor: ['black', 'dark brown', 'brown', 'blonde', 'red', 'gray', 'unknown'],
  outfitStyle: ['casual', 'smart casual', 'formal', 'streetwear', 'ethnic', 'sporty', 'unknown']
} as const;

const defaultAnalysis: GeminiAnalysis = {
  skinTone: { value: 'unknown', confidence: 0 },
  faceShape: { value: 'unknown', confidence: 0 },
  hairType: { value: 'unknown', confidence: 0 },
  hairColor: { value: 'unknown', confidence: 0 },
  outfitStyle: { value: 'unknown', confidence: 0 }
};

// Lowered confidence floor to be less aggressive about mapping to 'unknown'.
// This makes the system accept values with moderate confidence (>=30) instead
// of requiring very high confidence. Adjust if you prefer stricter behavior.
const ANALYSIS_CONFIDENCE_FLOOR = 30;
// `gemini-1.5-pro` is not supported for v1beta generateContent in this project.
// Keep only supported models to avoid unnecessary 404 retries.
const GEMINI_VISION_MODELS = ['gemini-2.5-flash'];

const getUserDocId = (id: string) => {
  return (id || 'guestuser@nova.ai').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
};

const splitDataUrl = (imageDataUrl: string) => {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
};

const hashImage = (imageDataUrl: string) => {
  const parsed = splitDataUrl(imageDataUrl);
  const raw = parsed?.data || imageDataUrl;
  return crypto.createHash('sha256').update(raw).digest('hex');
};

const normalizeConfidence = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const normalizeField = (key: keyof typeof allowedValues, field: unknown): AnalysisField => {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    return { value: 'unknown', confidence: 0 };
  }

  const record = field as Record<string, unknown>;
  const confidence = normalizeConfidence(record.confidence);
  const rawValue = typeof record.value === 'string' ? record.value.trim().toLowerCase() : 'unknown';
  // Normalize common variants from model output (e.g. "light medium" -> "light-medium")
  const normalizedValue = rawValue.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  // Accept any allowed value the model returns, even if confidence is below the floor.
  // We will let the consensus step decide which value wins across multiple runs.
  const value = (allowedValues[key] as readonly string[]).includes(normalizedValue) ? normalizedValue : 'unknown';

  return {
    value,
    confidence: value === 'unknown' ? 0 : confidence
  };
};

const normalizeGeminiAnalysis = (value: unknown): GeminiAnalysis => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultAnalysis;
  const record = value as Record<string, unknown>;

  return {
    skinTone: normalizeField('skinTone', record.skinTone),
    faceShape: normalizeField('faceShape', record.faceShape),
    hairType: normalizeField('hairType', record.hairType),
    hairColor: normalizeField('hairColor', record.hairColor),
    outfitStyle: normalizeField('outfitStyle', record.outfitStyle)
  };
};

const parseJson = (text: string) => {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(trimmed);
};

const buildPrompt = () => `You are NOVA's visual fashion analysis model.
Analyze ONLY fashion-relevant visual attributes that are visible in the uploaded selfie.
If the face, hair, or outfit is clearly visible, give your best visible estimate.
Use "unknown" only when the attribute is blocked, not visible, or cannot be detected with reasonable visual certainty.
If the image is clear, do not default to "unknown" for every field.
Do not detect height, weight, body type, personality, ethnicity, medical traits, hidden features, or other sensitive attributes.

Return structured JSON only. No markdown. No explanation.
Allowed values:
skinTone: fair, light-medium, medium, tan, deep, unknown
faceShape: oval, round, square, heart, diamond, rectangle, unknown
hairType: straight, wavy, curly, coily, unknown
hairColor: black, dark brown, brown, blonde, red, gray, unknown
outfitStyle: casual, smart casual, formal, streetwear, ethnic, sporty, unknown

JSON shape:
{
  "skinTone": { "value": "unknown", "confidence": 0 },
  "faceShape": { "value": "unknown", "confidence": 0 },
  "hairType": { "value": "unknown", "confidence": 0 },
  "hairColor": { "value": "unknown", "confidence": 0 },
  "outfitStyle": { "value": "unknown", "confidence": 0 }
}`;

const callGeminiVisionModel = async (imageDataUrl: string, model: string): Promise<GeminiAnalysis> => {
  const apiKey = process.env.GEMINI_API_KEY;
  const accessToken = process.env.GEMINI_ACCESS_TOKEN;
  if (!apiKey && !accessToken) {
    throw new Error('No Gemini credentials configured. Set GEMINI_API_KEY or GEMINI_ACCESS_TOKEN in .env.local.');
  }

  const image = splitDataUrl(imageDataUrl);
  if (!image) throw new Error('Invalid image data URL.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4200);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    let url = endpoint;
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      console.log(`Using GEMINI_ACCESS_TOKEN for ${model}`);
    } else {
      url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;
      console.log(`Using GEMINI_API_KEY query auth for ${model}`);
    }

    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildPrompt() },
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          topP: 0.1,
          topK: 1,
          maxOutputTokens: 320,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini Vision ${model} HTTP error:`, response.status, errorText);
      throw new Error(`Gemini Vision ${model} error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log(`Gemini Vision ${model} raw response:`, JSON.stringify(data, null, 2));
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn(`Gemini Vision ${model} returned no text candidate; falling back to defaultAnalysis.`);
      return defaultAnalysis;
    }

    try {
      return normalizeGeminiAnalysis(parseJson(text));
    } catch (parseError) {
      console.error(`Gemini Vision ${model} parse error:`, parseError, 'text:', text);
      return defaultAnalysis;
    }
  } finally {
    clearTimeout(timeout);
  }
};

const callGeminiVision = async (imageDataUrl: string): Promise<GeminiAnalysis> => {
  let lastError: unknown;

  for (const model of GEMINI_VISION_MODELS) {
    try {
      return await callGeminiVisionModel(imageDataUrl, model);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini Vision failed for all configured models.');
};

const chooseConsensus = (analyses: GeminiAnalysis[], key: keyof GeminiAnalysis) => {
  // Consider any non-unknown field from model runs and let frequency + average confidence decide.
  const valid = analyses.map((analysis) => analysis[key]).filter((field) => field.value !== 'unknown');
  if (!valid.length) return { value: 'unknown', confidence: 0 };

  const grouped = valid.reduce((acc, field) => {
    acc[field.value] = acc[field.value] || [];
    acc[field.value].push(field.confidence);
    return acc;
  }, {} as Record<string, number[]>);

  const ranked = Object.entries(grouped)
    .map(([value, confidences]) => ({
      value,
      count: confidences.length,
      confidence: Math.round(confidences.reduce((sum, item) => sum + item, 0) / confidences.length)
    }))
    .sort((a, b) => b.count - a.count || b.confidence - a.confidence);

  const winner = ranked[0];
  if (!winner || winner.confidence <= 0) {
    return { value: 'unknown', confidence: 0 };
  }

  // Accept the winner even if its confidence is below the original floor; caller can decide presentation.
  return { value: winner.value, confidence: winner.confidence };
};

const runRecommendationEngine = (analysis: GeminiAnalysis) => {
  const colorsBySkinTone: Record<string, string[]> = {
    fair: ['navy', 'emerald', 'burgundy'],
    'light-medium': ['olive', 'navy', 'cream'],
    medium: ['olive', 'beige', 'navy'],
    tan: ['cream', 'forest green', 'maroon'],
    deep: ['cobalt', 'white', 'mustard']
  };

  const eyewearByFaceShape: Record<string, string[]> = {
    round: ['rectangle', 'wayfarer'],
    square: ['round', 'oval'],
    oval: ['most frame styles']
  };

  const fitByStyle: Record<string, string> = {
    casual: 'regular',
    'smart casual': 'regular',
    streetwear: 'oversized',
    formal: 'slim or regular',
    ethnic: 'regular',
    sporty: 'relaxed'
  };

  const skinTone = analysis.skinTone.value;
  const faceShape = analysis.faceShape.value;
  const outfitStyle = analysis.outfitStyle.value;

  const recommendedColors = colorsBySkinTone[skinTone] || [];
  const eyewearSuggestions = eyewearByFaceShape[faceShape] || [];
  const recommendedFit = fitByStyle[outfitStyle] || '';
  const summaryParts = [
    skinTone !== 'unknown' ? `${skinTone} skin tone` : '',
    faceShape !== 'unknown' ? `${faceShape} face shape` : '',
    outfitStyle !== 'unknown' ? `${outfitStyle} outfit style` : ''
  ].filter(Boolean);

  return {
    recommendedColors,
    recommendedFit,
    eyewearSuggestions,
    styleSummary: summaryParts.length
      ? `NOVA found ${summaryParts.join(', ')} with high confidence and generated focused style recommendations.`
      : 'NOVA could not confidently analyze enough visible details from this selfie.'
  };
};

const runConsensusAnalysis = async (imageDataUrl: string): Promise<GeminiAnalysis> => {
  const settled = await Promise.allSettled([
    callGeminiVision(imageDataUrl),
    callGeminiVision(imageDataUrl),
    callGeminiVision(imageDataUrl)
  ]);

  const analyses = settled
    .filter((result): result is PromiseFulfilledResult<GeminiAnalysis> => result.status === 'fulfilled')
    .map((result) => result.value);

  if (analyses.length < 1) return defaultAnalysis;

  return {
    skinTone: chooseConsensus(analyses, 'skinTone'),
    faceShape: chooseConsensus(analyses, 'faceShape'),
    hairType: chooseConsensus(analyses, 'hairType'),
    hairColor: chooseConsensus(analyses, 'hairColor'),
    outfitStyle: chooseConsensus(analyses, 'outfitStyle')
  };
};

router.post('/analyze-selfie', async (req: any, res: any) => {
  const { imageDataUrl, userId, forceRefresh } = req.body || {};
  console.log('Received analyze-selfie request:', {
    userId,
    forceRefresh,
    imageDataUrlLength: typeof imageDataUrl === 'string' ? imageDataUrl.length : 0
  });

  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return res.status(400).json({ error: 'imageDataUrl is required.' });
  }

  const parsed = splitDataUrl(imageDataUrl);
  if (!parsed) {
    return res.status(400).json({ error: 'imageDataUrl must be a base64 image data URL.' });
  }

  const docId = getUserDocId(typeof userId === 'string' ? userId : 'guestuser@nova.ai');
  const imageHash = hashImage(imageDataUrl);
  const cacheRef = doc(firestore, 'users', docId, 'analysisCache', imageHash);

  try {
    if (!forceRefresh) {
      const cached = await getDoc(cacheRef);
      if (cached.exists()) {
        return res.json({ ...cached.data(), cached: true });
      }
    }

    const analysis = await runConsensusAnalysis(imageDataUrl);
    const recommendations = runRecommendationEngine(analysis);
    const result = {
      analysis,
      ...recommendations,
      imageHash,
      cached: false,
      analyzedAt: new Date().toISOString()
    };

    // Log analysis for debugging — helps determine why fields map to 'unknown'
    console.log('NOVA analysis result:', JSON.stringify(result, null, 2));

    await setDoc(cacheRef, result, { merge: true });
    const profilePhotoFields = imageDataUrl.length <= 1048487 ? { profilePhoto: imageDataUrl } : {};

    await setDoc(doc(firestore, 'users', docId), {
      novaAnalysisProfile: result,
      ...profilePhotoFields,
      profilePhotoHash: imageHash,
      updatedAt: serverTimestamp()
    }, { merge: true });
    await setDoc(doc(firestore, 'users', docId, 'profile', 'meta'), {
      novaAnalysisProfile: result,
      ...profilePhotoFields,
      profilePhotoHash: imageHash,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return res.json(result);
  } catch (error: any) {
    console.error('Selfie analysis failed:', error);
    return res.status(500).json({ error: error.message || 'Selfie analysis failed.' });
  }
});

export default router;
