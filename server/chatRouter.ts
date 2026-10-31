import express from "express";
import { askModel, ChatAnalysisContext } from "./ollama";
import { analyzeUserProfileWithGemini } from "./novaAiProfileAnalyzer";
import { getNovaAiRecommendations } from "./novaAiRecommender";

const router = express.Router();

/**
 * POST /api/chat/analyze-profile
 * Dedicated NOVA AI user photograph analysis using Gemini Vision.
 */
router.post("/chat/analyze-profile", async (req, res) => {
  const startTime = Date.now();
  console.log(`[NOVA AI Router] Received POST /api/chat/analyze-profile at ${new Date().toISOString()}`);

  try {
    const { imageBase64, mimeType } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 50) {
      console.warn(`[NOVA AI Router] Rejected invalid or empty image payload`);
      return res.status(400).json({
        success: false,
        error: 'A valid imageBase64 payload is required for NOVA AI personal profile analysis.'
      });
    }

    console.log(`[NOVA AI Router] Image validation completed (mimeType: ${mimeType || 'image/jpeg'}, payloadLength: ${imageBase64.length} chars)`);

    const profile = await analyzeUserProfileWithGemini(
      imageBase64,
      typeof mimeType === 'string' ? mimeType : 'image/jpeg'
    );

    const elapsed = Date.now() - startTime;
    console.log(`[NOVA AI Router] Analysis completed in ${elapsed}ms: Shape=${profile.bodyShape}, Tone=${profile.skinTone}/${profile.undertone}, Size=${profile.suggestedSize}`);

    res.json({
      success: true,
      profile
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[NOVA AI Router] Analysis failed after ${elapsed}ms:`, error.message || error);
    res.status(500).json({
      success: false,
      error: error.message || 'NOVA AI personal visual analysis failed.'
    });
  }
});

/**
 * POST /api/chat/recommendations
 * Dedicated NOVA AI product recommendations based on personal profile & catalogue aiAttributes.
 */
router.post("/chat/recommendations", async (req, res) => {
  try {
    const { profile, limit } = req.body || {};

    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'A valid personal profile object is required.'
      });
    }

    const recommendations = await getNovaAiRecommendations(
      profile,
      typeof limit === 'number' && limit > 0 ? limit : 8
    );

    res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error: any) {
    console.error('[NOVA AI] Product recommendations error:', error.message || error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate NOVA AI product recommendations.'
    });
  }
});

/**
 * POST /api/chat
 * Conversational interaction with fine-tuned NOVA AI styling oracle.
 */
router.post("/chat", async (req, res) => {
  try {
    const { messages, message, bodyAnalysis, styleProfile, personalProfile } = req.body || {};

    const latestMessage =
      Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1].content
        : message;

    if (!latestMessage || typeof latestMessage !== 'string' || !latestMessage.trim()) {
      return res.status(400).json({ error: 'A valid message string is required.' });
    }

    const sessionId =
      req.ip ||
      req.headers["x-forwarded-for"]?.toString() ||
      "default";

    // Format personal profile into styling context if available
    let customContext: ChatAnalysisContext = {
      bodyAnalysis,
      styleProfile
    };

    if (personalProfile && typeof personalProfile === 'object') {
      const shape = personalProfile.userConfirmedBodyShape || personalProfile.bodyShape;
      const tone = personalProfile.userConfirmedSkinTone || personalProfile.skinTone;
      const undertone = personalProfile.userConfirmedUndertone || personalProfile.undertone;
      const size = personalProfile.userConfirmedSize || personalProfile.suggestedSize;

      customContext.styleProfile = {
        ...customContext.styleProfile,
        skinTone: tone ? { value: `${tone} (${undertone || 'Natural'} undertone)` } : undefined,
        recommendedFit: shape ? `${shape} body silhouette balancing` : undefined,
      };
    }

    const reply = await askModel(sessionId, latestMessage, customContext);

    res.json({
      reply,
      pairingProducts: [],
    });
  } catch (error: any) {
    console.error('Chat error:', error.message || error);
    res.status(503).json({
      error: error.message || 'Chat service unavailable',
    });
  }
});

export default router;
