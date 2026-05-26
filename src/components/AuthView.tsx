import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, User, Eye, EyeOff, Check, AlertCircle, RefreshCw, Smartphone, Key, ArrowRight, ShieldCheck } from 'lucide-react';

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
  const [emailOrPhone, setEmailOrPhone] = useState('');
  
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

  // OTP simulation states
  const [simulatedOtp, setSimulatedOtp] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize and load registered users
  useEffect(() => {
    const existing = localStorage.getItem('nova_registered_users');
    if (!existing) {
      localStorage.setItem('nova_registered_users', JSON.stringify(SEED_USERS));
    }
  }, []);

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

  // Parse if input is email or phone
  const isEmail = (val: string) => {
    return val.includes('@');
  };

  // Generate and send OTP simulation
  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Initial validations
    const cleanInput = emailOrPhone.trim();
    if (!cleanInput) {
      setError('Please provide an Email Address or Phone Number.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please provide your Full Name to register.');
      return;
    }

    setIsSubmitting(true);

    // Simulate small backend check lookup
    setTimeout(() => {
      const registeredUsers: RegisterUser[] = JSON.parse(
        localStorage.getItem('nova_registered_users') || JSON.stringify(SEED_USERS)
      );

      // Check if user exists for login mode
      if (mode === 'login') {
        const found = registeredUsers.find(
          (u) => u.email.toLowerCase() === cleanInput.toLowerCase() || u.phone.replace(/\s+/g, '') === cleanInput.replace(/\s+/g, '')
        );

        if (!found) {
          setError('We could not find an account with that email or phone. Switch to "Sign Up" above to register brand new!');
          setIsSubmitting(false);
          return;
        }
      } else {
        // Sign-up: Check if user already exists
        const exists = registeredUsers.some(
          (u) => u.email.toLowerCase() === cleanInput.toLowerCase() || u.phone.replace(/\s+/g, '') === cleanInput.replace(/\s+/g, '')
        );

        if (exists) {
          setError('This email/phone is already registered. If you have an account already, switch to Login!');
          setIsSubmitting(false);
          return;
        }
      }

      // Generate random 6-digit verification code
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      setSimulatedOtp(generatedCode);
      setCountdown(59); // 1-minute cooling down timer
      setStep('otp');
      setIsSubmitting(false);
      
      // Fire up a simulation notification banner at top of screen
      const typeLabel = isEmail(cleanInput) ? 'Email Inbox' : 'SMS secure link';
      setNotification({
        message: `[SIMULATED PUSH] NOVA verification code sent to your ${typeLabel}: ${generatedCode}. Expiration in 5 mins.`,
        visible: true
      });
      setOtp(['', '', '', '', '', '']); // reset input
      
      // Trigger focus of first input block in next tick
      setTimeout(() => {
        otpRefs[0].current?.focus();
      }, 100);

    }, 800);
  };

  // Resend code simulated handler
  const handleResendOtp = () => {
    if (countdown > 0) return;
    setError(null);
    setSuccess(null);
    
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedOtp(generatedCode);
    setCountdown(59);
    
    const typeLabel = isEmail(emailOrPhone) ? 'Email' : 'SMS';
    setNotification({
      message: `[RESENT SIMULATED] New verification code sent to your ${typeLabel}: ${generatedCode}`,
      visible: true
    });
    setOtp(['', '', '', '', '', '']);
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

  // OTP form submission
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const enteredCode = otp.join('');
    if (enteredCode.length < 6) {
      setError('Please input all 6 numeric digits of your verification code.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      if (enteredCode !== simulatedOtp) {
        setError('Incorrect verification code. Please try again or resend.');
        setIsSubmitting(false);
        return;
      }

      // Success flows
      setSuccess('Verification successful!');
      
      const registeredUsers: RegisterUser[] = JSON.parse(
        localStorage.getItem('nova_registered_users') || JSON.stringify(SEED_USERS)
      );

      let finalName = '';
      let finalEmail = '';
      let finalPhone = '';

      if (mode === 'signup') {
        // Registering a brand new account
        const sanitizedInput = emailOrPhone.trim();
        const detectedEmail = isEmail(sanitizedInput) ? sanitizedInput : `${name.toLowerCase().replace(/\s+/g, '')}@nova.ai`;
        const detectedPhone = isEmail(sanitizedInput) ? '+91 99999 88888' : sanitizedInput;
        
        const newRecord: RegisterUser = {
          name: name.trim(),
          email: detectedEmail,
          phone: detectedPhone
        };

        const updatedUsers = [...registeredUsers, newRecord];
        localStorage.setItem('nova_registered_users', JSON.stringify(updatedUsers));
        
        finalName = newRecord.name;
        finalEmail = newRecord.email;
        finalPhone = newRecord.phone;
      } else {
        // Logging into an existing account
        const matched = registeredUsers.find(
          (u) => 
            u.email.toLowerCase() === emailOrPhone.trim().toLowerCase() || 
            u.phone.replace(/\s+/g, '') === emailOrPhone.trim().replace(/\s+/g, '')
        )!;
        finalName = matched.name;
        finalEmail = matched.email;
        finalPhone = matched.phone;
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onLoginSuccess(finalName, finalEmail, finalPhone, mode === 'signup');
      }, 500);

    }, 1000);
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 relative">
      
      {/* Immersive Mock Notifications Panel for OTP values */}
      <AnimatePresence>
        {notification.visible && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 inset-x-4 max-w-sm mx-auto z-50 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-indigo-500/30 flex gap-3 cursor-pointer"
            onClick={() => {
              // Auto-fill OTP on click for ultra cool convenience!
              if (simulatedOtp) {
                setOtp(simulatedOtp.split(''));
                setNotification(prev => ({ ...prev, visible: false }));
              }
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
              <span className="text-[9px] font-black text-amber-400 mt-1.5 block uppercase tracking-wider">💡 Click envelope to auto-fill code</span>
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

                {/* Email Address or Phone input field */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">Email or Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      {isEmail(emailOrPhone) ? <Mail className="w-4.5 h-4.5" /> : <Phone className="w-4.5 h-4.5" />}
                    </div>
                    <input
                      type="text"
                      placeholder={mode === 'login' ? 'arjun.mehta@email.com or +91 98765 43210' : 'Email or Mobile with +Country prefix'}
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                      required
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-1 ml-1 leading-tight">
                    {mode === 'login' 
                      ? '💡 Try: arjun.mehta@email.com or vijusaiya123@gmail.com' 
                      : '💡 Provide any dummy email or phone to register locally'}
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
                    Enter the 6-digit verification code sent securely to <span className="font-bold text-slate-800">{emailOrPhone}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => { setStep('input'); setError(null); }}
                    className="text-[11px] font-bold text-indigo-600 mt-1.5 hover:underline"
                  >
                    Change Email/Phone
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
