import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Check, Loader2, Mail, RefreshCw } from 'lucide-react';
import { signInWithServerCustomToken } from '../firebase';
import { apiUrl } from '../services/apiClient';
import type { LegalConsentRecord, DeliveryAddress } from '../types';

interface EmailVerificationViewProps {
  email: string;
  onVerificationSuccess: (result: {
    uid: string;
    email: string;
    customToken?: string;
    sessionToken?: string;
    legalConsent?: LegalConsentRecord;
    deliveryAddress?: DeliveryAddress;
  }) => void;
  onChangeEmail: (email: string) => void;
}

const OTP_LENGTH = 6;

export const EmailVerificationView: React.FC<EmailVerificationViewProps> = ({
  email,
  onVerificationSuccess,
  onChangeEmail
}) => {
  const [otp, setOtp] = useState('');
  const [currentEmail, setCurrentEmail] = useState(email);
  const [editedEmail, setEditedEmail] = useState(email);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(val);
    setError(null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      setError(`Please enter the full ${OTP_LENGTH}-digit code.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, otp }),
      });
      const data = await response.json() as {
        success?: boolean;
        error?: string;
        uid?: string;
        email?: string;
        customToken?: string;
        sessionToken?: string;
        legalConsent?: LegalConsentRecord;
        deliveryAddress?: DeliveryAddress;
        attemptsRemaining?: number;
      };

      if (!response.ok || !data.success) {
        const attemptsNote = typeof data.attemptsRemaining === 'number'
          ? ` ${data.attemptsRemaining} attempt${data.attemptsRemaining !== 1 ? 's' : ''} remaining.`
          : '';
        setError((data.error || 'Verification failed. Please try again.') + attemptsNote);
        setLoading(false);
        return;
      }

      // Sign into Firebase with the custom token returned by the backend
      if (data.customToken) {
        try {
          await signInWithServerCustomToken(data.customToken);
        } catch (firebaseErr) {
          console.error('Firebase custom token sign-in failed:', firebaseErr);
          // Non-fatal: session token and profile are already created; proceed
        }
      }

      setSuccess(true);
      window.setTimeout(() => {
        onVerificationSuccess({
          uid: data.uid || currentEmail,
          email: data.email || currentEmail,
          customToken: data.customToken,
          sessionToken: data.sessionToken,
          legalConsent: data.legalConsent,
          deliveryAddress: data.deliveryAddress,
        });
      }, 900);
    } catch (err) {
      console.error('OTP verification error:', err);
      setError('Could not verify the code. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || resendLoading) return;
    setResendLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/auth/resend-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail }),
      });
      const data = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        setError(data.error || 'Could not resend the code. Please try again.');
      } else {
        setOtp('');
        setResendCountdown(30);
        inputRef.current?.focus();
      }
    } catch {
      setError('Could not resend the code. Please check your connection and try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    const normalized = editedEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (normalized === currentEmail.toLowerCase()) {
      setIsEditingEmail(false);
      return;
    }
    setResendLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, isSignup: true }),
      });
      const data = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        setError(data.error || 'Could not send code to new address. Please try again.');
      } else {
        setCurrentEmail(normalized);
        setEditedEmail(normalized);
        onChangeEmail(normalized);
        setIsEditingEmail(false);
        setOtp('');
        setResendCountdown(30);
        inputRef.current?.focus();
      }
    } catch {
      setError('Could not send code to new address. Please check your connection and try again.');
    } finally {
      setResendLoading(false);
    }
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
          {success ? 'Email Verified' : 'Enter Verification Code'}
        </h1>
        <p className="text-[#5E667A] text-center">
          {success
            ? 'Your account is ready. Continuing to profile setup...'
            : `We sent a 6-digit code to`}
        </p>
        {!success && (
          <p className="text-[#131426] font-semibold text-center mt-1 break-all">{currentEmail}</p>
        )}

        {error && (
          <div className="mt-6 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!success && (
          <>
            <form onSubmit={handleVerify} className="mt-6 space-y-4">
              <div>
                <label htmlFor="otp-input" className="text-xs font-black text-[#5E667A] uppercase tracking-widest block mb-2">
                  Verification Code
                </label>
                <input
                  id="otp-input"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={OTP_LENGTH}
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="000000"
                  disabled={loading}
                  className="w-full px-4 py-4 text-center text-2xl font-bold tracking-[0.4em] bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl text-[#131426] placeholder-[#8E96AA] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== OTP_LENGTH}
                className="w-full py-3 px-4 rounded-2xl bg-[#553BE2] hover:bg-[#462CC9] text-white text-sm font-bold shadow-lg shadow-[#553BE2]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>

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
                    {resendLoading ? 'Sending...' : 'Send Code'}
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
              <p className="text-sm text-[#5E667A] mb-3">Didn't receive the code?</p>
              <button
                onClick={handleResend}
                disabled={resendCountdown > 0 || resendLoading || loading}
                className="text-sm font-medium text-[#553BE2] disabled:text-[#8E96AA] flex items-center justify-center gap-2 mx-auto"
              >
                {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {resendLoading
                  ? 'Sending...'
                  : resendCountdown > 0
                    ? `Resend code in 00:${String(resendCountdown).padStart(2, '0')}`
                    : 'Resend code'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
