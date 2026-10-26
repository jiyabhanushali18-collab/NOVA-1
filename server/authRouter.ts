import express, { Request, Response } from "express";
import crypto from "crypto";

import { initError as firebaseInitError } from "./firebaseAdmin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import "./firebaseAdmin";

console.log(
  "Email delivery configured:",
  Boolean(process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim())
);

const router = express.Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_OTP_ATTEMPTS = 3;

interface LegalConsentPayload {
  accepted: boolean;
  termsVersion: string;
  privacyVersion: string;
  consentedAt: string;
  serverRecordedAt?: string;
  source?: 'signup' | 'renewal';
  userId?: string;
  email?: string;
}

interface DeliveryAddressPayload {
  id?: string;
  label?: string;
  fullName: string;
  phone: string;
  flatNo: string;
  landmark?: string;
  city: string;
  state?: string;
  pinCode: string;
  country?: string;
  formattedAddress?: string;
  isDefault?: boolean;
  updatedAt?: string;
}

interface OrderPayload {
  orderId: string;
  userId: string;
  isGuest?: boolean;
  items: unknown[];
  subtotal: number;
  taxes: number;
  discount: number;
  shipping: number;
  grandTotal: number;
  paymentMethod: 'upi' | 'card' | 'cod';
  deliveryAddress: DeliveryAddressPayload;
  createdAt: string;
}

interface OTPRecord {
  email: string;
  otpHash: string;
  isSignup: boolean;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  lastAttemptAt?: number;
  legalConsent?: LegalConsentPayload;
}

const CURRENT_TERMS_VERSION = '2026.10.1';
const CURRENT_PRIVACY_VERSION = '2026.10.1';
const getRequiredSecret = (name: string): string => {
  const secret = process.env[name]?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error(`${name} must be configured with at least 32 bytes of random data.`);
  }
  return secret;
};
const SESSION_SECRET = getRequiredSecret('NOVA_SESSION_SECRET');
const OTP_HASH_SECRET = getRequiredSecret('OTP_HASH_SECRET');

const localOtpStore = new Map<string, OTPRecord>();
const localConsentStore = new Map<string, LegalConsentPayload>();
const localAddressStore = new Map<string, { primaryAddress: DeliveryAddressPayload | null; savedAddresses: DeliveryAddressPayload[] }>();
const localOrdersStore = new Map<string, OrderPayload[]>();
let firestore: any = null;
let auth: any = null;
let firebaseEnabled = false;

const initializeFirebaseServices = () => {
  try {
    firestore = getFirestore();
    try {
      firestore.settings({ preferRest: true });
    } catch {}
    auth = getAuth();
    firebaseEnabled = true;
    console.log('Firebase services initialized successfully.');
  } catch (error: any) {
    firebaseEnabled = false;
    console.warn('Firebase Admin unavailable; secure email authentication is disabled.', error?.message || error);
    if (firebaseInitError) {
      console.warn('Firebase Admin init error:', firebaseInitError.message);
    }
  }
};

initializeFirebaseServices();

const OTP_COLLECTION = 'email_otps';
const USERS_COLLECTION = 'users';
const LEGAL_CONSENTS_COLLECTION = 'legal_consents';
const ORDERS_COLLECTION = 'orders';

const signSessionToken = (uid: string, email?: string): string => {
  const payload = {
    uid: uid.trim(),
    email: email ? email.trim().toLowerCase() : '',
    iat: Date.now()
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `nova_sess.${encoded}.${sig}`;
};

const verifySessionToken = (token: string): { uid: string; email: string } | null => {
  if (!token || !token.startsWith('nova_sess.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.uid !== 'string' || !parsed.uid.trim()) return null;
    return {
      uid: parsed.uid.trim(),
      email: typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : ''
    };
  } catch {
    return null;
  }
};

const verifyAuthenticatedUser = async (
  req: Request,
  requestedUserId?: string
): Promise<{ ok: true; uid: string; email: string } | { ok: false; status: number; error: string }> => {
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!bearerToken) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required. Missing Authorization Bearer token.'
    };
  }

  let verifiedUser = verifySessionToken(bearerToken);

  if (!verifiedUser && firebaseEnabled && auth) {
    try {
      const decoded = await auth.verifyIdToken(bearerToken);
      if (decoded?.uid) {
        verifiedUser = {
          uid: decoded.uid,
          email: typeof decoded.email === 'string' ? decoded.email.toLowerCase() : ''
        };
      }
    } catch {
      // Invalid Firebase ID token
    }
  }

  if (!verifiedUser) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid or expired authentication token.'
    };
  }

  if (verifiedUser.uid.startsWith('guest_')) {
    return {
      ok: false,
      status: 403,
      error: 'Guest sessions cannot access or modify registered account addresses.'
    };
  }

  if (requestedUserId && requestedUserId.trim()) {
    const cleanRequested = requestedUserId.trim();
    const matchesUid = cleanRequested === verifiedUser.uid;
    const matchesEmail = Boolean(verifiedUser.email && cleanRequested.toLowerCase() === verifiedUser.email.toLowerCase());
    if (!matchesUid && !matchesEmail) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden: You are not authorized to access or modify another user's address or orders."
      };
    }
  }

  return {
    ok: true,
    uid: verifiedUser.uid,
    email: verifiedUser.email
  };
};

const formatBackendDeliveryAddress = (addr: Partial<DeliveryAddressPayload>): string => {
  return [addr.flatNo, addr.landmark, addr.city, addr.state]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ');
};

const buildBackendDeliveryAddress = (params: {
  rawAddress?: string;
  pinCode?: string;
  fullName?: string;
  phone?: string;
  existing?: Partial<DeliveryAddressPayload> | null;
}): DeliveryAddressPayload | null => {
  const rawAddress = typeof params.rawAddress === 'string' ? params.rawAddress.trim() : '';
  const pinCode = typeof params.pinCode === 'string' ? params.pinCode.trim() : (params.existing?.pinCode || '');
  const fullName = typeof params.fullName === 'string' && params.fullName.trim()
    ? params.fullName.trim()
    : (params.existing?.fullName || '');
  const phone = typeof params.phone === 'string' && params.phone.trim()
    ? params.phone.trim()
    : (params.existing?.phone || '');

  if (!rawAddress && !pinCode && !params.existing?.flatNo) {
    return null;
  }

  let flatNo = params.existing?.flatNo || '';
  let landmark = params.existing?.landmark || '';
  let city = params.existing?.city || '';
  const state = params.existing?.state || '';

  if (rawAddress) {
    const parts = rawAddress.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 4) {
      flatNo = parts.slice(0, -2).join(', ');
      landmark = parts[parts.length - 2];
      city = parts[parts.length - 1];
    } else if (parts.length === 3) {
      flatNo = parts[0];
      landmark = parts[1];
      city = parts[2];
    } else if (parts.length === 2) {
      flatNo = parts[0];
      landmark = '';
      city = parts[1];
    } else if (parts.length === 1) {
      flatNo = parts[0];
    }
  }

  const normalized: DeliveryAddressPayload = {
    id: params.existing?.id || 'addr_home_default',
    label: params.existing?.label || 'Home',
    fullName,
    phone,
    flatNo,
    landmark,
    city,
    state,
    pinCode,
    country: params.existing?.country || 'India',
    isDefault: true,
    updatedAt: new Date().toISOString()
  };
  normalized.formattedAddress = formatBackendDeliveryAddress(normalized);
  return normalized;
};

const deduplicateSavedAddresses = (
  list: DeliveryAddressPayload[],
  incoming: DeliveryAddressPayload
): DeliveryAddressPayload[] => {
  const targetId = incoming.id || `addr_${Date.now()}`;
  const normalizedIncoming: DeliveryAddressPayload = {
    ...incoming,
    id: targetId,
    label: incoming.label || 'Home',
    formattedAddress: incoming.formattedAddress || formatBackendDeliveryAddress(incoming),
    updatedAt: new Date().toISOString()
  };

  const filtered = list.filter((item) => {
    if (!item) return false;
    if (item.id && item.id === targetId) return false;
    return true;
  });

  return [normalizedIncoming, ...filtered];
};

const normalizeConsentPayload = (
  raw: any,
  fallbackSource: 'signup' | 'renewal' = 'signup'
): LegalConsentPayload | null => {
  if (!raw || typeof raw !== 'object' || raw.accepted !== true) return null;
  const serverRecordedAt = new Date().toISOString();
  const termsVersion =
    typeof raw.termsVersion === 'string' && raw.termsVersion.trim()
      ? raw.termsVersion.trim()
      : CURRENT_TERMS_VERSION;
  const privacyVersion =
    typeof raw.privacyVersion === 'string' && raw.privacyVersion.trim()
      ? raw.privacyVersion.trim()
      : CURRENT_PRIVACY_VERSION;
  const consentedAt =
    typeof raw.consentedAt === 'string' && raw.consentedAt.trim()
      ? raw.consentedAt.trim()
      : serverRecordedAt;
  const source: 'signup' | 'renewal' =
    raw.source === 'renewal' ? 'renewal' : fallbackSource;

  return {
    accepted: true,
    termsVersion,
    privacyVersion,
    consentedAt,
    serverRecordedAt,
    source,
  };
};

const maskEmail = (email: string) => email.replace(/^(.).+(@.+)$/, '$1***$2');

const getSafeSmtpConfigStatus = () => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const fromName = process.env.BREVO_SENDER_NAME?.trim() || 'NOVA';
  return {
    provider: 'Brevo',
    configured: Boolean(apiKey && fromEmail),
    apiKeyLoaded: Boolean(apiKey),
    fromEmail: fromEmail || null,
    fromName
  };
};

const generateOTP = () => {
  // cryptographically secure 6-digit OTP
  const num = crypto.randomInt(100000, 1000000);
  return String(num).padStart(6, '0');
};

const hashOTP = (otp: string) => crypto.createHmac('sha256', OTP_HASH_SECRET).update(otp).digest('hex');

const isValidEmail = (email?: string) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);


const sendOTPEmail = async (
  email: string,
  otp: string
): Promise<{ ok: boolean; status?: number; error?: string }> => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const from = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "NOVA";

  if (!apiKey || !from) {
    console.error(
      "[Email] Brevo is not configured; missing BREVO_API_KEY or BREVO_SENDER_EMAIL."
    );
    return {
      ok: false,
      status: 503,
      error: "Email delivery service is not configured. Please contact support."
    };
  }

  const html = `
    <h2>NOVA - The Future of Fashion</h2>
    <p>Your verification code is:</p>
    <h1 style="letter-spacing:6px">${otp}</h1>
    <p>This code expires in 5 minutes.</p>
    <p>If you didn't request this email, please ignore it.</p>
  `;

  try {
    console.log("[Email] Sending OTP through Brevo.", {
      recipient: maskEmail(email),
      senderEmail: from
    });

    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          sender: {
            name: senderName,
            email: from
          },
          to: [{ email }],
          subject: "Verify your NOVA Account",
          textContent: `Your NOVA verification code is ${otp}. This code expires in 5 minutes.`,
          htmlContent: html
        }),
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.message || JSON.stringify(errorJson);
      } catch {
        errorDetail = (await response.text()).slice(0, 500);
      }

      console.error("[Email] Brevo rejected the OTP email.", {
        status: response.status,
        error: errorDetail.slice(0, 500),
        recipient: maskEmail(email)
      });

      let userError = "Email delivery failed. Please try again.";
      if (response.status === 401) {
        if (errorDetail.includes('unrecognised IP address') || errorDetail.includes('authorised_ips')) {
          userError = "Email service rejected connection: unrecognised server IP. Please authorise your server IP in Brevo security settings.";
        } else {
          userError = "Email service authentication failed. Please verify provider credentials.";
        }
      } else if (response.status === 400 && errorDetail.includes('sender')) {
        userError = "Configured sender email is not verified with the email provider.";
      }

      return {
        ok: false,
        status: response.status,
        error: userError
      };
    }

    const result = await response.json() as { messageId?: string };

    console.log("[Email] Brevo accepted the OTP email.", {
      messageId: result.messageId,
      recipient: maskEmail(email)
    });

    return { ok: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown email provider error";

    console.error("[Email] Brevo request failed.", {
      message,
      recipient: maskEmail(email)
    });

    return {
      ok: false,
      status: 502,
      error: "Email delivery failed due to network error. Please try again."
    };
  }
};

// Helper: get OTP doc ref
const otpDocRef = (email: string) => {
  if (firebaseEnabled && firestore) {
    return firestore.collection(OTP_COLLECTION).doc(email);
  }
  return null;
};

const getStoredOtp = async (email: string) => {
  if (firebaseEnabled && firestore) {
    try {
      const doc = await otpDocRef(email)?.get();
      return doc?.exists ? doc.data() : null;
    } catch (e: any) {
      console.warn('[OTP] Firestore getStoredOtp failed, falling back to memory store:', e?.message || e);
    }
  }
  return localOtpStore.get(email) ?? null;
};

const saveStoredOtp = async (email: string, record: OTPRecord) => {
  localOtpStore.set(email, record);
  if (firebaseEnabled && firestore) {
    try {
      await otpDocRef(email)?.set(record, { merge: true });
    } catch (e: any) {
      console.warn('[OTP] Firestore saveStoredOtp failed, preserved in memory store:', e?.message || e);
    }
    return;
  }
};

const deleteStoredOtp = async (email: string) => {
  localOtpStore.delete(email);
  if (firebaseEnabled && firestore) {
    try {
      await otpDocRef(email)?.delete();
    } catch (e: any) {
      console.warn('[OTP] Firestore deleteStoredOtp failed:', e?.message || e);
    }
    return;
  }
};

const updateStoredOtp = async (email: string, data: Partial<OTPRecord>) => {
  const existing = localOtpStore.get(email);
  if (existing) {
    localOtpStore.set(email, { ...existing, ...data });
  }
  if (firebaseEnabled && firestore) {
    try {
      await otpDocRef(email)?.update(data);
    } catch (e: any) {
      console.warn('[OTP] Firestore updateStoredOtp failed:', e?.message || e);
    }
    return;
  }
};

// POST /api/auth/send-otp
router.post('/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const { email, isSignup, legalConsent } = req.body;
    if (!isValidEmail(email)) return res.status(400).json({ success: false, error: 'Invalid email' });
    if (!firebaseEnabled || !auth || !firestore) {
      return res.status(503).json({
        success: false,
        error: 'Secure email sign-in is unavailable because Firebase Admin is not configured. Configure a valid Firebase service account, then restart the server.'
      });
    }

    const normalizedConsent = normalizeConsentPayload(legalConsent, 'signup');
    if (isSignup === true && !normalizedConsent) {
      return res.status(400).json({
        success: false,
        error: "Please read and agree to NOVA's Terms & Conditions and Privacy Policy to create an account."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let existingFirebaseUser = true;
    try {
      await auth.getUserByEmail(normalizedEmail);
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found') {
        existingFirebaseUser = false;
      } else {
        throw error;
      }
    }

    if (isSignup === true && existingFirebaseUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists. Sign in with this email instead.'
      });
    }
    if (isSignup !== true && !existingFirebaseUser) {
      return res.status(404).json({
        success: false,
        error: 'No account was found for this email. Create an account first.'
      });
    }

    const existingRecord = await getStoredOtp(normalizedEmail);
    const now = Date.now();

    if (existingRecord) {
      const lastSent = existingRecord.lastSentAt || 0;

      // if last sent too recently
      if (now - lastSent < OTP_RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
        return res.status(429).json({ success: false, error: `Please wait ${wait} seconds before requesting a new code`, retryAfter: wait });
      }
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const createdAt = now;
    const expiresAt = now + OTP_TTL_MS; // 5 minutes

    console.log('[OTP] Generated verification code.', {
      email: maskEmail(normalizedEmail),
      otpLength: otp.length,
      expiresInSeconds: OTP_TTL_MS / 1000,
      storage: firebaseEnabled ? 'firestore' : 'memory'
    });

    const sent = await sendOTPEmail(normalizedEmail, otp);
    if (!sent.ok) return res.status(sent.status && sent.status >= 400 && sent.status < 600 ? sent.status : 502).json({ success: false, error: sent.error || 'Failed to send verification email' });

    const otpRecord: OTPRecord = {
      email: normalizedEmail,
      otpHash,
      isSignup: isSignup === true,
      createdAt,
      expiresAt,
      attempts: 0,
      lastSentAt: now
    };
    if (normalizedConsent) {
      otpRecord.legalConsent = normalizedConsent;
    }

    await saveStoredOtp(normalizedEmail, otpRecord);

    console.log('[OTP] Stored verification record.', {
      email: maskEmail(normalizedEmail),
      expiresAt,
      hasConsent: Boolean(normalizedConsent),
      storage: firebaseEnabled ? 'firestore' : 'memory'
    });

    return res.json({ success: true, message: 'OTP sent', expiresIn: 300 });
  } catch (err) {
    console.error('send-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/resend-otp
router.post('/auth/resend-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) return res.status(400).json({ success: false, error: 'Invalid email' });

    const normalizedEmail = email.trim().toLowerCase();
    const existingRecord = await getStoredOtp(normalizedEmail);
    const now = Date.now();

    if (!existingRecord) {
      return res.status(400).json({ success: false, error: 'No OTP request found. Please request a new code.' });
    }

    const data = existingRecord as any;
    const lastSent = data.lastSentAt || 0;
    if (now - lastSent < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
      return res.status(429).json({ success: false, error: `Please wait ${wait} seconds before resending`, retryAfter: wait });
    }

    // generate and replace OTP while preserving any pending legalConsent
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const createdAt = now;
    const expiresAt = now + OTP_TTL_MS;

    const sent = await sendOTPEmail(normalizedEmail, otp);
    if (!sent.ok) return res.status(sent.status && sent.status >= 400 && sent.status < 600 ? sent.status : 502).json({ success: false, error: sent.error || 'Failed to send verification email' });

    const updatedRecord: OTPRecord = {
      email: normalizedEmail,
      otpHash,
      isSignup: existingRecord.isSignup === true,
      createdAt,
      expiresAt,
      attempts: 0,
      lastSentAt: now
    };
    if (data.legalConsent) {
      updatedRecord.legalConsent = data.legalConsent;
    }

    await saveStoredOtp(normalizedEmail, updatedRecord);

    return res.json({ success: true, message: 'OTP resent', expiresIn: 300 });
  } catch (err) {
    console.error('resend-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/verify-otp
router.post('/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp, name, address, pinCode, phone, legalConsent, isSignup } = req.body;
    if (!isValidEmail(email) || !otp || typeof otp !== 'string') return res.status(400).json({ success: false, error: 'Invalid parameters' });
    if (!firebaseEnabled || !auth || !firestore) {
      return res.status(503).json({
        success: false,
        error: 'Secure email sign-in is unavailable because Firebase Admin is not configured. Configure a valid Firebase service account, then restart the server.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ success: false, error: 'OTP must be 6 digits' });
    }

    const existingRecord = await getStoredOtp(normalizedEmail);
    const now = Date.now();

    console.log('[OTP] Verifying code.', {
      email: maskEmail(normalizedEmail),
      otpLength: normalizedOtp.length,
      storage: firebaseEnabled ? 'firestore' : 'memory'
    });

    if (!existingRecord) {
      return res.status(400).json({ success: false, error: 'OTP not found. Please request a new code.' });
    }

    const data = existingRecord as any;
    if (typeof data.isSignup === 'boolean' && data.isSignup !== (isSignup === true)) {
      return res.status(400).json({ success: false, error: 'This code was requested for a different sign-in flow. Request a new code.' });
    }
    if ((data.expiresAt || 0) < now) {
      await deleteStoredOtp(normalizedEmail);
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new code.' });
    }

    if ((data.attempts || 0) >= MAX_OTP_ATTEMPTS) {
      await deleteStoredOtp(normalizedEmail);
      return res.status(429).json({ success: false, error: 'Maximum attempts exceeded. Please request a new code.' });
    }

    const otpHash = hashOTP(normalizedOtp);
    if (otpHash !== data.otpHash) {
      const attempts = (data.attempts || 0) + 1;
      await updateStoredOtp(normalizedEmail, { attempts, lastAttemptAt: now });
      return res.status(400).json({ success: false, error: `Invalid OTP. ${MAX_OTP_ATTEMPTS - attempts} attempts remaining.`, attemptsRemaining: Math.max(0, MAX_OTP_ATTEMPTS - attempts) });
    }

    const verifiedConsent =
      normalizeConsentPayload(legalConsent, 'signup') ||
      normalizeConsentPayload(data.legalConsent, 'signup');

    // Valid OTP - delete record
    await deleteStoredOtp(normalizedEmail);
    console.log('[OTP] Verification succeeded.', { email: maskEmail(normalizedEmail), storage: firebaseEnabled ? 'firestore' : 'memory' });

    const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : '';
    const requestedDisplayName = typeof name === 'string' && name.trim() ? name.trim() : normalizedEmail.split('@')[0];

    if (firebaseEnabled && auth && firestore) {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(normalizedEmail);
        if (isSignup === true) {
          return res.status(409).json({
            success: false,
            error: 'An account with this email already exists. Sign in with this email instead.'
          });
        }
        if (!userRecord.emailVerified) {
          await auth.updateUser(userRecord.uid, { emailVerified: true });
        }
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          if (isSignup !== true) {
            return res.status(404).json({
              success: false,
              error: 'No account was found for this email. Create an account first.'
            });
          }
          userRecord = await auth.createUser({ email: normalizedEmail, emailVerified: true });
        } else {
          console.error('Firebase auth lookup/create error:', err);
          return res.status(500).json({ success: false, error: 'Failed to process user account' });
        }
      }

      const uid = userRecord.uid;
      let resolvedName = requestedDisplayName;
      let resolvedPhone = cleanPhone;
      let resolvedAddress: string | undefined;
      let resolvedPinCode: string | undefined;
      const username = normalizedEmail.split('@')[0] || resolvedName;
      let resolvedDeliveryAddress: DeliveryAddressPayload | null = null;
      try {
        const userDocRef = firestore.collection(USERS_COLLECTION).doc(uid);
        const existingUserSnap = await userDocRef.get();
        const existingUserData = existingUserSnap?.exists ? existingUserSnap.data() : null;
        resolvedName = isSignup === true
          ? requestedDisplayName
          : existingUserData?.name || userRecord.displayName || requestedDisplayName;
        resolvedPhone = cleanPhone || existingUserData?.phoneNumber || existingUserData?.phone || userRecord.phoneNumber || '';
        const existingDeliveryAddress = existingUserData?.deliveryAddress || null;
        const existingSavedAddresses: DeliveryAddressPayload[] = Array.isArray(existingUserData?.savedAddresses)
          ? existingUserData.savedAddresses
          : [];

        resolvedDeliveryAddress = buildBackendDeliveryAddress({
          rawAddress: typeof address === 'string' ? address : undefined,
          pinCode: typeof pinCode === 'string' ? pinCode : undefined,
          fullName: resolvedName,
          phone: resolvedPhone,
          existing: existingDeliveryAddress
        });

        const nowTs = FieldValue.serverTimestamp();
        const userData: Record<string, unknown> = {
          uid,
          email: normalizedEmail,
          username,
          name: resolvedName,
          emailVerified: true,
          displayName: resolvedName,
          photoURL: existingUserData?.photoURL || '',
          phoneNumber: resolvedPhone,
          phone: resolvedPhone,
          gender: existingUserData?.gender || '',
          dob: existingUserData?.dob || '',
          createdAt: existingUserData?.createdAt || nowTs,
          updatedAt: nowTs,
          preferences: existingUserData?.preferences || {},
          wardrobeCount: existingUserData?.wardrobeCount || 0,
          wishlistCount: existingUserData?.wishlistCount || 0,
          savedLooks: existingUserData?.savedLooks || 0
        };

        if (typeof address === 'string' && address.trim()) {
          userData.address = address.trim();
        } else if (resolvedDeliveryAddress?.formattedAddress) {
          userData.address = resolvedDeliveryAddress.formattedAddress;
        }
        if (typeof pinCode === 'string' && /^\d{6}$/.test(pinCode.trim())) {
          userData.pinCode = pinCode.trim();
        } else if (resolvedDeliveryAddress?.pinCode) {
          userData.pinCode = resolvedDeliveryAddress.pinCode;
        }
        resolvedAddress = typeof userData.address === 'string'
          ? userData.address
          : typeof existingUserData?.address === 'string'
            ? existingUserData.address
            : resolvedDeliveryAddress?.formattedAddress;
        resolvedPinCode = typeof userData.pinCode === 'string'
          ? userData.pinCode
          : typeof existingUserData?.pinCode === 'string'
            ? existingUserData.pinCode
            : resolvedDeliveryAddress?.pinCode;

        if (resolvedDeliveryAddress) {
          const updatedSavedList = deduplicateSavedAddresses(existingSavedAddresses, resolvedDeliveryAddress);
          userData.deliveryAddress = resolvedDeliveryAddress;
          userData.savedAddresses = updatedSavedList;
          localAddressStore.set(uid, {
            primaryAddress: resolvedDeliveryAddress,
            savedAddresses: updatedSavedList
          });
          localAddressStore.set(normalizedEmail, {
            primaryAddress: resolvedDeliveryAddress,
            savedAddresses: updatedSavedList
          });
        }

        if (verifiedConsent) {
          const consentWithUser: LegalConsentPayload = {
            ...verifiedConsent,
            userId: uid,
            email: normalizedEmail
          };
          userData.legalConsent = consentWithUser;
          localConsentStore.set(uid, consentWithUser);
          localConsentStore.set(normalizedEmail, consentWithUser);

          await userDocRef.collection('legalConsent').doc('current').set({
            ...consentWithUser,
            recordedAt: nowTs
          }, { merge: true });

          await firestore.collection(LEGAL_CONSENTS_COLLECTION).add({
            ...consentWithUser,
            recordedAt: nowTs
          });
        }

        await userDocRef.set(userData, { merge: true });
        await userDocRef.collection('profile').doc('meta').set(userData, { merge: true });
        console.log('[Firebase] User Auth and Firestore profile ready.', {
          uid,
          email: maskEmail(normalizedEmail),
          hasLegalConsent: Boolean(verifiedConsent),
          hasAddress: Boolean(resolvedDeliveryAddress),
          firestoreDoc: `${USERS_COLLECTION}/${uid}`
        });
      } catch (err) {
        console.error('Failed to create user document:', err);
        return res.status(500).json({ success: false, error: 'Failed to save user profile' });
      }

      const customToken = await auth.createCustomToken(uid);
      const sessionToken = signSessionToken(uid, normalizedEmail);
      return res.json({
        success: true,
        message: 'Email verified',
        uid,
        email: normalizedEmail,
        name: resolvedName,
        phone: resolvedPhone,
        address: resolvedAddress,
        pinCode: resolvedPinCode,
        customToken,
        sessionToken,
        deliveryAddress: resolvedDeliveryAddress,
        legalConsent: verifiedConsent ? { ...verifiedConsent, userId: uid, email: normalizedEmail } : undefined
      });
    }

    const existingLocalAddr = localAddressStore.get(normalizedEmail);
    const localDeliveryAddress = buildBackendDeliveryAddress({
      rawAddress: typeof address === 'string' ? address : undefined,
      pinCode: typeof pinCode === 'string' ? pinCode : undefined,
      fullName: requestedDisplayName,
      phone: cleanPhone,
      existing: existingLocalAddr?.primaryAddress || null
    });

    if (localDeliveryAddress) {
      const updatedList = deduplicateSavedAddresses(existingLocalAddr?.savedAddresses || [], localDeliveryAddress);
      localAddressStore.set(normalizedEmail, {
        primaryAddress: localDeliveryAddress,
        savedAddresses: updatedList
      });
    }

    if (verifiedConsent) {
      const fallbackConsent: LegalConsentPayload = {
        ...verifiedConsent,
        userId: normalizedEmail,
        email: normalizedEmail
      };
      localConsentStore.set(normalizedEmail, fallbackConsent);
    }

    const sessionToken = signSessionToken(normalizedEmail, normalizedEmail);
    console.warn('[OTP] Firebase Admin not configured. Completing verification locally.', { email: maskEmail(normalizedEmail) });
    return res.json({
      success: true,
      message: 'Email verified locally',
      uid: normalizedEmail,
      email: normalizedEmail,
      sessionToken,
      deliveryAddress: localDeliveryAddress,
      legalConsent: verifiedConsent ? { ...verifiedConsent, userId: normalizedEmail, email: normalizedEmail } : undefined
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/session - Issue a signed session token for a registered user and sync/retrieve their saved address
router.post('/auth/session', async (req: Request, res: Response) => {
  try {
    const { uid, email, name, phone, address, pinCode } = req.body || {};
    const targetUid = typeof uid === 'string' && uid.trim() ? uid.trim() : '';
    const targetEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : '';
    const effectiveUid = targetUid || targetEmail;

    if (!effectiveUid || effectiveUid.startsWith('guest_')) {
      return res.status(400).json({
        success: false,
        error: 'A valid registered user uid or email is required to establish an authenticated session.'
      });
    }

    const sessionToken = signSessionToken(effectiveUid, targetEmail);
    let primaryAddress: DeliveryAddressPayload | null = null;
    let savedAddresses: DeliveryAddressPayload[] = [];

    if (firebaseEnabled && firestore) {
      try {
        const userDocRef = firestore.collection(USERS_COLLECTION).doc(effectiveUid);
        const snap = await userDocRef.get();
        if (snap.exists) {
          const data = snap.data() || {};
          primaryAddress = data.deliveryAddress || null;
          savedAddresses = Array.isArray(data.savedAddresses) ? data.savedAddresses : [];
          if (!primaryAddress && (data.address || data.pinCode)) {
            primaryAddress = buildBackendDeliveryAddress({
              rawAddress: data.address,
              pinCode: data.pinCode,
              fullName: data.name || name || '',
              phone: data.phone || data.phoneNumber || phone || ''
            });
          }
        }
      } catch (err) {
        console.warn('[Session] Firestore address lookup warning:', err);
      }
    }

    const memEntry = localAddressStore.get(effectiveUid) || (targetEmail ? localAddressStore.get(targetEmail) : undefined);
    if (!primaryAddress && memEntry?.primaryAddress) {
      primaryAddress = memEntry.primaryAddress;
      savedAddresses = memEntry.savedAddresses;
    }

    // If the user has no stored address yet on the server, but provided signup/profile address on session init, save it without duplicating
    if (!primaryAddress && (typeof address === 'string' && address.trim() || typeof pinCode === 'string' && pinCode.trim())) {
      primaryAddress = buildBackendDeliveryAddress({
        rawAddress: typeof address === 'string' ? address : undefined,
        pinCode: typeof pinCode === 'string' ? pinCode : undefined,
        fullName: typeof name === 'string' ? name : '',
        phone: typeof phone === 'string' ? phone : ''
      });
      if (primaryAddress) {
        savedAddresses = deduplicateSavedAddresses(savedAddresses, primaryAddress);
        localAddressStore.set(effectiveUid, { primaryAddress, savedAddresses });
        if (targetEmail) {
          localAddressStore.set(targetEmail, { primaryAddress, savedAddresses });
        }
        if (firebaseEnabled && firestore) {
          try {
            const userDocRef = firestore.collection(USERS_COLLECTION).doc(effectiveUid);
            await userDocRef.set({
              uid: effectiveUid,
              email: targetEmail || undefined,
              name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
              phone: typeof phone === 'string' && phone.trim() ? phone.trim() : undefined,
              address: primaryAddress.formattedAddress,
              pinCode: primaryAddress.pinCode,
              deliveryAddress: primaryAddress,
              savedAddresses,
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
          } catch {}
        }
      }
    }

    return res.json({
      success: true,
      uid: effectiveUid,
      email: targetEmail,
      sessionToken,
      deliveryAddress: primaryAddress,
      savedAddresses
    });
  } catch (err) {
    console.error('auth-session error:', err);
    return res.status(500).json({ success: false, error: 'Failed to initialize user session' });
  }
});

// GET /api/auth/address - Fetch the authenticated user's saved delivery address(es)
router.get('/auth/address', async (req: Request, res: Response) => {
  try {
    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const authCheck = await verifyAuthenticatedUser(req, requestedUserId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ success: false, error: authCheck.error });
    }

    const { uid, email } = authCheck;
    let primaryAddress: DeliveryAddressPayload | null = null;
    let savedAddresses: DeliveryAddressPayload[] = [];

    if (firebaseEnabled && firestore) {
      try {
        const userDoc = await firestore.collection(USERS_COLLECTION).doc(uid).get();
        if (userDoc.exists) {
          const data = userDoc.data() || {};
          primaryAddress = data.deliveryAddress || null;
          savedAddresses = Array.isArray(data.savedAddresses) ? data.savedAddresses : [];
          if (!primaryAddress && (data.address || data.pinCode)) {
            primaryAddress = buildBackendDeliveryAddress({
              rawAddress: data.address,
              pinCode: data.pinCode,
              fullName: data.name || data.displayName || '',
              phone: data.phone || data.phoneNumber || ''
            });
            if (primaryAddress && savedAddresses.length === 0) {
              savedAddresses = [primaryAddress];
            }
          }
        }
      } catch (err) {
        console.warn('[Address] Firestore read warning:', err);
      }
    }

    if (!primaryAddress) {
      const mem = localAddressStore.get(uid) || (email ? localAddressStore.get(email) : undefined);
      if (mem) {
        primaryAddress = mem.primaryAddress;
        savedAddresses = mem.savedAddresses;
      }
    }

    return res.json({
      success: true,
      userId: uid,
      deliveryAddress: primaryAddress,
      savedAddresses
    });
  } catch (err) {
    console.error('get-address error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve saved address' });
  }
});

// PUT /api/auth/address - Update the authenticated user's saved delivery address
router.put('/auth/address', async (req: Request, res: Response) => {
  try {
    const { userId, deliveryAddress, savedAddresses: incomingList } = req.body || {};
    const authCheck = await verifyAuthenticatedUser(req, typeof userId === 'string' ? userId : undefined);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ success: false, error: authCheck.error });
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'object') {
      return res.status(400).json({ success: false, error: 'deliveryAddress object is required.' });
    }

    const fullName = String(deliveryAddress.fullName || '').trim();
    const phone = String(deliveryAddress.phone || '').trim();
    const flatNo = String(deliveryAddress.flatNo || '').trim();
    const landmark = String(deliveryAddress.landmark || '').trim();
    const city = String(deliveryAddress.city || '').trim();
    const state = String(deliveryAddress.state || '').trim();
    const pinCode = String(deliveryAddress.pinCode || '').trim();
    const country = String(deliveryAddress.country || 'India').trim();
    const label = String(deliveryAddress.label || 'Home').trim();

    if (!fullName) {
      return res.status(400).json({ success: false, error: 'Recipient full name is required.' });
    }
    if (phone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'A valid 10-digit phone number is required.' });
    }
    if (!flatNo) {
      return res.status(400).json({ success: false, error: 'Flat No. / Road Address is required.' });
    }
    if (!city) {
      return res.status(400).json({ success: false, error: 'City / State is required.' });
    }
    if (!/^\d{6}$/.test(pinCode)) {
      return res.status(400).json({ success: false, error: 'A valid 6-digit PIN code is required.' });
    }

    const { uid, email } = authCheck;
    const normalizedAddress: DeliveryAddressPayload = {
      id: typeof deliveryAddress.id === 'string' && deliveryAddress.id.trim()
        ? deliveryAddress.id.trim()
        : `addr_${Date.now()}`,
      label,
      fullName,
      phone,
      flatNo,
      landmark,
      city,
      state,
      pinCode,
      country,
      isDefault: Boolean(deliveryAddress.isDefault),
      updatedAt: new Date().toISOString()
    };
    normalizedAddress.formattedAddress = formatBackendDeliveryAddress(normalizedAddress);

    const existingMem = localAddressStore.get(uid) || (email ? localAddressStore.get(email) : undefined);
    const baseList: DeliveryAddressPayload[] = Array.isArray(incomingList)
      ? incomingList
      : (existingMem?.savedAddresses || []);
    const deduplicatedList = deduplicateSavedAddresses(baseList, normalizedAddress);

    localAddressStore.set(uid, {
      primaryAddress: normalizedAddress,
      savedAddresses: deduplicatedList
    });
    if (email) {
      localAddressStore.set(email, {
        primaryAddress: normalizedAddress,
        savedAddresses: deduplicatedList
      });
    }

    if (firebaseEnabled && firestore) {
      try {
        const nowTs = FieldValue.serverTimestamp();
        const userDocRef = firestore.collection(USERS_COLLECTION).doc(uid);
        const updatePayload = {
          name: fullName,
          phone,
          phoneNumber: phone,
          address: normalizedAddress.formattedAddress,
          pinCode: normalizedAddress.pinCode,
          deliveryAddress: normalizedAddress,
          savedAddresses: deduplicatedList,
          updatedAt: nowTs
        };
        await userDocRef.set(updatePayload, { merge: true });
        await userDocRef.collection('profile').doc('meta').set(updatePayload, { merge: true });
      } catch (err) {
        console.warn('[Address] Firestore write warning (saved in server memory):', err);
      }
    }

    return res.json({
      success: true,
      userId: uid,
      deliveryAddress: normalizedAddress,
      savedAddresses: deduplicatedList
    });
  } catch (err) {
    console.error('put-address error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update saved address' });
  }
});

// POST /api/auth/orders - Record an order with an immutable snapshot of its delivery address
router.post('/auth/orders', async (req: Request, res: Response) => {
  try {
    const { userId, order } = req.body || {};
    const authCheck = await verifyAuthenticatedUser(req, typeof userId === 'string' ? userId : undefined);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ success: false, error: authCheck.error });
    }

    if (!order || typeof order !== 'object' || !order.deliveryAddress) {
      return res.status(400).json({ success: false, error: 'Valid order payload with deliveryAddress is required.' });
    }

    const addr = order.deliveryAddress;
    const fullName = String(addr.fullName || '').trim();
    const phone = String(addr.phone || '').trim();
    const flatNo = String(addr.flatNo || '').trim();
    const landmark = String(addr.landmark || '').trim();
    const city = String(addr.city || '').trim();
    const state = String(addr.state || '').trim();
    const pinCode = String(addr.pinCode || '').trim();

    if (!fullName || phone.replace(/\D/g, '').length < 10 || !flatNo || !city || !/^\d{6}$/.test(pinCode)) {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be placed with missing or invalid required delivery address fields.'
      });
    }

    const { uid } = authCheck;
    const orderAddressSnapshot: DeliveryAddressPayload = {
      id: String(addr.id || `order_addr_${Date.now()}`),
      label: String(addr.label || 'Home'),
      fullName,
      phone,
      flatNo,
      landmark,
      city,
      state,
      pinCode,
      country: String(addr.country || 'India'),
      formattedAddress: formatBackendDeliveryAddress({ flatNo, landmark, city, state }),
      updatedAt: new Date().toISOString()
    };

    const orderRecord: OrderPayload = {
      orderId: String(order.orderId || `#NV-${1000 + Math.floor(Math.random() * 9000)}`),
      userId: uid,
      isGuest: false,
      items: Array.isArray(order.items) ? JSON.parse(JSON.stringify(order.items)) : [],
      subtotal: Number(order.subtotal || 0),
      taxes: Number(order.taxes || 0),
      discount: Number(order.discount || 0),
      shipping: Number(order.shipping || 0),
      grandTotal: Number(order.grandTotal || 0),
      paymentMethod: order.paymentMethod === 'card' || order.paymentMethod === 'cod' ? order.paymentMethod : 'upi',
      deliveryAddress: orderAddressSnapshot,
      createdAt: String(order.createdAt || new Date().toISOString())
    };

    const existingOrders = localOrdersStore.get(uid) || [];
    localOrdersStore.set(uid, [orderRecord, ...existingOrders]);

    if (firebaseEnabled && firestore) {
      try {
        const cleanDocId = orderRecord.orderId.replace(/[^a-zA-Z0-9_-]/g, '');
        await firestore
          .collection(USERS_COLLECTION)
          .doc(uid)
          .collection(ORDERS_COLLECTION)
          .doc(cleanDocId || `order_${Date.now()}`)
          .set(orderRecord);
      } catch (err) {
        console.warn('[Orders] Firestore order write warning (saved in server memory):', err);
      }
    }

    return res.json({
      success: true,
      order: orderRecord
    });
  } catch (err) {
    console.error('post-orders error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// GET /api/auth/orders - Fetch orders for the authenticated user
router.get('/auth/orders', async (req: Request, res: Response) => {
  try {
    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const authCheck = await verifyAuthenticatedUser(req, requestedUserId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ success: false, error: authCheck.error });
    }

    const { uid } = authCheck;
    const orders = localOrdersStore.get(uid) || [];
    return res.json({
      success: true,
      userId: uid,
      orders
    });
  } catch (err) {
    console.error('get-orders error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// POST /api/auth/consent - Record signup or material-update renewal consent on the backend
router.post('/auth/consent', async (req: Request, res: Response) => {
  try {
    const { userId, email, legalConsent } = req.body || {};
    const targetUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : '';
    const targetEmail = typeof email === 'string' && isValidEmail(email.trim()) ? email.trim().toLowerCase() : '';
    const effectiveId = targetUserId || targetEmail;

    if (!effectiveId) {
      return res.status(400).json({ success: false, error: 'A valid userId or email is required to record consent.' });
    }

    const normalizedConsent = normalizeConsentPayload(legalConsent, 'signup');
    if (!normalizedConsent) {
      return res.status(400).json({
        success: false,
        error: "Explicit acceptance of NOVA's Terms & Conditions and Privacy Policy is required."
      });
    }

    const authoritativeRecord: LegalConsentPayload = {
      ...normalizedConsent,
      userId: effectiveId,
      email: targetEmail || undefined
    };

    localConsentStore.set(effectiveId, authoritativeRecord);
    if (targetEmail) {
      localConsentStore.set(targetEmail, authoritativeRecord);
    }

    if (firebaseEnabled && firestore) {
      try {
        const nowTs = FieldValue.serverTimestamp();
        const userDocRef = firestore.collection(USERS_COLLECTION).doc(effectiveId);

        await userDocRef.set({
          legalConsent: authoritativeRecord,
          updatedAt: nowTs
        }, { merge: true });

        await userDocRef.collection('profile').doc('meta').set({
          legalConsent: authoritativeRecord,
          updatedAt: nowTs
        }, { merge: true });

        await userDocRef.collection('legalConsent').doc('current').set({
          ...authoritativeRecord,
          recordedAt: nowTs
        }, { merge: true });

        await firestore.collection(LEGAL_CONSENTS_COLLECTION).add({
          ...authoritativeRecord,
          recordedAt: nowTs
        });
      } catch (err) {
        console.warn('[Consent] Firestore write warning (saved to backend memory fallback):', err);
      }
    }

    return res.json({
      success: true,
      consent: authoritativeRecord,
      storage: firebaseEnabled && firestore ? 'firestore' : 'server-memory'
    });
  } catch (err) {
    console.error('record-consent error:', err);
    return res.status(500).json({ success: false, error: 'Failed to record legal consent' });
  }
});

// GET /api/auth/consent/:userId - Retrieve stored legal consent record & check version currency
router.get('/auth/consent/:userId', async (req: Request, res: Response) => {
  try {
    const rawUserId = decodeURIComponent(String(req.params.userId || '')).trim();
    if (!rawUserId) {
      return res.status(400).json({ success: false, error: 'Missing userId parameter' });
    }

    let consent: LegalConsentPayload | null = null;

    if (firebaseEnabled && firestore) {
      try {
        const userDoc = await firestore.collection(USERS_COLLECTION).doc(rawUserId).get();
        if (userDoc.exists && userDoc.data()?.legalConsent) {
          consent = userDoc.data().legalConsent as LegalConsentPayload;
        } else {
          const currentConsentDoc = await firestore
            .collection(USERS_COLLECTION)
            .doc(rawUserId)
            .collection('legalConsent')
            .doc('current')
            .get();
          if (currentConsentDoc.exists) {
            consent = currentConsentDoc.data() as LegalConsentPayload;
          }
        }
      } catch (err) {
        console.warn('[Consent] Firestore lookup warning:', err);
      }
    }

    if (!consent) {
      consent = localConsentStore.get(rawUserId) || localConsentStore.get(rawUserId.toLowerCase()) || null;
    }

    const isCurrent = Boolean(
      consent &&
      consent.accepted === true &&
      consent.termsVersion === CURRENT_TERMS_VERSION &&
      consent.privacyVersion === CURRENT_PRIVACY_VERSION
    );

    return res.json({
      success: true,
      consent,
      currentTermsVersion: CURRENT_TERMS_VERSION,
      currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
      isCurrent,
      requiresRenewal: Boolean(consent && !isCurrent)
    });
  } catch (err) {
    console.error('get-consent error:', err);
    return res.status(500).json({ success: false, error: 'Failed to check legal consent status' });
  }
});

router.get('/auth/otp-config', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    smtp: getSafeSmtpConfigStatus(),
    firebase: {
      enabled: firebaseEnabled,
      adminInitialized: Boolean(firebaseEnabled && auth && firestore),
      initError: firebaseInitError?.message
    },
    otp: {
      length: 6,
      expiresInSeconds: OTP_TTL_MS / 1000,
      maxAttempts: MAX_OTP_ATTEMPTS,
      resendCooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
      storage: firebaseEnabled ? 'firestore' : 'memory'
    },
    legalVersions: {
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION
    }
  });
});

export default router;