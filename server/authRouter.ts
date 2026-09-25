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

interface OTPRecord {
  email: string;
  otpHash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  lastAttemptAt?: number;
}

const localOtpStore = new Map<string, OTPRecord>();
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
    const { email } = req.body;
    if (!isValidEmail(email)) return res.status(400).json({ success: false, error: 'Invalid email' });

    const normalizedEmail = email.trim().toLowerCase();
    const existingRecord = await getStoredOtp(normalizedEmail);
    const now = Date.now();

    if (existingRecord) {
      const lastSent = existingRecord.lastSentAt || 0;
      const expiresAt = existingRecord.expiresAt || 0;

      // if last sent too recently
      if (now - lastSent < OTP_RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
        return res.status(429).json({ success: false, error: `Please wait ${wait} seconds before requesting a new code`, retryAfter: wait });
      }

      // if existing OTP still valid, allow resend (generate new OTP)
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

    await saveStoredOtp(normalizedEmail, {
      email: normalizedEmail,
      otpHash,
      createdAt,
      expiresAt,
      attempts: 0,
      lastSentAt: now
    });

    console.log('[OTP] Stored verification record.', {
      email: maskEmail(normalizedEmail),
      expiresAt,
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

    // generate and replace OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const createdAt = now;
    const expiresAt = now + OTP_TTL_MS;

    const sent = await sendOTPEmail(normalizedEmail, otp);
    if (!sent.ok) return res.status(sent.status && sent.status >= 400 && sent.status < 500 ? sent.status : 502).json({ success: false, error: sent.error || 'Failed to send verification email' });

    await saveStoredOtp(normalizedEmail, {
      email: normalizedEmail,
      otpHash,
      createdAt,
      expiresAt,
      attempts: 0,
      lastSentAt: now
    });

    return res.json({ success: true, message: 'OTP resent', expiresIn: 300 });
  } catch (err) {
    console.error('resend-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/verify-otp
router.post('/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp, name, address, pinCode } = req.body;
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

        await userDocRef.set(userData, { merge: true });
        await userDocRef.collection('profile').doc('meta').set(userData, { merge: true });
        console.log('[Firebase] User Auth and Firestore profile ready.', {
          uid,
          email: maskEmail(normalizedEmail),
          firestoreDoc: `${USERS_COLLECTION}/${uid}`
        });
      } catch (err) {
        console.error('Failed to create user document:', err);
        return res.status(500).json({ success: false, error: 'Failed to save user profile' });
      }

      const customToken = await auth.createCustomToken(uid);
      return res.json({ success: true, message: 'Email verified', uid, email: normalizedEmail, customToken });
    }

    console.warn('[OTP] Firebase Admin not configured. Completing verification locally.', { email: maskEmail(normalizedEmail) });
    return res.json({ success: true, message: 'Email verified locally', uid: normalizedEmail, email: normalizedEmail });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
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
    }
  });
});

export default router;