/**
 * NOVA Marketing Email Copy Library & HTML Template Generator
 *
 * Short, humorous, playful, mildly flirty fashion-marketing copy
 * inspired by high-engagement consumer apps (Zomato, Swiggy)
 * while maintaining NOVA's fashion-focused, AI & AR identity.
 */

import { buildMarketingCtaUrl, getPublicAppUrl } from './appUrlConfig';

export type MarketingSlot = 'morning' | 'evening';

export interface MarketingEmailTemplate {
  id: string;
  slot: MarketingSlot;
  subject: string;
  previewText: string;
  headline: string;
  bodyText: string;
  ctaText: string;
  ctaPath: string; // e.g. '/?screen=showroom'
  category: 'crush' | 'outfit_check' | 'ar_tryon' | 'confidence' | 'wardrobe' | 'evening_look';
}

export const MARKETING_EMAIL_TEMPLATES: MarketingEmailTemplate[] = [
  // --------------------------------------------------------------------------
  // MORNING CAMPAIGNS (10:00 AM) — Outfit inspiration, confidence, daily slay
  // --------------------------------------------------------------------------
  {
    id: 'email_morn_001',
    slot: 'morning',
    subject: 'Crush ka reply aaye na aaye 💅',
    previewText: 'At least your outfit can make an impression.',
    headline: 'Make today your runway moment ✨',
    bodyText:
      'Good morning! Whether your crush replies or leaves you on delivered, your outfit deserves full attention today. Open NOVA, check today\'s trending drops, and walk out looking like a 10/10.',
    ctaText: 'Open NOVA',
    ctaPath: '/?screen=showroom',
    category: 'crush'
  },
  {
    id: 'email_morn_002',
    slot: 'morning',
    subject: 'Outfit status: Still loading? ☕',
    previewText: 'Your coffee is hot. Make sure your drip is too.',
    headline: 'Your coffee is brewing, let\'s fix the fit 👀',
    bodyText:
      'Staring at your closet won\'t make an outfit magically appear (we tried). Open Stylist AI on NOVA, tell us your morning vibe, and get a curated fit in under 30 seconds.',
    ctaText: 'Open NOVA',
    ctaPath: '/?screen=chat',
    category: 'outfit_check'
  },
  {
    id: 'email_morn_003',
    slot: 'morning',
    subject: 'Mirror mirror on the wall... 🪞✨',
    previewText: 'Spoiler: You\'re looking sharp today.',
    headline: 'Virtual fitting room is ready for you',
    bodyText:
      'Why guess how that jacket looks when you can try it on in real-time AR? Tap below, turn on your camera, and see how our newest designer pieces drape before you head out.',
    ctaText: 'Open NOVA',
    ctaPath: '/?screen=ar-tryon',
    category: 'ar_tryon'
  },
  {
    id: 'email_morn_004',
    slot: 'morning',
    subject: 'Wardrobe full, but "kuch nahi hai pehenne ko"? 🙈',
    previewText: 'We\'ve all been there. NOVA to the rescue.',
    headline: 'End the "I have nothing to wear" dilemma',
    bodyText:
      'The average person spends 17 minutes every morning choosing clothes. Cut that down to 10 seconds. Check your digitized Virtual Wardrobe and let NOVA recommend the winning combination.',
    ctaText: 'Open NOVA',
    ctaPath: '/?screen=virtual-wardrobe',
    category: 'wardrobe'
  },

  // --------------------------------------------------------------------------
  // EVENING CAMPAIGNS (7:30 PM) — Wind-down, evening plans, tomorrow prep
  // --------------------------------------------------------------------------
  {
    id: 'email_eve_001',
    slot: 'evening',
    subject: 'Your wardrobe has entered the chat 👀',
    previewText: 'One more scroll, one better outfit.',
    headline: 'Still thinking about what to wear?',
    bodyText:
      'Good evening! Day\'s almost done, but your style game never clocks out. Whether you\'re planning dinner with friends or tomorrow\'s work fit, let NOVA curate something unforgettable.',
    ctaText: 'Open NOVA',
    ctaPath: '/?screen=home',
    category: 'evening_look'
  },
  {
    id: 'email_eve_002',
    slot: 'evening',
    subject: 'Tomorrow\'s fit isn\'t going to plan itself 🌙',
    previewText: 'Sleep better knowing you\'re slaying tomorrow.',
    headline: 'Night prep = Morning chill 💤',
    bodyText:
      'Pro-tip from Stylist AI: picking tomorrow\'s look tonight means an extra 15 minutes of sweet sleep tomorrow morning. Open NOVA, check the weather-matched suggestions, and hit snooze guilt-free.',
    ctaText: 'Open NOVA',
    ctaPath: '/?screen=chat',
    category: 'confidence'
  },
  {
    id: 'email_eve_003',
    slot: 'evening',
    subject: 'Friday vibes: Pajamas can\'t be your whole personality 🍸',
    previewText: 'Step out in style, you\'ve earned it.',
    headline: 'Upgrade your evening aesthetic',
    bodyText:
      'The weekend is knocking. Trade the sweatpants for something sharp. Our partner boutique labels just dropped limited evening edits — try them on in AR right now.',
    ctaText: 'Open NOVA',
    ctaPath: '/?screen=ar-tryon',
    category: 'evening_look'
  },
  {
    id: 'email_eve_004',
    slot: 'evening',
    subject: 'Your wishlist is giving you side-eye 👀✨',
    previewText: 'Those saved looks are waiting for you.',
    headline: 'Don\'t leave your favorites hanging',
    bodyText:
      'Items in your wishlist are moving fast. Check out the latest size availability and complete your order before your favorites sell out.',
    ctaText: 'Open NOVA',
    ctaPath: '/?screen=showroom',
    category: 'outfit_check'
  }
];

export function selectMarketingEmailTemplate(
  slot: MarketingSlot,
  recentlySentIds: string[] = []
): MarketingEmailTemplate {
  const eligible = MARKETING_EMAIL_TEMPLATES.filter((t) => t.slot === slot);
  const unspent = eligible.filter((t) => !recentlySentIds.includes(t.id));
  const pool = unspent.length > 0 ? unspent : eligible;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * Generate responsive, accessible HTML email matching NOVA's purple & dark navy branding.
 */
export function generateMarketingEmailHtml(options: {
  template: MarketingEmailTemplate;
  recipientName?: string;
  recipientEmail: string;
  baseUrl: string;
  unsubscribeUrl: string;
}): string {
  const { template, recipientName, recipientEmail, baseUrl, unsubscribeUrl } = options;
  const displayName = recipientName ? recipientName.trim().split(' ')[0] : 'there';
  const actionFullUrl = buildMarketingCtaUrl(template.ctaPath, {
    utm_source: 'nova_marketing_email',
    utm_medium: 'email',
    utm_campaign: template.id
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${template.subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0B0E1E;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #E2E8F0;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #12162B;
      border: 1px solid #232A4C;
      border-radius: 24px;
      overflow: hidden;
      margin-top: 24px;
      margin-bottom: 24px;
    }
    .header {
      padding: 32px 32px 20px 32px;
      text-align: center;
      background: linear-gradient(180deg, rgba(85, 59, 226, 0.2) 0%, rgba(18, 22, 43, 0) 100%);
    }
    .logo-badge {
      display: inline-block;
      padding: 8px 18px;
      background-color: #553BE2;
      border-radius: 9999px;
      color: #FFFFFF;
      font-weight: 900;
      font-size: 14px;
      letter-spacing: 2px;
      text-transform: uppercase;
      box-shadow: 0 4px 14px rgba(85, 59, 226, 0.4);
    }
    .content-card {
      padding: 12px 36px 36px 36px;
      text-align: center;
    }
    .headline {
      font-size: 22px;
      font-weight: 800;
      color: #FFFFFF;
      margin-top: 16px;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    .greeting {
      font-size: 15px;
      font-weight: 700;
      color: #A5B4FC;
      margin-bottom: 8px;
    }
    .body-copy {
      font-size: 14px;
      line-height: 1.6;
      color: #94A3B8;
      margin-bottom: 28px;
    }
    .cta-button {
      display: inline-block;
      background-color: #553BE2;
      color: #FFFFFF !important;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(85, 59, 226, 0.35);
      transition: all 0.2s ease;
    }
    .features-grid {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #1E2545;
      display: table;
      width: 100%;
    }
    .feature-item {
      display: table-cell;
      width: 33.33%;
      text-align: center;
      padding: 8px;
    }
    .feature-title {
      font-size: 11px;
      font-weight: 700;
      color: #C7D2FE;
      margin-top: 4px;
    }
    .footer {
      background-color: #0A0D1B;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #1E2545;
      font-size: 11px;
      color: #64748B;
      line-height: 1.6;
    }
    .footer a {
      color: #818CF8;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <!-- Preheader text hidden in client preview -->
  <div style="display:none;font-size:1px;color:#0B0E1E;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${template.previewText}
  </div>

  <div class="email-container">
    <div class="header">
      <div class="logo-badge">NOVA</div>
      <div style="font-size: 11px; color: #818CF8; font-weight: 600; margin-top: 8px; letter-spacing: 0.5px;">
        AI &amp; AR Fashion Assistant
      </div>
    </div>

    <div class="content-card">
      <div class="greeting">Hey ${displayName} 👋</div>
      <div class="headline">${template.headline}</div>
      <div class="body-copy">${template.bodyText}</div>

      <div>
        <a href="${actionFullUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
          Open NOVA →
        </a>
        <div style="font-size: 11px; color: #7E89A8; margin-top: 10px;">
          Opens installed NOVA Android app or continues on web
        </div>
      </div>

      <div class="features-grid">
        <div class="feature-item">
          <div style="font-size: 18px;">👗</div>
          <div class="feature-title">AI Stylist</div>
        </div>
        <div class="feature-item">
          <div style="font-size: 18px;">✨</div>
          <div class="feature-title">AR Try-On</div>
        </div>
        <div class="feature-item">
          <div style="font-size: 18px;">🛍️</div>
          <div class="feature-title">Fresh Drops</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 8px 0;">
        You are receiving this style drop because you are a registered user of NOVA.
      </p>
      <p style="margin: 0 0 12px 0;">
        Sent to <strong>${recipientEmail}</strong> • NOVA Vision Labs
      </p>
      <p style="margin: 0;">
        Prefer fewer emails? <a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer">Unsubscribe from marketing emails</a>
        or update preferences in <a href="${baseUrl.replace(/\/$/, '')}/?screen=profile" target="_blank" rel="noopener noreferrer">Profile Settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}
