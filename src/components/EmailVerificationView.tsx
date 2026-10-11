import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Check, Loader2, Mail, RefreshCw } from 'lucide-react';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../firebase';
import {
  EMAIL_FOR_SIGN_IN_KEY,
  sendFirebaseEmailSignInLink
} from '../services/emailLinkAuth';

interface EmailVerificationViewProps {
  email: string;
  onVerificationSuccess: (result: { uid: string; email: string }) => void;
  onChangeEmail: (email: string) => void;
}

const getFirebaseAuthErrorMessage = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';

  if (code === 'auth/invalid-action-code') return 'This sign-in link is invalid or has expired. Request a new link.';
  if (code === 'auth/expired-action-code') return 'This sign-in link has expired. Request a new link.';
  if (code === 'auth/invalid-email') return 'The email address is invalid. Please request a new link.';
  if (code === 'auth/unauthorized-continue-uri') return 'This website address is not authorized in Firebase Authentication settings.';
  if (code === 'auth/unauthorized-domain') return 'Add this website domain to Firebase Authentication authorized domains.';
  if (code === 'auth/operation-not-allowed') return 'Enable Email link sign-in in Firebase Authentication settings.';
  return 'Could not complete email verification. Please request a new link and try again.';
};

export const EmailVerificationView: React.FC<EmailVerificationViewProps> = ({
  email,
  onVerificationSuccess,
  onChangeEmail
}) => {
  const [currentEmail, setCurrentEmail] = useState(email);
  const [editedEmail, setEditedEmail] = useState(email);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const processedLink = useRef(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (processedLink.current || !isSignInWithEmailLink(auth, window.location.href)) return;
    processedLink.current = true;

    const completeEmailSignIn = async () => {
      const storedEmail = localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
      if (!storedEmail) {
        setError('For security, open this link in the same browser where you started signup.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const credential = await signInWithEmailLink(auth, storedEmail, window.location.href);
        if (!credential.user.emailVerified) {
          throw new Error('Firebase did not mark the email as verified.');
        }

        localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
        window.history.replaceState({}, document.title, window.location.pathname);
        setSuccess(true);
        window.setTimeout(() => {
          onVerificationSuccess({
            uid: credential.user.uid,
            email: credential.user.email || storedEmail
          });
        }, 900);
      } catch (verificationError) {
        console.error('Firebase email link verification failed:', verificationError);
        setError(getFirebaseAuthErrorMessage(verificationError));
        setLoading(false);
      }
    };

    void completeEmailSignIn();
  }, [onVerificationSuccess]);

  const sendLink = async (targetEmail: string) => {
    const normalizedEmail = targetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }

    setResendLoading(true);
    setError(null);
    try {
      await sendFirebaseEmailSignInLink(normalizedEmail);
      setCurrentEmail(normalizedEmail);
      setEditedEmail(normalizedEmail);
      onChangeEmail(normalizedEmail);
      setIsEditingEmail(false);
      setResendCountdown(30);
      return true;
    } catch (sendError) {
      console.error('Failed to send Firebase email sign-in link:', sendError);
      setError(getFirebaseAuthErrorMessage(sendError));
      return false;
    } finally {
      setResendLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || resendLoading) return;
    await sendLink(currentEmail);
  };

  const handleChangeEmail = async () => {
    if (editedEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setIsEditingEmail(false);
      return;
    }
    await sendLink(editedEmail);
  };

  return (
    <div className="min-h-screen bg-[#F2EEFF] nova-page-wash flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[28px] border border-[#E4DFF5] p-7 shadow-xl shadow-[#553BE2]/5"
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F2EEFF] text-[#553BE2]">
          {success ? <Check className="h-8 w-8" /> : <Mail className="h-8 w-8" />}
        </div>
        <h1 className="text-2xl font-bold text-[#131426] text-center mb-2">
          {success ? 'Email Verified' : 'Check Your Email'}
        </h1>
        <p className="text-[#5E667A] text-center">
          {success
            ? 'Your account is ready. Continuing to profile setup...'
            : 'We sent you a secure sign-in link. Open it in this same browser to verify your email and finish signup.'}
        </p>
        <p className="text-[#131426] font-semibold text-center mt-2 break-all">{currentEmail}</p>

        {error && (
          <div className="mt-6 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!success && (
          <>
            {isEditingEmail ? (
              <div className="mt-6 p-4 bg-[#F2EEFF] border border-[#E4DFF5] rounded-lg">
                <label htmlFor="verification-email" className="text-xs font-black text-[#5E667A] uppercase tracking-widest block mb-2">
                  Change Email Address
                </label>
                <input
                  id="verification-email"
                  type="email"
                  value={editedEmail}
                  onChange={(event) => setEditedEmail(event.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white text-[#131426] border border-[#E4DFF5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#553BE2]"
                  autoComplete="email"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleChangeEmail}
                    disabled={resendLoading}
                    className="flex-1 px-3 py-2 text-sm font-semibold text-white bg-[#553BE2] rounded-lg disabled:opacity-50"
                  >
                    {resendLoading ? 'Sending...' : 'Send Link'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingEmail(false);
                      setEditedEmail(currentEmail);
                    }}
                    className="flex-1 px-3 py-2 text-sm font-semibold text-[#5E667A] bg-white border border-[#E4DFF5] rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingEmail(true)}
                className="w-full mt-6 px-4 py-2.5 text-sm font-semibold text-[#553BE2] bg-[#F2EEFF] border border-[#E4DFF5] rounded-lg"
              >
                Use Different Email
              </button>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-[#5E667A] mb-3">Didn't receive the email?</p>
              <button
                onClick={handleResend}
                disabled={resendCountdown > 0 || resendLoading || loading}
                className="text-sm font-medium text-[#553BE2] disabled:text-[#8E96AA] flex items-center justify-center gap-2 mx-auto"
              >
                {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {resendLoading ? 'Sending...' : resendCountdown > 0 ? `Resend link in 00:${String(resendCountdown).padStart(2, '0')}` : 'Resend sign-in link'}
              </button>
            </div>

          </>
        )}

        <p className="text-xs text-[#5E667A] text-center mt-6">
          Firebase securely handles the verification email. No custom email domain is needed.
        </p>
      </motion.div>
    </div>
  );
};
