import React, { useState } from 'react';
import accountService from '../../services/accountService';
import { NovaAccount } from '../../types';

interface Props {
  onAdded?: (acc: NovaAccount) => void;
}

export const AddAccountView: React.FC<Props> = ({ onAdded }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLocalAccount = (emailValue: string, displayName?: string): NovaAccount => {
    const normalizedEmail = emailValue.trim().toLowerCase();
    const username = normalizedEmail.split('@')[0] || 'nova-user';
    return {
      uid: `local-${normalizedEmail}`,
      username: displayName || username,
      email: normalizedEmail,
      profilePhoto: undefined,
      createdAt: Date.now()
    };
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const trimmed = email.trim();

    // If user entered a username (no @), treat as local account instead of Firebase email auth
    if (!trimmed.includes('@')) {
      const fallback = createLocalAccount(trimmed);
      onAdded?.(fallback);
      setLoading(false);
      return;
    }

    try {
      const user = await accountService.signInWithEmail(trimmed, password);
      const acc: NovaAccount = {
        uid: user.uid,
        username: user.email ? user.email.split('@')[0] : user.uid,
        email: user.email || '',
        profilePhoto: user.photoURL || undefined,
        createdAt: Date.now()
      };
      onAdded?.(acc);
    } catch (e: any) {
      if (e?.code === 'auth/user-not-found' || e?.message?.includes('user-not-found')) {
        try {
          const user = await accountService.registerWithEmail(email, password);
          const acc: NovaAccount = {
            uid: user.uid,
            username: user.email ? user.email.split('@')[0] : user.uid,
            email: user.email || '',
            profilePhoto: user.photoURL || undefined,
            createdAt: Date.now()
          };
          onAdded?.(acc);
        } catch (regErr: any) {
          setError(regErr?.message || 'Failed to create account');
        }
      } else if (e?.code === 'auth/operation-not-allowed' || e?.message?.includes('operation-not-allowed')) {
        const fallback = createLocalAccount(email);
        onAdded?.(fallback);
      } else {
        setError(e?.message || 'Failed to sign in');
      }
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await accountService.signInWithGoogle();
      const acc: NovaAccount = {
        uid: user.uid,
        username: user.displayName || (user.email ? user.email.split('@')[0] : user.uid),
        email: user.email || '',
        profilePhoto: user.photoURL || undefined,
        createdAt: Date.now()
      };
      onAdded?.(acc);
    } catch (e: any) {
      if (e?.code === 'auth/operation-not-allowed' || e?.message?.includes('operation-not-allowed')) {
        setError('Google sign-in is disabled in Firebase Auth. Please enable the Google provider in your Firebase console.');
      } else if (e?.code === 'auth/invalid-credential' || e?.message?.includes('invalid-credential')) {
        setError('Google sign-in credential is invalid. Check your Firebase Google provider setup and authorized domains.');
      } else if (e?.code === 'auth/unauthorized-domain' || e?.message?.includes('unauthorized-domain')) {
        setError('Firebase blocked this domain. Add your app origin to Firebase Auth authorized domains, then reload.');
      } else if (e?.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in was cancelled. Please try again.');
      } else {
        setError(e?.message || 'Google sign in failed');
      }
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <button disabled={loading} onClick={handleGoogle} className="w-full py-2 rounded bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold disabled:opacity-50">Continue with Google</button>

      <div className="text-center text-slate-400 text-sm">or</div>

      <form onSubmit={handleEmailLogin} className="space-y-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-2 rounded border" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-2 rounded border" />
        <button disabled={loading} type="submit" className="w-full py-2 rounded bg-white border font-bold">Sign in</button>
      </form>

      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  );
};

export default AddAccountView;
