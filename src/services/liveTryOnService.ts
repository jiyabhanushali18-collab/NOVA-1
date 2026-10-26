import { apiUrl, PRODUCTION_API_URL } from './apiClient';

export interface LiveTryOnSessionConfig {
  videoElement: HTMLVideoElement;
  garmentImage?: File | Blob | string | null;
  facingMode?: 'user' | 'environment';
  onStatusChange?: (status: string) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  signal?: AbortSignal;
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
const publicAsset = (assetPath: string) => `${import.meta.env.BASE_URL}${assetPath}`;

let liveConnectQueue: Promise<void> = Promise.resolve();
let isLiveConnectInProgress = false;

async function runSerializedLiveConnect<T>(
  signal: AbortSignal | undefined,
  onWaiting: () => void,
  connect: () => Promise<T>
): Promise<T> {
  if (signal?.aborted) {
    throw new DOMException('The live try-on connection was cancelled.', 'AbortError');
  }

  const previousConnect = liveConnectQueue;
  let releaseQueue!: () => void;
  liveConnectQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  try {
    if (isLiveConnectInProgress) {
      onWaiting();
      if (signal) {
        await Promise.race([
          previousConnect,
          new Promise<void>((_, reject) => {
            const onAbort = () => reject(new DOMException('The live try-on connection was cancelled.', 'AbortError'));
            signal.addEventListener('abort', onAbort, { once: true });
          }),
        ]);
      } else {
        await previousConnect;
      }
    } else {
      await previousConnect;
    }

    if (signal?.aborted) {
      throw new DOMException('The live try-on connection was cancelled.', 'AbortError');
    }

    isLiveConnectInProgress = true;
    return await connect();
  } finally {
    isLiveConnectInProgress = false;
    releaseQueue();
  }
}

// Keep credential metadata for failure feedback, and cache freshly minted token
let activeTokenState: {
  credentialId: string | null;
  feedbackEndpoint: string;
} | null = null;

let cachedClientToken: {
  token: string;
  expiresAt: number;
} | null = null;

let inFlightTokenPromise: Promise<string> | null = null;

export function invalidateLiveTryOnToken(): void {
  activeTokenState = null;
  cachedClientToken = null;
}

function reportSessionFailure(reason: string): void {
  const tokenState = activeTokenState;
  invalidateLiveTryOnToken();

  if (!tokenState?.credentialId) return;

  const isCreditFailure = reason.toLowerCase().includes('credit');
  void fetch(tokenState.feedbackEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentialId: tokenState.credentialId,
      event: isCreditFailure ? 'terminal_error' : 'session_error',
      reason,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Session feedback request failed with HTTP ${response.status}`);
      }
    })
    .catch((error) => {
      console.warn('Could not report live try-on session failure:', error);
    });
}

export const DEFAULT_GARMENTS = [
  {
    id: 'Lavender',
    name: 'Lavender Hoodie',
    category: 'Casual wear',
    img: publicAsset('garments/lavender.jpg'),
  },
  {
    id: 'Mint Green',
    name: 'Denim Jacket',
    category: 'Streetwear',
    img: publicAsset('garments/mint.jpg'),
  },
  {
    id: 'Beige',
    name: 'Beige Shirt',
    category: 'Smart Casual',
    img: publicAsset('garments/beige.jpg'),
  },
];

export const DEFAULT_MODELS: Record<string, string> = {
  Lavender: publicAsset('garments/model-lavender.jpg'),
  'Mint Green': publicAsset('garments/model-mint.jpg'),
  Beige: publicAsset('garments/model-beige.jpg'),
};

/**
 * Fetch a mint client session token with single-flight deduplication, caching,
 * and multi-tier fallback to eliminate duplicate requests and connection hangs.
 */
export async function getLiveTryOnToken(): Promise<string> {
  const now = Date.now();
  if (cachedClientToken && cachedClientToken.expiresAt > now) {
    return cachedClientToken.token;
  }

  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    try {
      const candidateEndpoints: string[] = [];
      const primaryUrl = apiUrl('/api/vton/token');
      if (primaryUrl) candidateEndpoints.push(primaryUrl);
      if (primaryUrl !== `${PRODUCTION_API_URL}/api/vton/token`) {
        candidateEndpoints.push(`${PRODUCTION_API_URL}/api/vton/token`);
      }

      let lastError: any = null;

      for (const endpoint of candidateEndpoints) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutMs = attempt === 0 ? 8000 : 12000;
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

            activeTokenState = {
              credentialId: typeof data.credentialId === 'string' ? data.credentialId : null,
              feedbackEndpoint: endpoint.replace(/\/api\/vton\/token$/, '/api/vton/session-event'),
            };

            // Cache token for 60 seconds (server issues 300s tokens) to deduplicate connects without sending expired tokens
            cachedClientToken = {
              token,
              expiresAt: Date.now() + 60 * 1000,
            };

            return token;
          } catch (err: any) {
            lastError = err;
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 400));
            }
          }
        }
      }

      const friendlyMessage =
        lastError?.name === 'AbortError'
          ? 'AI server is warming up. Tap Retry to connect.'
          : lastError?.message && !lastError.message.includes('fetch')
          ? lastError.message
          : 'Unable to connect to AI server. Tap Retry to connect.';

      throw new Error(friendlyMessage);
    } finally {
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
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
  const sessionId = 'ar-' + Math.random().toString(36).slice(2, 8);
  console.log(`[AR:${sessionId}] Initiating live try-on session...`);

  const throwIfAborted = () => {
    if (config.signal?.aborted) {
      throw new DOMException('The live try-on connection was cancelled.', 'AbortError');
    }
  };

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
  if (config.signal?.aborted) {
    localStream.getTracks().forEach((track) => track.stop());
    throwIfAborted();
  }

  console.log(`[AR:${sessionId}] Camera acquired (${currentFacingMode})`);
  config.videoElement.srcObject = localStream;
  config.videoElement.play().catch((err) => {
    console.warn('Camera preview play error:', err);
  });
  config.onLocalStream?.(localStream);
  config.onStatusChange?.('Connecting to AI...');

  // Keep SDK connection failures visible in the browser console.
  const logger = createConsoleLogger('warn');

  const client = createVtonClient({
    apiKeyProvider: getLiveTryOnToken,
    logger,
  });

  let isDestroyed = false;
  let hasConnected = false;

  // Single-flight connection with bounded SDK retry budget.
  let realtimeClient: any;
  try {
    throwIfAborted();
    const connectionOptions = {
      model,
      retries: 2,
      capacityRetryBudgetMs: 15000,
      onCapacityWait: ({ retryAfterMs }: { retryAfterMs: number }) => {
        console.warn(`[AR:${sessionId}] Server busy, waiting ${retryAfterMs}ms`);
        config.onStatusChange?.(`AI server busy - retrying in ${Math.ceil(retryAfterMs / 1000)} seconds...`);
      },
      onRemoteStream: (transformedStream: MediaStream) => {
        if (isDestroyed) return;
        console.log(`[AR:${sessionId}] Received transformed remote stream`);
        if (!hasConnected) {
          hasConnected = true;
          config.onConnected?.();
        }
        config.videoElement.srcObject = transformedStream;
        config.videoElement.play().catch((err) => {
          console.warn('Video play error:', err);
        });
        config.onStatusChange?.('Live AI Active');
      },
      onConnectionChange: (state: string) => {
        if (isDestroyed) return;
        console.log(`[AR:${sessionId}] WebRTC state change:`, state);
        if (state === 'connected' || state === 'generating') {
          if (!hasConnected) {
            hasConnected = true;
            config.onConnected?.();
          }
          config.onStatusChange?.('AI connected - waiting for transformed video...');
        } else if (state === 'reconnecting') {
          config.videoElement.srcObject = localStream;
          config.videoElement.play().catch((err) => {
            console.warn('Local camera preview play error:', err);
          });
          config.onStatusChange?.('AI connection lost - reconnecting...');
        } else if (state === 'disconnected') {
          config.videoElement.srcObject = localStream;
          config.videoElement.play().catch((err) => {
            console.warn('Local camera preview play error:', err);
          });
          config.onStatusChange?.(hasConnected
            ? 'AI disconnected - waiting to reconnect...'
            : 'AI connection retrying...');
        }
      },
    };

    realtimeClient = await runSerializedLiveConnect(
      config.signal,
      () => config.onStatusChange?.('Waiting for previous AI connection to close...'),
      () => client.realtime.connect(localStream, connectionOptions)
    );

    if (config.signal?.aborted) {
      realtimeClient?.disconnect();
      localStream.getTracks().forEach((track) => track.stop());
      throwIfAborted();
    }
  } catch (error: any) {
    const errorMsg = typeof error?.message === 'string' ? error.message : String(error || '');
    const isCancelled = config.signal?.aborted || error?.name === 'AbortError' || errorMsg.includes('cancelled');
    console.error(`[AR:${sessionId}] Connection error (cancelled: ${isCancelled}):`, errorMsg);
    if (isCancelled) {
      localStream.getTracks().forEach((track) => track.stop());
      if (config.videoElement.srcObject === localStream) {
        config.videoElement.srcObject = null;
      }
      throw error;
    }
    reportSessionFailure((error as any)?.message || 'connection_failure');
    config.videoElement.srcObject = localStream;
    config.videoElement.play().catch((playError) => {
      console.warn('Local camera preview play error after AI connection failure:', playError);
    });
    throw error;
  }

  let terminalErrorReported = false;
  const reportRealtimeError = (error: Error) => {
    if (isDestroyed || terminalErrorReported) return;
    terminalErrorReported = true;
    reportSessionFailure(error.message);
    config.onError?.(error);
  };
  realtimeClient.on('error', (error: { message?: string }) => {
    reportRealtimeError(new Error(error.message || 'The live AI connection was lost. Tap Try On Live to reconnect.'));
  });
  realtimeClient.on('sessionEnded', ({ reason }: { reason: string }) => {
    const reasonMessage: Record<string, string> = {
      insufficient_credits: 'The live try-on service has no credits available.',
      session_limit: 'The live try-on service reached its session limit.',
      policy_violation: 'The live try-on service ended this session due to a policy restriction.',
      moderation_violation: 'The live try-on service ended this session due to a content restriction.',
    };
    reportRealtimeError(new Error(reasonMessage[reason] || `The live try-on service ended the session (${reason}).`));
  });

  // Serialized, non-blocking garment sender
  let isUpdatingGarment = false;
  let pendingGarment: File | Blob | string | null = null;

  const setGarment = async (garment: File | Blob | string | null) => {
    if (isDestroyed) return;

    pendingGarment = garment;
    if (isUpdatingGarment) {
      return;
    }

    isUpdatingGarment = true;
    try {
      while (pendingGarment !== null && !isDestroyed) {
        if (!realtimeClient.isConnected()) {
          // Wait briefly for connection if it is transitioning
          for (let i = 0; i < 30 && !realtimeClient.isConnected() && !isDestroyed; i++) {
            await new Promise((r) => setTimeout(r, 100));
          }
          if (!realtimeClient.isConnected()) {
            break;
          }
        }

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
      console.warn(`[AR:${sessionId}] Error updating garment:`, err);
      config.onStatusChange?.('Live AI Active');
    } finally {
      isUpdatingGarment = false;
    }
  };

  // If a garment was requested at start, send it once WebRTC connection is active
  if (config.garmentImage) {
    setGarment(config.garmentImage).catch((err) => {
      console.warn(`[AR:${sessionId}] Initial garment apply warning:`, err);
    });
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
