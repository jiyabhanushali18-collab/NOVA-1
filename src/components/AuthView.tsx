import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, User, Check, AlertCircle, RefreshCw, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';

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
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisterUser[]>([]);

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

  const normalizePhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (value.trim().startsWith('+')) {
      return `+${digits}`;
    }
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    }
    if (digits.length >= 11 && digits.length <= 15) {
      return `+${digits}`;
    }
    return '';
  };

  const isValidPhoneNumber = (value: string) => {
    return /^\+[1-9]\d{9,14}$/.test(value);
  };

  const loginWithPhone = async (phone: string, signupEmail?: string) => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const normalizedPhone = phone.replace(/\s+/g, '');
    const matched = registeredUsers.find(
      (u) => u.phone.replace(/\s+/g, '') === normalizedPhone
    );

    const finalPhone = normalizedPhone;
    const finalName = matched?.name || (mode === 'signup' ? name.trim() || 'Guest User' : 'Guest User');
    const finalEmail = matched?.email || (mode === 'signup' ? signupEmail?.trim().toLowerCase() || `${finalName.toLowerCase().replace(/\s+/g, '') || 'guest'}@nova.ai` : `${finalName.toLowerCase().replace(/\s+/g, '') || 'guest'}@nova.ai`);

    if (mode === 'signup' && !matched) {
      const newUser: RegisterUser = {
        name: name.trim() || 'Guest User',
        phone: finalPhone,
        email: finalEmail
      };
      const updatedUsers = [...registeredUsers.filter((u) => u.phone.replace(/\s+/g, '') !== finalPhone), newUser];
      localStorage.setItem('nova_registered_users', JSON.stringify(updatedUsers));
      setRegisteredUsers(updatedUsers);
    }

    setSuccess('Login successful! Redirecting you to Home.');
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess(finalName, finalEmail, finalPhone, mode === 'signup');
    }, 500);
  };

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

    let signupEmailValue: string | undefined;

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please provide your Full Name to register.');
        return;
      }
      if (!email.trim()) {
        setError('Please provide your email address to register.');
        return;
      }
      let normalizedEmail = email.trim().toLowerCase();
      // If user entered a username (no @), append @gmail.com
      if (normalizedEmail.includes('@')) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          setError('Please provide a valid email address.');
          return;
        }
      } else {
        normalizedEmail = `${normalizedEmail}@gmail.com`;
      }
      signupEmailValue = normalizedEmail;
    }

    await loginWithPhone(normalizedPhone, signupEmailValue);
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 relative">
      <div className="absolute top-[10%] left-[10%] w-36 h-36 rounded-full bg-indigo-400/10 blur-3xl"></div>
      <div className="absolute bottom-[10%] right-[10%] w-44 h-44 rounded-full bg-purple-400/10 blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white/95 backdrop-blur-3xl rounded-[32px] border border-indigo-100/65 shadow-2xl p-7 relative overflow-hidden flex flex-col"
      >
        <div className="flex flex-col items-center text-center pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-extrabold shadow-lg shadow-indigo-600/20 mb-3 hover:scale-105 transition-transform duration-300">
            N
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">NOVA VISION LABS</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5 tracking-wider uppercase font-mono">AR & AI Curation Engine</p>
        </div>

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

        <form onSubmit={handleRequestOtp} className="space-y-4 flex-grow flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="text-center pb-1">
              <p className="text-xs text-slate-500 leading-relaxed">
                {mode === 'login'
                  ? 'Enter your phone number to sign in instantly with dummy account data.'
                  : 'Create an account by entering your name, email, and phone number. You will be redirected home.'}
              </p>
            </div>

            {mode === 'signup' && (
              <>
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

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                      required={mode === 'signup'}
                    />
                  </div>
                </div>
              </>
            )}

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
                  ? 'Enter any valid phone number to sign in with dummy data.'
                  : 'Use your email and phone number to register and continue.'}
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex gap-2.5 text-rose-600 items-start text-left">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span className="text-[11px] font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex gap-2.5 text-emerald-600 items-start text-left">
                <Check className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span className="text-[11px] font-semibold leading-relaxed">{success}</span>
              </div>
            )}
          </div>

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
                  Continue to Home <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400 font-mono tracking-wide leading-none uppercase">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-500 leading-none" /> Secure Dummy Login Enabled
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
