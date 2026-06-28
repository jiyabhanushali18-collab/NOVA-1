import { FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};

export const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyC3ykyIodmGSXMGys3ETJfTEiMPb9AdiJ4',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'nova-26b39.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'nova-26b39',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'nova-26b39.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1078365953930',
  appId: env.VITE_FIREBASE_APP_ID || '1:1078365953930:web:c19ef73e47173979893273'
};

export const firebaseProjectId = firebaseConfig.projectId || 'unknown-project';
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const getErrorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : undefined;
const getErrorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : undefined;

let authReadyPromise: Promise<User | null> | null = null;

const initializeAnonymousAuth = async (): Promise<User | null> => {
  if (auth.currentUser) return auth.currentUser;

  try {
    const credential = await signInAnonymously(auth);
    console.debug('Firebase anonymous auth initialized.', {
      uid: credential.user.uid,
      projectId: firebaseProjectId
    });
    return credential.user;
  } catch (error) {
    console.error(
      'Firebase anonymous auth failed:',
      error,
      getErrorCode(error),
      getErrorMessage(error)
    );
    return auth.currentUser;
  }
};

export const waitForFirebaseAuthReady = (): Promise<User | null> => {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
        return;
      }

      const anonymousUser = await initializeAnonymousAuth();
      resolve(anonymousUser);
    }, async (error) => {
      console.error(
        'Firebase auth state error:',
        error,
        getErrorCode(error),
        getErrorMessage(error)
      );
      const anonymousUser = await initializeAnonymousAuth();
      resolve(anonymousUser);
    });
  });

  return authReadyPromise;
};

onAuthStateChanged(auth, (user) => {
  if (!user) {
    waitForFirebaseAuthReady().catch((error) => {
      console.error(
        'Failed to start Firebase anonymous auth:',
        error,
        getErrorCode(error),
        getErrorMessage(error)
      );
    });
  }
});

waitForFirebaseAuthReady().catch((error) => {
  console.error(
    'Failed to initialize Firebase anonymous auth on startup:',
    error,
    getErrorCode(error),
    getErrorMessage(error)
  );
});

/**
 * Save user details to Firestore 'users' collection
 * @param name - User's full name
 * @param email - User's email address
 * @param phone - User's phone number
 * @param isNewUser - Whether this is a new signup or returning login
 */
export const saveUserToFirestore = async (
  name: string,
  email: string,
  phone: string,
  isNewUser: boolean = false,
  address?: string,
  pinCode?: string
): Promise<void> => {
  try {
    const normalizedEmail = email.toLowerCase().replace(/[@.]/g, '_');
    const userRef = doc(db, 'users', normalizedEmail);
    const userData: any = {
      uid: normalizedEmail,
      name,
      email,
      phone,
      username: email.split('@')[0] || name,
      createdAt: isNewUser ? serverTimestamp() : new Date(),
      lastLogin: serverTimestamp(),
      profilePhoto: undefined
    };
    if (address) userData.address = address;
    if (pinCode) userData.pinCode = pinCode;
    
    await setDoc(userRef, userData, { merge: true });
  } catch (err) {
    console.error('Error saving user to Firestore:', err);
    throw err;
  }
};
