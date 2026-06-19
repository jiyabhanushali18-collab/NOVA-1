import { auth, db } from '../firebase';
import { NovaAccount } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';

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

export const fetchProfileFromFirebase = async (uid: string): Promise<Partial<NovaAccount> | null> => {
  try {
    const ref = doc(db, 'users', uid, 'profile', 'meta');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
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

export default {
  getLocalAccounts,
  saveLocalAccounts,
  getActiveLocalAccount,
  setActiveLocalAccount,
  fetchProfileFromFirebase,
  signInWithGoogle,
  signInWithEmail
};
