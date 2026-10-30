import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { decartKeyPool, classifyDecartError } from './decartKeyPool';

const router = express.Router();

const getAdminSecret = (): string =>
  (process.env.DECART_ADMIN_SECRET || '').trim();

// In-memory IP rate limiter for token minting (abuse prevention)
const tokenRequestTimes = new Map<string, number[]>();
const MAX_TOKEN_REQUESTS_PER_MINUTE = 30;

const rateLimitTokenRequests = (req: Request, res: Response, next: NextFunction) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
    .split(',')[0]
    .trim();

  const now = Date.now();
  const windowStart = now - 60 * 1000;

  const timestamps = (tokenRequestTimes.get(ip) || []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_TOKEN_REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      error: 'Too many AR try-on token requests. Please wait a moment before trying again.',
      category: 'RATE_LIMITED'
    });
  }

  timestamps.push(now);
  tokenRequestTimes.set(ip, timestamps);

  // Periodically clean up old IP entries to prevent memory growth
  if (tokenRequestTimes.size > 2000) {
    for (const [k, ts] of tokenRequestTimes.entries()) {
      const active = ts.filter((t) => t > windowStart);
      if (active.length === 0) tokenRequestTimes.delete(k);
      else tokenRequestTimes.set(k, active);
    }
  }

  next();
};

const verifyAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  const adminSecret = getAdminSecret();
  if (!adminSecret) {
    return res.status(503).json({
      error: 'Administrative access is disabled. Set DECART_ADMIN_SECRET or NOVA_ADMIN_SECRET.'
    });
  }

  const headerSecret = String(req.headers['x-admin-key'] || '').trim();
  const authHeader = String(req.headers['authorization'] || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (headerSecret === adminSecret || bearerToken === adminSecret) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized. Valid administrative credential required.'
  });
};

/**
 * Mint a client token for WebRTC connection to Live VTON AI.
 * Uses DecartKeyPool for atomic selection, quota tracking, and automatic fallback.
 */
const handleTokenRequest = async (req: Request, res: Response) => {
  const clientOrigin = String(req.headers.origin || req.headers.referer || '');
  const authHeader = String(req.headers.authorization || '');
  const userId = authHeader ? 'authenticated-user' : 'guest-user';

  try {
    const result = await decartKeyPool.generateClientToken({
      expiresIn: 300,
      allowedModels: ['lucy-vton-latest'],
      maxSessionDuration: 300,
      userId,
      origin: clientOrigin
    });

    console.log(`[VTON Router] Token created successfully via "${result.credentialId}" (fallbackCount: ${result.fallbackCount}).`);

    return res.json({
      ...result.token,
      credentialId: result.credentialId,
      quotaGroup: result.quotaGroup,
      fallbackCount: result.fallbackCount
    });
  } catch (error: any) {
    console.error('[VTON Router] Token generation error:', error?.message);

    // Secondary fallback: if running locally and network/TLS proxy blocked Decart, try production Render proxy
    if (error?.category === 'NETWORK_FAILURE' || error?.message?.includes('fetch failed')) {
      try {
        console.warn('[VTON Router] Attempting fallback token proxy from production Render...');
        const fallback = await axios.get('https://nova-1-1.onrender.com/api/vton/token', {
          timeout: 10000,
          headers: { Accept: 'application/json' }
        });
        if (fallback.data && (fallback.data.apiKey || fallback.data.token)) {
          return res.json(fallback.data);
        }
      } catch (proxyError: any) {
        console.warn('[VTON Router] Proxy fallback also failed:', proxyError?.message);
      }
    }

    const statusCode = error?.status || 500;
    const sanitizedError = error?.message || 'Failed to create live AI token.';

    return res.status(statusCode).json({
      error: sanitizedError,
      category: error?.category || 'UNKNOWN',
      fallbackCount: error?.fallbackCount || 0
    });
  }
};

router.get(['/vton/token', '/token', '/decart/token'], rateLimitTokenRequests, handleTokenRequest);
router.post(['/vton/token', '/token', '/decart/token'], rateLimitTokenRequests, handleTokenRequest);

/**
 * Receives client-side session runtime events (such as WebRTC terminal close reasons)
 * to immediately adjust credential eligibility and quota group status.
 */
router.post(['/vton/session-event', '/decart/session-event'], async (req: Request, res: Response) => {
  try {
    const { credentialId, event, reason } = req.body;
    if (credentialId && typeof credentialId === 'string') {
      const sanitizedReason = String(reason || '').replace(/[\r\n]/g, ' ').slice(0, 120);
      console.log(`[VTON Router] Client session event: credentialId="${credentialId}", event="${event}", reason="${sanitizedReason}"`);
      decartKeyPool.recordSessionFeedback(credentialId, event, reason);
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record session event.' });
  }
});

/**
 * Admin: Get sanitized status report for all credentials in the pool.
 * Does NOT expose raw secret API keys.
 */
router.get('/vton/admin/pool-status', verifyAdminAccess, (_req: Request, res: Response) => {
  const status = decartKeyPool.getStatusReport();
  return res.json(status);
});

/**
 * Admin: Reset cooldown and health status across all or specific credentials.
 */
router.post('/vton/admin/reset-health', verifyAdminAccess, (req: Request, res: Response) => {
  const { credentialId } = req.body;
  decartKeyPool.resetHealth(credentialId);
  return res.json({
    ok: true,
    message: credentialId ? `Credential "${credentialId}" health reset.` : 'All credentials and quota groups reset to healthy.',
    status: decartKeyPool.getStatusReport()
  });
});

/**
 * Admin: Dynamically enable or disable a credential.
 */
router.post('/vton/admin/toggle-key', verifyAdminAccess, (req: Request, res: Response) => {
  const { id, enabled } = req.body;
  if (!id || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Missing "id" string or "enabled" boolean.' });
  }

  const success = decartKeyPool.setCredentialEnabled(id, enabled);
  if (!success) {
    return res.status(404).json({ error: `Credential with id "${id}" not found.` });
  }

  return res.json({
    ok: true,
    message: `Credential "${id}" ${enabled ? 'enabled' : 'disabled'}.`,
    status: decartKeyPool.getStatusReport()
  });
});

/**
 * Proxy image from external URL to base64 Data URL so the client can safely pass it
 * without cross-origin browser fetch blocking.
 */
router.post(['/vton/proxy-image', '/decart/proxy-image'], async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'imageUrl string is required' });
    }

    if (imageUrl.startsWith('data:')) {
      return res.json({ dataUrl: imageUrl });
    }

    let fetchUrl = imageUrl.trim();
    if (fetchUrl.startsWith('/')) {
      const publicBase = (process.env.PUBLIC_APP_URL || 'https://nova.nova-fashion.workers.dev').trim().replace(/\/$/, '');
      fetchUrl = `${publicBase}${fetchUrl}`;
    }

    if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Valid HTTP or HTTPS imageUrl is required' });
    }

    const response = await axios.get(fetchUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 10 * 1024 * 1024,
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
