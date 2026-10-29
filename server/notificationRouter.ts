import express, { Request, Response } from 'express';
import {
  registerDevicePushToken,
  updateNotificationPreferences,
  trackNotificationTap,
  getNotificationMetrics
} from './notificationService';

const router = express.Router();

/**
 * POST /api/notifications/register-token
 * Registers or updates an FCM / Web device push token with marketing consent.
 */
router.post('/notifications/register-token', async (req: Request, res: Response) => {
  try {
    const { token, userId, userEmail, platform, timezone, marketingOptIn, categories, language } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Push registration token is required.' });
    }

    const record = await registerDevicePushToken({
      token,
      userId,
      userEmail,
      platform,
      timezone,
      marketingOptIn,
      categories,
      language
    });

    return res.json({
      success: true,
      message: 'Device push token registered successfully',
      tokenId: record.tokenId,
      marketingOptIn: record.marketingOptIn
    });
  } catch (err: any) {
    console.error('[Notification Router] Registration error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to register token' });
  }
});

/**
 * POST /api/notifications/preferences
 * Update user marketing preferences (opt-in / opt-out / categories).
 */
router.post('/notifications/preferences', async (req: Request, res: Response) => {
  try {
    const { tokenId, userId, marketingOptIn, priceDrops, newArrivals, stylistReminders, marketing, language, timezone } = req.body;

    if (!tokenId && !userId) {
      return res.status(400).json({ success: false, error: 'tokenId or userId is required.' });
    }

    const { updatedCount } = await updateNotificationPreferences(
      { tokenId, userId },
      { marketingOptIn, priceDrops, newArrivals, stylistReminders, marketing, language, timezone }
    );

    return res.json({
      success: true,
      message: 'Preferences updated successfully',
      updatedCount
    });
  } catch (err: any) {
    console.error('[Notification Router] Preferences error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update preferences' });
  }
});

/**
 * POST /api/notifications/track-tap
 * Records a user tapping a received push notification for measurable engagement attribution.
 */
router.post('/notifications/track-tap', (req: Request, res: Response) => {
  try {
    const { campaignId, tokenId, deepLink } = req.body;
    trackNotificationTap({ campaignId, tokenId, deepLink });
    return res.json({ success: true, message: 'Tap recorded' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to record tap' });
  }
});

/**
 * GET /api/notifications/status
 * Public health & telemetry summary
 */
router.get('/notifications/status', (_req: Request, res: Response) => {
  const metrics = getNotificationMetrics();
  return res.json({
    success: true,
    status: 'healthy',
    activeOptedInRecipients: metrics.activeOptedInRecipients,
    totalRegisteredDevices: metrics.totalRegisteredDevices
  });
});

export default router;
