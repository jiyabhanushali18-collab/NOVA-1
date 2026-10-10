import express, { Request, Response } from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";

import { initError as firebaseInitError } from "./firebaseAdmin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import "./firebaseAdmin";

console.log("=== AUTH ROUTER ENV ===");
console.log("SMTP configured:", Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
console.log("SMTP sender:", process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@novavisionlabs.com');
console.log("=======================");

const router = express.Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_OTP_ATTEMPTS = 3;

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@novavisionlabs.com',
  fromName: process.env.SMTP_FROM_NAME || 'NOVA Vision Labs'
});

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

interface OTPRecord {
  email: string;
  otpHash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  lastAttemptAt?: number;
  legalConsent?: LegalConsentPayload;
}

const CURRENT_TERMS_VERSION = '2026.10.1';
const CURRENT_PRIVACY_VERSION = '2026.10.1';

const localOtpStore = new Map<string, OTPRecord>();
const localConsentStore = new Map<string, LegalConsentPayload>();
let firestore: any = null;
let auth: any = null;
let firebaseEnabled = false;

const initializeFirebaseServices = () => {
  try {
    firestore = getFirestore();
    auth = getAuth();
    firebaseEnabled = true;
    console.log('Firebase services initialized successfully.');
  } catch (error: any) {
    firebaseEnabled = false;
    console.warn('Firebase services unavailable, using local OTP fallback.', error?.message || error);
    if (firebaseInitError) {
      console.warn('Firebase Admin init error:', firebaseInitError.message);
    }
  }
};

initializeFirebaseServices();

const OTP_COLLECTION = 'email_otps';
const USERS_COLLECTION = 'users';
const LEGAL_CONSENTS_COLLECTION = 'legal_consents';

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
  const { host, port, secure, user, pass, fromEmail, fromName } = getSmtpConfig();
  return {
    configured: Boolean(host && user && pass),
    host: host || null,
    port,
    secure,
    user: user ? maskEmail(user) : null,
    passwordLoaded: Boolean(pass),
    fromEmail,
    fromName
  };
};

const generateOTP = () => {
  // cryptographically secure 6-digit OTP
  const num = crypto.randomInt(100000, 1000000);
  return String(num).padStart(6, '0');
};

const hashOTP = (otp: string) => crypto.createHash('sha256').update(otp).digest('hex');

const isValidEmail = (email?: string) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

let smtpTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let smtpTransporterKey = '';

const getSmtpTransporter = () => {
  const config = getSmtpConfig();
  if (!config.host || !config.user || !config.pass) return null;

  const configKey = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (!smtpTransporter || smtpTransporterKey !== configKey) {
    smtpTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass }
    });
    smtpTransporterKey = configKey;
  }
  return smtpTransporter;
};

const sendOTPEmail = async (email: string, otp: string): Promise<{ ok: boolean; status?: number; error?: string }> => {
  const config = getSmtpConfig();
  const transporter = getSmtpTransporter();
  const html = `
      <h2>NOVA - The Future of Fashion</h2>
      <p>Your verification code is:</p>
      <h1 style="letter-spacing:6px">${otp}</h1>
      <p>This code expires in 5 minutes.</p>
      <p>If you didn't request this email, please ignore it.</p>
    `;

  if (!transporter) {
    console.log("[OTP] SMTP is not configured; email not sent.", {
      recipient: maskEmail(email),
      senderEmail: config.fromEmail,
      otpLength: otp.length
    });
    return { ok: true };
  }

  try {
    console.log("[SMTP] Sending OTP email.", {
      recipient: maskEmail(email),
      senderEmail: config.fromEmail,
      host: config.host,
      port: config.port,
      secure: config.secure
    });

    const response = await transporter.sendMail({
      from: { address: config.fromEmail, name: config.fromName },
      to: email,
      subject: "Verify your NOVA Account",
      text: `Your NOVA verification code is ${otp}. This code expires in 5 minutes.`,
      html
    });

    console.log("[SMTP] OTP email accepted.", {
      messageId: response.messageId,
      recipient: maskEmail(email)
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[SMTP] OTP email failed.", {
      message: error.message,
      recipient: maskEmail(email)
    });
    return { ok: false, status: 502, error: error.message || 'SMTP delivery failed' };
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
    const doc = await otpDocRef(email)?.get();
    return doc?.exists ? doc.data() : null;
  }
  return localOtpStore.get(email) ?? null;
};

const saveStoredOtp = async (email: string, record: OTPRecord) => {
  if (firebaseEnabled && firestore) {
    await otpDocRef(email)?.set(record, { merge: true });
    return;
  }
  localOtpStore.set(email, record);
};

const deleteStoredOtp = async (email: string) => {
  if (firebaseEnabled && firestore) {
    await otpDocRef(email)?.delete();
    return;
  }
  localOtpStore.delete(email);
};

const updateStoredOtp = async (email: string, data: Partial<OTPRecord>) => {
  if (firebaseEnabled && firestore) {
    await otpDocRef(email)?.update(data);
    return;
  }
  const existing = localOtpStore.get(email);
  if (existing) {
    localOtpStore.set(email, { ...existing, ...data });
  }
};

// POST /api/auth/send-otp
router.post('/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const { email, isSignup, legalConsent } = req.body;
    if (!isValidEmail(email)) return res.status(400).json({ success: false, error: 'Invalid email' });

    const normalizedConsent = normalizeConsentPayload(legalConsent, 'signup');
    if (isSignup === true && !normalizedConsent) {
      return res.status(400).json({
        success: false,
        error: "Please read and agree to NOVA's Terms & Conditions and Privacy Policy to create an account."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
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
    if (!sent.ok) return res.status(sent.status && sent.status >= 400 && sent.status < 500 ? sent.status : 502).json({ success: false, error: sent.error || 'Failed to send verification email' });

    const otpRecord: OTPRecord = {
      email: normalizedEmail,
      otpHash,
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
    if (!sent.ok) return res.status(sent.status && sent.status >= 400 && sent.status < 500 ? sent.status : 502).json({ success: false, error: sent.error || 'Failed to send verification email' });

    const updatedRecord: OTPRecord = {
      email: normalizedEmail,
      otpHash,
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
    const { email, otp, name, address, pinCode, legalConsent } = req.body;
    if (!isValidEmail(email) || !otp || typeof otp !== 'string') return res.status(400).json({ success: false, error: 'Invalid parameters' });

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

    if (firebaseEnabled && auth && firestore) {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(normalizedEmail);
        if (!userRecord.emailVerified) {
          await auth.updateUser(userRecord.uid, { emailVerified: true });
        }
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({ email: normalizedEmail, emailVerified: true });
        } else {
          console.error('Firebase auth lookup/create error:', err);
          return res.status(500).json({ success: false, error: 'Failed to process user account' });
        }
      }

      const uid = userRecord.uid;
      const displayName = typeof name === 'string' && name.trim() ? name.trim() : normalizedEmail.split('@')[0];
      const username = normalizedEmail.split('@')[0] || displayName;
      try {
        const userDocRef = firestore.collection(USERS_COLLECTION).doc(uid);
        const nowTs = FieldValue.serverTimestamp();
        const userData: Record<string, unknown> = {
          uid,
          email: normalizedEmail,
          username,
          name: displayName,
          emailVerified: true,
          displayName,
          photoURL: '',
          phoneNumber: '',
          gender: '',
          dob: '',
          createdAt: nowTs,
          updatedAt: nowTs,
          preferences: {},
          wardrobeCount: 0,
          wishlistCount: 0,
          savedLooks: 0
        };

        if (typeof address === 'string' && address.trim()) userData.address = address.trim();
        if (typeof pinCode === 'string' && /^\d{6}$/.test(pinCode.trim())) userData.pinCode = pinCode.trim();

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
          firestoreDoc: `${USERS_COLLECTION}/${uid}`
        });
      } catch (err) {
        console.error('Failed to create user document:', err);
        return res.status(500).json({ success: false, error: 'Failed to save user profile' });
      }

      const customToken = await auth.createCustomToken(uid);
      return res.json({
        success: true,
        message: 'Email verified',
        uid,
        email: normalizedEmail,
        customToken,
        legalConsent: verifiedConsent ? { ...verifiedConsent, userId: uid, email: normalizedEmail } : undefined
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

    console.warn('[OTP] Firebase Admin not configured. Completing verification locally.', { email: maskEmail(normalizedEmail) });
    return res.json({
      success: true,
      message: 'Email verified locally',
      uid: normalizedEmail,
      email: normalizedEmail,
      legalConsent: verifiedConsent ? { ...verifiedConsent, userId: normalizedEmail, email: normalizedEmail } : undefined
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
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