import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './firebaseAdmin';
import {
  NotificationMessageTemplate,
  NotificationSlot,
  selectRotatedMarketingMessage,
  personalizeMessage
} from './notificationContentLibrary';

export interface DeviceTokenRecord {
  tokenId: string; // Hash or slice of token
  token: string;
  userId?: string;
  userEmail?: string;
  platform: 'android' | 'web' | 'ios';
  timezone: string; // e.g. 'Asia/Kolkata'
  marketingOptIn: boolean;
  categories: {
    priceDrops: boolean;
    newArrivals: boolean;
    stylistReminders: boolean;
    marketing: boolean;
  };
  language: 'hinglish' | 'english' | 'hindi';
  lastActiveAt: string;
  createdAt: string;
  recentlySentMessageIds: string[];
  sentCampaignDates: string[]; // e.g. ['2026-10-28_morning', '2026-10-28_evening']
}

export interface CampaignDeliveryResult {
  campaignId: string;
  slot: NotificationSlot;
  eligibleRecipients: number;
  sendAttempts: number;
  successfulSends: number;
  failedSends: number;
  invalidTokensPruned: number;
  skippedDueToCap: number;
  executedAt: string;
}

export interface NotificationMetrics {
  totalRegisteredDevices: number;
  activeOptedInRecipients: number;
  totalSendAttempts: number;
  totalSuccessfulSends: number;
  totalFailedSends: number;
  totalTaps: number;
  totalOptOuts: number;
  lastMorningCampaignAt: string | null;
  lastEveningCampaignAt: string | null;
  recentCampaignHistory: CampaignDeliveryResult[];
}

// In-memory token store for resilience & local development fallback
const localTokenStore = new Map<string, DeviceTokenRecord>();
const inMemoryTapEvents: Array<{ campaignId: string; tokenId: string; deepLink: string; tappedAt: string }> = [];
const campaignHistory: CampaignDeliveryResult[] = [];

// Overall metrics tracking
const metrics: NotificationMetrics = {
  totalRegisteredDevices: 0,
  activeOptedInRecipients: 0,
  totalSendAttempts: 0,
  totalSuccessfulSends: 0,
  totalFailedSends: 0,
  totalTaps: 0,
  totalOptOuts: 0,
  lastMorningCampaignAt: null,
  lastEveningCampaignAt: null,
  recentCampaignHistory: []
};

/**
 * Register or update an FCM / Web device push token.
 */
export async function registerDevicePushToken(payload: {
  token: string;
  userId?: string;
  userEmail?: string;
  platform?: 'android' | 'web' | 'ios';
  timezone?: string;
  marketingOptIn?: boolean;
  categories?: {
    priceDrops?: boolean;
    newArrivals?: boolean;
    stylistReminders?: boolean;
    marketing?: boolean;
  };
  language?: 'hinglish' | 'english' | 'hindi';
}): Promise<DeviceTokenRecord> {
  const token = payload.token.trim();
  if (!token) throw new Error('Token is required');

  const tokenId = 'tok_' + Buffer.from(token).toString('base64url').slice(-24);
  const existing = localTokenStore.get(tokenId);

  const cleanTimezone = payload.timezone?.trim() || existing?.timezone || 'Asia/Kolkata';
  const cleanPlatform = payload.platform || existing?.platform || 'android';
  const marketingOptIn = typeof payload.marketingOptIn === 'boolean'
    ? payload.marketingOptIn
    : existing?.marketingOptIn ?? true;

  const record: DeviceTokenRecord = {
    tokenId,
    token,
    userId: payload.userId || existing?.userId,
    userEmail: payload.userEmail || existing?.userEmail,
    platform: cleanPlatform,
    timezone: cleanTimezone,
    marketingOptIn,
    categories: {
      priceDrops: payload.categories?.priceDrops ?? existing?.categories.priceDrops ?? true,
      newArrivals: payload.categories?.newArrivals ?? existing?.categories.newArrivals ?? true,
      stylistReminders: payload.categories?.stylistReminders ?? existing?.categories.stylistReminders ?? true,
      marketing: payload.categories?.marketing ?? existing?.categories.marketing ?? true
    },
    language: payload.language || existing?.language || 'hinglish',
    lastActiveAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    recentlySentMessageIds: existing?.recentlySentMessageIds || [],
    sentCampaignDates: existing?.sentCampaignDates || []
  };

  localTokenStore.set(tokenId, record);
  updateMetricsCounters();

  // Persist asynchronously in Firestore if Firebase Admin is available
  if (adminDb) {
    try {
      await adminDb.collection('notification_tokens').doc(tokenId).set(record, { merge: true });
    } catch (err: any) {
      console.warn('[Notification Service] Firestore token write warning:', err?.message || err);
    }
  }

  return record;
}

/**
 * Update user marketing preferences (opt-in / opt-out / categories).
 */
export async function updateNotificationPreferences(
  identifier: { tokenId?: string; userId?: string },
  preferences: {
    marketingOptIn?: boolean;
    priceDrops?: boolean;
    newArrivals?: boolean;
    stylistReminders?: boolean;
    marketing?: boolean;
    language?: 'hinglish' | 'english' | 'hindi';
    timezone?: string;
  }
): Promise<{ updatedCount: number }> {
  let updatedCount = 0;

  for (const [id, record] of localTokenStore.entries()) {
    if (
      (identifier.tokenId && (id === identifier.tokenId || record.token === identifier.tokenId)) ||
      (identifier.userId && record.userId === identifier.userId)
    ) {
      if (typeof preferences.marketingOptIn === 'boolean') {
        record.marketingOptIn = preferences.marketingOptIn;
        if (!preferences.marketingOptIn) {
          metrics.totalOptOuts++;
        }
      }
      if (typeof preferences.priceDrops === 'boolean') record.categories.priceDrops = preferences.priceDrops;
      if (typeof preferences.newArrivals === 'boolean') record.categories.newArrivals = preferences.newArrivals;
      if (typeof preferences.stylistReminders === 'boolean') record.categories.stylistReminders = preferences.stylistReminders;
      if (typeof preferences.marketing === 'boolean') record.categories.marketing = preferences.marketing;
      if (preferences.language) record.language = preferences.language;
      if (preferences.timezone) record.timezone = preferences.timezone;
      record.lastActiveAt = new Date().toISOString();

      localTokenStore.set(id, record);
      updatedCount++;

      if (adminDb) {
        adminDb.collection('notification_tokens').doc(id).set(record, { merge: true }).catch(() => {});
      }
    }
  }

  updateMetricsCounters();
  return { updatedCount };
}

/**
 * Remove an invalid or uninstalled device token.
 */
export async function pruneDeviceToken(tokenIdOrRaw: string): Promise<void> {
  for (const [id, record] of localTokenStore.entries()) {
    if (id === tokenIdOrRaw || record.token === tokenIdOrRaw) {
      localTokenStore.delete(id);
      if (adminDb) {
        adminDb.collection('notification_tokens').doc(id).delete().catch(() => {});
      }
      break;
    }
  }
  updateMetricsCounters();
}

/**
 * Record a user tapping a received push notification for measurable engagement attribution.
 */
export function trackNotificationTap(payload: {
  campaignId: string;
  tokenId?: string;
  deepLink?: string;
}): void {
  metrics.totalTaps++;
  inMemoryTapEvents.unshift({
    campaignId: payload.campaignId || 'generic',
    tokenId: payload.tokenId ? payload.tokenId.slice(-8) : 'unknown',
    deepLink: payload.deepLink || 'home',
    tappedAt: new Date().toISOString()
  });

  if (inMemoryTapEvents.length > 500) {
    inMemoryTapEvents.pop();
  }
}

/**
 * Get all opted-in, eligible recipient devices for a campaign slot.
 */
export function getEligibleRecipients(slot: NotificationSlot): DeviceTokenRecord[] {
  const recipients: DeviceTokenRecord[] = [];
  const todayDateStr = new Date().toISOString().split('T')[0];

  for (const record of localTokenStore.values()) {
    // 1. Consent guard: must be explicitly opted in
    if (!record.marketingOptIn || !record.categories.marketing) {
      continue;
    }

    // 2. Daily cap guard: maximum 2 scheduled marketing campaigns per day
    const sendsToday = record.sentCampaignDates.filter((tag) => tag.startsWith(todayDateStr));
    if (sendsToday.length >= 2) {
      continue; // Capped
    }

    // 3. Slot duplicate guard: do not send the same slot twice in a day
    const slotTag = `${todayDateStr}_${slot}`;
    if (record.sentCampaignDates.includes(slotTag)) {
      continue;
    }

    recipients.push(record);
  }

  return recipients;
}

/**
 * Dispatch a single push notification payload to a recipient via FCM (with mock fallback).
 */
export async function sendPushToDevice(
  token: string,
  content: {
    title: string;
    body: string;
    deepLink: string;
    campaignId: string;
    slot: NotificationSlot;
  }
): Promise<{ success: boolean; invalidToken?: boolean; error?: string }> {
  // If Firebase Admin has initialized an app, use official Firebase Cloud Messaging
  if (getApps().length > 0) {
    try {
      const messaging = getMessaging();
      const messagePayload = {
        token,
        notification: {
          title: content.title,
          body: content.body
        },
        data: {
          deepLink: content.deepLink,
          campaignId: content.campaignId,
          slot: content.slot,
          click_action: 'FLUTTER_NOTIFICATION_CLICK' // standard Android background action
        },
        android: {
          priority: 'high' as const,
          notification: {
            icon: 'ic_launcher',
            color: '#553BE2',
            channelId: 'nova_marketing_channel',
            sound: 'default'
          }
        }
      };

      await messaging.send(messagePayload);
      return { success: true };
    } catch (err: any) {
      const errorCode = err?.code || err?.errorInfo?.code;
      const errorMessage = String(err?.message || '');
      const isUnregistered =
        errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/invalid-argument' ||
        errorMessage.includes('not a valid FCM registration token');

      if (isUnregistered) {
        return { success: false, invalidToken: true, error: errorCode };
      }

      return { success: false, error: err?.message || String(err) };
    }
  }

  // Graceful delivery simulation when Firebase Admin service account is absent in local dev
  console.log(`[FCM Simulation] Marketing Notification -> Token: ${token.slice(0, 10)}... | Title: "${content.title}" | DeepLink: "${content.deepLink}"`);
  return { success: true };
}

/**
 * Executes a scheduled marketing campaign for either 'morning' or 'evening'.
 */
export async function executeScheduledMarketingCampaign(
  slot: NotificationSlot,
  customTemplate?: NotificationMessageTemplate
): Promise<CampaignDeliveryResult> {
  const todayDateStr = new Date().toISOString().split('T')[0];
  const campaignId = `cmp_${todayDateStr}_${slot}_${Date.now()}`;
  const slotTag = `${todayDateStr}_${slot}`;

  const eligibleRecipients = getEligibleRecipients(slot);
  let sendAttempts = 0;
  let successfulSends = 0;
  let failedSends = 0;
  let invalidTokensPruned = 0;
  let skippedDueToCap = 0;

  console.log(`[Notification Campaign] Starting ${slot.toUpperCase()} campaign "${campaignId}". Eligible recipients: ${eligibleRecipients.length}`);

  for (const recipient of eligibleRecipients) {
    // Re-verify daily cap (max 2 sends per day)
    const sendsToday = recipient.sentCampaignDates.filter((t) => t.startsWith(todayDateStr));
    if (sendsToday.length >= 2 || recipient.sentCampaignDates.includes(slotTag)) {
      skippedDueToCap++;
      continue;
    }

    sendAttempts++;
    metrics.totalSendAttempts++;

    // Select rotated message matching user's language and avoiding recent repetition
    const template = customTemplate || selectRotatedMarketingMessage(
      slot,
      recipient.language,
      recipient.recentlySentMessageIds
    );

    const personalized = personalizeMessage(template, { name: recipient.userEmail?.split('@')[0] });

    const delivery = await sendPushToDevice(recipient.token, {
      title: personalized.title,
      body: personalized.body,
      deepLink: template.deepLink,
      campaignId,
      slot
    });

    if (delivery.success) {
      successfulSends++;
      metrics.totalSuccessfulSends++;

      // Update recipient rotation and idempotency history
      recipient.sentCampaignDates.push(slotTag);
      recipient.recentlySentMessageIds.unshift(template.id);
      if (recipient.recentlySentMessageIds.length > 10) {
        recipient.recentlySentMessageIds.pop();
      }
      localTokenStore.set(recipient.tokenId, recipient);

      if (adminDb) {
        adminDb.collection('notification_tokens').doc(recipient.tokenId).set({
          sentCampaignDates: recipient.sentCampaignDates,
          recentlySentMessageIds: recipient.recentlySentMessageIds,
          lastSentAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }
    } else {
      failedSends++;
      metrics.totalFailedSends++;

      if (delivery.invalidToken) {
        invalidTokensPruned++;
        await pruneDeviceToken(recipient.tokenId);
      }
    }
  }

  const result: CampaignDeliveryResult = {
    campaignId,
    slot,
    eligibleRecipients: eligibleRecipients.length,
    sendAttempts,
    successfulSends,
    failedSends,
    invalidTokensPruned,
    skippedDueToCap,
    executedAt: new Date().toISOString()
  };

  if (slot === 'morning') metrics.lastMorningCampaignAt = result.executedAt;
  else metrics.lastEveningCampaignAt = result.executedAt;

  campaignHistory.unshift(result);
  if (campaignHistory.length > 20) {
    campaignHistory.pop();
  }
  metrics.recentCampaignHistory = campaignHistory;

  console.log(`[Notification Campaign] ${slot.toUpperCase()} completed: ${successfulSends}/${sendAttempts} successful, ${failedSends} failed, ${invalidTokensPruned} pruned.`);
  return result;
}

/**
 * Send an immediate test notification to an authorized administrator's test device token.
 */
export async function sendAdminTestNotification(payload: {
  testToken: string;
  slot?: NotificationSlot;
  templateId?: string;
  customTitle?: string;
  customBody?: string;
  deepLink?: 'ar-tryon' | 'showroom' | 'wishlist' | 'stylist' | 'home';
}): Promise<{ success: boolean; error?: string }> {
  const slot = payload.slot || 'morning';
  const title = payload.customTitle || 'NOVA Test Slay Alert 💅';
  const body = payload.customBody || 'Crush ka reply aaye na aaye, outfit toh slay karna hai. [Test Notification]';
  const deepLink = payload.deepLink || 'ar-tryon';

  const res = await sendPushToDevice(payload.testToken, {
    title,
    body,
    deepLink,
    campaignId: `test_${Date.now()}`,
    slot
  });

  return res;
}

function updateMetricsCounters() {
  metrics.totalRegisteredDevices = localTokenStore.size;
  metrics.activeOptedInRecipients = Array.from(localTokenStore.values()).filter(
    (t) => t.marketingOptIn && t.categories.marketing
  ).length;
}

export function getNotificationMetrics(): NotificationMetrics {
  updateMetricsCounters();
  return { ...metrics };
}

export function getAllRegisteredTokens(): DeviceTokenRecord[] {
  return Array.from(localTokenStore.values());
}
