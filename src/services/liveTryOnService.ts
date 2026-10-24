import { apiUrl, PRODUCTION_API_URL } from './apiClient';

export interface LiveTryOnSessionConfig {
  videoElement: HTMLVideoElement;
  garmentImage?: File | Blob | string | null;
  facingMode?: 'user' | 'environment';
  onStatusChange?: (status: string) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
}

export interface LiveTryOnSessionHandle {
  client: any;
  localStream: MediaStream;
  stop: () => void;
  setGarment: (garment: File | Blob | string | null) => Promise<void>;
  flipCamera: () => Promise<void>;
}

// In-memory cache for processed garment blobs so switching garments is instant
const garmentCache = new Map<string, Blob | string>();

// Cached session token to eliminate duplicate network handshakes
let cachedTokenState: { token: string; expiresAt: number } | null = null;
let activeCredentialId: string | null = null;

export function invalidateLiveTryOnToken(): void {
  cachedTokenState = null;
  activeCredentialId = null;
}

export const DEFAULT_GARMENTS = [
  {
    id: 'Lavender',
    name: 'Lavender Hoodie',
    category: 'Casual wear',
    img: '/garments/lavender.jpg',
  },
  {
    id: 'Mint Green',
    name: 'Denim Jacket',
    category: 'Streetwear',
    img: '/garments/mint.jpg',
  },
  {
    id: 'Beige',
    name: 'Beige Shirt',
    category: 'Smart Casual',
    img: '/garments/beige.jpg',
  },
];

export const DEFAULT_MODELS: Record<string, string> = {
  Lavender: '/garments/model-lavender.jpg',
  'Mint Green': '/garments/model-mint.jpg',
  Beige: '/garments/model-beige.jpg',
};

/**
 * Fetch a mint client session token with multi-tier fallback, caching,
 * and retry handling to eliminate "fetch failed" on slow connections or cold starts.
 */
export async function getLiveTryOnToken(): Promise<string> {
  const now = Date.now();
  if (cachedTokenState && cachedTokenState.expiresAt > now + 60000) {
    return cachedTokenState.token;
  }

  const candidateEndpoints: string[] = [];

  // 1. Configured / platform apiUrl
  const standardUrl = apiUrl('/api/vton/token');
  if (standardUrl) candidateEndpoints.push(standardUrl);

  // 2. Production Render cloud backend (always available & has CORS enabled)
  candidateEndpoints.push(`${PRODUCTION_API_URL}/api/vton/token`);

  // 3. Local Node server fallbacks if running in browser
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port && port !== '3000') {
      candidateEndpoints.push(`http://${window.location.hostname}:3000/api/vton/token`);
    }
    candidateEndpoints.push('http://localhost:3000/api/vton/token');
    candidateEndpoints.push('http://127.0.0.1:3000/api/vton/token');
  }

  const uniqueEndpoints = Array.from(new Set(candidateEndpoints.filter(Boolean)));
  let lastError: any = null;

  for (const endpoint of uniqueEndpoints) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutMs = attempt === 0 ? 12000 : 25000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);

        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(errorJson.error || `Server HTTP ${response.status}`);
        }

        const data = await response.json();
        const token = data.apiKey || data.token;
        if (!token) {
          throw new Error('Server returned empty token');
        }

        if (data.credentialId) {
          activeCredentialId = data.credentialId;
        }

        // Cache token for 45 minutes
        cachedTokenState = {
          token,
          expiresAt: now + 45 * 60 * 1000,
        };

        return token;
      } catch (err: any) {
        lastError = err;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }
  }

  const friendlyMessage =
    lastError?.name === 'AbortError'
      ? 'AI server is warming up. Tap Try On Live to retry.'
      : lastError?.message && !lastError.message.includes('fetch')
      ? lastError.message
      : 'Unable to connect to AI server. Tap to retry.';

  throw new Error(friendlyMessage);
}

/**
 * Lightweight garment compression to ~30-40KB.
 * Keeps CPU usage under 1% and prevents WebRTC / WebSocket starvation.
 */
export async function compressGarmentImage(
  source: File | Blob | string,
  maxDimension = 480,
  quality = 0.75
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrlToRevoke: string | null = null;

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
          return resolve(source instanceof Blob ? source : new Blob());
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
            if (blob) {
              resolve(blob);
            } else {
              resolve(source instanceof Blob ? source : new Blob());
            }
          },
          'image/jpeg',
          quality
        );
      } catch (e) {
        if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
        reject(e);
      }
    };

    img.onerror = () => {
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
      if (source instanceof Blob) resolve(source);
      else reject(new Error('Failed to load image for compression'));
    };

    if (source instanceof Blob) {
      objectUrlToRevoke = URL.createObjectURL(source);
      img.src = objectUrlToRevoke;
    } else if (typeof source === 'string') {
      img.src = source;
    }
  });
}

/**
 * Normalizes garment source into an optimized format ready for the Realtime client.
 * Uses caching to avoid repeated fetches or CPU spikes.
 */
export async function prepareGarmentForLiveTryOn(
  garment: File | Blob | string
): Promise<File | Blob | string> {
  if (typeof garment === 'string' && garmentCache.has(garment)) {
    return garmentCache.get(garment)!;
  }

  try {
    if (garment instanceof File || garment instanceof Blob) {
      const compressed = await compressGarmentImage(garment);
      return compressed;
    }

    if (typeof garment === 'string') {
      // Data URL or Blob URL: compress directly
      if (garment.startsWith('data:') || garment.startsWith('blob:')) {
        const compressed = await compressGarmentImage(garment);
        garmentCache.set(garment, compressed);
        return compressed;
      }

      // Local static assets (/garments/lavender.jpg etc.): load directly on Canvas without proxy
      if (garment.startsWith('/') || garment.startsWith('./')) {
        try {
          const compressed = await compressGarmentImage(garment);
          garmentCache.set(garment, compressed);
          return compressed;
        } catch (e) {
          console.warn('Direct local asset canvas load warning, trying fetch:', e);
        }
      }

      // Remote or local URL: try direct fetch
      try {
        const res = await fetch(garment, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          const compressed = await compressGarmentImage(blob);
          garmentCache.set(garment, compressed);
          return compressed;
        }
      } catch {
        // Fallback to proxy if remote CORS blocked
      }

      // Proxy fallback for external URLs
      const proxyEndpoints = [
        apiUrl('/api/vton/proxy-image'),
        `${PRODUCTION_API_URL}/api/vton/proxy-image`,
      ];

      for (const endpoint of Array.from(new Set(proxyEndpoints))) {
        try {
          const proxyRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: garment }),
          });
          if (proxyRes.ok) {
            const proxyData = await proxyRes.json();
            if (proxyData.dataUrl) {
              const compressed = await compressGarmentImage(proxyData.dataUrl);
              garmentCache.set(garment, compressed);
              return compressed;
            }
          }
        } catch (e) {
          console.warn('Proxy garment image failed on', endpoint, e);
        }
      }
    }
  } catch (err) {
    console.warn('Image optimization skipped, using raw source:', err);
  }

  return garment;
}

/**
 * Pre-cache default garments in background so switching garments is instantaneous
 */
export async function preloadDefaultGarments(): Promise<void> {
  for (const item of DEFAULT_GARMENTS) {
    if (!garmentCache.has(item.img)) {
      try {
        await prepareGarmentForLiveTryOn(item.img);
      } catch (err) {
        console.warn('Preload warning for', item.id, err);
      }
    }
  }
}

// Warm up default garment cache on idle
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => preloadDefaultGarments());
  } else {
    setTimeout(preloadDefaultGarments, 1500);
  }
}

/**
 * Capture snapshot from an HTMLVideoElement
 */
export function captureVideoFrame(video: HTMLVideoElement): string | null {
  if (!video || !video.videoWidth || !video.videoHeight) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Start a real-time Virtual Try-On session.
 * Connects WebRTC FIRST with zero payload to prevent handshake timeouts.
 * Sends garment asynchronously once the channel is established.
 */
export async function startLiveTryOnSession(
  config: LiveTryOnSessionConfig
): Promise<LiveTryOnSessionHandle> {
  let currentFacingMode = config.facingMode || 'user';
  config.onStatusChange?.('Requesting camera access...');

  const { createDecartClient: createVtonClient, models, createConsoleLogger } = await import('@decartai/sdk');

  const model = models.realtime('lucy-vton-latest');
  const captureFps = typeof model.fps === 'number' ? model.fps : (model.fps?.ideal || 30);

  // Match model dimensions
  let localStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: currentFacingMode,
      width: model.width || 1280,
      height: model.height || 720,
      frameRate: captureFps,
    },
  });

  config.videoElement.srcObject = localStream;
  config.videoElement.play().catch((err) => {
    console.warn('Camera preview play error:', err);
  });
  config.onLocalStream?.(localStream);
  config.onStatusChange?.('Connecting to AI...');

  // Use error logger to silence routine disconnect warnings
  const logger = createConsoleLogger('error');

  const client = createVtonClient({
    apiKeyProvider: getLiveTryOnToken,
    logger,
  });

  let isDestroyed = false;

  // Connect WebRTC stream cleanly without giant initial payload.
  // This eliminates "WebSocket opening handshake timed out" errors.
  let realtimeClient;
  try {
    realtimeClient = await client.realtime.connect(localStream, {
      model,
      onRemoteStream: (transformedStream: MediaStream) => {
        if (isDestroyed) return;
        config.videoElement.srcObject = transformedStream;
        config.videoElement.play().catch((err) => {
          console.warn('Video play error:', err);
        });
        config.onStatusChange?.('Live AI Active');
        config.onConnected?.();
      },
      onConnectionChange: (state) => {
        if (isDestroyed) return;
        if (state === 'reconnecting') {
          config.onStatusChange?.('Reconnecting AI...');
        } else if (state === 'disconnected') {
          config.onStatusChange?.('Disconnected');
        }
      },
    });
  } catch (error) {
    invalidateLiveTryOnToken();
    if (activeCredentialId) {
      fetch(apiUrl('/api/vton/session-event'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId: activeCredentialId,
          event: 'session_error',
          reason: (error as any)?.message || 'connection_failure'
        }),
      }).catch(() => {});
    }
    localStream.getTracks().forEach((track) => track.stop());
    if (config.videoElement.srcObject === localStream) {
      config.videoElement.srcObject = null;
    }
    throw error;
  }

  // Serialized, non-blocking garment sender
  let isUpdatingGarment = false;
  let pendingGarment: File | Blob | string | null = null;

  const setGarment = async (garment: File | Blob | string | null) => {
    if (isDestroyed || !realtimeClient.isConnected()) return;

    pendingGarment = garment;
    if (isUpdatingGarment) {
      return;
    }

    isUpdatingGarment = true;
    try {
      while (pendingGarment !== null && !isDestroyed && realtimeClient.isConnected()) {
        const nextGarment = pendingGarment;
        pendingGarment = null;

        config.onStatusChange?.('Applying garment to AI...');
        if (!nextGarment) {
          await realtimeClient.setImage(null);
        } else {
          const prepared = await prepareGarmentForLiveTryOn(nextGarment);
          await realtimeClient.setImage(prepared);
        }
        config.onStatusChange?.('Live AI Active');
      }
    } catch (err: any) {
      console.warn('Error updating garment:', err);
      config.onStatusChange?.('Live AI Active');
    } finally {
      isUpdatingGarment = false;
    }
  };

  // If a garment was requested at start, send it once WebRTC connection is active
  if (config.garmentImage) {
    setTimeout(() => {
      if (!isDestroyed && realtimeClient.isConnected()) {
        setGarment(config.garmentImage);
      }
    }, 250);
  }

  const stop = () => {
    isDestroyed = true;
    try {
      if (realtimeClient && typeof realtimeClient.disconnect === 'function') {
        realtimeClient.disconnect();
      }
    } catch {
      // Ignored
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (config.videoElement && config.videoElement.srcObject) {
      const stream = config.videoElement.srcObject as MediaStream;
      stream?.getTracks?.().forEach((t) => t.stop());
      config.videoElement.srcObject = null;
    }
    config.onStatusChange?.('Camera ready');
  };

  const flipCamera = async () => {
    if (isDestroyed) return;
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    config.onStatusChange?.('Flipping camera...');

    try {
      localStream.getVideoTracks().forEach((t) => t.stop());

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: model.width || 1280,
          height: model.height || 720,
          frameRate: captureFps,
        },
      });

      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack) {
        await realtimeClient.replaceVideoTrack(newTrack);
        localStream = newStream;
        config.onStatusChange?.('Live AI Active');
      }
    } catch (err: any) {
      console.error('Failed to flip camera:', err);
      config.onError?.(err);
    }
  };

  return {
    client: realtimeClient,
    localStream,
    stop,
    setGarment,
    flipCamera,
  };
}
