import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, User, Check, AlertCircle, RefreshCw, ArrowRight, ShieldCheck, ChevronDown, LockKeyhole, UserRound, Sparkles, Plus, CalendarDays, Clock3, MapPin, Loader2 } from 'lucide-react';
import { apiUrl } from '../services/apiClient';
import { COUNTRIES, Country } from '../utils/countries';
import { useI18n } from '../i18n';
import { LegalConsentRecord, LegalDocumentType } from '../types';
import { createConsentSnapshot } from '../legal/legalDocuments';
import { LegalDocumentView } from './LegalDocumentView';
import { fetchAddressSuggestions, verifyPincode, AddressSuggestion } from '../services/addressAutocompleteService';

interface AuthViewProps {
  onLoginSuccess: (
    name: string,
    email: string,
    phone: string,
    isSignUp?: boolean,
    address?: string,
    pinCode?: string,
    uid?: string,
    legalConsent?: LegalConsentRecord
  ) => void;
  onGuestContinue: () => void;
  onProceedToEmailVerification?: (
    email: string,
    name: string,
    address?: string,
    pinCode?: string,
    phone?: string,
    legalConsent?: LegalConsentRecord,
    isSignUp?: boolean
  ) => void;
  initialMode?: 'login' | 'signup';
  prefilledName?: string;
  prefilledAddress?: string;
  prefilledPinCode?: string;
}

interface RegisterUser {
  uid: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  pinCode?: string;
  username?: string;
  accountType?: 'Guest' | 'Registered' | 'Premium';
  avatar?: string;
  createdAt?: string;
  lastActive?: string;
  linkedPhone?: boolean;
}

// Initial seed accounts for outstanding out-of-the-box convenience!
const SEED_USERS: RegisterUser[] = [
  { uid: 'user_arjun_001', name: 'Arjun Mehta', username: 'arjun.style', email: 'arjun.mehta@email.com', phone: '+91 98765 43210', address: 'Flat 402, Elite Arcade, Near Metro Station, Indiranagar, Bangalore', pinCode: '560038', accountType: 'Registered', createdAt: '12 Feb 2026', lastActive: 'Today', linkedPhone: true },
  { uid: 'user_pratham_001', name: 'Pratham', username: 'pratham.nova', email: 'pratham@nova.ai', phone: '+91 98765 43210', address: 'Bldg 4A, Flat 502, Raheja Palms, Bandra West, Mumbai', pinCode: '400050', accountType: 'Premium', createdAt: '12 Feb 2026', lastActive: 'Today', linkedPhone: true },
  { uid: 'user_dad_001', name: 'Dad', username: 'shopping.profile', email: 'dad@nova.ai', phone: '+91 98765 43210', accountType: 'Registered', createdAt: '4 Jan 2026', lastActive: 'Yesterday', linkedPhone: true },
  { uid: 'user_mom_001', name: 'Mom', username: 'premium.profile', email: 'mom@nova.ai', phone: '+91 98765 43210', accountType: 'Premium', createdAt: '18 Dec 2025', lastActive: '3 days ago', linkedPhone: true },
  { uid: 'user_viju_001', name: 'Viju Saiya', username: 'vijusaiya', email: 'vijusaiya123@gmail.com', phone: '+91 91234 56789', address: 'Plot 18, Sector 44, Near HUDA City Centre, Gurugram', pinCode: '122003', accountType: 'Registered', createdAt: '22 May 2026', lastActive: 'Today', linkedPhone: true },
  { uid: 'guest_tester_001', name: 'Guest Tester', email: 'guest@nova.ai', phone: '+91 99999 88888', accountType: 'Guest', createdAt: '8 Jun 2026', lastActive: 'Last week', linkedPhone: false }
];

const normalizeStoredUser = (user: Partial<RegisterUser>, index: number): RegisterUser => ({
  uid: user.uid || `legacy_user_${index}_${(user.email || user.phone || 'account').replace(/[^a-z0-9]/gi, '_')}`,
  name: user.name || 'NOVA User',
  email: user.email || `legacy${index}@nova.ai`,
  phone: user.phone || '',
  address: user.address,
  pinCode: user.pinCode,
  username: user.username,
  accountType: user.accountType || 'Registered',
  avatar: user.avatar,
  createdAt: user.createdAt || 'Recently',
  lastActive: user.lastActive || 'Recently',
  linkedPhone: user.linkedPhone ?? user.accountType !== 'Guest'
});

const mergeSeedUsers = (users: RegisterUser[]) => {
  const byUid = new Map(users.map((user) => [user.uid, user]));
  SEED_USERS.forEach((seedUser) => {
    const existing = byUid.get(seedUser.uid);
    if (!existing) {
      byUid.set(seedUser.uid, seedUser);
    } else if (!existing.address && seedUser.address) {
      byUid.set(seedUser.uid, {
        ...existing,
        address: seedUser.address,
        pinCode: existing.pinCode || seedUser.pinCode
      });
    }
  });
  return Array.from(byUid.values());
};

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess, onGuestContinue, onProceedToEmailVerification, initialMode = 'login' }) => {
  const { t } = useI18n();


  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [entryPath, setEntryPath] = useState<'choice' | 'signin' | 'signup' | 'account-selection'>(initialMode === 'signup' ? 'signup' : 'choice');
  
  // Form input fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const addressDropdownRef = useRef<HTMLDivElement>(null);
  const addressLookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Default to India
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);

  // Required legal consent state (unchecked by default)
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocumentType | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisterUser[]>([]);
  const [matchingAccounts, setMatchingAccounts] = useState<RegisterUser[]>([]);
  const [selectedAccountUid, setSelectedAccountUid] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem('nova_registered_users');
    if (!existing) {
      localStorage.setItem('nova_registered_users', JSON.stringify(SEED_USERS));
      setRegisteredUsers(SEED_USERS);
    } else {
      try {
        const parsed = JSON.parse(existing) as Partial<RegisterUser>[];
        const migratedUsers = mergeSeedUsers(parsed.map(normalizeStoredUser));
        localStorage.setItem('nova_registered_users', JSON.stringify(migratedUsers));
        setRegisteredUsers(migratedUsers);
      } catch {
        setRegisteredUsers(SEED_USERS);
        localStorage.setItem('nova_registered_users', JSON.stringify(SEED_USERS));
      }
    }
  }, []);

  const normalizePhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    // For the input field, we only accept digits without country code
    // The country code will be added when submitting
    if (digits.length >= 10 && digits.length <= 12) {
      return digits;
    }
    if (digits.length > 12) {
      return digits.slice(0, 12);
    }
    return digits;
  };

  const getFullPhoneNumber = (phone: string, country: Country) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    // Combine country code with phone digits
    return `${country.dialCode}${digits}`;
  };

  const isValidPhoneNumber = (value: string) => {
  return /^\+[1-9]\d{9,14}$/.test(value);
};

  const resetAlerts = () => {
    setError(null);
    setSuccess(null);
    setConsentError(null);
  };

  const clearFormFields = () => {
    setName('');
    setEmail('');
    setPhoneNumber('');
    setAddress('');
    setCity('');
    setState('');
    setPinCode('');
    setHasAcceptedLegal(false);
    setConsentError(null);
    setShowAddressDropdown(false);
    setAddressSuggestions([]);
  };

  const goToChoice = () => {
    setEntryPath('choice');
    setMode('login');
    setPhoneNumber('');
    setMatchingAccounts([]);
    setSelectedAccountUid(null);
    setActiveLegalDoc(null);
    clearFormFields();
    resetAlerts();
  };

  const goToSignIn = () => {
    setEntryPath('signin');
    setMode('login');
    setActiveLegalDoc(null);
    clearFormFields();
    resetAlerts();
  };

  const goToSignup = () => {
    setEntryPath('signup');
    setMode('signup');
    setActiveLegalDoc(null);
    clearFormFields();
    resetAlerts();
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (addressDropdownRef.current && !addressDropdownRef.current.contains(event.target as Node)) {
        setShowAddressDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleAddressChange = (val: string) => {
    setAddress(val);
    setShowAddressDropdown(true);

    if (addressLookupTimeoutRef.current) {
      clearTimeout(addressLookupTimeoutRef.current);
    }

    if (val.trim().length >= 2) {
      setIsSearchingAddress(true);
      addressLookupTimeoutRef.current = setTimeout(async () => {
        try {
          const suggestions = await fetchAddressSuggestions(val);
          setAddressSuggestions(suggestions);
        } catch {
          setAddressSuggestions([]);
        } finally {
          setIsSearchingAddress(false);
        }
      }, 250);
    } else {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
    }
  };

  const handleSelectSuggestion = (sug: AddressSuggestion) => {
    setAddress(sug.formattedAddress || sug.title);
    if (sug.city) setCity(sug.city);
    if (sug.state) setState(sug.state);
    if (sug.pinCode) setPinCode(sug.pinCode);
    setShowAddressDropdown(false);
  };

  const handlePinCodeChange = async (val: string) => {
    setPinCode(val);
    if (val.length === 6) {
      const res = await verifyPincode(val);
      if (res.valid) {
        if (res.city && !city) setCity(res.city);
        if (res.state && !state) setState(res.state);
      }
    }
  };

  const findAccountsByPhone = (phone: string) => {
    const normalizedPhone = phone.replace(/\s+/g, '');
    return registeredUsers.filter((user) => (
      user.phone.replace(/\s+/g, '') === normalizedPhone
      && user.accountType !== 'Guest'
      && user.linkedPhone !== false
    ));
  };

  const loginWithAccount = async (
    account: RegisterUser,
    phone: string,
    isSignUp = false,
    signupAddress?: string,
    signupPinCode?: string,
    legalConsent?: LegalConsentRecord
  ) => {
    if (!isSignUp) {
      const normalizedEmail = account.email.trim().toLowerCase();
      if (!onProceedToEmailVerification || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError('This account does not have a valid email address for secure sign-in.');
        setIsSubmitting(false);
        return;
      }

      try {
        const response = await fetch(apiUrl('/api/auth/send-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, isSignup: false }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          setError(data.error || 'Could not send a sign-in code. Please try again.');
          setIsSubmitting(false);
          return;
        }

        onProceedToEmailVerification(
          normalizedEmail,
          account.name,
          account.address,
          account.pinCode,
          phone,
          undefined,
          false
        );
        return;
      } catch (err) {
        console.error('Error sending sign-in OTP:', err);
        setError('Could not send a sign-in code. Please check your connection and try again.');
        setIsSubmitting(false);
        return;
      }
    }

    setSuccess('Login successful! Redirecting you to Home.');
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess(
        account.name,
        account.email,
        phone,
        isSignUp,
        signupAddress?.trim() || account.address,
        signupPinCode?.trim() || account.pinCode,
        account.uid,
        legalConsent
      );
    }, 500);
  };

  const loginWithPhone = async (phone: string, country: Country, signupEmail?: string, signupAddress?: string, signupPinCode?: string) => {
    if (isSubmitting) return;
    setError(null);
    setSuccess(null);
    setConsentError(null);

    if (mode === 'signup' && !hasAcceptedLegal) {
      setConsentError(t('auth.errorLegalConsent'));
      return;
    }

    setIsSubmitting(true);

    const fullPhone = getFullPhoneNumber(phone, country);
    const normalizedPhone = fullPhone.replace(/\s+/g, '');
    const matches = findAccountsByPhone(normalizedPhone);

    if (mode === 'login' && matches.length === 0) {
      setError(t('auth.notRegistered'));
      setIsSubmitting(false);
      return;
    }

    if (mode === 'login' && matches.length > 1) {
      setMatchingAccounts(matches);
      setSelectedAccountUid(null);
      setEntryPath('account-selection');
      setIsSubmitting(false);
      return;
    }

    const matched = matches[0];

    const finalPhone = normalizedPhone;
    const finalName = matched?.name || name.trim() || 'NOVA User';
    const finalEmail = matched?.email || signupEmail?.trim().toLowerCase() || `${finalName.toLowerCase().replace(/\s+/g, '') || 'novauser'}@nova.ai`;
    const consentRecord = mode === 'signup' && hasAcceptedLegal
      ? createConsentSnapshot({ email: finalEmail, source: 'signup' })
      : undefined;

    if (mode === 'signup' && !matched) {
      const newUser: RegisterUser = {
        uid: `user_${Date.now()}`,
        name: name.trim() || 'NOVA User',
        phone: finalPhone,
        email: finalEmail,
        address: signupAddress?.trim(),
        pinCode: signupPinCode?.trim(),
        username: finalEmail.split('@')[0],
        accountType: 'Registered',
        createdAt: 'Today',
        lastActive: 'Today',
        linkedPhone: true
      };
      const updatedUsers = [newUser, ...registeredUsers.filter((u) => u.uid !== newUser.uid)];
      localStorage.setItem('nova_registered_users', JSON.stringify(updatedUsers));
      setRegisteredUsers(updatedUsers);
      await loginWithAccount(newUser, finalPhone, true, signupAddress, signupPinCode, consentRecord);
      return;
    }

    await loginWithAccount({
      uid: matched?.uid || finalEmail,
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      address: matched?.address,
      pinCode: matched?.pinCode,
      username: matched?.username,
      accountType: matched?.accountType || 'Registered',
      avatar: matched?.avatar,
      createdAt: matched?.createdAt,
      lastActive: matched?.lastActive
    }, finalPhone, mode === 'signup', signupAddress, signupPinCode, consentRecord);
  };

  const handleSelectAccount = async (account: RegisterUser) => {
    setSelectedAccountUid(account.uid);
    setIsSubmitting(true);
    const fullPhone = getFullPhoneNumber(phoneNumber.trim(), selectedCountry).replace(/\s+/g, '');
    await loginWithAccount(account, fullPhone);
  };

  const handleSignupWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setSuccess(null);
    setConsentError(null);

    // Validate inputs
    if (!name.trim()) {
      setError(t('auth.errorNameRequired'));
      return;
    }

    if (!email.trim()) {
      setError(t('auth.errorEmailRequired'));
      return;
    }

    if (pinCode.trim() && !/^\d{6}$/.test(pinCode.trim())) {
      setError(t('auth.errorPinInvalid'));
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    if (!normalizedEmail.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(t('auth.errorEmailInvalid'));
      return;
    }

    const cleanPhone = phoneNumber.trim();
    const fullPhone = getFullPhoneNumber(cleanPhone, selectedCountry);
    if (!cleanPhone) {
      setError(t('auth.errorPhoneRequired'));
      return;
    }
    if (!isValidPhoneNumber(fullPhone)) {
      setError(t('auth.errorPhoneInvalid', { country: selectedCountry.name }));
      return;
    }

    // Enforce explicit legal consent before submitting registration
    if (!hasAcceptedLegal) {
      setConsentError("Please read and agree to NOVA's Terms & Conditions and Privacy Policy before creating an account.");
      return;
    }

    const consentSnapshot = createConsentSnapshot({
      email: normalizedEmail,
      source: 'signup',
    });

    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          isSignup: true,
          legalConsent: consentSnapshot,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || t('auth.errorSendFailed'));
        setIsSubmitting(false);
        return;
      }
      setSuccess(t('auth.codeSentSuccess'));
      setIsSubmitting(false);
      if (onProceedToEmailVerification) {
        onProceedToEmailVerification(
          normalizedEmail,
          name.trim(),
          (() => {
            const parts = [address.trim()];
            if (city.trim() && !address.toLowerCase().includes(city.toLowerCase())) parts.push(city.trim());
            if (state.trim() && !address.toLowerCase().includes(state.toLowerCase())) parts.push(state.trim());
            return parts.filter(Boolean).join(', ') || undefined;
          })(),
          pinCode.trim() || undefined,
          fullPhone,
          consentSnapshot,
          true
        );
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError(t('auth.errorSendNetwork'));
      setIsSubmitting(false);
    }
  };
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For signup, use email-based verification flow
    if (mode === 'signup') {
      await handleSignupWithEmail(e);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError('Please provide a valid email address.');
        return;
      }

      setError(null);
      setSuccess(null);
      setIsSubmitting(true);
      const account = registeredUsers.find(
        (user) => user.accountType !== 'Guest' && user.email.trim().toLowerCase() === normalizedEmail
      );
      await loginWithAccount(
        account || {
          uid: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          email: normalizedEmail,
          phone: '',
          accountType: 'Registered'
        },
        account?.phone || ''
      );
      return;
    }

    // For login, continue with phone-based flow
    setError(null);
    setSuccess(null);

    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone) {
      setError(`Please provide your phone number.`);
      return;
    }

    const fullPhone = getFullPhoneNumber(cleanPhone, selectedCountry);
    if (!isValidPhoneNumber(fullPhone)) {
      setError(`Please provide a valid phone number for ${selectedCountry.name}.`);
      return;
    }

    await loginWithPhone(cleanPhone, selectedCountry);
  };

  if (activeLegalDoc) {
    return (
      <div className="min-h-[85vh] py-4 px-1">
        <LegalDocumentView
          documentType={activeLegalDoc}
          onSelectDocument={(docType) => setActiveLegalDoc(docType)}
          onBack={() => setActiveLegalDoc(null)}
          backLabel={mode === 'signup' ? 'Back to Create Account' : 'Back'}
          isDarkMode={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 relative">

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-[28px] border border-[#E4DFF5] shadow-xl shadow-[#553BE2]/8 p-7 relative overflow-hidden flex flex-col"
      >
        <div className="flex flex-col items-center text-center pb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#553BE2] flex items-center justify-center text-white font-extrabold shadow-lg shadow-[#553BE2]/25 mb-3 hover:scale-105 transition-transform duration-300">
            N
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#131426]">NOVA</h2>
          <p className="text-xs font-bold text-[#5E667A] mt-0.5 tracking-wider uppercase font-mono">{t('app.curationEngine')}</p>
        </div>

        <AnimatePresence mode="wait">
          {entryPath === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <motion.div whileHover={{ y: -3, scale: 1.01 }} className="rounded-[24px] border border-[#E4DFF5] bg-[#F2EEFF]/55 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center">
                      <UserRound className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-[#131426]">{t('auth.continueAsGuest')}</h3>
                      <p className="text-[11px] text-[#5E667A] leading-relaxed mt-1">{t('auth.guestDescription')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onGuestContinue}
                    className="mt-4 w-full py-3 px-4 rounded-2xl bg-[#553BE2] hover:bg-[#462CC9] text-white text-xs font-bold shadow-lg shadow-[#553BE2]/25 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] overflow-hidden"
                  >
                    {t('auth.continueAsGuest')} <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>

                <motion.div whileHover={{ y: -3, scale: 1.01 }} className="rounded-[24px] border border-[#E4DFF5] bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center">
                      <LockKeyhole className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-[#131426]">{t('auth.registeredUser')}</h3>
                      <p className="text-[11px] text-[#5E667A] leading-relaxed mt-1">{t('auth.registeredDescription')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={goToSignIn}
                    className="mt-4 w-full py-3 px-4 rounded-2xl bg-white text-[#553BE2] text-xs font-bold border border-[#E4DFF5] shadow-sm flex items-center justify-center gap-1.5 transition-all hover:bg-[#F2EEFF] hover:border-[#553BE2]/30 active:scale-[0.98]"
                  >
                    {t('auth.signIn')} <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              </div>

              <div className="pt-2 text-center space-y-2">
                <p className="text-[11px] font-semibold text-[#5E667A]">{t('auth.savePrompt')}</p>
                <button type="button" onClick={goToSignup} className="text-xs font-black text-[#553BE2] hover:text-[#462CC9]">
                  {t('auth.createAccount')}
                </button>
                <p className="text-[9px] text-[#5E667A] leading-relaxed">{t('auth.guestWarning')}</p>
              </div>
            </motion.div>
          ) : entryPath === 'account-selection' ? (
            <motion.div
              key="account-selection"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="text-center">
                <h3 className="text-xl font-black tracking-tight text-[#131426]">{t('auth.chooseAccountTitle')}</h3>
                <p className="text-xs text-[#5E667A] leading-relaxed mt-2">
                  {t('auth.chooseAccountFound')}
                </p>
                <p className="text-xs text-[#5E667A] leading-relaxed">
                  {t('auth.chooseAccountPrompt')}
                </p>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 hide-scrollbar">
                {matchingAccounts.map((account, index) => {
                  const isSelected = selectedAccountUid === account.uid;
                  const initials = account.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join('') || 'N';

                  return (
                    <motion.div
                      key={account.uid}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 1.02 }}
                      className={`rounded-[24px] bg-white p-[1px] shadow-sm transition-all duration-300 ${
                        isSelected
                          ? 'bg-[#553BE2] shadow-[#553BE2]/20'
                          : 'border border-[#E4DFF5]'
                      }`}
                    >
                      <div className="rounded-[23px] bg-white p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center font-black shadow-inner overflow-hidden">
                            {account.avatar ? (
                              <img src={account.avatar} alt={account.name} className="w-full h-full object-cover" />
                            ) : (
                              initials
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="text-sm font-black text-[#131426] truncate">{account.name}</h4>
                                {account.username && <p className="text-[10px] font-semibold text-[#5E667A] truncate">@{account.username}</p>}
                              </div>
                              <div className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${
                                account.accountType === 'Premium'
                                  ? 'bg-[#F2EEFF] text-[#553BE2]'
                                  : 'bg-[#F2EEFF] text-[#5E667A]'
                              }`}>
                                {account.accountType || 'Registered'}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <div className="rounded-2xl bg-[#F2EEFF] px-3 py-2 border border-[#E4DFF5]/60">
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#5E667A]">
                                  <CalendarDays className="w-3 h-3" /> {t('common.created')}
                                </div>
                                <p className="text-[10px] font-bold text-[#131426] mt-1">{account.createdAt || 'Recently'}</p>
                              </div>
                              <div className="rounded-2xl bg-[#F2EEFF] px-3 py-2 border border-[#E4DFF5]/60">
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#5E667A]">
                                  <Clock3 className="w-3 h-3" /> {t('common.lastActive')}
                                </div>
                                <p className="text-[10px] font-bold text-[#131426] mt-1">{account.lastActive || 'Recently'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelectAccount(account)}
                          className={`mt-4 w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-70 ${
                            isSelected
                              ? 'bg-[#553BE2] text-white shadow-lg shadow-[#553BE2]/25'
                              : 'bg-[#F2EEFF] text-[#553BE2] hover:bg-[#ECE7FF]'
                          }`}
                        >
                          {isSelected && isSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : isSelected ? (
                            <>
                              <Check className="w-4 h-4" /> Continue
                            </>
                          ) : (
                            <>
                              {t('auth.continue')} <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="pt-1 space-y-2 text-center">
                <button type="button" onClick={goToSignup} className="w-full py-2.5 rounded-2xl text-xs font-black text-[#553BE2] bg-[#F2EEFF] hover:bg-[#ECE7FF] flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> {t('auth.createNewAccount')}
                </button>
                <button type="button" onClick={goToSignIn} className="w-full py-2 text-xs font-bold text-[#5E667A] hover:text-[#131426]">
                  {t('auth.useDifferentPhone')}
                </button>
                <button type="button" onClick={goToChoice} className="w-full py-2 text-xs font-bold text-[#5E667A] hover:text-[#131426]">
                  {t('auth.back')}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key={entryPath}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleRequestOtp}
              className="space-y-4 flex-grow flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                <div className="text-center pb-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F2EEFF] border border-[#E4DFF5] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#553BE2] mb-3">
                    {mode === 'login' ? <LockKeyhole className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {mode === 'login' ? t('auth.registeredUser') : t('auth.createAccount')}
                  </div>
                  <p className="text-xs text-[#5E667A] leading-relaxed">
                    {mode === 'login' ? t('auth.signInSubtitle') : t('auth.signUpSubtitle')}
                  </p>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-[#5E667A] uppercase tracking-widest block ml-1 leading-none">{mode === 'login' ? t('auth.emailLabelRecommended') : t('auth.emailLabel')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5E667A]">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder-[#8E96AA] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all shadow-sm"
                      required={mode === 'signup'}
                    />
                  </div>
                </div>

                {mode === 'signup' && (
              <>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-[#5E667A] uppercase tracking-widest block ml-1 leading-none">{t('auth.fullNameLabel')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5E667A]">
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="text"
                      placeholder={t('auth.fullNamePlaceholder')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder-[#8E96AA] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all shadow-sm"
                      required={mode === 'signup'}
                    />
                  </div>
                </div>

                {/* Delivery Address with Smart Autocomplete */}
                <div className="space-y-1 text-left relative" ref={addressDropdownRef}>
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-[#5E667A] uppercase tracking-widest leading-none">
                      {t('auth.addressLabel')}
                    </label>
                    {isSearchingAddress && (
                      <span className="text-[9px] text-[#553BE2] font-semibold flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Suggestions...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5E667A]">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="House/Flat, Street, Area"
                      value={address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      onFocus={() => {
                        if (addressSuggestions.length > 0) setShowAddressDropdown(true);
                      }}
                      className="w-full pl-9 pr-8 py-3 bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder-[#8E96AA] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all shadow-sm"
                      autoComplete="street-address"
                    />
                    {address && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddress('');
                          setAddressSuggestions([]);
                          setShowAddressDropdown(false);
                        }}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#8E96AA] hover:text-[#5E667A]"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>

                  {/* Smart Suggestions Dropdown */}
                  {showAddressDropdown && addressSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E4DFF5] rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-[#F2EEFF] animate-scale-up max-h-56 overflow-y-auto">
                      <div className="px-3 py-1.5 bg-[#FAF8FE] border-b border-[#E4DFF5] flex items-center justify-between text-[10px] font-bold text-[#5E667A]">
                        <span className="flex items-center gap-1 text-[#553BE2]">
                          <Sparkles className="w-3 h-3" /> Suggested Locations
                        </span>
                        <span>Mumbai &amp; India</span>
                      </div>
                      {addressSuggestions.map((sug) => (
                        <button
                          key={sug.id}
                          type="button"
                          onClick={() => handleSelectSuggestion(sug)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-[#F2EEFF] transition-colors flex items-start gap-2.5 group cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#553BE2] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[#131426] truncate">
                              {sug.title}
                            </div>
                            <div className="text-[10px] text-[#5E667A] truncate">
                              {sug.subtitle}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Structured City and State fields */}
                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#5E667A] uppercase tracking-widest block ml-1 leading-none">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder-[#8E96AA] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all shadow-sm"
                      autoComplete="address-level2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#5E667A] uppercase tracking-widest block ml-1 leading-none">
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder-[#8E96AA] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all shadow-sm"
                      autoComplete="address-level1"
                    />
                  </div>
                </div>

                {/* 6-Digit PIN Code */}
                <div className="space-y-1 text-left">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-[#5E667A] uppercase tracking-widest leading-none">
                      {t('auth.pinCodeLabel')}
                    </label>
                    {pinCode.length === 6 && (
                      <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> 6-digit format
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="6-digit PIN code (e.g. 400062)"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => handlePinCodeChange(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-3 pr-4 py-2.5 bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder-[#8E96AA] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all shadow-sm"
                      autoComplete="postal-code"
                    />
                  </div>
                </div>
              </>
                )}

                <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-[#5E667A] uppercase tracking-widest block ml-1 leading-none">{t('auth.phoneNumber')}</label>
              <div className="flex gap-2">
                {/* Country Selector Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                    className="h-[42px] px-3 bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl font-semibold text-xs flex items-center gap-2 hover:bg-white hover:border-[#553BE2] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all shadow-sm whitespace-nowrap"
                  >
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span className="text-[#131426]">{selectedCountry.dialCode}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#5E667A]" />
                  </button>

                  {/* Country Dropdown Menu */}
                  {isCountryDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 max-h-64 bg-white border border-[#E4DFF5] rounded-xl shadow-lg z-50 overflow-y-auto">
                      <div className="sticky top-0 p-2 bg-white border-b border-[#E4DFF5]">
                        <input
                          type="text"
                          placeholder="Search country..."
                          className="w-full px-3 py-2 text-xs border border-[#E4DFF5] rounded-lg focus:outline-none focus:border-[#553BE2] focus:ring-1 focus:ring-[#553BE2]"
                          onChange={(e) => {
                            // Could be used for filtering countries
                          }}
                        />
                      </div>
                      {COUNTRIES.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(country);
                            setIsCountryDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 hover:bg-[#F2EEFF] transition-colors ${
                            selectedCountry.code === country.code ? 'bg-[#F2EEFF] text-[#553BE2]' : 'text-[#131426]'
                          }`}
                        >
                          <span className="text-base w-6">{country.flag}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[#131426] truncate">{country.name}</div>
                            <div className="text-[#5E667A] text-[10px]">{country.dialCode}</div>
                          </div>
                          {selectedCountry.code === country.code && (
                            <Check className="w-4 h-4 text-[#553BE2] shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone Number Input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5E667A]">
                    <Phone className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(normalizePhoneNumber(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-[#F2EEFF]/70 border border-[#E4DFF5] rounded-xl text-xs font-semibold text-[#131426] placeholder-[#8E96AA] focus:outline-none focus:border-[#553BE2] focus:bg-white focus:ring-1 focus:ring-[#553BE2] transition-all shadow-sm"
                    required={mode === 'signup'}
                  />
                </div>
              </div>
                  <span className="text-[9px] text-[#5E667A] block mt-1 ml-1 leading-tight">
                    {mode === 'login'
                      ? 'If you sign in with email above, you do not need to enter a phone number.'
                      : 'Use a valid phone number to register and continue.'}
                  </span>
                </div>

                {mode === 'signup' && (
                  <div className="space-y-1.5 text-left pt-1">
                    <label
                      htmlFor="nova-signup-legal-consent"
                      className={`flex items-start gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                        consentError
                          ? 'bg-rose-50/70 border-rose-200'
                          : hasAcceptedLegal
                          ? 'bg-[#F2EEFF] border-[#553BE2]/40'
                          : 'bg-[#F2EEFF]/60 border-[#E4DFF5] hover:border-[#553BE2]/30'
                      }`}
                    >
                      <input
                        id="nova-signup-legal-consent"
                        type="checkbox"
                        checked={hasAcceptedLegal}
                        onChange={(e) => {
                          setHasAcceptedLegal(e.target.checked);
                          if (e.target.checked) {
                            setConsentError(null);
                          }
                        }}
                        aria-required="true"
                        aria-invalid={Boolean(consentError)}
                        aria-describedby={consentError ? 'signup-legal-consent-error' : undefined}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D5CBF7] text-[#553BE2] focus:ring-[#553BE2] accent-[#553BE2] cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-[#131426] leading-relaxed">
                        I have read and agree to NOVA&apos;s{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveLegalDoc('terms');
                          }}
                          className="font-bold text-[#553BE2] hover:text-[#462CC9] underline underline-offset-2 focus:outline-none focus:ring-1 focus:ring-[#553BE2] rounded px-0.5 cursor-pointer"
                        >
                          Terms &amp; Conditions
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveLegalDoc('privacy');
                          }}
                          className="font-bold text-[#553BE2] hover:text-[#462CC9] underline underline-offset-2 focus:outline-none focus:ring-1 focus:ring-[#553BE2] rounded px-0.5 cursor-pointer"
                        >
                          Privacy Policy
                        </button>
                        .
                      </span>
                    </label>

                    {consentError && (
                      <div
                        id="signup-legal-consent-error"
                        role="alert"
                        aria-live="assertive"
                        className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-600 text-left"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-semibold leading-snug">{consentError}</span>
                      </div>
                    )}
                  </div>
                )}

                {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex gap-2.5 text-rose-600 items-start text-left">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-[11px] font-semibold leading-relaxed">{error}</span>
                  {mode === 'login' && error === t('auth.notRegistered') && (
                    <div className="flex gap-2 mt-3">
                      <button type="button" onClick={goToSignup} className="px-3 py-2 rounded-xl bg-white text-rose-600 border border-rose-100 text-[10px] font-black">
                        {t('auth.createAccount')}
                      </button>
                      <button type="button" onClick={goToChoice} className="px-3 py-2 rounded-xl bg-rose-100/60 text-rose-600 text-[10px] font-black">
                        {t('auth.back')}
                      </button>
                    </div>
                  )}
                </div>
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
                  aria-disabled={mode === 'signup' && !hasAcceptedLegal}
                  className={`w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all outline-none focus:ring-2 focus:ring-[#553BE2]/40 cursor-pointer disabled:opacity-70 active:scale-[0.98] ${
                    mode === 'signup' && !hasAcceptedLegal
                      ? 'bg-[#553BE2]/80 hover:bg-[#553BE2] text-white/95 shadow-sm'
                      : 'bg-[#553BE2] hover:bg-[#462CC9] text-white shadow-lg shadow-[#553BE2]/25'
                  }`}
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {mode === 'login' ? t('auth.continue') : t('auth.createAccount')} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button type="button" onClick={goToChoice} className="w-full py-2 text-xs font-bold text-[#5E667A] hover:text-[#131426]">
                  {t('auth.back')}
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[#5E667A] font-mono tracking-wide leading-none uppercase">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-500 leading-none" /> Guest and registered flows separated
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
