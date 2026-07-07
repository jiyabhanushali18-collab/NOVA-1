import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react';
import { apiUrl } from '../services/apiClient';

interface EmailVerificationViewProps {
  email: string;
  name: string;
  address?: string;
  pinCode?: string;
  onVerificationSuccess: (result: { uid?: string; email: string; customToken?: string }) => void;
  onChangeEmail: () => void;
}

export const EmailVerificationView: React.FC<EmailVerificationViewProps> = ({
  email,
  name,
  address,
  pinCode,
  onVerificationSuccess,
  onChangeEmail
}) => {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = setTimeout(() => {
      setResendCountdown(resendCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleOTPChange = (index: number, value: string) => {
    // Only allow digits
    const sanitized = value.replace(/[^0-9]/g, '');
    
    if (sanitized.length === 0) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    // For pasted content (multiple digits), distribute them
    if (sanitized.length > 1) {
      const digits = sanitized.split('');
      const newOtp = [...otp];
      
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        newOtp[index + i] = digits[i];
      }
      
      setOtp(newOtp);
      
      // Focus the last filled input or the next empty one
      const lastFilled = Math.min(index + digits.length, 5);
      inputRefs.current[lastFilled]?.focus();
      return;
    }

    // Single digit input
    const newOtp = [...otp];
    newOtp[index] = sanitized;
    setOtp(newOtp);

    // Auto-advance to next input
    if (sanitized && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    setError(null);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/[^0-9]/g, '').split('').slice(0, 6);
    
    if (digits.length > 0) {
      const newOtp = [...otp];
      digits.forEach((digit, index) => {
        newOtp[index] = digit;
      });
      setOtp(newOtp);
      
      // Focus the last position or last filled
      const focusIndex = Math.min(digits.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const isOTPComplete = otp.every(digit => digit !== '');

  const handleVerify = async () => {
    if (!isOTPComplete) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const otpString = otp.join('');
      console.debug('OTP verify request started.', { email, endpoint: apiUrl('/api/auth/verify-otp'), otpLength: otpString.length });
      const response = await fetch(apiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          otp: otpString,
          name,
          address,
          pinCode
        })
      });

      const data = await response.json();
      console.debug('OTP verify response received.', { status: response.status, success: data.success, uid: data.uid });

      if (!response.ok) {
        setError(data.error || 'Verification failed');
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        setLoading(false);
        return;
      }

      // Success!
      setSuccess(true);
      setLoading(false);

      // Navigate after brief delay to show success animation
      setTimeout(() => {
        onVerificationSuccess({ uid: data.uid, email: data.email || email, customToken: data.customToken });
      }, 1500);
    } catch (err) {
      console.error('Verification error:', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0 || resendLoading) return;

    setResendLoading(true);
    setError(null);

    try {
      console.debug('OTP resend request started.', { email, endpoint: apiUrl('/api/auth/send-otp') });
      const response = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      console.debug('OTP resend response received.', { status: response.status, success: data.success, expiresIn: data.expiresIn });

      if (!response.ok) {
        setError(data.error || 'Failed to resend OTP');
        setResendLoading(false);
        return;
      }

      // Reset OTP inputs
      setOtp(['', '', '', '', '', '']);
      setAttemptsRemaining(3);
      setResendCountdown(30);
      setResendLoading(false);
      inputRefs.current[0]?.focus();
    } catch (err) {
      console.error('Resend error:', err);
      setError('Failed to resend OTP. Please try again.');
      setResendLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    return `00:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-6 shadow-lg"
            >
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl font-bold text-slate-900 text-center mb-2"
            >
              Email Verified
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-slate-600 text-center"
            >
              Redirecting to profile setup...
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Verify Your Email
              </h1>
              <p className="text-slate-600">
                We've sent a 6-digit verification code to
              </p>
              <p className="text-slate-900 font-semibold mt-1">{email}</p>
            </div>

            {/* Change Email Link */}
            <button
              onClick={onChangeEmail}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-8 transition-colors"
            >
              Change Email
            </button>

            {/* OTP Input Boxes */}
            <div className="mb-8">
              <div className="flex gap-3 mb-6">
                {otp.map((digit, index) => (
                  <motion.input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={loading || success}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 transition-all duration-200"
                  />
                ))}
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-6"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Resend Section */}
              <div className="text-center mb-6">
                <p className="text-sm text-slate-600 mb-3">
                  Didn't receive the code?
                </p>

                {resendCountdown > 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      disabled
                      className="text-sm font-medium text-slate-400 cursor-not-allowed"
                    >
                      Resend OTP
                    </button>
                    <p className="text-xl font-mono font-bold text-slate-900">
                      {formatCountdown(resendCountdown)}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleResendOTP}
                    disabled={resendLoading}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors disabled:text-slate-400 flex items-center justify-center gap-2 mx-auto"
                  >
                    {resendLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Resend OTP'
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Verify Button */}
            <motion.button
              onClick={handleVerify}
              disabled={!isOTPComplete || loading}
              whileHover={!loading && isOTPComplete ? { scale: 1.02 } : undefined}
              whileTap={!loading && isOTPComplete ? { scale: 0.98 } : undefined}
              className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                isOTPComplete && !loading
                  ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:shadow-lg'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </motion.button>

            {/* Footer Text */}
            <p className="text-xs text-slate-500 text-center mt-6">
              This code expires in 5 minutes
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
