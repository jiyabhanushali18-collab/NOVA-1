import dotenv from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

dotenv.config();

// Ensure local Windows dev handles system CA / corporate proxy TLS gracefully
if (process.platform === 'win32' && process.env.NODE_ENV !== 'production' && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

let initialized = false;
let initError: Error | null = null;

function isValidServiceAccount(sa: any): boolean {
  if (!sa || typeof sa !== 'object') return false;
  const projectId = sa.project_id || sa.projectId;
  const clientEmail = sa.client_email || sa.clientEmail;
  const privateKey = sa.private_key || sa.privateKey;

  if (!projectId || typeof projectId !== 'string' || projectId === 'your-project-id') return false;
  if (!clientEmail || typeof clientEmail !== 'string' || clientEmail.includes('your-project-id') || clientEmail.includes('example.com')) return false;
  if (!privateKey || typeof privateKey !== 'string' || privateKey.includes('YourKeyHere') || !privateKey.includes('BEGIN PRIVATE KEY')) return false;

  return true;
}

function getServiceAccount(): any | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  // 1. JSON environment variable
  if (json) {
    try {
      let parsed = JSON.parse(json);
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      if (isValidServiceAccount(parsed)) {
        return parsed;
      }
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_JSON parsed but failed validation (contains placeholder values or missing fields).");
    } catch (e) {
      console.warn("⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable.");
    }
  }

  // 2. Base64 environment variable
  if (base64) {
    try {
      const decoded = Buffer.from(base64, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      if (isValidServiceAccount(parsed)) {
        return parsed;
      }
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_BASE64 parsed but failed validation.");
    } catch (e) {
      console.warn("⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable.");
    }
  }

  // 3. Individual environment variables
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim();
  const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID)?.trim();
  if (clientEmail && privateKey && projectId) {
    const candidate = {
      type: 'service_account',
      project_id: projectId.replace(/^["']|["']$/g, ''),
      client_email: clientEmail.replace(/^["']|["']$/g, ''),
      private_key: privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n'),
    };
    if (isValidServiceAccount(candidate)) {
      return candidate;
    }
  }

  // 4. File-based credentials
  const fallbackDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const accountPath = filePath || path.join(fallbackDir, "serviceAccount.json");

  if (fs.existsSync(accountPath)) {
    try {
      const contents = fs.readFileSync(accountPath, "utf8");
      const parsed = JSON.parse(contents);
      if (isValidServiceAccount(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn("⚠️ Failed to read/parse service account file at " + accountPath);
    }
  }

  // 5. Raw .env file fallback (in case dotenv truncated an unquoted multiline block)
  try {
    const envFile = path.join(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const envRaw = fs.readFileSync(envFile, 'utf8');
      const match = envRaw.match(/FIREBASE_SERVICE_ACCOUNT_JSON\s*=\s*(\{[\s\S]*?\n\})/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (isValidServiceAccount(parsed)) {
          return parsed;
        }
      }
    }
  } catch {}

  return null;
}

try {
  if (!getApps().length) {
    const serviceAccount = getServiceAccount();

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      initialized = true;
      console.log("✅ Firebase Admin initialized successfully");
    } else {
      console.warn("⚠️ Running Firebase Admin in local fallback mode (no valid service account provided).");
    }
  } else {
    initialized = true;
  }
} catch (err) {
  initError = err as Error;
  console.error("❌ Firebase Admin init error:", err);
}

export const adminDb = initialized && getApps().length ? getFirestore() : null;
export { initialized, initError };