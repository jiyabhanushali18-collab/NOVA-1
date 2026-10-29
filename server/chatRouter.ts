import express from "express";
import { askModel, ChatAnalysisContext } from "./ollama";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { messages, message, bodyAnalysis, styleProfile } = req.body || {};

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

    const context: ChatAnalysisContext = {
      bodyAnalysis,
      styleProfile
    };

    const reply = await askModel(sessionId, latestMessage, context);

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
