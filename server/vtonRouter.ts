import express from 'express';
import { createDecartClient as createVtonClient } from '@decartai/sdk';
import axios from 'axios';

const router = express.Router();

const getApiKey = () => {
  return process.env.VTON_API_KEY || 'dct_nova_icMPpxWjNuwXYZltqFExguJrjleyiKwmwbfkiCThSdLMlnhMbskdUfUeYuYCluxY';
};

/**
 * Mint a client token for WebRTC connection to Live VTON AI
 */
router.get(['/vton/token', '/token'], async (_req, res) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Live VTON API key is not configured on the server.' });
    }

    const aiClient = createVtonClient({ apiKey });
    const token = await aiClient.tokens.create({
      expiresIn: 3600,
    });

    res.json(token);
  } catch (error: any) {
    console.error('Error creating live AI token:', error);
    res.status(500).json({
      error: error?.message || 'Failed to create live AI token. Check server configuration.'
    });
  }
});

/**
 * Proxy image from external URL to base64 Data URL so the client can safely pass it
 * without cross-origin browser fetch blocking.
 */
router.post('/vton/proxy-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'imageUrl string is required' });
    }

    if (imageUrl.startsWith('data:')) {
      return res.json({ dataUrl: imageUrl });
    }

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(response.data).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    res.json({ dataUrl });
  } catch (error: any) {
    console.error('Error proxying garment image for Live AI:', error?.message);
    res.status(500).json({ error: 'Failed to fetch and convert garment image.' });
  }
});

export default router;
