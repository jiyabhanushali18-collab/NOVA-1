import {
  MarketingSlot,
  executeScheduledMarketingEmailCampaign
} from './marketingEmailService';
import { adminDb } from './firebaseAdmin';

export interface EmailSchedulerConfig {
  enabled: boolean;
  morningTime: { hour: number; minute: number }; // 10:00 AM IST
  eveningTime: { hour: number; minute: number }; // 7:00 PM IST (19:00)
  defaultTimezone: string; // 'Asia/Kolkata'
  lastMorningRunDate: string | null;
  lastEveningRunDate: string | null;
}

const config: EmailSchedulerConfig = {
  enabled: true,
  morningTime: { hour: 10, minute: 0 },
  eveningTime: { hour: 19, minute: 0 },
  defaultTimezone: 'Asia/Kolkata',
  lastMorningRunDate: null,
  lastEveningRunDate: null
};

let schedulerTimer: NodeJS.Timeout | null = null;
let checkInProgress = false;

export function getTimeInTimezone(timezone: string = config.defaultTimezone): {
  hour: number;
  minute: number;
  dateStr: string;
  isoString: string;
} {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    let year = '', month = '', day = '', hour = 0, minute = 0;

    for (const p of parts) {
      if (p.type === 'year') year = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'day') day = p.value;
      if (p.type === 'hour') hour = parseInt(p.value, 10);
      if (p.type === 'minute') minute = parseInt(p.value, 10);
    }

    const dateStr = `${year}-${month}-${day}`;
    return { hour, minute, dateStr, isoString: now.toISOString() };
  } catch {
    // Robust mathematical fallback for Asia/Kolkata (UTC + 5:30)
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    const hour = istDate.getUTCHours();
    const minute = istDate.getUTCMinutes();
    const dateStr = istDate.toISOString().split('T')[0];
    return { hour, minute, dateStr, isoString: now.toISOString() };
  }
}

export async function isCampaignAlreadyExecutedPersistently(slot: MarketingSlot, dateStr: string): Promise<boolean> {
  if (adminDb) {
    try {
      const doc = await adminDb.collection('marketing_campaign_executions').doc(`${slot}_${dateStr}`).get();
      if (doc.exists) {
        const data = doc.data();
        if (data?.status === 'completed' || data?.status === 'completed_with_failures') return true;
        if (data?.status === 'running') {
          const startedAt = new Date(data.startedAt || 0).getTime();
          // If within the last 15 minutes, consider it currently active
          if (Date.now() - startedAt < 15 * 60 * 1000) return true;
        }
      }
    } catch {}
  }
  return false;
}

export async function checkAndTriggerEmailCampaigns(): Promise<void> {
  if (!config.enabled || checkInProgress) return;
  checkInProgress = true;
  try {
    await checkDueCampaigns();
  } catch (err) {
    console.error('[Marketing Email Scheduler] Schedule check failed:', err);
  } finally {
    checkInProgress = false;
  }
}

async function checkDueCampaigns(): Promise<void> {
  const { hour, minute, dateStr } = getTimeInTimezone(config.defaultTimezone);

  // 1. Morning Campaign Window (10:00 AM IST, window 10:00 - 10:04)
  const isMorningWindow =
    hour === config.morningTime.hour &&
    minute >= config.morningTime.minute &&
    minute <= config.morningTime.minute + 4;

  if (isMorningWindow && config.lastMorningRunDate !== dateStr) {
    config.lastMorningRunDate = dateStr;
    console.log(
      `[Marketing Email Scheduler] Triggering automated MORNING email campaign at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${config.defaultTimezone})...`
    );
    try {
      await executeScheduledMarketingEmailCampaign('morning');
    } catch (err) {
      console.error('[Marketing Email Scheduler] Morning campaign error:', err);
    }
  }

  // 2. Evening Campaign Window (7:00 PM IST / 19:00, window 19:00 - 19:04)
  const isEveningWindow =
    hour === config.eveningTime.hour &&
    minute >= config.eveningTime.minute &&
    minute <= config.eveningTime.minute + 4;

  if (isEveningWindow && config.lastEveningRunDate !== dateStr) {
    config.lastEveningRunDate = dateStr;
    console.log(
      `[Marketing Email Scheduler] Triggering automated EVENING email campaign at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${config.defaultTimezone})...`
    );
    try {
      await executeScheduledMarketingEmailCampaign('evening');
    } catch (err) {
      console.error('[Marketing Email Scheduler] Evening campaign error:', err);
    }
  }
}

export function startMarketingEmailScheduler(): void {
  if (schedulerTimer) return;

  console.log(
    `[Marketing Email Scheduler] Initialized: Morning at ${String(config.morningTime.hour).padStart(2, '0')}:${String(config.morningTime.minute).padStart(2, '0')} IST, Evening at ${String(config.eveningTime.hour).padStart(2, '0')}:${String(config.eveningTime.minute).padStart(2, '0')} IST (${config.defaultTimezone}).`
  );

  // A persistent Firestore campaign claim makes checks safe across restarts and instances.
  // The narrow window deliberately skips missed campaigns instead of catching up in a burst.
  setTimeout(() => {
    void checkAndTriggerEmailCampaigns();
  }, 3000);

  // Check every 30 seconds for scheduled window
  schedulerTimer = setInterval(() => {
    void checkAndTriggerEmailCampaigns();
  }, 30000);
}

export function stopMarketingEmailScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export function getMarketingSchedulerConfig(): EmailSchedulerConfig {
  return { ...config };
}

export function updateMarketingSchedulerConfig(updates: Partial<EmailSchedulerConfig>): EmailSchedulerConfig {
  if (typeof updates.enabled === 'boolean') config.enabled = updates.enabled;
  if (updates.morningTime) config.morningTime = updates.morningTime;
  if (updates.eveningTime) config.eveningTime = updates.eveningTime;
  if (updates.defaultTimezone) config.defaultTimezone = updates.defaultTimezone;
  return { ...config };
}

export function pauseMarketingEmailScheduler(): void {
  config.enabled = false;
  console.log('[Marketing Email Scheduler] Paused.');
}

export function resumeMarketingEmailScheduler(): void {
  config.enabled = true;
  console.log('[Marketing Email Scheduler] Resumed.');
}

export async function triggerManualEmailCampaign(slot: MarketingSlot) {
  console.log(`[Marketing Email Scheduler] Manually triggering ${slot} campaign...`);
  return await executeScheduledMarketingEmailCampaign(slot);
}

export function getNextCampaignTiming(): {
  currentTimeIST: string;
  nextMorningCampaign: string;
  nextEveningCampaign: string;
} {
  const { hour, minute, dateStr } = getTimeInTimezone(config.defaultTimezone);
  const currentTimeIST = `${dateStr} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`;

  // Morning: 10:00
  let nextMorningDate = dateStr;
  if (hour > 10 || (hour === 10 && minute > 0)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    nextMorningDate = tomorrow.toLocaleDateString('en-CA', { timeZone: config.defaultTimezone });
  }
  const nextMorningCampaign = `${nextMorningDate} 10:00 AM IST`;

  // Evening: 19:00
  let nextEveningDate = dateStr;
  if (hour > 19 || (hour === 19 && minute > 0)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    nextEveningDate = tomorrow.toLocaleDateString('en-CA', { timeZone: config.defaultTimezone });
  }
  const nextEveningCampaign = `${nextEveningDate} 07:00 PM IST`;

  return { currentTimeIST, nextMorningCampaign, nextEveningCampaign };
}
