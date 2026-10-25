import express, { Request, Response } from 'express';

const router = express.Router();
const maxImageDataUrlLength = 5 * 1024 * 1024;

router.post('/tryon/score', async (req: Request, res: Response) => {
  const { imageDataUrl, garmentName } = req.body || {};

  if (typeof imageDataUrl !== 'string' || imageDataUrl.length > maxImageDataUrlLength) {
    return res.status(400).json({ error: 'A try-on image under 5 MB is required.' });
  }

  const imageMatch = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!imageMatch) {
    return res.status(400).json({ error: 'The try-on image must be a JPEG, PNG, or WebP data URL.' });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: 'AI style scoring is not configured on the server.' });
  }

  const garmentContext = typeof garmentName === 'string' ? garmentName.trim().slice(0, 80) : '';
  const prompt = [
    'Evaluate the outfit styling visible in this try-on image, not the person.',
    'Score visual outfit coherence, color coordination, and how naturally the garment appears integrated.',
    'Ignore identity, attractiveness, body shape or size, skin tone, and background.',
    'Use the full 0-100 range: low scores for clearly clashing or poorly integrated styling, high scores for cohesive and well-integrated styling.',
    'If the outfit is not clearly visible enough to assess, set assessable to false.',
    garmentContext ? `The selected garment is: ${garmentContext}.` : '',
    'Return only JSON with assessable (boolean), score (integer 0-100), and feedback (one short, constructive sentence).'
  ].filter(Boolean).join(' ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: imageMatch[1], data: imageMatch[2] } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      console.error(`[Try-On Score] Gemini request failed with HTTP ${response.status}.`);
      return res.status(502).json({ error: 'AI style scoring is temporarily unavailable.' });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
      .trim();
    if (!text) {
      return res.status(502).json({ error: 'AI style scoring returned no assessment.' });
    }

    let assessment: { assessable?: unknown; score?: unknown; feedback?: unknown };
    try {
      assessment = JSON.parse(text);
    } catch {
      console.error('[Try-On Score] Gemini returned invalid assessment JSON.');
      return res.status(502).json({ error: 'AI style scoring returned an invalid assessment.' });
    }

    if (assessment.assessable !== true) {
      return res.status(422).json({ error: 'The outfit is not clear enough to score. Try another photo with the outfit fully visible.' });
    }

    if (typeof assessment.score !== 'number' || !Number.isFinite(assessment.score) || assessment.score < 0 || assessment.score > 100) {
      console.error('[Try-On Score] Gemini returned an out-of-range assessment score.');
      return res.status(502).json({ error: 'AI style scoring returned an invalid score.' });
    }

    if (typeof assessment.feedback !== 'string' || !assessment.feedback.trim()) {
      console.error('[Try-On Score] Gemini returned no assessment feedback.');
      return res.status(502).json({ error: 'AI style scoring returned no feedback.' });
    }

    return res.json({
      score: Math.round(assessment.score),
      feedback: assessment.feedback.trim().slice(0, 240)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Try-On Score] Assessment request failed:', message);
    return res.status(502).json({ error: 'AI style scoring is temporarily unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
