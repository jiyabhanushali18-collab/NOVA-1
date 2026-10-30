/**
 * Production URL Configuration and Deep-Link Helper for NOVA
 *
 * Ensures all email campaigns, CTAs, notifications, and unsubscribes
 * resolve to the official production HTTPS destination by default,
 * avoiding accidental localhost:3000 links in production.
 */

export const DEFAULT_PRODUCTION_URL = 'https://nova.nova-fashion.workers.dev';
// The public web app is hosted on Cloudflare; API routes are served by the
// long-running Render backend. Keep unsubscribe actions on the API origin.
export const DEFAULT_PRODUCTION_API_URL = 'https://nova-1-1.onrender.com';

export function getPublicApiUrl(): string {
  const envUrl = process.env.PUBLIC_API_URL?.trim();
  const candidate = envUrl || DEFAULT_PRODUCTION_API_URL;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      console.warn('[AppUrlConfig] Ignoring non-production PUBLIC_API_URL; using configured production backend.');
      return DEFAULT_PRODUCTION_API_URL;
    }
    return parsed.origin;
  } catch {
    console.warn('[AppUrlConfig] Invalid PUBLIC_API_URL; using configured production backend.');
    return DEFAULT_PRODUCTION_API_URL;
  }
}

/**
 * Returns the validated public application URL.
 * Guarantees HTTPS in production. Never falls back to localhost unless
 * DEV_LOCAL_EMAILS=true is explicitly set in development.
 */
export function getPublicAppUrl(): string {
  const envUrl = process.env.PUBLIC_APP_URL?.trim();

  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      // If someone passed http://localhost in dev and explicitly allowed it
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1'
      ) {
        if (process.env.DEV_LOCAL_EMAILS === 'true' && process.env.NODE_ENV === 'development') {
          return parsed.origin;
        }
        // Disallow localhost for production/marketing emails
        console.warn(`[AppUrlConfig] Ignoring localhost PUBLIC_APP_URL in non-dev mode; defaulting to ${DEFAULT_PRODUCTION_URL}`);
        return DEFAULT_PRODUCTION_URL;
      }

      // Ensure HTTPS for remote origins
      if (parsed.protocol !== 'https:') {
        return `https://${parsed.host}`;
      }

      return parsed.origin;
    } catch (err) {
      console.warn('[AppUrlConfig] Failed to parse PUBLIC_APP_URL, using default:', err);
      return DEFAULT_PRODUCTION_URL;
    }
  }

  return DEFAULT_PRODUCTION_URL;
}

/**
 * Build a production-safe marketing CTA link.
 * Supports deep-linking into specific NOVA screens.
 */
export function buildMarketingCtaUrl(ctaPath: string = '/?screen=home', params?: Record<string, string>): string {
  const base = getPublicAppUrl();
  let normalizedPath = ctaPath.trim();
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  try {
    const url = new URL(normalizedPath, base);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, v);
        }
      }
    }
    return url.toString();
  } catch {
    return `${base}${normalizedPath}`;
  }
}

/**
 * Build CAN-SPAM / GDPR compliant unsubscribe URL.
 */
export function buildUnsubscribeUrl(email: string, token: string): string {
  const base = getPublicApiUrl();
  return `${base}/api/marketing/unsubscribe?email=${encodeURIComponent(email.trim().toLowerCase())}&token=${encodeURIComponent(token)}`;
}

/**
 * Returns configured Android APK download URL if one is set and valid.
 * Returns null if no verified APK distribution host exists.
 */
export function getAndroidApkDownloadUrl(): string | null {
  const raw = process.env.ANDROID_APK_URL?.trim() || process.env.VITE_ANDROID_APK_URL?.trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch {}
  }
  return null;
}
