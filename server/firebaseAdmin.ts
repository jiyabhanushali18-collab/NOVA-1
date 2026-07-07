import * as admin from 'firebase-admin';

let initialized = false;
let initError: Error | null = null;

const getServiceAccountFromEnv = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (clientEmail && privateKey && projectId) {
    return {
      projectId,
      clientEmail,
      privateKey
    };
  }

  return null;
};

const getFirebaseProjectId = () => {
  return process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'nova-26b39';
};

const initFirebaseAdmin = () => {
  if (initialized) return admin as any;

  try {
    const serviceAccount = getServiceAccountFromEnv();
    if (serviceAccount) {
      (admin as any).initializeApp({
        credential: (admin as any).credential.cert(serviceAccount as any),
        projectId: serviceAccount.projectId || serviceAccount.project_id || getFirebaseProjectId()
      });
      console.log('Firebase Admin initialized from service account environment variables');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      (admin as any).initializeApp({ projectId: getFirebaseProjectId() });
      console.log('Firebase Admin initialized using Google Application Default Credentials');
    } else {
      throw new Error('Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_ADMIN_SERVICE_ACCOUNT, split FIREBASE_ADMIN_* credentials, or GOOGLE_APPLICATION_CREDENTIALS.');
    }

    initialized = true;
  } catch (err) {
    initError = err as Error;
    console.warn('Firebase Admin SDK initialization failed; continuing without Firebase services.', err);
  }

  return admin as any;
};

export default initFirebaseAdmin();
export { initError };
