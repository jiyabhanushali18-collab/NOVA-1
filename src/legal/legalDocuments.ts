import { LegalConsentRecord, LegalDocumentType } from '../types';

export const TERMS_VERSION = '2026.10.1';
export const PRIVACY_VERSION = '2026.10.1';
export const LEGAL_EFFECTIVE_DATE = 'October 11, 2026';
export const LEGAL_LAST_UPDATED = 'October 11, 2026';
export const LEGAL_EFFECTIVE_DATE_HI = '11 अक्टूबर, 2026';
export const LEGAL_LAST_UPDATED_HI = '11 अक्टूबर, 2026';

export interface LegalSection {
  id: string;
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  reviewNote?: string;
}

export interface LegalDocumentDefinition {
  type: LegalDocumentType;
  title: string;
  shortTitle: string;
  subtitle: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  templateNotice: string;
  highlights: Array<{
    label: string;
    value: string;
  }>;
  sections: LegalSection[];
  unverifiedItems: string[];
}

export const createConsentSnapshot = (
  overrides?: Partial<LegalConsentRecord>
): LegalConsentRecord => ({
  accepted: true,
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
  consentedAt: new Date().toISOString(),
  source: 'signup',
  ...overrides,
});

export const isConsentCurrent = (
  consent?: Partial<LegalConsentRecord> | null
): boolean => {
  if (!consent || consent.accepted !== true) return false;
  return (
    consent.termsVersion === TERMS_VERSION &&
    consent.privacyVersion === PRIVACY_VERSION &&
    typeof consent.consentedAt === 'string' &&
    consent.consentedAt.trim().length > 0
  );
};

export const TERMS_DOCUMENT: LegalDocumentDefinition = {
  type: 'terms',
  title: 'Terms & Conditions',
  shortTitle: 'Terms & Conditions',
  subtitle:
    'Governing access to and use of the NOVA AI + AR Fashion Assistant application, Virtual Wardrobe, Camera Scan, AR Try-On, and Showroom features.',
  version: TERMS_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  lastUpdated: LEGAL_LAST_UPDATED,
  templateNotice:
    'Initial Legal Draft — Sections containing [Pending Confirmation] indicate business, corporate, or jurisdictional details that must be confirmed by the operator and reviewed by qualified legal counsel before commercial publication.',
  highlights: [
    { label: 'Document Version', value: `v${TERMS_VERSION}` },
    { label: 'Effective Date', value: LEGAL_EFFECTIVE_DATE },
    { label: 'Last Updated', value: LEGAL_LAST_UPDATED },
  ],
  sections: [
    {
      id: 'terms-1',
      number: '01',
      title: 'Operator Identity & Scope of Terms',
      paragraphs: [
        'These Terms & Conditions ("Terms") govern your access to and use of the NOVA AI + AR Fashion Assistant application ("NOVA", "the App", or "the Service"), including its AI Stylist chat, Camera Scan, Virtual Wardrobe, AR Try-On, Profile Style Analysis, and Showroom catalog features.',
        'Operator / Legal Entity Name: [Pending Confirmation — Insert Registered Legal Entity Name]. Registered Office / Postal Address: [Pending Confirmation — Insert Official Postal Address]. Designated Support & Legal Contact Email: [Pending Confirmation — Insert Verified Support Email].',
      ],
      reviewNote:
        'Requires operator confirmation of registered company name, corporate registration number, physical address, and monitored support email.',
    },
    {
      id: 'terms-2',
      number: '02',
      title: 'Eligibility, Account Registration & Guest Access',
      paragraphs: [
        'You may explore limited features of NOVA using "Continue as Guest" or register an account via "Create an Account". When registering an account, you agree to provide accurate and current information, including your full name, email address, mobile phone number, and optional delivery address / PIN code.',
        'Account creation requires explicit acceptance of these Terms & Conditions and the NOVA Privacy Policy, followed by email verification using a secure Firebase Authentication email sign-in link or registered phone login. We record the document versions you accept and the timestamp of your consent against your user account.',
      ],
      bullets: [
        'Guest sessions store temporary activity on your local device and may not persist across devices or browser clears.',
        'Registered accounts are personal to you; you are responsible for safeguarding access to your email inbox, phone number, and device.',
        'Duplicate account creation using false identities or automated scripts is prohibited.',
      ],
    },
    {
      id: 'terms-3',
      number: '03',
      title: 'AI Styling, Camera Scan, Virtual Wardrobe & AR Try-On Disclaimers',
      paragraphs: [
        'NOVA provides computer-vision and AI-assisted fashion recommendations, including selfie-based color/face-shape analysis, garment attribute detection, virtual wardrobe organization, and augmented-reality (AR) garment overlays.',
        'All AI and AR outputs are algorithmic estimates intended solely for informational and styling inspiration purposes:',
      ],
      bullets: [
        'AR Try-On overlays and size/fit suggestions ("Slim Fit", "Regular Fit", body measurements) are visual approximations and do not guarantee physical garment fit, drape, or tailoring accuracy.',
        'Skin tone, undertone, face shape, and color palette detections generated during Profile Style Analysis depend on lighting, camera quality, and image framing, and do not constitute dermatological, medical, or biometric identification advice.',
        'AI Stylist responses are generated by an automated language model and may occasionally produce inaccurate or incomplete styling suggestions.',
      ],
    },
    {
      id: 'terms-4',
      number: '04',
      title: 'User Content, Photos & Permissions',
      paragraphs: [
        'Certain NOVA features allow you to capture or upload photographs (such as selfies for Style Analysis, garment photos for Camera Scan or Virtual Wardrobe, or live camera streams for AR Try-On) and submit product reviews.',
        'By submitting or scanning content in NOVA, you confirm that you have the right to use and upload such images and text, and you grant NOVA a limited, non-exclusive license to process, analyze, store, and display that content solely as needed to provide the features you invoke (as detailed in the Privacy Policy).',
      ],
      bullets: [
        'Do not upload unlawful, infringing, defamatory, or explicit imagery, or photographs of other individuals without their permission.',
        'Product reviews submitted in the Showroom or Try-On Result screens may be displayed publicly alongside your reviewer display name.',
      ],
    },
    {
      id: 'terms-5',
      number: '05',
      title: 'Showroom Catalog, Vendors & Checkout Simulation',
      paragraphs: [
        'NOVA displays curated apparel, footwear, and accessories in the Showroom, which may include third-party brand or vendor listings stored in the platform catalog.',
        'In the current application build, cart checkout, saved payment cards, and UPI handles operate as an interactive demonstration/prototype environment unless and until a licensed payment processor and merchant fulfilment agreement are formally activated.',
      ],
      bullets: [
        'Product prices, stock indicators, ratings, and delivery estimates displayed in the Showroom are subject to change without notice.',
        'Vendor fulfilment terms, return/refund windows, shipping carriers, and commercial warranties: [Pending Confirmation — Requires formal vendor & e-commerce fulfilment policy before live commercial checkout is enabled].',
      ],
      reviewNote:
        'Commercial e-commerce terms (returns, refunds, shipping SLAs, payment gateway terms, and vendor liability allocation) must be finalized before live payment processing is enabled.',
    },
    {
      id: 'terms-6',
      number: '06',
      title: 'Acceptable Use & Platform Integrity',
      paragraphs: [
        'You agree not to misuse NOVA or interfere with its backend services, authentication endpoints, AI inference pipelines, or database infrastructure.',
      ],
      bullets: [
        'Do not attempt to bypass OTP rate limits, forge authentication tokens, or manipulate stored legal consent records.',
        'Do not reverse-engineer, scrape, or overload the Express API, Firebase/Firestore collections, Python vision service, or AI chat endpoints.',
        'Do not enter real sensitive financial credentials (such as live credit card CVVs or banking passwords) into prototype/simulated payment fields.',
      ],
    },
    {
      id: 'terms-7',
      number: '07',
      title: 'Intellectual Property',
      paragraphs: [
        'The NOVA brand name, star logo, interface design, software code, styling taxonomy, and original catalog presentation are protected by applicable intellectual property laws. Except for your own uploaded wardrobe photos, selfies, and review text, you acquire no ownership rights in the Service.',
      ],
    },
    {
      id: 'terms-8',
      number: '08',
      title: 'Account Removal, Suspension & Termination',
      paragraphs: [
        'You may sign out or remove your account from your local device at any time via Profile Settings. As explained in our Privacy Policy, removing an account from the device switcher clears local browser state on that device; requests to delete server-stored profile, wardrobe, and analysis records in Firebase Firestore must be submitted through the operator contact channel.',
        'We reserve the right to suspend or terminate accounts that violate these Terms or compromise platform security.',
      ],
    },
    {
      id: 'terms-9',
      number: '09',
      title: 'Disclaimers, Limitation of Liability & Updates to Terms',
      paragraphs: [
        'To the maximum extent permitted by applicable law, NOVA is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of uninterrupted availability, merchantable fit accuracy, or error-free AI output.',
        'When we make material updates to these Terms or our Privacy Policy, we will increment the published document version identifier and prompt registered users to review and accept the updated terms before continuing to use affected account features.',
        'Governing Law & Dispute Resolution Venue: [Pending Confirmation — Insert Applicable Jurisdiction and Courts].',
      ],
      reviewNote:
        'Limitation of liability caps, consumer statutory rights carve-outs, and governing law/arbitration clauses require review by legal counsel in your target jurisdiction.',
    },
  ],
  unverifiedItems: [
    'Registered legal entity name, corporate identification number, and physical postal address.',
    'Monitored customer support and legal notices email address.',
    'Live commercial checkout, payment gateway processor, shipping, return, and refund policies.',
    'Third-party vendor marketplace agreements and product warranty allocation.',
    'Governing law, consumer protection disclosures, and dispute resolution jurisdiction.',
  ],
};

export const PRIVACY_DOCUMENT: LegalDocumentDefinition = {
  type: 'privacy',
  title: 'Privacy Policy',
  shortTitle: 'Privacy Policy',
  subtitle:
    'Transparent disclosure of how NOVA collects, processes on-device, transmits to backend/AI services, stores in Firebase Firestore, and manages your personal data.',
  version: PRIVACY_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  lastUpdated: LEGAL_LAST_UPDATED,
  templateNotice:
    'Technical Accuracy Notice — This Privacy Policy is based on an inspection of the actual NOVA codebase and architecture. Items marked [Pending Confirmation] reflect organizational policies, retention schedules, or vendor agreements that must be confirmed before production release.',
  highlights: [
    { label: 'Policy Version', value: `v${PRIVACY_VERSION}` },
    { label: 'Effective Date', value: LEGAL_EFFECTIVE_DATE },
    { label: 'Last Updated', value: LEGAL_LAST_UPDATED },
  ],
  sections: [
    {
      id: 'privacy-1',
      number: '01',
      title: 'Data Controller & Contact Details',
      paragraphs: [
        'This Privacy Policy explains how NOVA ("we", "us", or "our") handles information when you use the NOVA AI + AR Fashion Assistant application.',
        'Data Controller / Operator: [Pending Confirmation — Insert Legal Entity Name]. Postal Address: [Pending Confirmation — Insert Postal Address]. Privacy / Data Protection Contact: [Pending Confirmation — Insert Privacy Contact Email].',
      ],
      reviewNote:
        'Requires insertion of verified data controller identity and Data Protection Officer (DPO) / privacy contact details.',
    },
    {
      id: 'privacy-2',
      number: '02',
      title: 'Data Collected by the Application',
      paragraphs: [
        'Depending on whether you use NOVA as a Guest or create a Registered Account, the application collects the following categories of information:',
      ],
      bullets: [
        'Account & Registration Data: Full name, email address, mobile phone number (with country code), optional street/city address, and optional 6-digit PIN code submitted during signup.',
        'Legal Consent Metadata: Explicit acceptance status, accepted Terms & Conditions version (termsVersion), accepted Privacy Policy version (privacyVersion), acceptance timestamp (consentedAt and server timestamp), and account identifier (UID/email).',
        'Body Measurements & Style Preferences: Height, weight, chest, waist, and inseam measurements, along with preferred style, fit, color palette, and occasion settings.',
        'Photos & Visual Inputs (When You Use Visual Features): Selfies captured or uploaded for AI Style Analysis, garment photos scanned or uploaded in Camera Scan and Virtual Wardrobe, and live camera video frames used in AR Try-On.',
        'App Activity & Commerce Data: Virtual Wardrobe items and tags, wishlist items, shopping cart items, product reviews (rating, review text, reviewer name, account UID), saved delivery addresses, NOVA loyalty points, and recent feature activity.',
      ],
    },
    {
      id: 'privacy-3',
      number: '03',
      title: 'Data Processed On-Device (In Your Browser / Device)',
      paragraphs: [
        'Several NOVA features process data directly on your device without sending raw camera streams to external servers:',
      ],
      bullets: [
        'Camera Scan Feature Extraction (src/services/cameraScanService.ts): When you scan an outfit in Camera Scan, the image is resized locally on an HTML5 canvas (up to 512×512) to compute color histograms, edge density, and garment category matches in your browser.',
        'Live AR Try-On Preview (src/components/ArTryOnView.tsx): Live camera video accessed via navigator.mediaDevices.getUserMedia is rendered locally on your screen to overlay virtual garments in real time. Toggling "Incognito AR Scan" in Profile > Privacy & Security prevents AR try-on sessions from being added to your local recent activity log.',
        'Local Device Storage (localStorage): NOVA stores your active session state, device account switcher list (nova_accounts), cart (nova_cart_<uid>), wishlist, measurements, preferences, local wardrobe cache, and simulated payment/address entries in browser localStorage.',
      ],
    },
    {
      id: 'privacy-4',
      number: '04',
      title: 'Data Sent to Backend Services, Cloud Databases & AI Providers',
      paragraphs: [
        'We do NOT claim that photos or personal data never leave your device. Based on the verified application implementation, the following features transmit data to backend servers, cloud databases, or AI services:',
      ],
      bullets: [
        'Firebase Authentication & Cloud Firestore (Google Firebase): Account authentication and email sign-in links are handled by Firebase Authentication. User profile metadata (users/{uid} and users/{uid}/profile/meta), legal consent records (legal_consents), product reviews (product_reviews), and synced Virtual Wardrobe items (users/{uid}/wardrobe) are stored in Google Firebase / Cloud Firestore.',
        'Selfie Style Analysis (POST /api/analyze-selfie): When you run AI Style Analysis (ProfileAnalysisView), your base64-encoded selfie image (imageDataUrl) and user identifier are sent to the NOVA Express backend (server/analysisRouter.ts). The backend analyzes pixel regions using Sharp, caches the analysis by SHA-256 image hash in Firestore (users/{docId}/analysisCache/{imageHash}), and stores both the analysis profile and the selfie data URL (when within Firestore’s ~1 MB document limit) in your Firestore user document (users/{docId} and users/{docId}/profile/meta).',
        'Virtual Wardrobe Vision Service & Google Cloud Vision API: When you scan or upload a garment to the Virtual Wardrobe (src/services/aiService.ts -> server_ai/main.py), the garment image is uploaded to the Python FastAPI backend (port 8000), saved to server disk directories (server_ai/uploads/ and output/), and—when Google Cloud credentials are configured—transmitted to the Google Cloud Vision API for label, color, and object detection. Resulting garment images and attributes are also saved to Firestore (users/{docId}/wardrobe).',
        'AI Stylist Chat (POST /api/chat): Messages sent to the NOVA AI Stylist are processed by the Express backend (server/chatRouter.ts) and forwarded to the configured Ollama LLM runtime (default qwen2.5:7b). Up to 20 recent conversation messages are held in server memory keyed by client IP address to maintain conversation context.',
        'Email Verification (Firebase Authentication): During signup, Firebase Authentication sends an email sign-in link to the address provided. Opening the link verifies the address and signs the user in.',
      ],
    },
    {
      id: 'privacy-5',
      number: '05',
      title: 'Data Shared with Vendors & Third Parties',
      paragraphs: [
        'Showroom products and vendor profiles are retrieved from Firestore so you can browse catalog items. NOVA shares or exposes data to third parties only in the following verified ways:',
      ],
      bullets: [
        'Public Product Reviews: Reviews and star ratings you submit on Showroom products or Try-On Results are stored in the Firestore product_reviews collection and are visible to other users viewing those products.',
        'Infrastructure Sub-processors: Google Firebase (Authentication and Cloud Firestore), Google Cloud Vision API (when enabled for Virtual Wardrobe analysis), and the operator’s configured SMTP email provider process data on our behalf to deliver core app functionality.',
        'Vendor Order Sharing: Checkout in the current app build is simulated locally; no personal data or payment credentials are automatically transmitted to third-party apparel vendors at checkout unless live order fulfilment is enabled in a future release.',
      ],
      reviewNote:
        'Third-party vendor data-sharing agreements and sub-processor DPAs (Data Processing Addenda) remain [Pending Confirmation].',
    },
    {
      id: 'privacy-6',
      number: '06',
      title: 'Optional Camera & Photo Permissions',
      paragraphs: [
        'Camera and photo library permissions are strictly optional and requested on-demand only when you launch AR Try-On, Camera Scan, Virtual Wardrobe garment upload/capture, or Profile Selfie Analysis.',
        'You may decline or revoke camera permissions at any time in your browser or mobile operating system settings. If you decline camera access, you can still upload existing image files where supported, chat with the AI Stylist, browse the Showroom, and manage your profile.',
      ],
    },
    {
      id: 'privacy-7',
      number: '07',
      title: 'Data Retention & Account / Data Deletion Procedures',
      paragraphs: [
        'We distinguish clearly between local device removal and server-side data deletion so you know exactly how your data is handled:',
      ],
      bullets: [
        'OTP Verification Codes: Stored as SHA-256 hashes with a 5-minute expiration time (TTL) and deleted upon successful verification or after 3 failed attempts.',
        'AI Chat Context: Held in server RAM (up to 20 messages per client IP) and cleared when the server restarts.',
        'Local Sign-Out & Account Removal: Clicking "Log Out" or removing an account in Profile > Manage Accounts clears or removes that account entry from your local browser storage (localStorage).',
        'Server-Side Data Deletion Disclosure: Removing an account from your device does NOT automatically delete your cloud records stored in Firebase Firestore (users/{uid}, profile/meta, analysisCache, wardrobe, product_reviews, legal_consents) or garment files stored in server_ai/uploads/. To request permanent deletion of server-stored account and image data, please contact the operator at [Pending Confirmation — Insert Privacy Deletion Request Email / Process].',
      ],
      reviewNote:
        'Formal server-side data retention periods and an automated cloud account-purge workflow remain [Pending Confirmation].',
    },
    {
      id: 'privacy-8',
      number: '08',
      title: 'Consent Integrity, Security & Policy Updates',
      paragraphs: [
        'When you create an account, NOVA records the exact Terms & Conditions and Privacy Policy versions you accepted along with an ISO timestamp in our backend and Firebase Firestore. Ordinary client-side profile controls cannot alter or backdate stored consent records.',
        'While we use SHA-256 hashing for OTP codes and Firebase Authentication custom tokens for verified sessions, no method of electronic transmission or storage is 100% secure. Specific enterprise security certifications or encryption-at-rest guarantees beyond standard cloud provider defaults are [Pending Confirmation].',
        'If we make material changes to how we process your personal data, we will update the Privacy Policy version identifier and prompt registered users to review and renew their consent.',
      ],
    },
  ],
  unverifiedItems: [
    'Data Controller legal name, registration details, postal address, and Data Protection Officer / privacy email.',
    'Exact data retention schedules for Firestore user profiles, stored selfie data URLs (profilePhoto), analysisCache, and server_ai/uploads/ garment files.',
    'Automated server-side account and Firestore data deletion workflow (current UI account removal only clears local device storage).',
    'Executed Data Processing Agreements (DPAs) with Google Cloud / Firebase and any external LLM hosting provider if Ollama is hosted remotely.',
    'Whether third-party Showroom vendors will receive customer shipping/contact data once live checkout replaces the current simulated checkout.',
  ],
};

export const TERMS_DOCUMENT_HI: LegalDocumentDefinition = {
  type: 'terms',
  title: 'नियम व शर्तें',
  shortTitle: 'नियम व शर्तें',
  subtitle:
    'NOVA AI + AR फैशन सहायक एप्लिकेशन, वर्चुअल वॉर्डरोब, कैमरा स्कैन, AR ट्राई-ऑन और शोरूम सुविधाओं तक पहुंच और उपयोग को नियंत्रित करने वाले नियम।',
  version: TERMS_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE_HI,
  lastUpdated: LEGAL_LAST_UPDATED_HI,
  templateNotice:
    'प्रारंभिक कानूनी मसौदा — [पुष्टि लंबित] चिह्नित अनुभाग व्यावसायिक, कॉर्पोरेट या क्षेत्राधिकार संबंधी विवरण दर्शाते हैं जिन्हें वाणिज्यिक प्रकाशन से पहले ऑपरेटर द्वारा पुष्टि और योग्य कानूनी परामर्शदाता द्वारा समीक्षा की जानी चाहिए।',
  highlights: [
    { label: 'दस्तावेज़ संस्करण', value: `v${TERMS_VERSION}` },
    { label: 'प्रभावी तिथि', value: LEGAL_EFFECTIVE_DATE_HI },
    { label: 'अंतिम अपडेट', value: LEGAL_LAST_UPDATED_HI },
  ],
  sections: [
    {
      id: 'terms-1',
      number: '01',
      title: 'ऑपरेटर पहचान और शर्तों का दायरा',
      paragraphs: [
        'ये नियम व शर्तें ("शर्तें") NOVA AI + AR फैशन सहायक एप्लिकेशन ("NOVA", "ऐप", या "सेवा") तक आपकी पहुंच और उपयोग को नियंत्रित करती हैं, जिसमें इसका AI स्टाइलिस्ट चैट, कैमरा स्कैन, वर्चुअल वॉर्डरोब, AR ट्राई-ऑन, प्रोफाइल स्टाइल विश्लेषण और शोरूम कैटलॉग सुविधाएं शामिल हैं।',
        'ऑपरेटर / कानूनी संस्था का नाम: [पुष्टि लंबित — पंजीकृत कानूनी संस्था का नाम दर्ज करें]। पंजीकृत कार्यालय / डाक पता: [पुष्टि लंबित — आधिकारिक डाक पता दर्ज करें]। नामित सहायता और कानूनी संपर्क ईमेल: [पुष्टि लंबित — सत्यापित सहायता ईमेल दर्ज करें]।',
      ],
      reviewNote:
        'पंजीकृत कंपनी का नाम, कॉर्पोरेट पंजीकरण संख्या, भौतिक पता और निगरानी किए जा रहे सहायता ईमेल की ऑपरेटर द्वारा पुष्टि आवश्यक है।',
    },
    {
      id: 'terms-2',
      number: '02',
      title: 'पात्रता, खाता पंजीकरण और अतिथि पहुंच',
      paragraphs: [
        'आप "अतिथि के रूप में जारी रखें" का उपयोग करके NOVA की सीमित सुविधाओं का पता लगा सकते हैं या "खाता बनाएं" के माध्यम से एक खाता पंजीकृत कर सकते हैं। खाता पंजीकृत करते समय, आप अपना पूरा नाम, ईमेल पता, मोबाइल फोन नंबर और वैकल्पिक डिलीवरी पता / पिन कोड सहित सटीक और वर्तमान जानकारी प्रदान करने के लिए सहमत होते हैं।',
        'खाता निर्माण के लिए इन नियमों और शर्तों और NOVA गोपनीयता नीति की स्पष्ट स्वीकृति की आवश्यकता होती है, जिसके बाद सुरक्षित फ़ायरबेस प्रमाणीकरण ईमेल साइन-इन लिंक या पंजीकृत फोन लॉगिन का उपयोग करके ईमेल सत्यापन किया जाता है। हम आपके द्वारा स्वीकार किए गए दस्तावेज़ संस्करणों और आपकी सहमति के टाइमस्टैम्प को आपके उपयोगकर्ता खाते के साथ रिकॉर्ड करते हैं।',
      ],
      bullets: [
        'अतिथि सत्र आपके स्थानीय डिवाइस पर अस्थायी गतिविधि संग्रहीत करते हैं और हो सकता है कि विभिन्न डिवाइसों या ब्राउज़र साफ़ करने पर बने न रहें।',
        'पंजीकृत खाते आपके लिए व्यक्तिगत हैं; आप अपने ईमेल इनबॉक्स, फोन नंबर और डिवाइस तक पहुंच की सुरक्षा के लिए जिम्मेदार हैं।',
        'झूठी पहचान या स्वचालित स्क्रिप्ट का उपयोग करके डुप्लिकेट खाता निर्माण प्रतिबंधित है।',
      ],
    },
    {
      id: 'terms-3',
      number: '03',
      title: 'AI स्टाइलिंग, कैमरा स्कैन, वर्चुअल वॉर्डरोब और AR ट्राई-ऑन अस्वीकरण',
      paragraphs: [
        'NOVA कंप्यूटर-विज़न और AI-सहायता प्राप्त फैशन सिफारिशें प्रदान करता है, जिसमें सेल्फी-आधारित रंग/चेहरे के आकार का विश्लेषण, परिधान विशेषता का पता लगाना, वर्चुअल वॉर्डरोब संगठन और संवर्धित-वास्तविकता (AR) परिधान ओवरले शामिल हैं।',
        'सभी AI और AR आउटपुट पूरी तरह से सूचनात्मक और स्टाइल प्रेरणा उद्देश्यों के लिए अभिप्रेत एल्गोरिदमिक अनुमान हैं:',
      ],
      bullets: [
        'AR ट्राई-ऑन ओवरले और आकार/फिट सुझाव ("स्लिम फिट", "रेगुलर फिट", शरीर के माप) दृश्य सन्निकटन हैं और भौतिक परिधान फिट, ड्रेप या सिलाई सटीकता की गारंटी नहीं देते हैं।',
        'प्रोफाइल स्टाइल विश्लेषण के दौरान उत्पन्न त्वचा टोन, अंडरटोन, चेहरे का आकार और रंग पैलेट का पता लगाना प्रकाश, कैमरा गुणवत्ता और छवि फ्रेमिंग पर निर्भर करता है, और यह त्वचाविज्ञान, चिकित्सा या बायोमेट्रिक पहचान सलाह का गठन नहीं करता है।',
        'AI स्टाइलिस्ट प्रतिक्रियाएं एक स्वचालित भाषा मॉडल द्वारा उत्पन्न की जाती हैं और कभी-कभी गलत या अधूरी स्टाइलिंग सिफारिशें उत्पन्न कर सकती हैं।',
      ],
    },
    {
      id: 'terms-4',
      number: '04',
      title: 'उपयोगकर्ता सामग्री, तस्वीरें और अनुमतियां',
      paragraphs: [
        'कुछ NOVA सुविधाएं आपको तस्वीरें लेने या अपलोड करने (जैसे स्टाइल विश्लेषण के लिए सेल्फी, कैमरा स्कैन या वर्चुअल वॉर्डरोब के लिए परिधान तस्वीरें, या AR ट्राई-ऑन के लिए लाइव कैमरा स्ट्रीम) और उत्पाद समीक्षाएं सबमिट करने की अनुमति देती हैं।',
        'NOVA में सामग्री सबमिट या स्कैन करके, आप पुष्टि करते हैं कि आपके पास ऐसी छवियों और पाठ का उपयोग करने और अपलोड करने का अधिकार है, और आप NOVA को केवल आपके द्वारा उपयोग की जाने वाली सुविधाएं प्रदान करने के लिए आवश्यक सामग्री को संसाधित करने, विश्लेषण करने, संग्रहीत करने और प्रदर्शित करने का एक सीमित, गैर-विशिष्ट लाइसेंस प्रदान करते हैं (जैसा कि गोपनीयता नीति में विस्तृत है)।',
      ],
      bullets: [
        'गैरकानूनी, उल्लंघनकारी, मानहानिकारक या स्पष्ट चित्र, या अन्य व्यक्तियों की अनुमति के बिना उनकी तस्वीरें अपलोड न करें।',
        'शोरूम या ट्राई-ऑन परिणाम स्क्रीन में सबमिट की गई उत्पाद समीक्षाएं आपके समीक्षक प्रदर्शन नाम के साथ सार्वजनिक रूप से प्रदर्शित की जा सकती हैं।',
      ],
    },
    {
      id: 'terms-5',
      number: '05',
      title: 'शोरूम कैटलॉग, विक्रेता और चेकआउट सिमुलेशन',
      paragraphs: [
        'NOVA शोरूम में क्यूरेट किए गए परिधान, जूते और सहायक उपकरण प्रदर्शित करता है, जिसमें प्लेटफ़ॉर्म कैटलॉग में संग्रहीत तृतीय-पक्ष ब्रांड या विक्रेता लिस्टिंग शामिल हो सकती है।',
        'वर्तमान एप्लिकेशन बिल्ड में, कार्ट चेकआउट, सहेजे गए भुगतान कार्ड और UPI हैंडल एक इंटरैक्टिव प्रदर्शन/प्रोटोटाइप वातावरण के रूप में काम करते हैं जब तक कि एक लाइसेंस प्राप्त भुगतान प्रोसेसर और मर्चेंट पूर्ति समझौता औपचारिक रूप से सक्रिय नहीं हो जाता।',
      ],
      bullets: [
        'शोरूम में प्रदर्शित उत्पाद की कीमतें, स्टॉक संकेतक, रेटिंग और डिलीवरी अनुमान बिना किसी पूर्व सूचना के परिवर्तन के अधीन हैं।',
        'विक्रेता पूर्ति शर्तें, वापसी/वापसी विंडो, शिपिंग वाहक और वाणिज्यिक वारंटी: [पुष्टि लंबित — लाइव वाणिज्यिक चेकआउट सक्षम होने से पहले औपचारिक विक्रेता और ई-कॉमर्स पूर्ति नीति की आवश्यकता है]।',
      ],
      reviewNote:
        'लाइव भुगतान प्रसंस्करण सक्षम होने से पहले वाणिज्यिक ई-कॉमर्स शर्तें (रिटर्न, रिफंड, शिपिंग एसएलए, पेमेंट गेटवे शर्तें और विक्रेता देयता आवंटन) को अंतिम रूप दिया जाना चाहिए।',
    },
    {
      id: 'terms-6',
      number: '06',
      title: 'स्वीकार्य उपयोग और प्लेटफ़ॉर्म अखंडता',
      paragraphs: [
        'आप NOVA का दुरुपयोग न करने या इसकी बैकएंड सेवाओं, प्रमाणीकरण एंडपॉइंट्स, AI निष्कर्ष पाइपलाइनों, या डेटाबेस बुनियादी ढांचे में हस्तक्षेप न करने के लिए सहमत होते हैं।',
      ],
      bullets: [
        'OTP दर सीमाओं को बायपास करने, प्रमाणीकरण टोकन बनाने, या संग्रहीत कानूनी सहमति रिकॉर्ड में हेरफेर करने का प्रयास न करें।',
        'Express API, Firebase/Firestore संग्रहों, Python विज़न सेवा, या AI चैट एंडपॉइंट्स को रिवर्स-इंजीनियर, स्क्रैप या ओवरलोड न करें।',
        'प्रोटोटाइप/सिम्युलेटेड भुगतान फ़ील्ड में वास्तविक संवेदनशील वित्तीय क्रेडेंशियल (जैसे लाइव क्रेडिट कार्ड सीवीवी या बैंकिंग पासवर्ड) दर्ज न करें।',
      ],
    },
    {
      id: 'terms-7',
      number: '07',
      title: 'बौद्धिक संपदा',
      paragraphs: [
        'NOVA ब्रांड नाम, स्टार लोगो, इंटरफ़ेस डिज़ाइन, सॉफ्टवेयर कोड, स्टाइलिंग वर्गीकरण और मूल कैटलॉग प्रस्तुति लागू बौद्धिक संपदा कानूनों द्वारा संरक्षित हैं। आपके अपने अपलोड किए गए वॉर्डरोब फोटो, सेल्फी और समीक्षा पाठ को छोड़कर, आप सेवा में कोई स्वामित्व अधिकार प्राप्त नहीं करते हैं।',
      ],
    },
    {
      id: 'terms-8',
      number: '08',
      title: 'खाता हटाना, निलंबन और समाप्ति',
      paragraphs: [
        'आप प्रोफ़ाइल सेटिंग्स के माध्यम से किसी भी समय अपने स्थानीय डिवाइस से साइन आउट कर सकते हैं या अपना खाता हटा सकते हैं। जैसा कि हमारी गोपनीयता नीति में बताया गया है, डिवाइस स्विचर से खाता हटाने से उस डिवाइस पर स्थानीय ब्राउज़र स्थिति साफ़ हो जाती है; Firebase Firestore में सर्वर-संग्रहीत प्रोफ़ाइल, वॉर्डरोब और विश्लेषण रिकॉर्ड को हटाने के अनुरोध ऑपरेटर संपर्क चैनल के माध्यम से सबमिट किए जाने चाहिए।',
        'हम उन खातों को निलंबित या समाप्त करने का अधिकार सुरक्षित रखते हैं जो इन शर्तों का उल्लंघन करते हैं या प्लेटफ़ॉर्म सुरक्षा से समझौता करते हैं।',
      ],
    },
    {
      id: 'terms-9',
      number: '09',
      title: 'अस्वीकरण, देयता की सीमा और शर्तों में अपडेट',
      paragraphs: [
        'लागू कानून द्वारा अनुमत अधिकतम सीमा तक, NOVA बिना किसी निर्बाध उपलब्धता की वारंटी, व्यापार योग्य फिट सटीकता, या त्रुटि-मुक्त AI आउटपुट के "जैसा है" और "जैसा उपलब्ध है" के आधार पर प्रदान किया जाता है।',
        'जब हम इन शर्तों या हमारी गोपनीयता नीति में महत्वपूर्ण अपडेट करते हैं, तो हम प्रकाशित दस्तावेज़ संस्करण पहचानकर्ता को बढ़ाएंगे और पंजीकृत उपयोगकर्ताओं को प्रभावित खाता सुविधाओं का उपयोग जारी रखने से पहले अद्यतन शर्तों की समीक्षा करने और स्वीकार करने के लिए संकेत देंगे।',
        'लागू कानून और विवाद समाधान स्थल: [पुष्टि लंबित — लागू क्षेत्राधिकार और न्यायालय दर्ज करें]।',
      ],
      reviewNote:
        'देयता सीमा कैप, उपभोक्ता वैधानिक अधिकार अपवाद, और शासी कानून/मध्यस्थता खंडों को आपके लक्षित क्षेत्राधिकार में कानूनी परामर्शदाता द्वारा समीक्षा की आवश्यकता है।',
    },
  ],
  unverifiedItems: [
    'पंजीकृत कानूनी संस्था का नाम, कॉर्पोरेट पहचान संख्या, और भौतिक डाक पता।',
    'निगरानी किया जाने वाला ग्राहक सहायता और कानूनी नोटिस ईमेल पता।',
    'लाइव वाणिज्यिक चेकआउट, पेमेंट गेटवे प्रोसेसर, शिपिंग, वापसी और रिफंड नीतियां।',
    'तृतीय-पक्ष विक्रेता बाज़ार समझौते और उत्पाद वारंटी आवंटन।',
    'शासी कानून, उपभोक्ता संरक्षण प्रकटीकरण और विवाद समाधान क्षेत्राधिकार।',
  ],
};

export const PRIVACY_DOCUMENT_HI: LegalDocumentDefinition = {
  type: 'privacy',
  title: 'गोपनीयता नीति',
  shortTitle: 'गोपनीयता नीति',
  subtitle:
    'NOVA आपके व्यक्तिगत डेटा को कैसे एकत्र करता है, डिवाइस पर संसाधित करता है, बैकएंड/AI सेवाओं को भेजता है, Firebase Firestore में संग्रहीत करता है और प्रबंधित करता है, इसका पारदर्शी प्रकटीकरण।',
  version: PRIVACY_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE_HI,
  lastUpdated: LEGAL_LAST_UPDATED_HI,
  templateNotice:
    'तकनीकी सटीकता सूचना — यह गोपनीयता नीति वास्तविक NOVA कोडबेस और आर्किटेक्चर के निरीक्षण पर आधारित है। [पुष्टि लंबित] चिह्नित आइटम संगठनात्मक नीतियों, प्रतिधारण कार्यक्रमों, या विक्रेता समझौतों को दर्शाते हैं जिन्हें उत्पादन रिलीज से पहले पुष्टि की जानी चाहिए।',
  highlights: [
    { label: 'नीति संस्करण', value: `v${PRIVACY_VERSION}` },
    { label: 'प्रभावी तिथि', value: LEGAL_EFFECTIVE_DATE_HI },
    { label: 'अंतिम अपडेट', value: LEGAL_LAST_UPDATED_HI },
  ],
  sections: [
    {
      id: 'privacy-1',
      number: '01',
      title: 'डेटा नियंत्रक और संपर्क विवरण',
      paragraphs: [
        'यह गोपनीयता नीति बताती है कि जब आप NOVA AI + AR फैशन सहायक एप्लिकेशन का उपयोग करते हैं तो NOVA ("हम", "हमारा", या "हमारी") जानकारी को कैसे संभालता है।',
        'डेटा नियंत्रक / ऑपरेटर: [पुष्टि लंबित — कानूनी संस्था का नाम दर्ज करें]। डाक पता: [पुष्टि लंबित — डाक पता दर्ज करें]। गोपनीयता / डेटा संरक्षण संपर्क: [पुष्टि लंबित — गोपनीयता संपर्क ईमेल दर्ज करें]।',
      ],
      reviewNote:
        'सत्यापित डेटा नियंत्रक पहचान और डेटा सुरक्षा अधिकारी (DPO) / गोपनीयता संपर्क विवरण सम्मिलित करने की आवश्यकता है।',
    },
    {
      id: 'privacy-2',
      number: '02',
      title: 'एप्लिकेशन द्वारा एकत्र किया गया डेटा',
      paragraphs: [
        'आप NOVA का उपयोग अतिथि के रूप में करते हैं या पंजीकृत खाता बनाते हैं, इसके आधार पर एप्लिकेशन निम्नलिखित श्रेणियों की जानकारी एकत्र करता है:',
      ],
      bullets: [
        'खाता और पंजीकरण डेटा: साइनअप के दौरान सबमिट किया गया पूरा नाम, ईमेल पता, मोबाइल फोन नंबर (देश कोड के साथ), वैकल्पिक सड़क/शहर का पता, और वैकल्पिक 6-अंकीय पिन कोड।',
        'कानूनी सहमति मेटाडेटा: स्पष्ट स्वीकृति स्थिति, स्वीकृत नियम व शर्तें संस्करण (termsVersion), स्वीकृत गोपनीयता नीति संस्करण (privacyVersion), स्वीकृति टाइमस्टैम्प (consentedAt और सर्वर टाइमस्टैम्प), और खाता पहचानकर्ता (UID/ईमेल)।',
        'शरीर के माप और स्टाइल प्राथमिकताएं: ऊंचाई, वजन, छाती, कमर और इनसीम माप, साथ ही पसंदीदा स्टाइल, फिट, रंग पैलेट और अवसर सेटिंग्स।',
        'तस्वीरें और दृश्य इनपुट (जब आप दृश्य सुविधाओं का उपयोग करते हैं): AI स्टाइल विश्लेषण के लिए ली गई या अपलोड की गई सेल्फी, कैमरा स्कैन और वर्चुअल वॉर्डरोब में स्कैन या अपलोड की गई परिधान तस्वीरें, और AR ट्राई-ऑन में उपयोग किए जाने वाले लाइव कैमरा वीडियो फ्रेम।',
        'ऐप गतिविधि और वाणिज्य डेटा: वर्चुअल वॉर्डरोब आइटम और टैग, विशलिस्ट आइटम, शॉपिंग कार्ट आइटम, उत्पाद समीक्षाएं (रेटिंग, समीक्षा पाठ, समीक्षक का नाम, खाता UID), सहेजे गए डिलीवरी पते, NOVA लॉयल्टी अंक, और हाल की सुविधा गतिविधि।',
      ],
    },
    {
      id: 'privacy-3',
      number: '03',
      title: 'डिवाइस पर संसाधित डेटा (आपके ब्राउज़र / डिवाइस में)',
      paragraphs: [
        'कई NOVA सुविधाएं बाहरी सर्वर पर रॉ कैमरा स्ट्रीम भेजे बिना सीधे आपके डिवाइस पर डेटा संसाधित करती हैं:',
      ],
      bullets: [
        'कैमरा स्कैन फीचर निष्कर्षण (src/services/cameraScanService.ts): जब आप कैमरा स्कैन में किसी पोशाक को स्कैन करते हैं, तो आपके ब्राउज़र में रंग हिस्टोग्राम, एज डेंसिटी और परिधान श्रेणी मिलान की गणना करने के लिए छवि को स्थानीय रूप से HTML5 कैनवास (512×512 तक) पर आकार दिया जाता है।',
        'लाइव AR ट्राई-ऑन पूर्वावलोकन (src/components/ArTryOnView.tsx): real time में वर्चुअल कपड़ों को ओवरले करने के लिए navigator.mediaDevices.getUserMedia के माध्यम से एक्सेस किया गया लाइव कैमरा वीडियो आपकी स्क्रीन पर स्थानीय रूप से प्रस्तुत किया जाता है। प्रोफ़ाइल > गोपनीयता और सुरक्षा में "गुप्त AR स्कैन" चालू करने से AR ट्राई-ऑन सत्र आपके स्थानीय हालिया गतिविधि लॉग में जोड़े जाने से बचते हैं।',
        'स्थानीय डिवाइस स्टोरेज (localStorage): NOVA आपके सक्रिय सत्र की स्थिति, डिवाइस खाता स्विचर सूची (nova_accounts), कार्ट (nova_cart_<uid>), विशलिस्ट, माप, प्राथमिकताएं, स्थानीय वॉर्डरोब कैश, और सिम्युलेटेड भुगतान/पता प्रविष्टियों को ब्राउज़र localStorage में संग्रहीत करता है।',
      ],
    },
    {
      id: 'privacy-4',
      number: '04',
      title: 'बैकएंड सेवाओं, क्लाउड डेटाबेस और AI प्रदाताओं को भेजा गया डेटा',
      paragraphs: [
        'हम यह दावा नहीं करते हैं कि तस्वीरें या व्यक्तिगत डेटा कभी भी आपके डिवाइस से बाहर नहीं जाते हैं। सत्यापित एप्लिकेशन कार्यान्वयन के आधार पर, निम्नलिखित सुविधाएं बैकएंड सर्वर, क्लाउड डेटाबेस या AI सेवाओं को डेटा संचारित करती हैं:',
      ],
      bullets: [
        'Firebase Authentication और Cloud Firestore (Google Firebase): खाता प्रमाणीकरण और ईमेल साइन-इन लिंक Firebase Authentication द्वारा नियंत्रित किए जाते हैं। उपयोगकर्ता प्रोफ़ाइल मेटाडेटा (users/{uid} और users/{uid}/profile/meta), कानूनी सहमति रिकॉर्ड (legal_consents), उत्पाद समीक्षाएं (product_reviews), और सिंक किए गए वर्चुअल वॉर्डरोब आइटम (users/{uid}/wardrobe) Google Firebase / Cloud Firestore में संग्रहीत किए जाते हैं।',
        'सेल्फी स्टाइल विश्लेषण (POST /api/analyze-selfie): जब आप AI स्टाइल विश्लेषण (ProfileAnalysisView) चलाते हैं, तो आपकी base64-एन्कोडेड सेल्फी छवि (imageDataUrl) और उपयोगकर्ता पहचानकर्ता NOVA Express बैकएंड (server/analysisRouter.ts) पर भेजे जाते हैं। बैकएंड Sharp का उपयोग करके पिक्सेल क्षेत्रों का विश्लेषण करता है, Firestore (users/{docId}/analysisCache/{imageHash}) में SHA-256 छवि हैश द्वारा विश्लेषण को कैश करता है, और विश्लेषण प्रोफ़ाइल और सेल्फी डेटा URL दोनों को (जब Firestore की ~1 MB दस्तावेज़ सीमा के भीतर हो) आपके Firestore उपयोगकर्ता दस्तावेज़ (users/{docId} और users/{docId}/profile/meta) में संग्रहीत करता है।',
        'वर्चुअल वॉर्डरोब विज़न सेवा और Google Cloud Vision API: जब आप वर्चुअल वॉर्डरोब (src/services/aiService.ts -> server_ai/main.py) में किसी परिधान को स्कैन या अपलोड करते हैं, तो परिधान छवि Python FastAPI बैकएंड (पोर्ट 8000) पर अपलोड की जाती है, सर्वर डिस्क निर्देशिकाओं (server_ai/uploads/ और output/) में सहेजी जाती है, और—जब Google Cloud क्रेडेंशियल कॉन्फ़िगर किए जाते हैं—लेबल, रंग और वस्तु का पता लगाने के लिए Google Cloud Vision API को भेजी जाती है। परिणामी परिधान छवियां और विशेषताएं Firestore (users/{docId}/wardrobe) में भी सहेजी जाती हैं।',
        'AI स्टाइलिस्ट चैट (POST /api/chat): NOVA AI स्टाइलिस्ट को भेजे गए संदेश Express बैकएंड (server/chatRouter.ts) द्वारा संसाधित किए जाते हैं और कॉन्फ़िगर किए गए Ollama LLM रनटाइम (डिफ़ॉल्ट qwen2.5:7b) पर अग्रेषित किए जाते हैं। बातचीत के संदर्भ को बनाए रखने के लिए क्लाइंट आईपी पते द्वारा कीड किए गए सर्वर मेमोरी में 20 हालिया बातचीत संदेश रखे जाते हैं।',
        'ईमेल सत्यापन (Firebase Authentication): साइनअप के दौरान, Firebase Authentication दिए गए पते पर एक ईमेल साइन-इन लिंक भेजता है। लिंक खोलने से पते की पुष्टि होती है और उपयोगकर्ता साइन इन हो जाता है।',
      ],
    },
    {
      id: 'privacy-5',
      number: '05',
      title: 'विक्रेताओं और तृतीय पक्षों के साथ साझा किया गया डेटा',
      paragraphs: [
        'शोरूम उत्पाद और विक्रेता प्रोफ़ाइल Firestore से प्राप्त की जाती हैं ताकि आप कैटलॉग आइटम ब्राउज़ कर सकें। NOVA केवल निम्नलिखित सत्यापित तरीकों से तीसरे पक्ष को डेटा साझा या प्रदर्शित करता है:',
      ],
      bullets: [
        'सार्वजनिक उत्पाद समीक्षाएं: शोरूम उत्पादों या ट्राई-ऑन परिणामों पर आपके द्वारा सबमिट की गई समीक्षाएं और स्टार रेटिंग Firestore product_reviews संग्रह में संग्रहीत की जाती हैं और उन उत्पादों को देखने वाले अन्य उपयोगकर्ताओं को दिखाई देती हैं।',
        'इन्फ्रास्ट्रक्चर सब-प्रोसेसर: Google Firebase (Authentication और Cloud Firestore), Google Cloud Vision API (जब वर्चुअल वॉर्डरोब विश्लेषण के लिए सक्षम हो), और ऑपरेटर का कॉन्फ़िगर किया गया SMTP ईमेल प्रदाता मुख्य ऐप कार्यक्षमता प्रदान करने के लिए हमारी ओर से डेटा संसाधित करते हैं।',
        'विक्रेता ऑर्डर साझाकरण: वर्तमान ऐप बिल्ड में चेकआउट स्थानीय रूप से सिम्युलेटेड है; चेकआउट पर कोई भी व्यक्तिगत डेटा या भुगतान क्रेडेंशियल स्वचालित रूप से तृतीय-पक्ष परिधान विक्रेताओं को प्रेषित नहीं किया जाता है जब तक कि भविष्य के रिलीज में लाइव ऑर्डर पूर्ति सक्षम न हो।',
      ],
      reviewNote:
        'तृतीय-पक्ष विक्रेता डेटा-साझाकरण समझौते और सब-प्रोसेसर डीपीए (डेटा प्रोसेसिंग परिशिष्ट) [पुष्टि लंबित] बने हुए हैं।',
    },
    {
      id: 'privacy-6',
      number: '06',
      title: 'वैकल्पिक कैमरा और फोटो अनुमतियां',
      paragraphs: [
        'कैमरा और फोटो लाइब्रेरी अनुमतियां पूरी तरह से वैकल्पिक हैं और केवल तभी ऑन-डिमांड मांगी जाती हैं जब आप AR ट्राई-ऑन, कैमरा स्कैन, वर्चुअल वॉर्डरोब गारमेंट अपलोड/कैप्चर, या प्रोफाइल सेल्फी विश्लेषण लॉन्च करते हैं।',
        'आप अपने ब्राउज़र या मोबाइल ऑपरेटिंग सिस्टम सेटिंग्स में किसी भी समय कैमरा अनुमतियों को अस्वीकार या रद्द कर सकते हैं। यदि आप कैमरे की पहुंच को अस्वीकार करते हैं, तो भी आप समर्थित मौजूदा छवि फ़ाइलें अपलोड कर सकते हैं, AI स्टाइलिस्ट के साथ चैट कर सकते हैं, शोरूम ब्राउज़ कर सकते हैं और अपनी प्रोफ़ाइल प्रबंधित कर सकते हैं।',
      ],
    },
    {
      id: 'privacy-7',
      number: '07',
      title: 'डेटा प्रतिधारण और खाता / डेटा हटाने की प्रक्रिया',
      paragraphs: [
        'हम स्थानीय डिवाइस हटाने और सर्वर-साइड डेटा हटाने के बीच स्पष्ट रूप से अंतर करते हैं ताकि आप ठीक से जान सकें कि आपका डेटा कैसे संभाला जाता है:',
      ],
      bullets: [
        'OTP सत्यापन कोड: 5 मिनट के समाप्ति समय (TTL) के साथ SHA-256 हैश के रूप में संग्रहीत और सफल सत्यापन पर या 3 असफल प्रयासों के बाद हटा दिए जाते हैं।',
        'AI चैट संदर्भ: सर्वर रैम (प्रति क्लाइंट आईपी 20 संदेशों तक) में रखा गया और सर्वर पुनरारंभ होने पर साफ़ कर दिया जाता है।',
        'स्थानीय साइन-आउट और खाता हटाना: प्रोफ़ाइल > खाते प्रबंधित करें में "लॉग आउट" पर क्लिक करने या खाता हटाने से आपके स्थानीय ब्राउज़र स्टोरेज (localStorage) से वह खाता प्रविष्टि साफ़ या हटा दी जाती है।',
        'सर्वर-साइड डेटा हटाने का प्रकटीकरण: आपके डिवाइस से खाता हटाने से Firebase Firestore (users/{uid}, profile/meta, analysisCache, wardrobe, product_reviews, legal_consents) में संग्रहीत आपके क्लाउड रिकॉर्ड या server_ai/uploads/ में संग्रहीत परिधान फ़ाइलें स्वचालित रूप से नहीं हटती हैं। सर्वर-संग्रहीत खाते और छवि डेटा को स्थायी रूप से हटाने का अनुरोध करने के लिए, कृपया [पुष्टि लंबित — गोपनीयता हटाने का अनुरोध ईमेल / प्रक्रिया दर्ज करें] पर ऑपरेटर से संपर्क करें।',
      ],
      reviewNote:
        'औपचारिक सर्वर-साइड डेटा प्रतिधारण अवधि और एक स्वचालित क्लाउड खाता-हटाने का वर्कफ़्लो [पुष्टि लंबित] बना हुआ है।',
    },
    {
      id: 'privacy-8',
      number: '08',
      title: 'सहमति अखंडता, सुरक्षा और नीति अपडेट',
      paragraphs: [
        'जब आप एक खाता बनाते हैं, तो NOVA हमारे बैकएंड और Firebase Firestore में एक ISO टाइमस्टैम्प के साथ आपके द्वारा स्वीकार किए गए सटीक नियम व शर्तें और गोपनीयता नीति संस्करणों को रिकॉर्ड करता है। सामान्य क्लाइंट-साइड प्रोफ़ाइल नियंत्रण संग्रहीत सहमति रिकॉर्ड को बदल या बैकडेट नहीं कर सकते हैं।',
        'यद्यपि हम OTP कोड के लिए SHA-256 हैशिंग और सत्यापित सत्रों के लिए Firebase प्रमाणीकरण कस्टम टोकन का उपयोग करते हैं, इलेक्ट्रॉनिक प्रसारण या भंडारण का कोई भी तरीका 100% सुरक्षित नहीं है। मानक क्लाउड प्रदाता डिफ़ॉल्ट से परे विशिष्ट उद्यम सुरक्षा प्रमाणपत्र या एन्क्रिप्शन-एट-रेस्ट गारंटी [पुष्टि लंबित] हैं।',
        'यदि हम आपके व्यक्तिगत डेटा को संसाधित करने के तरीके में महत्वपूर्ण परिवर्तन करते हैं, तो हम गोपनीयता नीति संस्करण पहचानकर्ता को अपडेट करेंगे और पंजीकृत उपयोगकर्ताओं को उनकी सहमति की समीक्षा करने और नवीनीकृत करने के लिए संकेत देंगे।',
      ],
    },
  ],
  unverifiedItems: [
    'डेटा नियंत्रक का कानूनी नाम, पंजीकरण विवरण, डाक पता, और डेटा सुरक्षा अधिकारी / गोपनीयता ईमेल।',
    'Firestore उपयोगकर्ता प्रोफाइल, संग्रहीत सेल्फी डेटा URL (profilePhoto), analysisCache, और server_ai/uploads/ परिधान फ़ाइलों के लिए सटीक डेटा प्रतिधारण कार्यक्रम।',
    'स्वचालित सर्वर-साइड खाता और Firestore डेटा विलोपन वर्कफ़्लो (वर्तमान UI खाता हटाना केवल स्थानीय डिवाइस स्टोरेज को साफ़ करता है)।',
    'Google Cloud / Firebase और किसी भी बाहरी LLM होस्टिंग प्रदाता के साथ निष्पादित डेटा प्रोसेसिंग समझौते (DPA) यदि Ollama को दूरस्थ रूप से होस्ट किया जाता है।',
    'क्या तृतीय-पक्ष शोरूम विक्रेताओं को ग्राहक शिपिंग/संपर्क डेटा प्राप्त होगा जब लाइव चेकआउट वर्तमान सिम्युलेटेड चेकआउट की जगह ले लेगा।',
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocumentDefinition> = {
  terms: TERMS_DOCUMENT,
  privacy: PRIVACY_DOCUMENT,
};

export const LEGAL_DOCUMENTS_HI: Record<LegalDocumentType, LegalDocumentDefinition> = {
  terms: TERMS_DOCUMENT_HI,
  privacy: PRIVACY_DOCUMENT_HI,
};

export const getLegalDocument = (
  type: LegalDocumentType,
  locale: string = 'en'
): LegalDocumentDefinition => {
  if (locale === 'hi') {
    return LEGAL_DOCUMENTS_HI[type] || LEGAL_DOCUMENTS[type];
  }
  return LEGAL_DOCUMENTS[type];
};
