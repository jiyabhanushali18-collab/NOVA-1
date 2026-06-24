import { NovaStyleAnalysisResult } from '../types';

interface AnalyzeSelfiePayload {
  imageDataUrl: string;
  userId: string;
  forceRefresh?: boolean;
}

const buildUnknownResult = (error?: string): NovaStyleAnalysisResult => ({
  analysis: {
    skinTone: { value: 'unknown', confidence: 0 },
    faceShape: { value: 'unknown', confidence: 0 },
    hairType: { value: 'unknown', confidence: 0 },
    hairColor: { value: 'unknown', confidence: 0 },
    outfitStyle: { value: 'unknown', confidence: 0 }
  },
  recommendedColors: [],
  recommendedFit: '',
  eyewearSuggestions: [],
  styleSummary: error || 'NOVA could not confidently analyze enough visible details from this selfie.',
  error
});

export const analyzeSelfie = async ({
  imageDataUrl,
  userId,
  forceRefresh = false
}: AnalyzeSelfiePayload): Promise<NovaStyleAnalysisResult> => {
  try {
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(imageDataUrl)) {
      throw new Error('Please upload a supported image file so NOVA can send the selfie to Gemini.');
    }

    const response = await fetch('/api/analyze-selfie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl, userId, forceRefresh })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || `Selfie analysis failed with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('NOVA selfie analysis failed:', error);
    return buildUnknownResult(error instanceof Error ? error.message : 'Selfie analysis failed.');
  }
};
