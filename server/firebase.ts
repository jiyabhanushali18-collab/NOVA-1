import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyC3ykyIodmGSXMGys3ETJfTEiMPb9AdiJ4',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'nova-26b39.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'nova-26b39',
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || 'nova-26b39.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '1078365953930',
  appId:
    process.env.FIREBASE_APP_ID || '1:1078365953930:web:c19ef73e47173979893273',
};

const requiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
  console.warn(
    `Firebase config is incomplete. Missing: ${missingKeys.join(', ')}. ` +
      'Set FIREBASE_* environment variables in .env for your project.'
  );
}

const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);
