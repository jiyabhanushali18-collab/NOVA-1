import {
  MarketingSlot,
  executeScheduledMarketingEmailCampaign
} from './marketingEmailService';

export interface EmailSchedulerConfig {
  enabled: boolean;
  morningTime: { hour: number; minute: number }; // Default 10:00 AM
  eveningTime: { hour: number; minute: number }; // Default 7:30 PM (19:30)
  defaultTimezone: string; // 'Asia/Kolkata'
  lastMorningRunDate: string | null;
  lastEveningRunDate: string | null;
}

const config: EmailSchedulerConfig = {
  enabled: true,
  morningTime: { hour: 10, minute: 0 },
  eveningTime: { hour: 19, minute: 30 },
  defaultTimezone: 'Asia/Kolkata',
  lastMorningRunDate: null,
  lastEveningRunDate: null
};

let schedulerTimer: NodeJS.Timeout | null = null;

function getTimeInTimezone(timezone: string): { hour: number; minute: number; dateStr: string } {
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
    return { hour, minute, dateStr };
  } catch {
    const fallback = new Date();
    return {
      hour: fallback.getHours(),
      minute: fallback.getMinutes(),
      dateStr: fallback.toISOString().split('T')[0]
    };
  }
}

async function checkAndTriggerEmailCampaigns(): Promise<void> {
  if (!config.enabled) return;

  const { hour, minute, dateStr } = getTimeInTimezone(config.defaultTimezone);

  // 1. Morning Email Campaign (10:00 AM)
  const isMorningWindow =
    hour === config.morningTime.hour &&
    Math.abs(minute - config.morningTime.minute) <= 2;

  if (isMorningWindow && config.lastMorningRunDate !== dateStr) {
    config.lastMorningRunDate = dateStr;
    console.log(
      `[Marketing Email Scheduler] Triggering automated MORNING email campaign at ${hour}:${minute} (${config.defaultTimezone})...`
    );
    try {
      await executeScheduledMarketingEmailCampaign('morning');
    } catch (err) {
      console.error('[Marketing Email Scheduler] Morning campaign error:', err);
    }
  }

  // 2. Evening Email Campaign (7:30 PM / 19:30)
  const isEveningWindow =
    hour === config.eveningTime.hour &&
    Math.abs(minute - config.eveningTime.minute) <= 2;

  if (isEveningWindow && config.lastEveningRunDate !== dateStr) {
    config.lastEveningRunDate = dateStr;
    console.log(
      `[Marketing Email Scheduler] Triggering automated EVENING email campaign at ${hour}:${minute} (${config.defaultTimezone})...`
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
    `[Marketing Email Scheduler] Initialized: Morning at ${config.morningTime.hour}:${String(config.morningTime.minute).padStart(2, '0')}, Evening at ${config.eveningTime.hour}:${String(config.eveningTime.minute).padStart(2, '0')} (${config.defaultTimezone}).`
  );

  // Check every 45 seconds for scheduled window
  schedulerTimer = setInterval(checkAndTriggerEmailCampaigns, 45000);
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
