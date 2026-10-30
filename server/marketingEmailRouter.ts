import express, { Request, Response, NextFunction } from 'express';
import { getPublicAppUrl } from './appUrlConfig';
import {
  suppressEmail,
  unsuppressEmail,
  verifyUnsubscribeToken,
  isEmailSuppressed,
  getMarketingEmailMetrics,
  sendTestMarketingEmail,
  getEligibleMarketingRecipients
} from './marketingEmailService';
import {
  getMarketingSchedulerConfig,
  updateMarketingSchedulerConfig,
  pauseMarketingEmailScheduler,
  resumeMarketingEmailScheduler,
  triggerManualEmailCampaign
} from './marketingEmailScheduler';
import { MARKETING_EMAIL_TEMPLATES } from './marketingEmailLibrary';

const router = express.Router();

const getAdminSecret = (): string =>
  (process.env.NOVA_ADMIN_SECRET || process.env.DECART_ADMIN_SECRET || '').trim();

const verifyAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  const adminSecret = getAdminSecret();
  const headerSecret = String(req.headers['x-admin-key'] || '').trim();
  const authHeader = String(req.headers['authorization'] || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  const candidate = headerSecret || bearerToken;
  if (!candidate) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Administrative credential required.'
    });
  }

  if (adminSecret && candidate === adminSecret) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized. Invalid administrative credential.'
  });
};

// ----------------------------------------------------------------------------
// 1. One-Click Web Unsubscribe Link (CAN-SPAM / GDPR Compliant)
// ----------------------------------------------------------------------------
router.get('/marketing/unsubscribe', async (req: Request, res: Response) => {
  const rawEmail = String(req.query.email || '').trim();
  const token = String(req.query.token || '').trim();

  if (!rawEmail || !rawEmail.includes('@')) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>NOVA - Invalid Request</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="background:#0B0E1E;color:#E2E8F0;font-family:sans-serif;padding:40px;text-align:center;">
        <h2>Invalid Unsubscribe Link</h2>
        <p>The link is incomplete or missing a valid email address.</p>
      </body>
      </html>
    `);
  }

  // Verify HMAC signature token
  const isValid = verifyUnsubscribeToken(rawEmail, token);
  if (!isValid) {
    return res.status(403).send('This unsubscribe link is invalid or expired.');
  }

  // Process unsubscribe
  await suppressEmail(rawEmail, 'user_link_unsubscribe');

  const appBaseUrl = getPublicAppUrl();

  return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribed • NOVA</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #0B0E1E;
          color: #E2E8F0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .card {
          max-width: 440px;
          margin: 20px;
          background: #12162B;
          border: 1px solid #232A4C;
          border-radius: 24px;
          padding: 36px 32px;
          text-align: center;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        }
        .icon {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: rgba(85, 59, 226, 0.15);
          color: #553BE2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          margin-bottom: 20px;
        }
        h2 { margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #FFFFFF; }
        p { font-size: 13px; line-height: 1.6; color: #94A3B8; margin-bottom: 24px; }
        .email-badge {
          display: inline-block;
          background: #1A203E;
          border: 1px solid #283360;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          color: #C7D2FE;
          margin-bottom: 24px;
        }
        .button {
          display: inline-block;
          background: #553BE2;
          color: #FFFFFF !important;
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
          padding: 12px 28px;
          border-radius: 12px;
          transition: all 0.2s;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">✉️</div>
        <h2>You&apos;ve Been Unsubscribed</h2>
        <div class="email-badge">${rawEmail}</div>
        <p>
          You will no longer receive daily marketing emails or style drop notifications from NOVA.<br><br>
          <small style="color:#64748B;">Note: Critical transactional emails such as order receipts and OTP login codes will still be delivered safely.</small>
        </p>
        <a href="${appBaseUrl}" class="button">Return to NOVA</a>
      </div>
    </body>
    </html>
  `);
});

// ----------------------------------------------------------------------------
// 2. Programmatic API Unsubscribe & Preference Endpoints
// ----------------------------------------------------------------------------
router.post('/marketing/unsubscribe', async (req: Request, res: Response) => {
  const { email, token } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  if (!token || !verifyUnsubscribeToken(email, token)) {
    return res.status(403).json({ success: false, error: 'Invalid security token' });
  }

  await suppressEmail(email, 'api_request');
  return res.json({ success: true, message: `Email ${email} has been unsubscribed from marketing campaigns.` });
});

router.post('/marketing/resubscribe', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  return res.status(409).json({ success: false, error: 'To subscribe again, update marketing email consent in your NOVA account settings.' });
});

// ----------------------------------------------------------------------------
// 3. Public Health Status
// ----------------------------------------------------------------------------
router.get('/marketing/status', async (_req: Request, res: Response) => {
  const metrics = getMarketingEmailMetrics();
  const config = getMarketingSchedulerConfig();
  const eligible = await getEligibleMarketingRecipients();

  return res.json({
    success: true,
    status: 'healthy',
    channel: 'email',
    eligibleRegisteredRecipients: eligible.length,
    schedulerEnabled: config.enabled,
    morningTime: config.morningTime,
    eveningTime: config.eveningTime,
    timezone: config.defaultTimezone,
    metrics
  });
});

// ----------------------------------------------------------------------------
// 4. Protected Admin Endpoints
// ----------------------------------------------------------------------------
router.get('/marketing/admin/config', verifyAdminAccess, async (_req: Request, res: Response) => {
  const config = getMarketingSchedulerConfig();
  const metrics = getMarketingEmailMetrics();
  const eligible = await getEligibleMarketingRecipients();

  return res.json({
    success: true,
    config,
    metrics,
    eligibleRecipientsCount: eligible.length
  });
});

router.post('/marketing/admin/config', verifyAdminAccess, (req: Request, res: Response) => {
  try {
    const { morningHour, morningMinute, eveningHour, eveningMinute, enabled, defaultTimezone } = req.body;
    const updates: any = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof defaultTimezone === 'string') updates.defaultTimezone = defaultTimezone;
    if (typeof morningHour === 'number' && typeof morningMinute === 'number') {
      updates.morningTime = { hour: morningHour, minute: morningMinute };
    }
    if (typeof eveningHour === 'number' && typeof eveningMinute === 'number') {
      updates.eveningTime = { hour: eveningHour, minute: eveningMinute };
    }

    const updated = updateMarketingSchedulerConfig(updates);
    return res.json({ success: true, message: 'Marketing email scheduler updated', config: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Update failed' });
  }
});

router.post('/marketing/admin/pause', verifyAdminAccess, (_req: Request, res: Response) => {
  pauseMarketingEmailScheduler();
  return res.json({ success: true, message: 'Marketing email campaigns paused' });
});

router.post('/marketing/admin/resume', verifyAdminAccess, (_req: Request, res: Response) => {
  resumeMarketingEmailScheduler();
  return res.json({ success: true, message: 'Marketing email campaigns resumed' });
});

router.post('/marketing/admin/trigger', verifyAdminAccess, async (req: Request, res: Response) => {
  try {
    const slot = req.body.slot === 'evening' ? 'evening' : 'morning';
    const result = await triggerManualEmailCampaign(slot);
    return res.json({ success: true, message: `Manual ${slot} email campaign executed`, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Manual execution failed' });
  }
});

router.post('/marketing/admin/test-send', verifyAdminAccess, async (req: Request, res: Response) => {
  try {
    const { toEmail, templateId } = req.body;
    if (!toEmail || typeof toEmail !== 'string' || !toEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid recipient email required' });
    }

    const result = await sendTestMarketingEmail({ toEmail, templateId });
    return res.json({
      success: result.ok,
      messageId: result.messageId,
      templateUsed: result.templateUsed.id,
      subject: result.templateUsed.subject,
      error: result.error
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Test send failed' });
  }
});

router.get('/marketing/admin/templates', verifyAdminAccess, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    count: MARKETING_EMAIL_TEMPLATES.length,
    templates: MARKETING_EMAIL_TEMPLATES
  });
});

export default router;
