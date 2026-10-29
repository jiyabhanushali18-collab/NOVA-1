import { App as CapApp, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ScreenId } from '../types';

export interface DeepLinkDestination {
  screen: ScreenId;
  productId?: string;
  campaignId?: string;
  source?: string;
  rawUrl: string;
}

const ALLOWED_SCREENS: Record<string, ScreenId> = {
  home: 'home',
  showroom: 'showroom',
  catalog: 'showroom',
  catalogue: 'showroom',
  shop: 'showroom',
  explore: 'showroom',
  'ar-tryon': 'ar-tryon',
  artryon: 'ar-tryon',
  tryon: 'ar-tryon',
  'try-on': 'ar-tryon',
  chat: 'chat',
  stylist: 'chat',
  'stylist-ai': 'chat',
  'ai-stylist': 'chat',
  'virtual-wardrobe': 'virtual-wardrobe',
  wardrobe: 'virtual-wardrobe',
  wishlist: 'wardrobe',
  profile: 'profile',
  faq: 'faq',
  cart: 'cart',
  'product-details': 'product-details',
  product: 'product-details'
};

let lastHandledUrl = '';
let lastHandledTime = 0;

/**
 * Validates and parses any incoming deep-link or App Link URL into a safe NOVA screen destination.
 * Never throws. Rejects unsafe schemes. Defaults gracefully to 'home'.
 */
export function parseDeepLink(rawUrl: string): DeepLinkDestination {
  const fallback: DeepLinkDestination = {
    screen: 'home',
    rawUrl
  };

  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback;
  }

  const trimmed = rawUrl.trim();

  // Reject unsafe schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    console.warn('[DeepLink] Rejected unsafe URL scheme:', rawUrl);
    return fallback;
  }

  try {
    let url: URL;

    // Handle custom schemes: nova:// or novafashion://
    if (lower.startsWith('nova://') || lower.startsWith('novafashion://')) {
      const synthetic = trimmed
        .replace(/^novafashion:\/\//i, 'https://nova.nova-fashion.workers.dev/')
        .replace(/^nova:\/\//i, 'https://nova.nova-fashion.workers.dev/');
      url = new URL(synthetic);
    } else if (lower.startsWith('http://') || lower.startsWith('https://')) {
      url = new URL(trimmed);
    } else {
      // Relative path or query string
      url = new URL(trimmed, 'https://nova.nova-fashion.workers.dev');
    }

    const searchParams = url.searchParams;
    const pathSegments = url.pathname
      .split('/')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // 1. Check query parameters first (?screen=... or ?open=... or ?deepLink=...)
    const queryScreen =
      searchParams.get('screen') ||
      searchParams.get('open') ||
      searchParams.get('deepLink') ||
      searchParams.get('tab') ||
      '';

    let matchedScreen: ScreenId | null = null;
    let targetProductId = searchParams.get('productId') || searchParams.get('id') || undefined;
    const campaignId = searchParams.get('campaignId') || searchParams.get('utm_campaign') || undefined;
    const source = searchParams.get('source') || searchParams.get('utm_source') || undefined;

    if (queryScreen) {
      const key = queryScreen.toLowerCase();
      if (ALLOWED_SCREENS[key]) {
        matchedScreen = ALLOWED_SCREENS[key];
      }
    }

    // 2. Check path segments if not resolved by query parameters (e.g. /showroom, /ar-tryon, /product/123)
    if (!matchedScreen && pathSegments.length > 0) {
      const firstSegment = pathSegments[0];
      if (ALLOWED_SCREENS[firstSegment]) {
        matchedScreen = ALLOWED_SCREENS[firstSegment];
        if (
          (firstSegment === 'product' || firstSegment === 'product-details') &&
          pathSegments.length > 1
        ) {
          targetProductId = pathSegments[1];
        }
      }
    }

    // Default to 'home' if no specific known destination was recognized
    const finalScreen: ScreenId = matchedScreen || 'home';

    return {
      screen: finalScreen,
      productId: targetProductId,
      campaignId,
      source,
      rawUrl
    };
  } catch (err) {
    console.warn('[DeepLink] Error parsing deep link URL:', err);
    return fallback;
  }
}

/**
 * Initializes deep link listeners for Capacitor (Android/iOS) and web.
 * Handles:
 * 1. Warm start: App is already in memory when App Link or custom scheme is tapped.
 * 2. Cold start: App was launched from scratch by an incoming URL.
 * 3. Web URL parameters: ?screen=showroom, etc.
 *
 * Includes deduplication to prevent double-navigation on repeat events.
 */
export function initializeDeepLinkHandler(
  onNavigate: (destination: DeepLinkDestination) => void
): () => void {
  const handleDestination = (rawUrl: string, origin: 'warm' | 'cold' | 'web') => {
    if (!rawUrl) return;

    const now = Date.now();
    if (rawUrl === lastHandledUrl && now - lastHandledTime < 1500) {
      // Deduplicate rapid repeat events
      return;
    }

    lastHandledUrl = rawUrl;
    lastHandledTime = now;

    console.log(`[DeepLink] Received ${origin} URL:`, rawUrl);
    const dest = parseDeepLink(rawUrl);
    onNavigate(dest);
  };

  let cleanupListener: (() => void) | null = null;

  // 1. Capacitor Native Listeners
  if (Capacitor.isNativePlatform()) {
    // Warm start: App already running in background
    CapApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      handleDestination(event.url, 'warm');
    }).then((handle) => {
      cleanupListener = () => {
        handle.remove();
      };
    }).catch((err) => {
      console.warn('[DeepLink] Failed to register appUrlOpen listener:', err);
    });

    // Cold start: App launched from an external intent
    CapApp.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) {
        handleDestination(launchUrl.url, 'cold');
      }
    }).catch(() => {});
  } else {
    // 2. Web browser: parse current location
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      if (
        window.location.search.includes('screen=') ||
        window.location.search.includes('open=') ||
        window.location.search.includes('deepLink=') ||
        window.location.search.includes('utm_campaign=')
      ) {
        handleDestination(currentUrl, 'web');
      }
    }
  }

  return () => {
    cleanupListener?.();
  };
}

/**
 * Returns custom scheme fallback intent for Android.
 */
export function getNativeAppSchemeUrl(screen: ScreenId = 'home', params?: Record<string, string>): string {
  const q = new URLSearchParams({ screen });
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v);
    }
  }
  return `novafashion://open?${q.toString()}`;
}
