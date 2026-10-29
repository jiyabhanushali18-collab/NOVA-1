import {
  NotificationSlot,
  executeScheduledMarketingCampaign,
  getNotificationMetrics
} from './notificationService';

export interface SchedulerConfig {
  enabled: boolean;
  morningTime: { hour: number; minute: number }; // 10:00 AM default
  eveningTime: { hour: number; minute: number }; // 7:00 PM default (19:00)
  defaultTimezone: string; // 'Asia/Kolkata'
  lastMorningRunDate: string | null;
  lastEveningRunDate: string | null;
}

const config: SchedulerConfig = {
  enabled: true,
  morningTime: { hour: 10, minute: 0 },
  eveningTime: { hour: 19, minute: 0 },
  defaultTimezone: 'Asia/Kolkata',
  lastMorningRunDate: null,
  lastEveningRunDate: null
};

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Gets current hour and minute in a given IANA timezone.
 */
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
  } catch (err) {
    // Fallback to UTC/IST
    const fallback = new Date();
    return {
      hour: fallback.getHours(),
      minute: fallback.getMinutes(),
      dateStr: fallback.toISOString().split('T')[0]
    };
  }
}

/**
 * Evaluate if a scheduled campaign should fire right now.
 */
async function checkAndTriggerCampaigns(): Promise<void> {
  if (!config.enabled) {
    return;
  }

  const { hour, minute, dateStr } = getTimeInTimezone(config.defaultTimezone);

  // 1. Morning Campaign (Default 10:00 AM)
  const isMorningWindow =
    hour === config.morningTime.hour &&
    Math.abs(minute - config.morningTime.minute) <= 2;

  if (isMorningWindow && config.lastMorningRunDate !== dateStr) {
    config.lastMorningRunDate = dateStr;
    console.log(`[Notification Scheduler] Triggering automated MORNING campaign at ${hour}:${minute} (${config.defaultTimezone})...`);
    try {
      await executeScheduledMarketingCampaign('morning');
    } catch (err) {
      console.error('[Notification Scheduler] Morning campaign execution error:', err);
    }
  }

  // 2. Evening Campaign (Default 7:00 PM / 19:00)
  const isEveningWindow =
    hour === config.eveningTime.hour &&
    Math.abs(minute - config.eveningTime.minute) <= 2;

  if (isEveningWindow && config.lastEveningRunDate !== dateStr) {
    config.lastEveningRunDate = dateStr;
    console.log(`[Notification Scheduler] Triggering automated EVENING campaign at ${hour}:${minute} (${config.defaultTimezone})...`);
    try {
      await executeScheduledMarketingCampaign('evening');
    } catch (err) {
      console.error('[Notification Scheduler] Evening campaign execution error:', err);
    }
  }
}

/**
 * Start the notification scheduler service.
 */
export function startNotificationScheduler(): void {
  if (schedulerInterval) {
    return;
  }

  console.log(`[Notification Scheduler] Active — Morning: ${config.morningTime.hour}:${config.morningTime.minute.toString().padStart(2, '0')}, Evening: ${config.eveningTime.hour}:${config.eveningTime.minute.toString().padStart(2, '0')} (${config.defaultTimezone})`);

  // Run initial check after 5 seconds to align
  setTimeout(() => {
    checkAndTriggerCampaigns().catch(() => {});
  }, 5000);

  // Run periodic 60-second check
  schedulerInterval = setInterval(() => {
    checkAndTriggerCampaigns().catch(() => {});
  }, 60 * 1000);
}

/**
 * Stop or pause the notification scheduler.
 */
export function pauseNotificationScheduler(): void {
  config.enabled = false;
  console.log('[Notification Scheduler] Paused by administrator.');
}

/**
 * Resume the notification scheduler.
 */
export function resumeNotificationScheduler(): void {
  config.enabled = true;
  console.log('[Notification Scheduler] Resumed by administrator.');
}

/**
 * Update configured campaign schedule times.
 */
export function updateSchedulerConfig(updates: {
  morningHour?: number;
  morningMinute?: number;
  eveningHour?: number;
  eveningMinute?: number;
  enabled?: boolean;
  defaultTimezone?: string;
}): SchedulerConfig {
  if (typeof updates.morningHour === 'number' && updates.morningHour >= 0 && updates.morningHour <= 23) {
    config.morningTime.hour = updates.morningHour;
  }
  if (typeof updates.morningMinute === 'number' && updates.morningMinute >= 0 && updates.morningMinute <= 59) {
    config.morningTime.minute = updates.morningMinute;
  }
  if (typeof updates.eveningHour === 'number' && updates.eveningHour >= 0 && updates.eveningHour <= 23) {
    config.eveningTime.hour = updates.eveningHour;
  }
  if (typeof updates.eveningMinute === 'number' && updates.eveningMinute >= 0 && updates.eveningMinute <= 59) {
    config.eveningTime.minute = updates.eveningMinute;
  }
  if (typeof updates.enabled === 'boolean') {
    config.enabled = updates.enabled;
  }
  if (updates.defaultTimezone?.trim()) {
    config.defaultTimezone = updates.defaultTimezone.trim();
  }

  return { ...config };
}

export function getSchedulerConfig(): SchedulerConfig {
  return { ...config };
}
