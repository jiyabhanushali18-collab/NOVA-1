import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminDb } from './firebaseAdmin';
import { getPublicAppUrl, buildUnsubscribeUrl } from './appUrlConfig';
import {
  MarketingEmailTemplate,
  MarketingSlot,
  selectMarketingEmailTemplate,
  generateMarketingEmailHtml,
  MARKETING_EMAIL_TEMPLATES
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
  marketingOptIn?: boolean;
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
  executedAt: string;
  providerStatus: 'brevo_accepted' | 'simulated_local' | 'failed';
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
// 1. Suppression List & Opt-Out Management
// ----------------------------------------------------------------------------
const suppressionSet = new Set<string>();

function loadSuppressionList() {
  try {
    if (fs.existsSync(SUPPRESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUPPRESSION_FILE, 'utf8'));
      if (Array.isArray(data)) {
        data.forEach((e: string) => suppressionSet.add(e.toLowerCase().trim()));
      }
    }
  } catch {}
}
loadSuppressionList();

function saveSuppressionList() {
  try {
    fs.writeFileSync(
      SUPPRESSION_FILE,
      JSON.stringify(Array.from(suppressionSet), null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn('[Marketing Email] Warning: Could not save suppression list file:', err);
  }
}

export function isEmailSuppressed(email: string): boolean {
  return suppressionSet.has(email.toLowerCase().trim());
}

export async function suppressEmail(email: string, reason: string = 'user_unsubscribe'): Promise<void> {
  const normalized = email.toLowerCase().trim();
  suppressionSet.add(normalized);
  saveSuppressionList();

  // Also sync to Firestore users collection if available
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

      // Also record in a dedicated suppression collection
      await adminDb.collection('marketing_suppressions').doc(crypto.createHash('sha256').update(normalized).digest('hex')).set({
        email: normalized,
        suppressedAt: new Date().toISOString(),
        reason
      }, { merge: true });
    } catch (err) {
      console.warn('[Marketing Email] Firestore suppression sync notice:', err);
    }
  }
}

export async function unsuppressEmail(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  suppressionSet.delete(normalized);
  saveSuppressionList();

  if (adminDb) {
    try {
      // Removing an operational suppression must never manufacture user consent.
      await adminDb.collection('marketing_suppressions').doc(crypto.createHash('sha256').update(normalized).digest('hex')).delete().catch(() => {});
    } catch {}
  }
}

// ----------------------------------------------------------------------------
// 2. Unsubscribe Token Security
// ----------------------------------------------------------------------------
const UNPUB_SECRET = process.env.NOVA_SESSION_SECRET;

export function generateUnsubscribeToken(email: string): string {
  if (!UNPUB_SECRET) throw new Error('NOVA_SESSION_SECRET is required for secure unsubscribe links');
  return crypto
    .createHmac('sha256', UNPUB_SECRET)
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token || !UNPUB_SECRET) return false;
  const expected = generateUnsubscribeToken(email);
  const expectedBuf = Buffer.from(expected);
  const tokenBuf = Buffer.from(token);
  if (expectedBuf.length !== tokenBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, tokenBuf);
}

// ----------------------------------------------------------------------------
// 3. Campaign History & Metrics
// ----------------------------------------------------------------------------
const campaignHistory: EmailCampaignResult[] = [];

function loadCampaignHistory() {
  try {
    if (fs.existsSync(CAMPAIGN_HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(CAMPAIGN_HISTORY_FILE, 'utf8'));
      if (Array.isArray(data)) {
        campaignHistory.push(...data);
      }
    }
  } catch {}
}
loadCampaignHistory();

function saveCampaignHistory() {
  try {
    fs.writeFileSync(
      CAMPAIGN_HISTORY_FILE,
      JSON.stringify(campaignHistory.slice(-50), null, 2),
      'utf8'
    );
  } catch {}
}

export function getMarketingEmailMetrics(): MarketingEmailMetrics {
  let attempts = 0;
  let success = 0;
  let failed = 0;
  let lastMorning: string | null = null;
  let lastEvening: string | null = null;

  for (const c of campaignHistory) {
    attempts += c.sendAttempts;
    success += c.successfulSends;
    failed += c.failedSends;
    if (c.slot === 'morning') lastMorning = c.executedAt;
    if (c.slot === 'evening') lastEvening = c.executedAt;
  }

  return {
    totalSendAttempts: attempts,
    totalSuccessfulSends: success,
    totalFailedSends: failed,
    totalUnsubscribes: suppressionSet.size,
    lastMorningCampaignAt: lastMorning,
    lastEveningCampaignAt: lastEvening,
    recentCampaigns: campaignHistory.slice(-10)
  };
}

// ----------------------------------------------------------------------------
// 4. Retrieve Eligible Registered Users
// ----------------------------------------------------------------------------
export async function getEligibleMarketingRecipients(): Promise<EmailRecipient[]> {
  const recipientsMap = new Map<string, EmailRecipient>();

  // 1. Authoritative Firestore collection 'users'
  if (adminDb) {
    try {
      const usersSnap = await adminDb.collection('users').get();
      const suppressionDocs = await adminDb.collection('marketing_suppressions').get();
      const firestoreSuppressions = new Set<string>();
      suppressionDocs.forEach((doc: any) => {
        const email = doc.data()?.email;
        if (typeof email === 'string') firestoreSuppressions.add(email.toLowerCase().trim());
      });
      usersSnap.forEach((doc: any) => {
        const data = doc.data();
        const rawEmail = data?.email || data?.userEmail;
        if (typeof rawEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail.trim())) {
          const email = rawEmail.toLowerCase().trim();
          if (data.emailVerified !== true || data.marketingEmailOptIn !== true || isEmailSuppressed(email) || firestoreSuppressions.has(email)) {
            return;
          }
          recipientsMap.set(email, {
            uid: doc.id,
            email,
            name: data.name || data.fullName || data.displayName || undefined,
            marketingOptIn: true
          });
        }
      });
    } catch (err) {
      console.warn('[Marketing Email] Warning reading Firestore users:', err);
    }
  }

  // Do not fall back to a local file: it cannot establish verified Firebase identity.

  return Array.from(recipientsMap.values());
}

async function isRecipientCurrentlyEligible(user: EmailRecipient): Promise<boolean> {
  if (!adminDb || user.marketingOptIn !== true || isEmailSuppressed(user.email)) return false;
  try {
    const userRef = adminDb.collection('users').doc(user.uid);
    const suppressionRef = adminDb.collection('marketing_suppressions')
      .doc(crypto.createHash('sha256').update(user.email.toLowerCase().trim()).digest('hex'));
    const [userSnap, suppressionSnap] = await Promise.all([userRef.get(), suppressionRef.get()]);
    const data = userSnap.data();
    return userSnap.exists && !suppressionSnap.exists && data?.emailVerified === true &&
      data?.marketingEmailOptIn === true && typeof data?.email === 'string' &&
      data.email.toLowerCase().trim() === user.email;
  } catch {
    // Consent and suppression state cannot be verified; fail closed.
    return false;
  }
}

// ----------------------------------------------------------------------------
// 5. Brevo REST API Email Dispatcher
// ----------------------------------------------------------------------------
export async function sendBrevoEmail(payload: {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<{ ok: boolean; status?: number; error?: string; messageId?: string; simulated?: boolean }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const fromName = process.env.BREVO_SENDER_NAME?.trim() || 'NOVA';

  // If Brevo is not configured in environment, simulate cleanly for local testing & development
  if (!apiKey || !fromEmail) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, error: 'Brevo is not configured in production' };
    }
    console.log('[Marketing Email] Simulated delivery (Brevo API key or sender email not present in environment):', {
      recipient: payload.toEmail.replace(/^(.).+(@.+)$/, '$1***$2'),
      subject: payload.subject
    });
    return {
      ok: true,
      simulated: true,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: fromName,
          email: fromEmail
        },
        to: [
          {
            email: payload.toEmail,
            name: payload.toName || undefined
          }
        ],
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Marketing Email] Brevo HTTP error:', response.status, errText);
      return { ok: false, status: response.status, error: errText };
    }

    const resJson = (await response.json()) as { messageId?: string };
    return { ok: true, messageId: resJson.messageId };
  } catch (err: any) {
    console.error('[Marketing Email] Brevo network failure:', err?.message);
    return { ok: false, error: err?.message || 'Network failure sending marketing email' };
  }
}

// ----------------------------------------------------------------------------
// 6. Execute Scheduled Email Marketing Campaign
// ----------------------------------------------------------------------------
export async function executeScheduledMarketingEmailCampaign(
  slot: MarketingSlot,
  baseUrl: string = getPublicAppUrl()
): Promise<EmailCampaignResult> {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const campaignId = `email_${slot}_${dateStr}`;

  console.log(`[Marketing Email] Starting scheduled ${slot.toUpperCase()} campaign: ${campaignId}...`);

  // One atomic, persistent claim per scheduled slot prevents parallel instances
  // and restarts from dispatching the same scheduled campaign twice.
  if (!adminDb) {
    console.warn('[Marketing Email] Persistent campaign store unavailable; scheduled send skipped.');
    return { campaignId, slot, templateId: 'none', subject: '', eligibleRecipients: 0, sendAttempts: 0, successfulSends: 0, failedSends: 0, skippedDueToSuppression: 0, executedAt: new Date().toISOString(), providerStatus: 'failed' };
  }
  const executionRef = adminDb.collection('marketing_email_campaigns').doc(campaignId);
  const claimed = await adminDb.runTransaction(async (tx: any) => {
    const snap = await tx.get(executionRef);
    if (snap.exists) return false;
    tx.create(executionRef, { campaignId, slot, scheduledDate: dateStr, timezone: 'Asia/Kolkata', status: 'running', startedAt: new Date().toISOString() });
    return true;
  });
  if (!claimed) {
    console.log(`[Marketing Email] Persistent claim already exists for ${campaignId}; skipping.`);
    return { campaignId, slot, templateId: 'already_claimed', subject: '', eligibleRecipients: 0, sendAttempts: 0, successfulSends: 0, failedSends: 0, skippedDueToSuppression: 0, executedAt: new Date().toISOString(), providerStatus: 'failed' };
  }

  // 1. Select rotating marketing message template
  const recentTemplates = campaignHistory.slice(-4).map((c) => c.templateId);
  const template = selectMarketingEmailTemplate(slot, recentTemplates);

  // 2. Fetch authoritative eligible recipients
  const recipients = await getEligibleMarketingRecipients();

  let sendAttempts = 0;
  let successfulSends = 0;
  let failedSends = 0;
  let skippedDueToSuppression = 0;
  let providerStatus: 'brevo_accepted' | 'simulated_local' | 'failed' = 'brevo_accepted';

  // 3. Batch dispatch with rate-limiting
  const BATCH_SIZE = 5;
  const DELAY_MS = 150;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    for (const user of batch) {
      // Recheck consent and suppression status immediately before sending each email
      if (!(await isRecipientCurrentlyEligible(user))) {
        skippedDueToSuppression++;
        continue;
      }

      const recipientRef = adminDb.collection('marketing_email_deliveries').doc(crypto.createHash('sha256').update(`${user.uid}:${dateStr}:${slot}`).digest('hex'));
      const recipientClaim = await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(recipientRef);
        if (snap.exists) return false;
        tx.create(recipientRef, { campaignId, uid: user.uid, recipient: user.email, slot, scheduledDate: dateStr, status: 'sending', selectedTemplateId: template.id, subject: template.subject, startedAt: new Date().toISOString() });
        return true;
      });
      if (!recipientClaim) { skippedDueToSuppression++; continue; }

      const allUserTemplates = MARKETING_EMAIL_TEMPLATES.filter((item) => item.slot === slot);
      const previousDeliveries = await adminDb.collection('marketing_email_deliveries')
        .where('uid', '==', user.uid).where('slot', '==', slot).limit(8).get();
      const recentlyUsed = new Set<string>();
      previousDeliveries.forEach((doc: any) => {
        const data = doc.data();
        if (data.scheduledDate !== dateStr && typeof data.selectedTemplateId === 'string') recentlyUsed.add(data.selectedTemplateId);
      });
      const cooledTemplates = allUserTemplates.filter((item) => !recentlyUsed.has(item.id));
      const userTemplatePool = cooledTemplates.length ? cooledTemplates : allUserTemplates;
      const userSeed = crypto.createHash('sha256').update(`${user.uid}:${dateStr}:${slot}`).digest();
      const userTemplate = userTemplatePool[userSeed.readUInt32BE(0) % userTemplatePool.length] || template;

      sendAttempts++;
      const token = generateUnsubscribeToken(user.email);
      const unsubscribeUrl = buildUnsubscribeUrl(user.email, token);

      const html = generateMarketingEmailHtml({
        template: userTemplate,
        recipientName: user.name,
        recipientEmail: user.email,
        baseUrl,
        unsubscribeUrl
      });

      const res = await sendBrevoEmail({
        toEmail: user.email,
        toName: user.name,
        subject: userTemplate.subject,
        htmlContent: html,
        textContent: `${userTemplate.headline}\n\n${userTemplate.bodyText}\n\nVisit NOVA: ${baseUrl}${userTemplate.ctaPath}\n\nUnsubscribe: ${unsubscribeUrl}`
      });

      if (res.ok) {
        successfulSends++;
        if (res.simulated) {
          providerStatus = 'simulated_local';
        }
      } else {
        failedSends++;
      }
      await recipientRef.set({ status: res.ok ? (res.simulated ? 'simulated' : 'accepted_by_brevo') : 'failed', messageId: res.messageId || null, error: res.error || null, completedAt: new Date().toISOString() }, { merge: true });
    }

    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  if (successfulSends === 0 && failedSends > 0) {
    providerStatus = 'failed';
  }

  const result: EmailCampaignResult = {
    campaignId,
    slot,
    templateId: template.id,
    subject: template.subject,
    eligibleRecipients: recipients.length,
    sendAttempts,
    successfulSends,
    failedSends,
    skippedDueToSuppression,
    executedAt: new Date().toISOString(),
    providerStatus
  };

  campaignHistory.push(result);
  saveCampaignHistory();
  await executionRef.set({ status: failedSends > 0 ? (successfulSends > 0 ? 'completed_with_failures' : 'failed') : 'completed', eligibleRecipients: recipients.length, sendAttempts, acceptedByBrevo: successfulSends, failedSends, completedAt: result.executedAt, templateId: template.id, subject: template.subject }, { merge: true });

  console.log(`[Marketing Email] Campaign ${campaignId} completed:`, {
    eligible: recipients.length,
    sent: successfulSends,
    failed: failedSends,
    providerStatus
  });

  return result;
}

// ----------------------------------------------------------------------------
// 7. Test Send for Administrative Verification
// ----------------------------------------------------------------------------
export async function sendTestMarketingEmail(payload: {
  toEmail: string;
  templateId?: string;
  baseUrl?: string;
}): Promise<{ ok: boolean; messageId?: string; templateUsed: MarketingEmailTemplate; error?: string }> {
  const { toEmail, templateId, baseUrl = getPublicAppUrl() } = payload;

  const template =
    MARKETING_EMAIL_TEMPLATES.find((t) => t.id === templateId) ||
    MARKETING_EMAIL_TEMPLATES[0];

  const token = generateUnsubscribeToken(toEmail);
  const unsubscribeUrl = buildUnsubscribeUrl(toEmail, token);

  const html = generateMarketingEmailHtml({
    template,
    recipientName: 'NOVA Tester',
    recipientEmail: toEmail,
    baseUrl,
    unsubscribeUrl
  });

  const res = await sendBrevoEmail({
    toEmail,
    toName: 'NOVA Tester',
    subject: `[TEST] ${template.subject}`,
    htmlContent: html,
    textContent: `[TEST CAMPAIGN]\n${template.headline}\n\n${template.bodyText}\n\nVisit NOVA: ${baseUrl}${template.ctaPath}\n\nUnsubscribe: ${unsubscribeUrl}`
  });

  if (!res.ok) {
    return { ok: false, templateUsed: template, error: res.error };
  }

  return { ok: true, messageId: res.messageId, templateUsed: template };
}
