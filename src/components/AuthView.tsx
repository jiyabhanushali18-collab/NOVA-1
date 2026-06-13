import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, User, Check, AlertCircle, RefreshCw, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthViewProps {
  onLoginSuccess: (name: string, email: string, phone: string, isSignUp?: boolean) => void;
  initialMode?: 'login' | 'signup';
}

interface RegisterUser {
  name: string;
  email: string;
  phone: string;
}

// Initial seed accounts for outstanding out-of-the-box convenience!
const SEED_USERS: RegisterUser[] = [
  { name: 'Arjun Mehta', email: 'arjun.mehta@email.com', phone: '+91 98765 43210' },
  { name: 'Viju Saiya', email: 'vijusaiya123@gmail.com', phone: '+91 91234 56789' },
  { name: 'Guest Tester', email: 'guest@nova.ai', phone: '+91 99999 88888' }
];

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  
  // Form input fields
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // OTP flow steps: 'input' | 'otp'
  const [step, setStep] = useState<'input' | 'otp'>('input');
  
  // 6-digit OTP input array
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  const [notification, setNotification] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisterUser[]>([]);

  // Initialize and load registered users
  useEffect(() => {
    const existing = localStorage.getItem('nova_registered_users');
    if (!existing) {
      localStorage.setItem('nova_registered_users', JSON.stringify(SEED_USERS));
      setRegisteredUsers(SEED_USERS);
    } else {
      try {
        setRegisteredUsers(JSON.parse(existing));
      } catch {
        setRegisteredUsers(SEED_USERS);
        localStorage.setItem('nova_registered_users', JSON.stringify(SEED_USERS));
      }
    }
  }, []);

  const isValidPhoneNumber = (value: string) => {
    return /^\+[1-9]\d{1,14}$/.test(value);
  };

  const createRecaptchaVerifier = (): RecaptchaVerifier => {
    if (recaptchaVerifier.current) {
      return recaptchaVerifier.current;
    }

    if (typeof window === 'undefined') {
      throw new Error('Recaptcha verifier is only available in the browser.');
    }

    recaptchaVerifier.current = new RecaptchaVerifier(
      'recaptcha-container',
      {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved, signInWithPhoneNumber may proceed.
        },
        'expired-callback': () => {
          setError('reCAPTCHA expired. Please try again.');
          setConfirmationResult(null);
        }
      },
      auth
    );

    return recaptchaVerifier.current;
  };

  const clearRecaptcha = () => {
    if (recaptchaVerifier.current) {
      try {
        recaptchaVerifier.current.clear();
      } catch {
        // ignore cleanup failures
      }
      recaptchaVerifier.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearRecaptcha();
    };
  }, []);

  const sendOtp = async (phone: string, forceRefresh = false) => {
    if (!isValidPhoneNumber(phone)) {
      setError('Please enter a valid phone number in E.164 format, for example +919876543210.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      if (forceRefresh) {
        clearRecaptcha();
      }

      const appVerifier = createRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmationResult(confirmation);
      setStep('otp');
      setCountdown(59);
      setOtp(['', '', '', '', '', '']);
      setNotification({
        message: `OTP sent to ${phone}. Please enter the 6-digit code shown on your device.`,
        visible: true
      });
    } catch (err: any) {
      console.error('Phone auth error:', err);
      if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format. Please use +919876543210.');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('SMS quota exceeded. Please try again later.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.code === 'auth/captcha-check-failed') {
        setError('reCAPTCHA validation failed. Please refresh and try again.');
      } else {
        setError('Unable to send OTP. Please try again.');
      }
      clearRecaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP Countdown timer trigger
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Toast notification disappears automatically
  useEffect(() => {
    let notifyTimer: any;
    if (notification.visible) {
      notifyTimer = setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, 12000); // Live on screen for 12 seconds so users easily read/copy
    }
    return () => clearTimeout(notifyTimer);
  }, [notification.visible]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone) {
      setError('Please provide your phone number in E.164 format, for example +919876543210.');
      return;
    }

    const normalizedPhone = cleanPhone.replace(/\s+/g, '');
    if (!isValidPhoneNumber(normalizedPhone)) {
      setError('Please provide a valid phone number in E.164 format, for example +919876543210.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please provide your Full Name to register.');
      return;
    }

    const userExists = registeredUsers.some(
      (u) => u.phone.replace(/\s+/g, '') === normalizedPhone
    );

    if (mode === 'login') {
      if (!userExists) {
        setError('We could not find an account with that phone number. Switch to "Create Account" to register.');
        return;
      }
    } else {
      if (userExists) {
        setError('This phone number is already registered. If you already have an account, switch to Sign In!');
        return;
      }
    }

    await sendOtp(normalizedPhone);
    setTimeout(() => {
      otpRefs[0].current?.focus();
    }, 100);
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setError(null);
    setSuccess(null);

    const cleanPhone = phoneNumber.trim();
    const normalizedPhone = cleanPhone.replace(/\s+/g, '');
    if (!isValidPhoneNumber(normalizedPhone)) {
      setError('Please enter your phone number again in E.164 format before resending OTP.');
      return;
    }

    await sendOtp(normalizedPhone, true);
    setTimeout(() => {
      otpRefs[0].current?.focus();
    }, 100);
  };

  // OTP Digit changes
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // numbers only
    
    const updated = [...otp];
    // Keep only last character
    const char = value.substring(value.length - 1);
    updated[index] = char;
    setOtp(updated);

    // Auto-focus next input
    if (char && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  // Key downs inside OTP (backspace back-tracking)
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  // OTP Paste handler
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split('');
    setOtp(digits);
    otpRefs[5].current?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const enteredCode = otp.join('');
    if (enteredCode.length < 6) {
      setError('Please input all 6 numeric digits of your verification code.');
      return;
    }

    if (!confirmationResult) {
      setError('OTP session expired. Please request a new code.');
      return;
    }

    setIsSubmitting(true);

    try {
      const userCredential = await confirmationResult.confirm(enteredCode);
      const finalPhone = userCredential.user.phoneNumber || phoneNumber.trim();
      const existingUsers: RegisterUser[] = JSON.parse(
        localStorage.getItem('nova_registered_users') || JSON.stringify(SEED_USERS)
      );

      let finalName = '';
      let finalEmail = '';

      if (mode === 'signup') {
        const newUser: RegisterUser = {
          name: name.trim(),
          phone: finalPhone,
          email: `${name.trim().toLowerCase().replace(/\s+/g, '')}@nova.ai`
        };

        const updatedUsers = [...existingUsers, newUser];
        localStorage.setItem('nova_registered_users', JSON.stringify(updatedUsers));
        setRegisteredUsers(updatedUsers);

        finalName = newUser.name;
        finalEmail = newUser.email;
      } else {
        const matched = existingUsers.find(
          (u) => u.phone.replace(/\s+/g, '') === finalPhone.replace(/\s+/g, '')
        );
        finalName = matched?.name || finalPhone;
        finalEmail = matched?.email || `${finalName.toLowerCase().replace(/\s+/g, '')}@nova.ai`;
      }

      setSuccess('Verification successful!');
      setTimeout(() => {
        setIsSubmitting(false);
        onLoginSuccess(finalName, finalEmail, finalPhone, mode === 'signup');
      }, 500);
    } catch (err: any) {
      console.error('OTP verification failed:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Incorrect verification code. Please try again.');
      } else if (err.code === 'auth/code-expired') {
        setError('OTP expired. Request a new code.');
        setConfirmationResult(null);
      } else {
        setError('Unable to verify OTP. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 relative">
      <div id="recaptcha-container" className="hidden" />
      {/* Immersive Mock Notifications Panel for OTP values */}
      <AnimatePresence>
        {notification.visible && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 inset-x-4 max-w-sm mx-auto z-50 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-indigo-500/30 flex gap-3 cursor-pointer"
            onClick={() => {
              setNotification(prev => ({ ...prev, visible: false }));
            }}
          >
            <div className="w-9 h-9 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 animate-pulse">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1 leading-normal">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">NOVA Telemetry SMS</span>
                <span className="text-[8px] text-slate-400 font-mono leading-none">Just Received</span>
              </div>
              <p className="text-xs font-semibold text-slate-100 mt-1 leading-tight">{notification.message}</p>
              <span className="text-[9px] font-black text-amber-400 mt-1.5 block uppercase tracking-wider">💡 Tap the notification to dismiss when you are ready.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Blur Backings */}
      <div className="absolute top-[10%] left-[10%] w-36 h-36 rounded-full bg-indigo-400/10 blur-3xl"></div>
      <div className="absolute bottom-[10%] right-[10%] w-44 h-44 rounded-full bg-purple-400/10 blur-3xl"></div>

      {/* Primary Card View Container */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white/95 backdrop-blur-3xl rounded-[32px] border border-indigo-100/65 shadow-2xl p-7 relative overflow-hidden flex flex-col"
      >
        {/* Brand identity header */}
        <div className="flex flex-col items-center text-center pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-extrabold shadow-lg shadow-indigo-600/20 mb-3 hover:scale-105 transition-transform duration-300">
            N
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">NOVA VISION LABS</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5 tracking-wider uppercase font-mono">AR & AI Curation Engine</p>
        </div>

        {/* Floating tabs selectors */}
        {step === 'input' && (
          <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-6 relative">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all relative z-10 text-center ${mode === 'login' ? 'text-indigo-600 shadow-sm bg-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all relative z-10 text-center ${mode === 'signup' ? 'text-indigo-600 shadow-sm bg-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Create Account
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'input' ? (
            /* ================== INPUT STEP VIEW ================== */
            <motion.form
              key="input-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleRequestOtp}
              className="space-y-4 flex-grow flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                {/* Mode description header */}
                <div className="text-center pb-1">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {mode === 'login' 
                      ? 'Welcome back! Enter your registered details to verify via secure One-Time code.'
                      : 'Create secondary account instantly. We will transmit an active OTP code to test registration flow.'}
                  </p>
                </div>

                {/* Account Name input field - signup mode only */}
                {mode === 'signup' && (
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4.5 h-4.5" />
                      </div>
                      <input
                        type="text"
                        placeholder="Arjun Mehta"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                        required={mode === 'signup'}
                      />
                    </div>
                  </div>
                )}

                {/* Phone input field */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="tel"
                      placeholder="+919876543210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                      required
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-1 ml-1 leading-tight">
                    {mode === 'login' 
                      ? '💡 Enter your registered phone in E.164 format, for example +919876543210.' 
                      : '💡 Use your phone number to receive a secure OTP for sign up.'}
                  </span>
                </div>

                {/* Standard validation error blocks */}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex gap-2.5 text-rose-600 items-start text-left"
                  >
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-semibold leading-relaxed">{error}</span>
                  </motion.div>
                )}
              </div>

              {/* Security confirmation lock footer */}
              <div className="pt-6 space-y-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer disabled:bg-indigo-400"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Verify via Safe OTP <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400 font-mono tracking-wide leading-none uppercase">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-500 leading-none" /> Secure Encryption Shield Active
                </div>
              </div>
            </motion.form>
          ) : (
            /* ================== OTP CODE VERIFICATION VIEW ================== */
            <motion.form
              key="otp-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleVerifyOtp}
              className="space-y-4 flex-grow flex flex-col justify-between"
            >
              <div className="space-y-5">
                {/* Description back options header */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1 text-slate-800">
                    <Smartphone className="w-5 h-5 text-indigo-500" />
                    <h4 className="text-sm font-bold text-slate-800 leading-none">Security Code</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed px-1">
                    Enter the 6-digit verification code sent securely to <span className="font-bold text-slate-800">{phoneNumber}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => { setStep('input'); setError(null); }}
                    className="text-[11px] font-bold text-indigo-600 mt-1.5 hover:underline"
                  >
                    Change Phone Number
                  </button>
                </div>

                {/* 6 Digit custom visual code layouts */}
                <div className="flex justify-between items-center gap-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={otpRefs[idx]}
                      type="text"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      className="w-11 h-12 text-center text-lg font-black text-slate-900 bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-inner"
                    />
                  ))}
                </div>

                {/* Resend and countdown timer utilities */}
                <div className="text-center pt-1.5">
                  {countdown > 0 ? (
                    <p className="text-[10px] font-bold text-slate-400 font-mono tracking-wider uppercase leading-none">
                      Resend code in <span className="text-indigo-600 font-extrabold">{countdown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 active:scale-95 transition-transform"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Resend verification code
                    </button>
                  )}
                </div>

                {/* Errors display */}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex gap-2.5 text-rose-600 items-start text-left"
                  >
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-semibold leading-relaxed">{error}</span>
                  </motion.div>
                )}

                {/* Success display */}
                {success && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex gap-2.5 text-emerald-600 items-start text-left"
                  >
                    <Check className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-semibold leading-relaxed">{success}</span>
                  </motion.div>
                )}
              </div>

              {/* Submit trigger button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer disabled:bg-indigo-400"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Verify and Continue <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};
