import express from "express";
import { askModel } from "./ollama";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { messages, message } = req.body;

    const latestMessage =
      Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1].content
        : message;

    const sessionId =
      req.ip ||
      req.headers["x-forwarded-for"]?.toString() ||
      "default";

    const reply = await askModel(sessionId, latestMessage);

    res.json({
      reply,
      pairingProducts: [],
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({
      error: error.message,
    });
  }
});

export default router;