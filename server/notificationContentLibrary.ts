/**
 * NOVA Notification Content Library
 * 
 * Witty, playful, humorous, mildly flirty, and relatable fashion marketing copy
 * inspired by the engagement style of top Indian consumer apps (Zomato, Swiggy)
 * while staying true to NOVA's high-tech optical vision & virtual styling identity.
 */

export type NotificationSlot = 'morning' | 'evening';
export type NotificationLanguage = 'hinglish' | 'english' | 'hindi';
export type NotificationCategory =
  | 'ar_tryon'
  | 'outfit_check'
  | 'wishlist'
  | 'new_arrivals'
  | 'stylist'
  | 'confidence'
  | 'humor';

export interface NotificationMessageTemplate {
  id: string;
  slot: NotificationSlot;
  category: NotificationCategory;
  language: NotificationLanguage;
  title: string;
  body: string;
  deepLink: 'ar-tryon' | 'showroom' | 'wishlist' | 'stylist' | 'home';
  tags: string[];
}

export const NOTIFICATION_CONTENT_LIBRARY: NotificationMessageTemplate[] = [
  // -------------------------------------------------------------
  // MORNING SLOT (10:00 AM) — Outfit checks, morning slay, styling
  // -------------------------------------------------------------
  {
    id: 'mkt_morn_001',
    slot: 'morning',
    category: 'confidence',
    language: 'hinglish',
    title: 'Good morning, stunner 💅',
    body: 'Crush ka reply aaye na aaye, aaj ka outfit toh slay karna hai. Open NOVA & get dressed!',
    deepLink: 'showroom',
    tags: ['crush', 'slay', 'daily_look']
  },
  {
    id: 'mkt_morn_002',
    slot: 'morning',
    category: 'outfit_check',
    language: 'hinglish',
    title: 'Outfit status: Pending? 👀',
    body: 'Mirror selfie lene se pehle outfit check toh banta hai. Dekhein aaj kya pehenna hai?',
    deepLink: 'stylist',
    tags: ['mirror_selfie', 'stylist', 'morning_routine']
  },
  {
    id: 'mkt_morn_003',
    slot: 'morning',
    category: 'ar_tryon',
    language: 'hinglish',
    title: 'Fit check in 3... 2... 1 ✨',
    body: 'Aaj ka look loading hai. NOVA AR open karke real-time mein check kar lo!',
    deepLink: 'ar-tryon',
    tags: ['ar', 'tryon', 'fit_check']
  },
  {
    id: 'mkt_morn_004',
    slot: 'morning',
    category: 'humor',
    language: 'hinglish',
    title: 'Wardrobe crisis averted! 🚨',
    body: '"Kuch pehne ko nahi hai" bolne se pehle NOVA explore karo. Fresh drip just dropped.',
    deepLink: 'showroom',
    tags: ['wardrobe_crisis', 'fresh_drip']
  },
  {
    id: 'mkt_morn_005',
    slot: 'morning',
    category: 'new_arrivals',
    language: 'hinglish',
    title: 'Subah ki chai aur naye fits ☕',
    body: 'Naye curated pieces arrive ho chuke hain. Style standard thoda aur upar le chalein?',
    deepLink: 'showroom',
    tags: ['tea', 'new_arrivals', 'morning']
  },
  {
    id: 'mkt_morn_006',
    slot: 'morning',
    category: 'stylist',
    language: 'hinglish',
    title: 'AI Stylist is on duty 🤖✨',
    body: 'Confused between formal ya casual? Stylist AI se pucho, 2 seconds mein sorted.',
    deepLink: 'stylist',
    tags: ['ai_stylist', 'fashion_advice']
  },
  {
    id: 'mkt_morn_007',
    slot: 'morning',
    category: 'confidence',
    language: 'english',
    title: 'Dress like you own the room ✨',
    body: 'Whatever your day has planned, make sure your outfit steals the spotlight. Discover new looks.',
    deepLink: 'showroom',
    tags: ['power_dressing', 'english']
  },
  {
    id: 'mkt_morn_008',
    slot: 'morning',
    category: 'ar_tryon',
    language: 'english',
    title: 'Try before you step out 💜',
    body: 'Wondering how that jacket looks on you? Live AR Try-On gives you the exact answer.',
    deepLink: 'ar-tryon',
    tags: ['ar', 'tryon', 'english']
  },
  {
    id: 'mkt_morn_009',
    slot: 'morning',
    category: 'confidence',
    language: 'hindi',
    title: 'आज का दिन, आपका स्टाइल ✨',
    body: 'आज कौन सा लुक ट्राय कर रहे हैं? NOVA पर अपनी पसंद का ऑउटफिट लाइव पहनकर देखें।',
    deepLink: 'ar-tryon',
    tags: ['hindi', 'style']
  },
  {
    id: 'mkt_morn_010',
    slot: 'morning',
    category: 'humor',
    language: 'hinglish',
    title: 'Meeting mein entry iconic honi chahiye 💼🔥',
    body: 'Zoom call ho ya boardroom, your outfit should speak louder than your presentation.',
    deepLink: 'showroom',
    tags: ['workwear', 'office']
  },

  // -------------------------------------------------------------
  // EVENING SLOT (7:00 PM) — Evening outings, wishlist, relaxation
  // -------------------------------------------------------------
  {
    id: 'mkt_eve_001',
    slot: 'evening',
    category: 'wishlist',
    language: 'hinglish',
    title: 'Tumhara favourite outfit wait kar raha hai 💜',
    body: 'Wishlist mein rakha hua piece bol raha hai: "Mujhe kab try karoge?" Dekho abhi!',
    deepLink: 'wishlist',
    tags: ['wishlist', 'evening', 'heart']
  },
  {
    id: 'mkt_eve_002',
    slot: 'evening',
    category: 'humor',
    language: 'hinglish',
    title: 'Relationship status complicated? 😭',
    body: 'Koi baat nahi! At least apna outfit status sorted rakho. Discover tonight\'s best vibe.',
    deepLink: 'showroom',
    tags: ['relationship_status', 'vibes', 'humor']
  },
  {
    id: 'mkt_eve_003',
    slot: 'evening',
    category: 'ar_tryon',
    language: 'hinglish',
    title: 'Ab imagination se bahar aao 👀✨',
    body: 'Sochna band karo ki ye dress kaisa lagega. AR Camera on karo aur khud dekh lo!',
    deepLink: 'ar-tryon',
    tags: ['ar', 'imagination', 'tryon']
  },
  {
    id: 'mkt_eve_004',
    slot: 'evening',
    category: 'confidence',
    language: 'hinglish',
    title: 'Dil ki suno, wardrobe ko chance do 💃',
    body: 'Work is wrapped. Sham ki coffee ya dinner date? Pick a look that turns heads tonight.',
    deepLink: 'showroom',
    tags: ['evening_out', 'dinner_date']
  },
  {
    id: 'mkt_eve_005',
    slot: 'evening',
    category: 'stylist',
    language: 'hinglish',
    title: 'Late night aesthetic upgrade 🌙',
    body: 'Kal subah kya pehenna hai? Apne AI stylist ke sath abhi plan kar lo, no morning rush!',
    deepLink: 'stylist',
    tags: ['night_owl', 'planning']
  },
  {
    id: 'mkt_eve_006',
    slot: 'evening',
    category: 'new_arrivals',
    language: 'hinglish',
    title: 'Secret drop just went live 🤫⚡',
    body: 'Limited edition streetwear & premium hoodies just hit the catalog. Pehle aap dekh lo.',
    deepLink: 'showroom',
    tags: ['secret_drop', 'streetwear']
  },
  {
    id: 'mkt_eve_007',
    slot: 'evening',
    category: 'confidence',
    language: 'english',
    title: 'Time to switch off work mode 🍸✨',
    body: 'Ditch the formal wear and slip into something stunning. Find your evening aesthetic on NOVA.',
    deepLink: 'showroom',
    tags: ['after_work', 'english']
  },
  {
    id: 'mkt_eve_008',
    slot: 'evening',
    category: 'wishlist',
    language: 'english',
    title: 'Still thinking about that look? 💭',
    body: 'Your saved pieces are waiting. Try them on in AR right now from the comfort of your couch.',
    deepLink: 'wishlist',
    tags: ['wishlist', 'couch', 'english']
  },
  {
    id: 'mkt_eve_009',
    slot: 'evening',
    category: 'confidence',
    language: 'hindi',
    title: 'शाम की महफ़िल, आपका अंदाज़ 💜',
    body: 'आज शाम का प्लान क्या है? अपने पसंदीदा ऑउटफिट को NOVA AR पर अभी ट्राय करके देखें।',
    deepLink: 'ar-tryon',
    tags: ['hindi', 'evening']
  },
  {
    id: 'mkt_eve_010',
    slot: 'evening',
    category: 'ar_tryon',
    language: 'hinglish',
    title: 'Mirror mirror on the wall... 🪞',
    body: 'Who has the sharpest fit of them all? Open NOVA AR Try-On and see for yourself!',
    deepLink: 'ar-tryon',
    tags: ['mirror_mirror', 'ar', 'tryon']
  }
];

/**
 * Selects an appropriate marketing template with rotation tracking to eliminate repetition.
 */
export function selectRotatedMarketingMessage(
  slot: NotificationSlot,
  preferredLanguage: NotificationLanguage = 'hinglish',
  recentlySentIds: string[] = [],
  preferredCategory?: NotificationCategory
): NotificationMessageTemplate {
  // Filter by slot
  let candidates = NOTIFICATION_CONTENT_LIBRARY.filter((item) => item.slot === slot);

  // Filter by category if requested
  if (preferredCategory) {
    const categoryMatches = candidates.filter((item) => item.category === preferredCategory);
    if (categoryMatches.length > 0) {
      candidates = categoryMatches;
    }
  }

  // Filter by language if available
  const langMatches = candidates.filter((item) => item.language === preferredLanguage);
  if (langMatches.length > 0) {
    candidates = langMatches;
  }

  // Avoid recently sent messages for this user/device
  const unreadCandidates = candidates.filter((item) => !recentlySentIds.includes(item.id));
  const pool = unreadCandidates.length > 0 ? unreadCandidates : candidates;

  // Pick random candidate from pool
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex] || NOTIFICATION_CONTENT_LIBRARY[0];
}

/**
 * Dynamic message customizer when user personalization data (e.g. wishlist count or product name) is present.
 */
export function personalizeMessage(
  template: NotificationMessageTemplate,
  userProfile?: { name?: string; wishlistedItemName?: string; recentViewName?: string }
): { title: string; body: string } {
  let title = template.title;
  let body = template.body;

  if (userProfile?.name && userProfile.name.trim()) {
    const firstName = userProfile.name.trim().split(' ')[0];
    if (template.language === 'hinglish') {
      title = `${firstName}, ${title.toLowerCase()}`;
    }
  }

  if (userProfile?.wishlistedItemName && template.category === 'wishlist') {
    body = `Aapka "${userProfile.wishlistedItemName}" wishlist mein wait kar raha hai. Aaj hi AR Try-On karke dekhein!`;
  }

  return { title, body };
}
