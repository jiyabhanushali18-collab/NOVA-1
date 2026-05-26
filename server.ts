import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI securely server-side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Endpoint for Gemini style chat assistant integration
app.post('/api/chat', async (req: any, res: any) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  if (!ai) {
    return res.json({
      reply: "Hi Pratham! I'm NOVA, your personal AI and AR Optical Assistant. Currently, my API Key is not configured in this preview, but you can add it via Settings Secrets in the AI Studio menu. In the meantime, I can simulate intelligent responses here, or you can interactively explore scanning outfits, virtual try-ons, and detailed clothing combinations using the handy navigation buttons below!"
    });
  }

  try {
    const userPrompt = messages[messages.length - 1]?.content || "Hello";
    
    const systemInstruction = `You are "NOVA" (Next-Gen Optical Vision Assistant), a visionary, conversational, and hyper-intelligent AI and AR style assistant. 
You provide style recommendations, outfit advice, color coordination, and AR try-on feedback. 
Talk with design-focused sophistication, visionary passion, and helpful confidence. 
Keep replies concise, clear, and beautifully structured with linebreaks. Avoid long-winded paragraphs. 
Address the user as Pratham or Arjun (depending on their profile state). Speak like an elite personal curator.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: error.message || 'Error communicating with GenAI model.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NOVA server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
