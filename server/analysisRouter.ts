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

const ANALYSIS_CONFIDENCE_FLOOR = 50;
const GEMINI_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

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
  const value = (allowedValues[key] as readonly string[]).includes(rawValue) && confidence >= ANALYSIS_CONFIDENCE_FLOOR ? rawValue : 'unknown';

  return {
    value,
    confidence: value === 'unknown' ? Math.min(confidence, ANALYSIS_CONFIDENCE_FLOOR - 1) : confidence
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
Use your best visible estimate when a face, hair, or outfit is reasonably visible. Use "unknown" only when the attribute is blocked, out of frame, too blurry, or genuinely not visible.
Confidence should be 50-100 for visible estimates and 0-49 for unknown.
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
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured. Set it in .env.local or .env.');
  }

  const image = splitDataUrl(imageDataUrl);
  if (!image) throw new Error('Invalid image data URL.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4200);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
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
      throw new Error(`Gemini Vision ${model} error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return defaultAnalysis;
    return normalizeGeminiAnalysis(parseJson(text));
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
  const valid = analyses.map((analysis) => analysis[key]).filter((field) => field.value !== 'unknown' && field.confidence >= ANALYSIS_CONFIDENCE_FLOOR);
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
  if (!winner || winner.confidence < ANALYSIS_CONFIDENCE_FLOOR) {
    return { value: 'unknown', confidence: winner?.confidence ? Math.min(winner.confidence, ANALYSIS_CONFIDENCE_FLOOR - 1) : 0 };
  }

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

    await setDoc(cacheRef, result, { merge: true });
    await setDoc(doc(firestore, 'users', docId), {
      novaAnalysisProfile: result,
      profilePhoto: imageDataUrl,
      profilePhotoHash: imageHash,
      updatedAt: serverTimestamp()
    }, { merge: true });
    await setDoc(doc(firestore, 'users', docId, 'profile', 'meta'), {
      novaAnalysisProfile: result,
      profilePhoto: imageDataUrl,
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
