import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminDb } from './firebaseAdmin';
import { getPublicAppUrl, getPublicApiUrl, buildUnsubscribeUrl } from './appUrlConfig';
import {
  MarketingSlot,
  PersonalizedEmailPayload,
  generatePersonalizedContent,
  generateMarketingEmailHtml,
  MARKETING_EMAIL_TEMPLATES,
  MarketingEmailTemplate
} from './marketingEmailLibrary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

const SUPPRESSION_FILE = path.resolve(DATA_DIR, 'email_suppression_list.json');
const CAMPAIGN_HISTORY_FILE = path.resolve(DATA_DIR, 'email_campaign_history.json');

export interface EmailRecipient {
  uid: string;
  email: string;
  name?: string;
  marketingEmailOptIn?: boolean;
  marketingOptIn?: boolean;
  emailVerified?: boolean;
  gender?: string;
  preferences?: Record<string, any>;
}

export interface EmailRecipientDeliveryRecord {
  recipientId: string;
  emailMasked: string;
  templateId: string;
  subject: string;
  ctaText: string;
  status: 'sent' | 'skipped_duplicate' | 'suppressed' | 'failed' | 'simulated';
  messageId?: string;
  error?: string;
  dispatchedAt: string;
}

export interface EmailCampaignResult {
  campaignId: string;
  slot: MarketingSlot;
  templateId: string;
  subject: string;
  eligibleRecipients: number;
  sendAttempts: number;
  successfulSends: number;
  failedSends: number;
  skippedDueToSuppression: number;
  skippedDueToDuplicate?: number;
  executedAt: string;
  completedAt?: string;
  providerStatus: 'brevo_accepted' | 'simulated_local' | 'failed';
  recipientLogs?: EmailRecipientDeliveryRecord[];
}

export interface MarketingEmailMetrics {
  totalSendAttempts: number;
  totalSuccessfulSends: number;
  totalFailedSends: number;
  totalUnsubscribes: number;
  lastMorningCampaignAt: string | null;
  lastEveningCampaignAt: string | null;
  recentCampaigns: EmailCampaignResult[];
}

// ----------------------------------------------------------------------------
// Privacy & Masking Helper
// ----------------------------------------------------------------------------
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

// ----------------------------------------------------------------------------
// Strict Email Address Validator
// ----------------------------------------------------------------------------
export function isValidEmailAddress(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254) return false;
  if (trimmed.endsWith('@guest.nova.ai')) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(trimmed);
}

// ----------------------------------------------------------------------------
// 1. Suppression List & Opt-Out Management
// ----------------------------------------------------------------------------
let suppressionSet = new Set<string>();

function loadSuppressionList(): void {
  try {
    if (fs.existsSync(SUPPRESSION_FILE)) {
      const data = fs.readFileSync(SUPPRESSION_FILE, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        suppressionSet = new Set(list.map((e: string) => e.toLowerCase().trim()));
      }
    }
  } catch (err) {
    console.warn('[Marketing Email] Warning: Could not load suppression list from disk:', err);
  }
}

function saveSuppressionList(): void {
  try {
    const list = Array.from(suppressionSet);
    fs.writeFileSync(SUPPRESSION_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Marketing Email] Warning: Could not save suppression list to disk:', err);
  }
}

loadSuppressionList();

export function isEmailSuppressed(email: string): boolean {
  if (!email) return true;
  return suppressionSet.has(email.trim().toLowerCase());
}

export function generateUnsubscribeToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'nova-marketing-secret-salt-2026';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = generateUnsubscribeToken(email);
  const expectedBuf = Buffer.from(expected);
  const tokenBuf = Buffer.from(token);
  if (expectedBuf.length !== tokenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, tokenBuf);
}

export async function suppressEmail(email: string, reason: string = 'user_unsubscribe'): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return;

  // 1. Record in memory and local file
  suppressionSet.add(normalized);
  saveSuppressionList();

  // 2. Sync to Firestore
  if (adminDb) {
    try {
      const snapshot = await adminDb.collection('users').where('email', '==', normalized).get();
      const batch = adminDb.batch();
      snapshot.forEach((doc: any) => {
        batch.update(doc.ref, {
          marketingEmailOptIn: false,
          unsubscribedAt: new Date().toISOString(),
          unsubscribeReason: reason
        });
      });
      await batch.commit();

      // Dedicated suppression collection with SHA-256 doc ID
      const hashId = crypto.createHash('sha256').update(normalized).digest('hex');
      await adminDb.collection('marketing_suppressions').doc(hashId).set({
        email: normalized,
        suppressedAt: new Date().toISOString(),
        reason
      });

      console.log(`[Marketing Email] Successfully suppressed email ${maskEmail(normalized)} (${reason}).`);
    } catch (err) {
      console.warn('[Marketing Email] Firestore suppress notice:', err);
    }
  }
}

export async function unsuppressEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  suppressionSet.delete(normalized);
  saveSuppressionList();

  if (adminDb) {
    try {
      // Removing an operational suppression must never manufacture user consent.
      const hashId = crypto.createHash('sha256').update(normalized).digest('hex');
      await adminDb.collection('marketing_suppressions').doc(hashId).delete().catch(() => {});
      await adminDb.collection('marketing_suppressions').doc(normalized).delete().catch(() => {});
      console.log(`[Marketing Email] Operational suppression removed for ${maskEmail(normalized)}.`);
    } catch (err) {
      console.warn('[Marketing Email] Firestore unsuppress notice:', err);
    }
  }
}

// ----------------------------------------------------------------------------
// 2. Distributed Locking & Execution State
// ----------------------------------------------------------------------------
export async function acquireCampaignLock(slot: MarketingSlot, dateStr: string): Promise<{ acquired: boolean; lockId: string; reason?: string }> {
  const lockDocId = `${slot}_${dateStr}`;

  if (adminDb) {
    try {
      const docRef = adminDb.collection('marketing_campaign_executions').doc(lockDocId);
      const acquired = await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(docRef);
        if (snap.exists) {
          const data = snap.data();
          if (data?.status === 'completed' || data?.status === 'completed_with_failures') {
            return false;
          }
          if (data?.status === 'running') {
            const startedAt = new Date(data.startedAt || 0).getTime();
            if (Date.now() - startedAt < 15 * 60 * 1000) {
              return false;
            }
          }
        }
        tx.set(docRef, {
          slot,
          dateStr,
          status: 'running',
          startedAt: new Date().toISOString(),
          hostname: process.env.RENDER_INSTANCE_ID || 'single-host'
        });
        return true;
      });

      if (!acquired) {
        return { acquired: false, lockId: lockDocId, reason: `Campaign ${lockDocId} already executed or running in Firestore` };
      }
      return { acquired: true, lockId: lockDocId };
    } catch (err) {
      console.warn('[Marketing Email] Firestore lock error, checking local history:', err);
    }
  }

  // Local fallback lock
  const alreadyInHistory = campaignHistory.some(
    (c) => c.slot === slot && (c as any).scheduledDate === dateStr && c.providerStatus !== 'failed'
  );
  if (alreadyInHistory) {
    return { acquired: false, lockId: lockDocId, reason: `Campaign ${lockDocId} found in local history` };
  }

  return { acquired: true, lockId: lockDocId };
}

// ----------------------------------------------------------------------------
// 3. Campaign History & Idempotency Storage
// ----------------------------------------------------------------------------
let campaignHistory: EmailCampaignResult[] = [];

function loadCampaignHistory(): void {
  try {
    if (fs.existsSync(CAMPAIGN_HISTORY_FILE)) {
      const data = fs.readFileSync(CAMPAIGN_HISTORY_FILE, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        campaignHistory = list;
      }
    }
  } catch (err) {
    console.warn('[Marketing Email] Warning: Could not load campaign history from disk:', err);
  }
}

function saveCampaignHistory(): void {
  try {
    fs.writeFileSync(CAMPAIGN_HISTORY_FILE, JSON.stringify(campaignHistory.slice(-100), null, 2), 'utf8');
  } catch (err) {
    console.warn('[Marketing Email] Warning: Could not save campaign history to disk:', err);
  }
}

loadCampaignHistory();

export async function finalizeCampaignRecord(result: EmailCampaignResult): Promise<void> {
  const existingIdx = campaignHistory.findIndex((c) => c.campaignId === result.campaignId);
  if (existingIdx >= 0) {
    campaignHistory[existingIdx] = result;
  } else {
    campaignHistory.push(result);
  }
  saveCampaignHistory();

  if (adminDb) {
    try {
      await adminDb.collection('marketing_campaign_history').doc(result.campaignId).set({
        ...result,
        recipientLogs: result.recipientLogs ? result.recipientLogs.slice(-50) : []
      });
    } catch (err) {
      console.warn('[Marketing Email] Error writing campaign history to Firestore:', err);
    }
  }
}

// ----------------------------------------------------------------------------
// 4. Recipient-Level Idempotency & Send Tracking
// ----------------------------------------------------------------------------
const localDailySentRecipients = new Set<string>();

export async function isRecipientAlreadySentToday(uid: string, dateStr: string, slot: MarketingSlot): Promise<boolean> {
  const key = `${uid}_${dateStr}_${slot}`;
  if (localDailySentRecipients.has(key)) return true;

  if (adminDb) {
    try {
      const hashId = crypto.createHash('sha256').update(`${uid}:${dateStr}:${slot}`).digest('hex');
      const doc = await adminDb.collection('marketing_email_deliveries').doc(hashId).get();
      if (doc.exists) {
        const data = doc.data();
        if (data?.status === 'accepted_by_brevo' || data?.status === 'sent' || data?.status === 'simulated') {
          localDailySentRecipients.add(key);
          return true;
        }
      }
    } catch {}
  }
  return false;
}

export async function markRecipientSentToday(uid: string, dateStr: string, slot: MarketingSlot): Promise<void> {
  localDailySentRecipients.add(`${uid}_${dateStr}_${slot}`);
}

export async function recordRecipientSend(
  uid: string,
  templateId: string,
  subject: string
): Promise<void> {
  if (adminDb) {
    try {
      await adminDb.collection('marketing_recipient_logs').add({
        uid,
        templateId,
        subject,
        sentAt: new Date().toISOString()
      });
    } catch {}
  }
}

export async function getRecipientRecentSends(uid: string): Promise<{ templateIds: string[]; subjects: string[] }> {
  const templateIds: string[] = [];
  const subjects: string[] = [];

  if (adminDb) {
    try {
      const snapshot = await adminDb
        .collection('marketing_recipient_logs')
        .where('uid', '==', uid)
        .orderBy('sentAt', 'desc')
        .limit(6)
        .get();

      snapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data.templateId) templateIds.push(data.templateId);
        if (data.subject) subjects.push(data.subject);
      });
    } catch {}
  }

  return { templateIds, subjects };
}

// ----------------------------------------------------------------------------
// 5. Eligible Recipient Retrieval
// ----------------------------------------------------------------------------
export async function getEligibleMarketingRecipients(): Promise<EmailRecipient[]> {
  const recipientsMap = new Map<string, EmailRecipient>();

  // 1. Fetch real users from Firestore
  if (adminDb) {
    try {
      // Populate Firestore suppressions set using SHA-256 hashes and email values
      const suppressionSnap = await adminDb.collection('marketing_suppressions').get().catch(() => null);
      const firestoreSuppressions = new Set<string>();
      if (suppressionSnap) {
        suppressionSnap.forEach((doc: any) => {
          const data = doc.data();
          if (data?.email) {
            firestoreSuppressions.add(String(data.email).toLowerCase().trim());
          }
        });
      }

      const usersSnap = await adminDb.collection('users').get();
      usersSnap.forEach((doc: any) => {
        const data = doc.data();
        const rawEmail = data?.email || data?.userEmail;

        if (typeof rawEmail === 'string' && isValidEmailAddress(rawEmail)) {
          const email = rawEmail.toLowerCase().trim();

          // STRICT CONSENT & VERIFICATION RULES:
          // 1. Must be email-verified
          // 2. Must have explicit marketing opt-in: marketingEmailOptIn === true
          // 3. Must not be suppressed locally or in Firestore
          if (
            data.emailVerified !== true ||
            data.marketingEmailOptIn !== true ||
            isEmailSuppressed(email) ||
            firestoreSuppressions.has(email)
          ) {
            return;
          }

          recipientsMap.set(email, {
            uid: doc.id,
            email,
            name: data.displayName || data.firstName || data.name,
            marketingEmailOptIn: true,
            emailVerified: true,
            gender: data.gender || data.fashionPreference?.gender,
            preferences: data.fashionPreference || data.preferences || {}
          });
        }
      });
    } catch (err) {
      console.warn('[Marketing Email] Error fetching Firestore recipients:', err);
    }
  }

  // 2. Local fallback registered users (dev / test mode only, never in production)
  if (process.env.NODE_ENV !== 'production' && recipientsMap.size === 0) {
    const localUsersFile = path.resolve(DATA_DIR, 'registered_users.json');
    if (fs.existsSync(localUsersFile)) {
      try {
        const localUsers = JSON.parse(fs.readFileSync(localUsersFile, 'utf8'));
        if (Array.isArray(localUsers)) {
          for (const u of localUsers) {
            if (u.email && isValidEmailAddress(u.email)) {
              const email = u.email.toLowerCase().trim();
              if (u.marketingEmailOptIn !== true || u.emailVerified !== true || isEmailSuppressed(email)) {
                continue;
              }
              if (!recipientsMap.has(email)) {
                recipientsMap.set(email, {
                  uid: u.uid || `local_${email}`,
                  email,
                  name: u.name,
                  marketingEmailOptIn: true,
                  emailVerified: true,
                  gender: u.gender,
                  preferences: u.preferences
                });
              }
            }
          }
        }
      } catch {}
    }
  }

  return Array.from(recipientsMap.values());
}

export async function isRecipientCurrentlyEligible(user: EmailRecipient): Promise<boolean> {
  if (isEmailSuppressed(user.email)) return false;
  if (!adminDb) {
    return user.marketingEmailOptIn === true && user.emailVerified === true;
  }
  try {
    const userRef = adminDb.collection('users').doc(user.uid);
    const hashId = crypto.createHash('sha256').update(user.email.toLowerCase().trim()).digest('hex');
    const suppressionRef = adminDb.collection('marketing_suppressions').doc(hashId);
    const [userSnap, suppressionSnap] = await Promise.all([userRef.get(), suppressionRef.get()]);
    if (!userSnap.exists || suppressionSnap.exists) return false;
    const data = userSnap.data();
    return (
      data?.emailVerified === true &&
      data?.marketingEmailOptIn === true &&
      typeof data?.email === 'string' &&
      data.email.toLowerCase().trim() === user.email.toLowerCase().trim()
    );
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// 6. Product Catalog Fetcher for Dynamic Personalization
// ----------------------------------------------------------------------------
let cachedProductCatalog: Array<{ id: string; name: string; category?: string; price?: number; imageUrl?: string }> = [];
let lastCatalogFetch = 0;

export async function getCachedProductCatalog(): Promise<Array<{ id: string; name: string; category?: string; price?: number; imageUrl?: string }>> {
  if (Date.now() - lastCatalogFetch < 30 * 60 * 1000 && cachedProductCatalog.length > 0) {
    return cachedProductCatalog;
  }

  if (adminDb) {
    try {
      const snap = await adminDb.collection('products').limit(20).get();
      const list: any[] = [];
      snap.forEach((doc: any) => {
        const d = doc.data();
        list.push({
          id: doc.id,
          name: d.name || d.title || 'Curated Style Item',
          category: d.category || 'Apparel',
          price: d.price || 1499,
          imageUrl: d.imageUrl || d.images?.[0]
        });
      });
      if (list.length > 0) {
        cachedProductCatalog = list;
        lastCatalogFetch = Date.now();
        return cachedProductCatalog;
      }
    } catch {}
  }

  cachedProductCatalog = [
    { id: 'prod_01', name: 'Oversized Cuban Collar Linen Shirt', category: 'Shirts', price: 1799 },
    { id: 'prod_02', name: 'Relaxed Tailored Pleated Trousers', category: 'Pants', price: 2199 },
    { id: 'prod_03', name: 'Structured Minimalist Blazer', category: 'Outerwear', price: 3499 },
    { id: 'prod_04', name: 'Monochrome Ribbed Knit Midi Dress', category: 'Dresses', price: 2599 },
    { id: 'prod_05', name: 'Cropped Utility Cargo Jacket', category: 'Jackets', price: 2899 },
    { id: 'prod_06', name: 'Chunky Sole Streetwear Loafers', category: 'Footwear', price: 2999 }
  ];
  lastCatalogFetch = Date.now();
  return cachedProductCatalog;
}

// ----------------------------------------------------------------------------
// 7. Brevo Delivery Engine
// ----------------------------------------------------------------------------
export async function sendBrevoEmail(payload: {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  tags?: string[];
  unsubscribeUrl?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string; simulated?: boolean }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const fromName = process.env.BREVO_SENDER_NAME?.trim() || 'NOVA';

  if (!apiKey || !fromEmail) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, error: 'Brevo is not configured in production' };
    }
    console.log('[Marketing Email] Simulated delivery (Brevo API key or sender email not configured):', {
      recipient: maskEmail(payload.toEmail),
      subject: payload.subject
    });
    return {
      ok: true,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      simulated: true
    };
  }

  const endpoint = 'https://api.brevo.com/v3/smtp/email';
  const headers: Record<string, string> = {
    'api-key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const body: any = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: payload.toEmail, name: payload.toName || 'NOVA Member' }],
    subject: payload.subject,
    htmlContent: payload.htmlContent,
    textContent: payload.textContent,
    tags: payload.tags || ['marketing', 'automated']
  };

  if (payload.unsubscribeUrl) {
    body.headers = {
      'List-Unsubscribe': `<${payload.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    };
  }

  // Retry with exponential backoff on 429
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (response.status === 201) {
        const data: any = await response.json();
        return { ok: true, messageId: data.messageId || 'brevo_accepted' };
      }

      if (response.status === 429 && attempt < maxAttempts) {
        const backoffMs = attempt * 1500;
        console.warn(`[Marketing Email] Brevo rate limit 429, backing off for ${backoffMs}ms...`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      const errorText = await response.text();
      return { ok: false, error: `Brevo error HTTP ${response.status}: ${errorText}` };
    } catch (err: any) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return { ok: false, error: err?.message || 'Network error reaching Brevo API' };
    }
  }

  return { ok: false, error: 'Brevo delivery failed after max retries' };
}

// ----------------------------------------------------------------------------
// 8. Automated Campaign Execution Engine
// ----------------------------------------------------------------------------
export async function executeScheduledMarketingEmailCampaign(
  slot: MarketingSlot
): Promise<EmailCampaignResult> {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const campaignId = `mkt_${slot}_${dateStr.replace(/-/g, '')}`;

  // 1. Atomic Persistent Distributed Lock via Firestore
  let executionRef: any = null;
  if (adminDb) {
    executionRef = adminDb.collection('marketing_campaign_executions').doc(`${slot}_${dateStr}`);
    const claimed = await adminDb.runTransaction(async (tx: any) => {
      const snap = await tx.get(executionRef);
      if (snap.exists) return false;
      tx.create(executionRef, {
        campaignId,
        slot,
        scheduledDate: dateStr,
        timezone: 'Asia/Kolkata',
        status: 'running',
        startedAt: new Date().toISOString()
      });
      return true;
    });

    if (!claimed) {
      console.log(`[Marketing Email] Persistent claim already exists for ${slot}_${dateStr}; skipping duplicate dispatch.`);
      const existing = campaignHistory.find((c) => c.slot === slot && (c as any).scheduledDate === dateStr);
      if (existing) return existing;
      return {
        campaignId,
        slot,
        templateId: 'already_claimed',
        subject: '',
        eligibleRecipients: 0,
        sendAttempts: 0,
        successfulSends: 0,
        failedSends: 0,
        skippedDueToSuppression: 0,
        skippedDueToDuplicate: 0,
        executedAt: new Date().toISOString(),
        providerStatus: 'brevo_accepted'
      };
    }
  } else {
    // Local dev fallback lock
    const lock = await acquireCampaignLock(slot, dateStr);
    if (!lock.acquired) {
      console.log(`[Marketing Email] Execution skipped: ${lock.reason}`);
      const existing = campaignHistory.find((c) => c.slot === slot && (c as any).scheduledDate === dateStr);
      if (existing) return existing;
      return {
        campaignId,
        slot,
        templateId: 'already_claimed',
        subject: '',
        eligibleRecipients: 0,
        sendAttempts: 0,
        successfulSends: 0,
        failedSends: 0,
        skippedDueToSuppression: 0,
        skippedDueToDuplicate: 0,
        executedAt: new Date().toISOString(),
        providerStatus: 'brevo_accepted'
      };
    }
  }

  // 2. Fetch catalog and eligible recipients
  const productCatalog = await getCachedProductCatalog();
  const recipients = await getEligibleMarketingRecipients();
  const baseUrl = getPublicAppUrl();

  let sendAttempts = 0;
  let successfulSends = 0;
  let failedSends = 0;
  let skippedDueToSuppression = 0;
  let skippedDueToDuplicate = 0;
  let overallProviderStatus: 'brevo_accepted' | 'simulated_local' | 'failed' = 'brevo_accepted';
  const recipientLogs: EmailRecipientDeliveryRecord[] = [];

  // Batch sending (10 per batch, 50ms pause)
  const BATCH_SIZE = 10;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    for (const user of batch) {
      // Live eligibility recheck immediately before dispatch
      const eligible = await isRecipientCurrentlyEligible(user);
      if (!eligible) {
        skippedDueToSuppression++;
        continue;
      }

      // Atomic per-recipient delivery claim in Firestore
      const recipientHashId = crypto.createHash('sha256').update(`${user.uid}:${dateStr}:${slot}`).digest('hex');
      const recipientRef = adminDb ? adminDb.collection('marketing_email_deliveries').doc(recipientHashId) : null;

      if (recipientRef) {
        const recipientClaim = await adminDb.runTransaction(async (tx: any) => {
          const snap = await tx.get(recipientRef);
          if (snap.exists) return false;
          tx.create(recipientRef, {
            campaignId,
            uid: user.uid,
            recipient: user.email,
            slot,
            scheduledDate: dateStr,
            status: 'sending',
            startedAt: new Date().toISOString()
          });
          return true;
        });

        if (!recipientClaim) {
          skippedDueToDuplicate++;
          recipientLogs.push({
            recipientId: user.uid,
            emailMasked: maskEmail(user.email),
            templateId: '',
            subject: '',
            ctaText: '',
            status: 'skipped_duplicate',
            dispatchedAt: new Date().toISOString()
          });
          continue;
        }
      } else {
        // Dev fallback check
        const alreadySent = await isRecipientAlreadySentToday(user.uid, dateStr, slot);
        if (alreadySent) {
          skippedDueToDuplicate++;
          continue;
        }
      }

      // Fetch user's recent send history to prevent repeating templates / subject lines
      const { templateIds: recentTemplateIds, subjects: recentSubjects } = await getRecipientRecentSends(user.uid);

      // Generate personalized, unique content for THIS specific recipient (Swiggy/Zomato style)
      const personalized = generatePersonalizedContent({
        slot,
        recipientName: user.name,
        recentTemplateIds,
        recentSubjects,
        userGender: user.gender,
        productCatalog,
        recipientSeed: `${user.email}_${slot}_${dateStr}`
      });

      sendAttempts++;

      const token = generateUnsubscribeToken(user.email);
      const unsubscribeUrl = buildUnsubscribeUrl(user.email, token);

      const html = generateMarketingEmailHtml({
        personalized,
        recipientName: user.name,
        recipientEmail: user.email,
        baseUrl,
        unsubscribeUrl
      });

      const textFallback = `${personalized.headline}\n\n${personalized.bodyText}\n\nExplore in NOVA: ${baseUrl}${personalized.ctaPath}\n\nUnsubscribe: ${unsubscribeUrl}`;

      const res = await sendBrevoEmail({
        toEmail: user.email,
        toName: user.name,
        subject: personalized.subject,
        htmlContent: html,
        textContent: textFallback,
        unsubscribeUrl,
        tags: ['marketing', slot, campaignId]
      });

      if (res.ok) {
        successfulSends++;
        if (res.simulated) overallProviderStatus = 'simulated_local';
        await recordRecipientSend(user.uid, personalized.templateId, personalized.subject);
        recipientLogs.push({
          recipientId: user.uid,
          emailMasked: maskEmail(user.email),
          templateId: personalized.templateId,
          subject: personalized.subject,
          ctaText: personalized.ctaText,
          status: res.simulated ? 'simulated' : 'sent',
          messageId: res.messageId,
          dispatchedAt: new Date().toISOString()
        });
      } else {
        failedSends++;
        recipientLogs.push({
          recipientId: user.uid,
          emailMasked: maskEmail(user.email),
          templateId: personalized.templateId,
          subject: personalized.subject,
          ctaText: personalized.ctaText,
          status: 'failed',
          error: res.error,
          dispatchedAt: new Date().toISOString()
        });
      }

      if (recipientRef) {
        await recipientRef.set({
          status: res.ok ? (res.simulated ? 'simulated' : 'accepted_by_brevo') : 'failed',
          messageId: res.messageId || null,
          error: res.error || null,
          completedAt: new Date().toISOString(),
          selectedTemplateId: personalized.templateId,
          subject: personalized.subject
        }, { merge: true }).catch(() => {});
      }

      // Polite delay between individual dispatches
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  if (failedSends > 0 && successfulSends === 0 && recipients.length > 0) {
    overallProviderStatus = 'failed';
  }

  const result: EmailCampaignResult = {
    campaignId,
    slot,
    templateId: 'personalized_multi_variant',
    subject: `Personalized ${slot === 'morning' ? 'Morning Slay' : 'Evening Vibe'} Campaign (${successfulSends} delivered)`,
    eligibleRecipients: recipients.length,
    sendAttempts,
    successfulSends,
    failedSends,
    skippedDueToSuppression,
    skippedDueToDuplicate,
    executedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    providerStatus: overallProviderStatus,
    recipientLogs: recipientLogs.slice(-25)
  };

  // Record in Firestore execution doc
  if (executionRef) {
    await executionRef.set({
      status: failedSends > 0 ? (successfulSends > 0 ? 'completed_with_failures' : 'failed') : 'completed',
      eligibleRecipients: recipients.length,
      sendAttempts,
      acceptedByBrevo: successfulSends,
      failedSends,
      completedAt: result.completedAt,
      templateId: result.templateId,
      subject: result.subject
    }, { merge: true }).catch(() => {});
  }

  // Also record in local campaign history
  await finalizeCampaignRecord(result);

  console.log(`[Marketing Email] Campaign ${campaignId} finished:`, {
    eligible: recipients.length,
    sent: successfulSends,
    failed: failedSends,
    skippedDuplicate: skippedDueToDuplicate,
    skippedSuppressed: skippedDueToSuppression,
    providerStatus: overallProviderStatus
  });

  return result;
}

// ----------------------------------------------------------------------------
// 9. Administrative Verification Test Send
// ----------------------------------------------------------------------------
export async function sendTestMarketingEmail(payload: {
  toEmail: string;
  templateId?: string;
  slot?: MarketingSlot;
  baseUrl?: string;
}): Promise<{
  ok: boolean;
  messageId?: string;
  templateUsed: MarketingEmailTemplate;
  personalizedUsed: PersonalizedEmailPayload;
  providerStatus: 'brevo_accepted' | 'simulated_local' | 'failed';
  error?: string;
}> {
  const { toEmail, templateId, slot = 'morning', baseUrl = getPublicAppUrl() } = payload;

  const template =
    MARKETING_EMAIL_TEMPLATES.find((t) => t.id === templateId) ||
    MARKETING_EMAIL_TEMPLATES.find((t) => t.slot === slot) ||
    MARKETING_EMAIL_TEMPLATES[0];

  const token = generateUnsubscribeToken(toEmail);
  const unsubscribeUrl = buildUnsubscribeUrl(toEmail, token);

  const personalized = generatePersonalizedContent({
    slot: template.slot || slot,
    recipientName: 'NOVA VIP Tester',
    recentTemplateIds: [],
    recentSubjects: [],
    recipientSeed: `test_${toEmail}`
  });

  const html = generateMarketingEmailHtml({
    personalized,
    recipientName: 'NOVA VIP Tester',
    recipientEmail: toEmail,
    baseUrl,
    unsubscribeUrl
  });

  const res = await sendBrevoEmail({
    toEmail,
    toName: 'NOVA VIP Tester',
    subject: `[TEST] ${personalized.subject}`,
    htmlContent: html,
    textContent: `[TEST CAMPAIGN]\n${personalized.headline}\n\n${personalized.bodyText}\n\nVisit NOVA: ${baseUrl}${personalized.ctaPath}\n\nUnsubscribe: ${unsubscribeUrl}`,
    tags: ['test', 'admin-verification'],
    unsubscribeUrl
  });

  if (!res.ok) {
    return {
      ok: false,
      templateUsed: template,
      personalizedUsed: personalized,
      providerStatus: 'failed',
      error: res.error
    };
  }

  return {
    ok: true,
    messageId: res.messageId,
    templateUsed: template,
    personalizedUsed: personalized,
    providerStatus: res.simulated ? 'simulated_local' : 'brevo_accepted'
  };
}

// ----------------------------------------------------------------------------
// 10. Metrics Reporting
// ----------------------------------------------------------------------------
export function getMarketingEmailMetrics(): MarketingEmailMetrics {
  let totalSendAttempts = 0;
  let totalSuccessfulSends = 0;
  let totalFailedSends = 0;
  let lastMorningCampaignAt: string | null = null;
  let lastEveningCampaignAt: string | null = null;

  for (const c of campaignHistory) {
    totalSendAttempts += c.sendAttempts || 0;
    totalSuccessfulSends += c.successfulSends || 0;
    totalFailedSends += c.failedSends || 0;

    if (c.slot === 'morning' && (!lastMorningCampaignAt || c.executedAt > lastMorningCampaignAt)) {
      lastMorningCampaignAt = c.executedAt;
    }
    if (c.slot === 'evening' && (!lastEveningCampaignAt || c.executedAt > lastEveningCampaignAt)) {
      lastEveningCampaignAt = c.executedAt;
    }
  }

  return {
    totalSendAttempts,
    totalSuccessfulSends,
    totalFailedSends,
    totalUnsubscribes: suppressionSet.size,
    lastMorningCampaignAt,
    lastEveningCampaignAt,
    recentCampaigns: campaignHistory.slice(-10)
  };
}
