/**
 * NOVA Marketing Email Copy Library & Content Personalization Engine
 *
 * Swiggy / Zomato style high-engagement consumer marketing copy:
 * witty, relatable, conversational, mildly playful, fashion-focused,
 * mobile-first, adhering to NOVA's brand identity.
 */

import { buildMarketingCtaUrl, getPublicAppUrl } from './appUrlConfig';

export type MarketingSlot = 'morning' | 'evening';

export interface CtaOption {
  text: string;
  path: string;
}

export interface MarketingContentVariant {
  id: string;
  slot: MarketingSlot;
  category: 'outfit_formula' | 'ar_tryon' | 'confidence' | 'wardrobe' | 'evening_look' | 'trend_drop' | 'stylist_tip';
  subjectLines: string[];
  previewTexts: string[];
  headlines: string[];
  bodyTemplates: ((name: string, category?: string) => string)[];
  fashionTips: string[];
  ctaOptions: CtaOption[];
  featuredCategoryHint?: string;
}

export interface PersonalizedEmailPayload {
  templateId: string;
  slot: MarketingSlot;
  subject: string;
  previewText: string;
  headline: string;
  greeting: string;
  bodyText: string;
  fashionTip?: string;
  featuredProduct?: {
    name: string;
    category?: string;
    price?: number;
    imageUrl?: string;
  };
  ctaText: string;
  ctaPath: string;
}

// ----------------------------------------------------------------------------
// 1. Content Library Pools (Morning: 10:00 AM | Evening: 7:00 PM)
// ----------------------------------------------------------------------------

export const MARKETING_CONTENT_VARIANTS: MarketingContentVariant[] = [
  // ==========================================================================
  // MORNING CAMPAIGN POOL (10:00 AM IST) — Outfit inspiration & daily energy
  // ==========================================================================
  {
    id: 'morn_outfit_crush',
    slot: 'morning',
    category: 'outfit_formula',
    subjectLines: [
      'Crush ka reply aaye na aaye 💅',
      'Your outfit deserves a standing ovation today 👏',
      'Warning: This look might turn heads at work 👀'
    ],
    previewTexts: [
      'At least your outfit can make an unforgettable impression.',
      'Coffee is hot. Your outfit needs to match.',
      'Start the day looking like a 10/10.'
    ],
    headlines: [
      'Make today your personal runway moment ✨',
      'Outfits speak louder than morning alarms ⏰',
      'Serve looks before your first coffee ☕'
    ],
    bodyTemplates: [
      (name) =>
        `Good morning ${name}! Whether your crush replies or leaves you on seen, your outfit deserves full attention today. Open NOVA, check today's trending drops, and walk out looking like a 10/10.`,
      (name) =>
        `Hey ${name}! Don't let your morning style be an afterthought. We've matched the weather with today's sharpest silhouettes so you can get dressed in under 60 seconds.`
    ],
    fashionTips: [
      'Pro tip: Pair relaxed-fit bottoms with a structured top for effortless balance.',
      'Style rule #1: Monochromatic layers instantly make any outfit look 3x more expensive.'
    ],
    ctaOptions: [
      { text: 'Explore Your Style', path: '/?screen=showroom' },
      { text: 'Open NOVA', path: '/?screen=home' }
    ],
    featuredCategoryHint: 'T-Shirts'
  },
  {
    id: 'morn_coffee_loading',
    slot: 'morning',
    category: 'stylist_tip',
    subjectLines: [
      'Outfit status: Still loading? ☕',
      'The 10-second outfit decision is here ⚡',
      'Staring at your closet won\'t help (we tried) 🙈'
    ],
    previewTexts: [
      'Your coffee is hot. Make sure your drip is too.',
      'Let NOVA Stylist pick your look while you sip.',
      'Zero morning wardrobe panic guaranteed.'
    ],
    headlines: [
      'Your coffee is brewing, let\'s fix the fit 👀',
      'End the morning closet paralysis right now',
      'Stylist AI has an outfit formula for you'
    ],
    bodyTemplates: [
      (name) =>
        `Good morning ${name}! Staring at your closet won't make an outfit magically appear. Open Stylist AI on NOVA, tell us your vibe for today, and get a curated fit in under 30 seconds.`,
      (name) =>
        `Morning ${name}! The average person spends 17 minutes choosing clothes every morning. Let NOVA cut that down to 10 seconds. Check your personalized recommendation today.`
    ],
    fashionTips: [
      'Minimalist hack: Solid neutrals + one statement accessory = instant boardroom confidence.',
      'Footwear matters: Crisp clean sneakers keep smart casual fits grounded.'
    ],
    ctaOptions: [
      { text: 'Find Your Next Look', path: '/?screen=chat' },
      { text: 'Try This Look', path: '/?screen=ar-tryon' }
    ],
    featuredCategoryHint: 'Shirts'
  },
  {
    id: 'morn_ar_mirror',
    slot: 'morning',
    category: 'ar_tryon',
    subjectLines: [
      'Mirror mirror on the wall... 🪞✨',
      'Try it on before you step out 📸',
      'The virtual fitting room is unlocked for you 🔓'
    ],
    previewTexts: [
      'Spoiler: You are looking sharp today.',
      'Real-time AR Try-On on your phone camera.',
      'See how today\'s newest styles drape on you.'
    ],
    headlines: [
      'Virtual fitting room is ready for you 🪞',
      'See the look on you in real-time AR',
      'Never wonder "How will this look on me?" again'
    ],
    bodyTemplates: [
      (name) =>
        `Hey ${name}! Why guess how that jacket looks when you can try it on in real-time AR? Tap below, turn on your camera, and see how our newest designer pieces drape before you head out.`,
      (name) =>
        `Good morning ${name}! Step into NOVA's Virtual Fitting Room. Instant AR try-on lets you preview outfits from every angle with true-to-life fit physics.`
    ],
    fashionTips: [
      'Shoulder seams should sit right at your natural shoulder bone for a tailored silhouette.',
      'Slight cuffing on your trousers adds instant intentionality to any outfit.'
    ],
    ctaOptions: [
      { text: 'Try This Look in AR', path: '/?screen=ar-tryon' },
      { text: 'Explore Showroom', path: '/?screen=showroom' }
    ],
    featuredCategoryHint: 'Jackets'
  },
  {
    id: 'morn_wardrobe_dilemma',
    slot: 'morning',
    category: 'wardrobe',
    subjectLines: [
      'Wardrobe full, but "kuch nahi hai pehenne ko"? 🙈',
      'Unlock outfits already in your wardrobe 🗝️',
      'Your closet has hidden gems waiting for you 💎'
    ],
    previewTexts: [
      'We have all been there. NOVA to the rescue.',
      'New combinations from clothes you already own.',
      'Digitize your closet and slay every morning.'
    ],
    headlines: [
      'End the "I have nothing to wear" dilemma 👗',
      'Fresh outfit combinations with zero shopping',
      'Your digital wardrobe is ready to mix & match'
    ],
    bodyTemplates: [
      (name) =>
        `Hey ${name}! The biggest styling myth: you need new clothes every day. Open your Virtual Wardrobe on NOVA and discover fresh pairings with pieces you already own.`,
      (name) =>
        `Good morning ${name}! Take 2 minutes to check your digitized wardrobe. NOVA automatically pairs complementary colors and textures to build you a brand-new outfit.`
    ],
    fashionTips: [
      'Color wheel rule: Complementary colors (like navy and tan) create timeless high-contrast depth.',
      'Texture contrast: Pair rough denim or cargo with soft cotton knitwear for a tactile upgrade.'
    ],
    ctaOptions: [
      { text: 'Discover Your Wardrobe', path: '/?screen=virtual-wardrobe' },
      { text: 'Open NOVA', path: '/?screen=home' }
    ],
    featuredCategoryHint: 'Cargo Pants'
  },
  {
    id: 'morn_confidence_slay',
    slot: 'morning',
    category: 'confidence',
    subjectLines: [
      'Dressed for success, literally 🚀',
      'Today\'s agenda: Looking effortless 💫',
      'Your outfit is your personal armor today 🛡️'
    ],
    previewTexts: [
      'Walk into your day with 100% confidence.',
      'When you look good, you feel unstoppable.',
      'Curated fashion drops live now on NOVA.'
    ],
    headlines: [
      'Own the room today, one outfit at a time 💥',
      'Effortless morning style unlocked',
      'Step out with signature NOVA style'
    ],
    bodyTemplates: [
      (name) =>
        `Rise and shine ${name}! Dressing well is a form of self-respect. Whether you have presentations, lectures, or coffee meetings today, step out knowing your look is on point.`,
      (name) =>
        `Hey ${name}! Life is too short to wear boring clothes on a workday. Open NOVA to explore our handpicked morning style drops and elevate your day.`
    ],
    fashionTips: [
      'Invest in high-quality basics: they form the foundation of 80% of stylish outfits.',
      'A sharp pair of sunglasses or a classic timepiece completes even the simplest tee-and-jeans look.'
    ],
    ctaOptions: [
      { text: 'Explore Showroom', path: '/?screen=showroom' },
      { text: 'Explore Your Style', path: '/?screen=showroom' }
    ],
    featuredCategoryHint: 'Accessories'
  },

  // ==========================================================================
  // EVENING CAMPAIGN POOL (7:00 PM IST) — Wind-down, evening plans & tomorrow
  // ==========================================================================
  {
    id: 'eve_wardrobe_chat',
    slot: 'evening',
    category: 'evening_look',
    subjectLines: [
      'Your wardrobe has entered the chat 👀',
      'Evening plans? Your fit shouldn\'t be casual 🍸',
      'Day is done, but your style never clocks out 🌆'
    ],
    previewTexts: [
      'One more scroll, one better outfit.',
      'Step out in style tonight, you\'ve earned it.',
      'Fresh evening drops waiting for you in NOVA.'
    ],
    headlines: [
      'Still thinking about what to wear tonight? 🌙',
      'Upgrade your evening aesthetic effortlessly',
      'From desk to dinner: style made easy'
    ],
    bodyTemplates: [
      (name) =>
        `Good evening ${name}! Day's almost done, but your style game never clocks out. Whether you're heading to dinner with friends or unwinding tonight, let NOVA curate something unforgettable.`,
      (name) =>
        `Hey ${name}! Trade the work tension for evening chic. Our boutique partner collections just updated with tonight's trending aesthetics.`
    ],
    fashionTips: [
      'Evening transition: Swap white sneakers for sleek loafers or boots to instantly elevate a dinner fit.',
      'Dark tones like charcoal, midnight navy, and deep olive look magnetic under warm evening lighting.'
    ],
    ctaOptions: [
      { text: 'Explore Showroom', path: '/?screen=showroom' },
      { text: 'Try This Look', path: '/?screen=ar-tryon' }
    ],
    featuredCategoryHint: 'Shirts'
  },
  {
    id: 'eve_tomorrow_prep',
    slot: 'evening',
    category: 'wardrobe',
    subjectLines: [
      'Tomorrow\'s fit isn\'t going to plan itself 🌙',
      'Sleep better knowing you\'re slaying tomorrow 💤',
      'The 2-minute trick for a stress-free morning ⏰'
    ],
    previewTexts: [
      'Night prep = Morning chill.',
      'Hit snooze tomorrow guilt-free with an outfit ready.',
      'Let Stylist AI plan tomorrow\'s look right now.'
    ],
    headlines: [
      'Night prep = 15 extra minutes of sleep tomorrow 💤',
      'What should you wear tomorrow? Solved.',
      'Beat the morning rush before you go to bed'
    ],
    bodyTemplates: [
      (name) =>
        `Good evening ${name}! Pro-tip from Stylist AI: picking tomorrow's look tonight means an extra 15 minutes of sweet sleep tomorrow morning. Open NOVA, check the weather-matched suggestions, and hit snooze guilt-free.`,
      (name) =>
        `Hey ${name}! Don't wake up tomorrow to a chaotic closet. Take 60 seconds tonight to lock in your fit with NOVA, and start your day ahead of everyone else.`
    ],
    fashionTips: [
      'Weather-smart styling: Check tomorrow\'s temperature forecast tonight so your layers are ready.',
      'Wrinkle check: Hang tomorrow\'s shirt in the bathroom while taking a hot shower for a quick steam.'
    ],
    ctaOptions: [
      { text: 'Find Your Next Look', path: '/?screen=chat' },
      { text: 'Discover Your Wardrobe', path: '/?screen=virtual-wardrobe' }
    ],
    featuredCategoryHint: 'T-Shirts'
  },
  {
    id: 'eve_pajama_personality',
    slot: 'evening',
    category: 'evening_look',
    subjectLines: [
      'Pajamas can\'t be your whole personality 🍸',
      'Time to trade sweatpants for something sharp ✨',
      'Unwind in style: your evening style edit 🌙'
    ],
    previewTexts: [
      'Step out in style, you\'ve earned it.',
      'Limited evening drops live on NOVA Showroom.',
      'Try on weekend looks in real-time AR tonight.'
    ],
    headlines: [
      'Upgrade your off-duty aesthetic tonight 💫',
      'Sharp evening looks for your weekend vibe',
      'Relaxed luxury: the modern evening wardrobe'
    ],
    bodyTemplates: [
      (name) =>
        `Good evening ${name}! We love cozy pajamas as much as anyone, but tonight calls for a style upgrade. Explore relaxed streetwear, crisp overshirts, and understated luxury on NOVA.`,
      (name) =>
        `Hey ${name}! The evening belongs to you. Take a breather, open NOVA's Showroom, and browse fresh drops tailored to your aesthetic.`
    ],
    fashionTips: [
      'Overshirt supremacy: Layering a structured chore coat or denim jacket over a plain tee is the king of relaxed evening style.',
      'Proportions: If wearing relaxed trousers, keep your top fitted or neatly tucked.'
    ],
    ctaOptions: [
      { text: 'Try This Look', path: '/?screen=ar-tryon' },
      { text: 'Explore Showroom', path: '/?screen=showroom' }
    ],
    featuredCategoryHint: 'Jackets'
  },
  {
    id: 'eve_wishlist_sideeye',
    slot: 'evening',
    category: 'trend_drop',
    subjectLines: [
      'Your wishlist is giving you side-eye 👀✨',
      'Those saved styles are waiting for you 🛍️',
      'Limited stock alert on your favorite categories 🔥'
    ],
    previewTexts: [
      'Don\'t leave your favorite fits hanging.',
      'Sizes are moving fast. Check availability.',
      'Exclusive styles ready to view on NOVA.'
    ],
    headlines: [
      'Don\'t leave your favorites hanging 🛍️',
      'Trending pieces everyone is trying on in AR',
      'Your style radar picked up something good'
    ],
    bodyTemplates: [
      (name) =>
        `Good evening ${name}! Trending styles on NOVA are moving fast. Explore the latest sizes, preview how they look with AR Try-On, and level up your rotation before stock runs out.`,
      (name) =>
        `Hey ${name}! Treat yourself after a productive day. NOVA's curated showroom has new arrivals designed to refresh your daily rotation with zero fuss.`
    ],
    fashionTips: [
      'Capsule wardrobe rule: If a new piece matches at least 3 items in your existing closet, it is a guaranteed winner.',
      'Accessorize smart: Minimalist matte silver or gold accents bring quiet sophistication to any casual look.'
    ],
    ctaOptions: [
      { text: 'Explore Showroom', path: '/?screen=showroom' },
      { text: 'Explore Your Style', path: '/?screen=showroom' }
    ],
    featuredCategoryHint: 'Accessories'
  },
  {
    id: 'eve_night_drip',
    slot: 'evening',
    category: 'confidence',
    subjectLines: [
      'Golden hour style inspiration 🌆',
      'A little styling inspiration for tonight 🌙',
      'End your day looking like a visionary ✨'
    ],
    previewTexts: [
      'Discover tonight\'s featured aesthetics.',
      'Stylist AI has tonight\'s moodboard ready.',
      'Sleek cuts, premium fabrics, effortless fits.'
    ],
    headlines: [
      'Curate your personal aesthetic tonight 🎨',
      'Style never sleeps: evening inspiration',
      'Tomorrow\'s best-dressed title is yours to claim'
    ],
    bodyTemplates: [
      (name) =>
        `Hey ${name}! End your evening with some creative inspiration. Step into NOVA's AI showroom, experiment with different colorways, and save your favorite fits for the week.`,
      (name) =>
        `Good evening ${name}! Looking good is a habit. Browse today's community favorite outfits and see which looks inspire your personal aesthetic.`
    ],
    fashionTips: [
      'Monochrome magic: Wearing all black or deep navy with varied textures (knit + leather + denim) looks elite every single time.',
      'Comfort meets style: Stretch cotton chinos look as formal as dress trousers while staying as comfortable as loungewear.'
    ],
    ctaOptions: [
      { text: 'Open NOVA', path: '/?screen=home' },
      { text: 'Find Your Next Look', path: '/?screen=chat' }
    ],
    featuredCategoryHint: 'Cargo Pants'
  }
];

// Backward compatibility template adapter
export interface MarketingEmailTemplate {
  id: string;
  slot: MarketingSlot;
  subject: string;
  previewText: string;
  headline: string;
  bodyText: string;
  ctaText: string;
  ctaPath: string;
  category: string;
}

export const MARKETING_EMAIL_TEMPLATES: MarketingEmailTemplate[] = MARKETING_CONTENT_VARIANTS.map((v) => ({
  id: v.id,
  slot: v.slot,
  subject: v.subjectLines[0],
  previewText: v.previewTexts[0],
  headline: v.headlines[0],
  bodyText: v.bodyTemplates[0]('there'),
  ctaText: v.ctaOptions[0].text,
  ctaPath: v.ctaOptions[0].path,
  category: v.category
}));

// ----------------------------------------------------------------------------
// 2. Personalization Engine: Dynamic Selection per User
// ----------------------------------------------------------------------------

export function generatePersonalizedContent(params: {
  slot: MarketingSlot;
  recipientName?: string;
  recentTemplateIds?: string[];
  recentSubjects?: string[];
  userGender?: string;
  productCatalog?: Array<{
    id: string;
    name: string;
    category?: string;
    price?: number;
    imageUrl?: string;
  }>;
  recipientSeed?: string; // used for deterministic pseudo-random per recipient
}): PersonalizedEmailPayload {
  const {
    slot,
    recipientName,
    recentTemplateIds = [],
    recentSubjects = [],
    productCatalog = [],
    recipientSeed = ''
  } = params;

  // Filter variants matching campaign slot
  const slotPool = MARKETING_CONTENT_VARIANTS.filter((v) => v.slot === slot);

  // Exclude variants sent recently to this specific recipient
  const freshPool = slotPool.filter((v) => !recentTemplateIds.includes(v.id));
  const candidatePool = freshPool.length > 0 ? freshPool : slotPool;

  // Seeded index selection to ensure consistent variation for this recipient
  let seedNum = 0;
  for (let i = 0; i < recipientSeed.length; i++) {
    seedNum = (seedNum * 31 + recipientSeed.charCodeAt(i)) & 0xffffffff;
  }
  const variantIndex = Math.abs(seedNum) % candidatePool.length;
  const variant = candidatePool[variantIndex];

  // Pick fresh subject line not recently sent
  const freshSubjects = variant.subjectLines.filter((s) => !recentSubjects.includes(s));
  const subject = freshSubjects.length > 0
    ? freshSubjects[Math.abs(seedNum >> 2) % freshSubjects.length]
    : variant.subjectLines[Math.abs(seedNum >> 2) % variant.subjectLines.length];

  // Pick preview text and headline
  const previewText = variant.previewTexts[Math.abs(seedNum >> 3) % variant.previewTexts.length];
  const headline = variant.headlines[Math.abs(seedNum >> 4) % variant.headlines.length];

  // Clean first name greeting
  const firstName = recipientName && recipientName.trim()
    ? recipientName.trim().split(' ')[0]
    : '';
  const greeting = firstName ? `Hey ${firstName} 👋` : 'Hey there 👋';
  const nameForBody = firstName || 'there';

  // Body copy
  const bodyFn = variant.bodyTemplates[Math.abs(seedNum >> 5) % variant.bodyTemplates.length];
  const bodyText = bodyFn(nameForBody, variant.featuredCategoryHint);

  // Fashion tip
  const fashionTip = variant.fashionTips[Math.abs(seedNum >> 6) % variant.fashionTips.length];

  // CTA option
  const cta = variant.ctaOptions[Math.abs(seedNum >> 7) % variant.ctaOptions.length];

  // Featured genuine product from catalog (if available and matching category hint)
  let featuredProduct: PersonalizedEmailPayload['featuredProduct'] = undefined;
  if (productCatalog.length > 0) {
    const validProducts = productCatalog.filter(
      (p) => p.name && (p.imageUrl || typeof p.price === 'number')
    );
    if (validProducts.length > 0) {
      let matching = validProducts;
      if (variant.featuredCategoryHint) {
        const catMatch = validProducts.filter(
          (p) => p.category?.toLowerCase() === variant.featuredCategoryHint?.toLowerCase()
        );
        if (catMatch.length > 0) matching = catMatch;
      }
      const prod = matching[Math.abs(seedNum >> 8) % matching.length];
      if (prod) {
        featuredProduct = {
          name: prod.name,
          category: prod.category,
          price: prod.price,
          imageUrl: prod.imageUrl?.startsWith('http') ? prod.imageUrl : undefined
        };
      }
    }
  }

  return {
    templateId: variant.id,
    slot,
    subject,
    previewText,
    headline,
    greeting,
    bodyText,
    fashionTip,
    featuredProduct,
    ctaText: cta.text,
    ctaPath: cta.path
  };
}

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

// ----------------------------------------------------------------------------
// 3. Mobile-First Responsive HTML Email Generator
// ----------------------------------------------------------------------------

export function generateMarketingEmailHtml(options: {
  personalized: PersonalizedEmailPayload;
  recipientEmail: string;
  baseUrl: string;
  unsubscribeUrl: string;
}): string {
  const { personalized, recipientEmail, baseUrl, unsubscribeUrl } = options;
  const ctaUrl = buildMarketingCtaUrl(personalized.ctaPath, {
    utm_source: 'nova_marketing_email',
    utm_medium: 'email',
    utm_campaign: personalized.templateId
  });

  const featuredProductHtml = personalized.featuredProduct
    ? `
      <div style="margin: 24px 0 20px 0; padding: 18px; background: rgba(85, 59, 226, 0.08); border: 1px solid rgba(85, 59, 226, 0.25); border-radius: 16px; text-align: left;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #A5B4FC; font-weight: 800; margin-bottom: 6px;">
          ⭐ Featured In Showroom
        </div>
        <div style="font-size: 15px; font-weight: 700; color: #FFFFFF; margin-bottom: 4px;">
          ${personalized.featuredProduct.name}
        </div>
        ${
          personalized.featuredProduct.category
            ? `<div style="font-size: 12px; color: #94A3B8; margin-bottom: 6px;">Category: ${personalized.featuredProduct.category}</div>`
            : ''
        }
        ${
          typeof personalized.featuredProduct.price === 'number' && personalized.featuredProduct.price > 0
            ? `<div style="font-size: 14px; font-weight: 800; color: #38BDF8;">₹${personalized.featuredProduct.price.toLocaleString('en-IN')}</div>`
            : ''
        }
      </div>
    `
    : '';

  const fashionTipHtml = personalized.fashionTip
    ? `
      <div style="margin: 20px 0; padding: 14px 18px; background: #0E1222; border-left: 3px solid #553BE2; border-radius: 8px; text-align: left;">
        <div style="font-size: 11px; font-weight: 800; color: #818CF8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">
          💡 Stylist Tip
        </div>
        <div style="font-size: 12px; color: #CBD5E1; line-height: 1.5;">
          ${personalized.fashionTip}
        </div>
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${personalized.subject}</title>
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
      background: linear-gradient(180deg, rgba(85, 59, 226, 0.22) 0%, rgba(18, 22, 43, 0) 100%);
    }
    .logo-badge {
      display: inline-block;
      padding: 8px 20px;
      background-color: #553BE2;
      border-radius: 9999px;
      color: #FFFFFF;
      font-weight: 900;
      font-size: 14px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      box-shadow: 0 4px 16px rgba(85, 59, 226, 0.45);
    }
    .content-card {
      padding: 12px 36px 36px 36px;
      text-align: center;
    }
    .headline {
      font-size: 22px;
      font-weight: 800;
      color: #FFFFFF;
      margin-top: 14px;
      margin-bottom: 12px;
      line-height: 1.35;
    }
    .greeting {
      font-size: 15px;
      font-weight: 700;
      color: #A5B4FC;
      margin-bottom: 8px;
    }
    .body-copy {
      font-size: 14px;
      line-height: 1.65;
      color: #94A3B8;
      margin-bottom: 20px;
    }
    .cta-button {
      display: inline-block;
      background-color: #553BE2;
      color: #FFFFFF !important;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      padding: 14px 34px;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(85, 59, 226, 0.35);
      transition: all 0.2s ease;
    }
    .features-grid {
      margin-top: 28px;
      padding-top: 22px;
      border-top: 1px solid #1E2545;
      display: table;
      width: 100%;
    }
    .feature-item {
      display: table-cell;
      width: 33.33%;
      text-align: center;
      padding: 6px;
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
  <!-- Preheader preview text -->
  <div style="display:none;font-size:1px;color:#0B0E1E;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${personalized.previewText}
  </div>

  <div class="email-container">
    <div class="header">
      <div class="logo-badge">NOVA</div>
      <div style="font-size: 11px; color: #818CF8; font-weight: 600; margin-top: 8px; letter-spacing: 0.5px;">
        AI &amp; AR Fashion Assistant
      </div>
    </div>

    <div class="content-card">
      <div class="greeting">${personalized.greeting}</div>
      <div class="headline">${personalized.headline}</div>
      <div class="body-copy">${personalized.bodyText}</div>

      ${featuredProductHtml}
      ${fashionTipHtml}

      <div style="margin-top: 24px;">
        <a href="${ctaUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
          ${personalized.ctaText} →
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
        You are receiving this style drop because you are a registered user of NOVA with marketing updates enabled.
      </p>
      <p style="margin: 0 0 12px 0;">
        Sent to <strong>${recipientEmail}</strong> • NOVA Vision Labs
      </p>
      <p style="margin: 0;">
        Prefer fewer emails? <a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer">Unsubscribe from marketing emails</a>
        or manage preferences in <a href="${baseUrl.replace(/\/$/, '')}/?screen=profile" target="_blank" rel="noopener noreferrer">Profile Settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}
