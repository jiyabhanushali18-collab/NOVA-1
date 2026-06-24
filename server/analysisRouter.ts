import express from 'express';
import crypto from 'crypto';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { LocalVisionAnalysis, analyzeSelfieLocally } from './localVisionAnalyzer';

const router = express.Router();

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

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const runRecommendationEngine = (analysis: LocalVisionAnalysis) => {
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
    oval: ['most frame styles'],
    rectangle: ['round', 'aviator'],
    diamond: ['oval', 'rimless'],
    heart: ['bottom-heavy', 'round']
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
      ? `NOVA analyzed this selfie locally and found ${summaryParts.join(', ')}.`
      : 'NOVA could not confidently analyze enough visible details from this selfie.'
  };
};

router.post('/analyze-selfie', async (req: any, res: any) => {
  const started = Date.now();
  const { imageDataUrl, userId, forceRefresh } = req.body || {};
  console.log('Received local analyze-selfie request:', {
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
      try {
        const cached = await withTimeout(getDoc(cacheRef), 600);
        if (cached.exists()) {
          return res.json({ ...cached.data(), cached: true });
        }
      } catch (cacheError) {
        console.warn('Skipping analysis cache read:', cacheError);
      }
    }

    const analysis = await analyzeSelfieLocally(imageDataUrl);
    const recommendations = runRecommendationEngine(analysis);
    const result = {
      analysis,
      ...recommendations,
      imageHash,
      cached: false,
      analysisEngine: 'local-cv-sharp-hsv-lab',
      elapsedMs: Date.now() - started,
      analyzedAt: new Date().toISOString()
    };

    console.log('NOVA local analysis result:', JSON.stringify(result, null, 2));

    const profilePhotoFields = imageDataUrl.length <= 1048487 ? { profilePhoto: imageDataUrl } : {};

    Promise.allSettled([
      withTimeout(setDoc(cacheRef, result, { merge: true }), 1200),
      withTimeout(setDoc(doc(firestore, 'users', docId), {
        novaAnalysisProfile: result,
        ...profilePhotoFields,
        profilePhotoHash: imageHash,
        updatedAt: serverTimestamp()
      }, { merge: true }), 1200),
      withTimeout(setDoc(doc(firestore, 'users', docId, 'profile', 'meta'), {
        novaAnalysisProfile: result,
        ...profilePhotoFields,
        profilePhotoHash: imageHash,
        updatedAt: serverTimestamp()
      }, { merge: true }), 1200)
    ]).then((settled) => {
      const rejected = settled.filter((item) => item.status === 'rejected');
      if (rejected.length) console.warn('Local analysis persistence skipped or failed:', rejected);
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Local selfie analysis failed:', error);
    return res.status(422).json({ error: error.message || 'Selfie analysis failed.' });
  }
});

export default router;
