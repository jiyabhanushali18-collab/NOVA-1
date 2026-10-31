import { Capacitor } from '@capacitor/core';
import { apiUrl } from './apiClient';

export interface PushPreferences {
  marketingOptIn: boolean;
  priceDrops: boolean;
  newArrivals: boolean;
  stylistReminders: boolean;
  orderUpdates: boolean;
  language: 'hinglish' | 'english' | 'hindi';
}

const TOKEN_STORAGE_KEY = 'nova_push_device_token_v1';
const PREFS_STORAGE_KEY = 'notifications_settings';

/**
 * Get or generate a persistent local device token for this installation.
 * (In Android Capacitor / Web Push, this binds with the FCM or browser token).
 */
export function getStoredDeviceToken(): string {
  let token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    token = `dev_${Capacitor.isNativePlatform() ? 'apk' : 'web'}_${randomHex}`;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
  return token;
}

/**
 * Register push token with the NOVA backend.
 */
export async function syncPushTokenWithBackend(user?: { uid?: string; email?: string }): Promise<void> {
  try {
    const token = getStoredDeviceToken();
    const platform = Capacitor.isNativePlatform() ? 'android' : 'web';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

    let storedPrefs: any = {};
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) storedPrefs = JSON.parse(raw);
    } catch {}

    const payload = {
      token,
      userId: user?.uid,
      userEmail: user?.email,
      platform,
      timezone,
      marketingOptIn: storedPrefs.marketingOptIn ?? true,
      categories: {
        priceDrops: storedPrefs.priceDrops ?? true,
        newArrivals: storedPrefs.newArrivals ?? true,
        stylistReminders: storedPrefs.stylistReminders ?? true,
        marketing: storedPrefs.marketing ?? true
      },
      language: storedPrefs.language || 'hinglish'
    };

    await fetch(apiUrl('/api/notifications/register-token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[Push Notification] Token sync warning:', err);
  }
}

/**
 * Request notification permission from browser or Android.
 */
export async function requestPushNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (typeof window === 'undefined') return 'default';

  // 1. Browser Notification API
  if ('Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('[Push Notification] Permission request notice:', e);
    }
  }

  return 'granted';
}

/**
 * Send notification tap attribution to server.
 */
export function trackPushTap(campaignId: string, deepLink: string): void {
  try {
    const token = getStoredDeviceToken();
    void fetch(apiUrl('/api/notifications/track-tap'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, tokenId: token, deepLink })
    });
  } catch {}
}

/**
 * Sync marketing email preference (opt-in / opt-out) with backend.
 */
export async function syncMarketingEmailPreference(email: string, marketingEmailOptIn: boolean): Promise<void> {
  if (!email || !email.includes('@') || email.endsWith('@guest.nova.ai')) return;
  try {
    await fetch(apiUrl('/api/marketing/preferences'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        marketingEmailOptIn
      })
    });
  } catch (err) {
    console.warn('[Marketing Email] Preference sync notice:', err);
  }
}
export async function syncPreferencesUpdate(prefs: Partial<PushPreferences>, userId?: string): Promise<void> {
  try {
    const token = getStoredDeviceToken();
    await fetch(apiUrl('/api/notifications/preferences'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId: token,
        userId,
        ...prefs
      })
    });
  } catch (err) {
    console.warn('[Push Notification] Preferences update warning:', err);
  }
}
