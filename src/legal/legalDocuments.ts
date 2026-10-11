import { LegalConsentRecord, LegalDocumentType } from '../types';

export const TERMS_VERSION = '2026.10.1';
export const PRIVACY_VERSION = '2026.10.1';
export const LEGAL_EFFECTIVE_DATE = 'October 11, 2026';
export const LEGAL_LAST_UPDATED = 'October 11, 2026';

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

export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocumentDefinition> = {
  terms: TERMS_DOCUMENT,
  privacy: PRIVACY_DOCUMENT,
};
