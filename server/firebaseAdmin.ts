import { initializeApp, cert, getApps } from "firebase-admin/app";

let initialized = false;
let initError: Error |null = null;

function getServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!json) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing");
  }

  return JSON.parse(json);
}

try {
  if (!getApps().length) {
    const serviceAccount = getServiceAccount();

    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    console.log("✅ Firebase Admin initialized");
  }

  initialized = true;
} catch (err) {
  initError = err as Error;
  console.error("❌ Firebase Admin init error:", err);
}

export { initialized, initError };