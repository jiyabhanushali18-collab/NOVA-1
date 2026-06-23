import { auth, db } from '../firebase';
import { Measurement, NovaAccount, Preference } from '../types';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const ACCOUNTS_KEY = 'nova_accounts';
const ACTIVE_KEY = 'nova_active_account';

export const getLocalAccounts = (): NovaAccount[] => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NovaAccount[];
  } catch {
    return [];
  }
};

export const saveLocalAccounts = (accounts: NovaAccount[]) => {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
};

export const getActiveLocalAccount = (): string | undefined => {
  try {
    return localStorage.getItem(ACTIVE_KEY) || undefined;
  } catch {
    return undefined;
  }
};

export const setActiveLocalAccount = (uid: string | undefined) => {
  try {
    if (uid) localStorage.setItem(ACTIVE_KEY, uid);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
};

export const getUserDocId = (id: string) => {
  return (id || 'guestuser@nova.ai').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
};

const withoutUndefined = <T extends Record<string, unknown>>(value: T) => {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
};

export const upsertUserProfile = async (
  account: Partial<NovaAccount> & { uid?: string; email?: string; phone?: string },
  extra?: {
    preferences?: Preference[];
    measurements?: Measurement[];
    wardrobeCount?: number;
    wardrobeUpdatedAt?: string;
  }
) => {
  const docId = getUserDocId(account.email || account.uid || account.username || 'guestuser@nova.ai');
  const email = account.email || '';
  const username = account.username || (email ? email.split('@')[0] : docId);
  const now = Date.now();
  const profile = withoutUndefined({
    uid: account.uid || docId,
    username,
    name: account.name || username,
    email,
    phone: account.phone,
    profilePhoto: account.profilePhoto,
    gender: account.gender,
    size: account.size,
    createdAt: account.createdAt || now,
    updatedAt: serverTimestamp(),
    preferences: extra?.preferences,
    measurements: extra?.measurements,
    wardrobeCount: extra?.wardrobeCount,
    wardrobeUpdatedAt: extra?.wardrobeUpdatedAt
  });

  await setDoc(doc(db, 'users', docId), profile, { merge: true });
  await setDoc(doc(db, 'users', docId, 'profile', 'meta'), profile, { merge: true });
  return docId;
};

export const fetchProfileFromFirebase = async (uid: string): Promise<Partial<NovaAccount> | null> => {
  try {
    const docId = getUserDocId(uid);
    const parentSnap = await getDoc(doc(db, 'users', docId));
    if (parentSnap.exists()) return parentSnap.data() as Partial<NovaAccount>;

    const ref = doc(db, 'users', docId, 'profile', 'meta');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const legacySnap = await getDoc(doc(db, 'users', uid, 'profile', 'meta'));
      if (!legacySnap.exists()) return null;
      return legacySnap.data() as Partial<NovaAccount>;
    }
    return snap.data() as Partial<NovaAccount>;
  } catch (e) {
    return null;
  }
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
};

export const signInWithEmail = async (email: string, password: string) => {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
};

export const registerWithEmail = async (email: string, password: string) => {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  return res.user;
};

export default {
  getLocalAccounts,
  saveLocalAccounts,
  getActiveLocalAccount,
  setActiveLocalAccount,
  getUserDocId,
  upsertUserProfile,
  fetchProfileFromFirebase,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail
};
