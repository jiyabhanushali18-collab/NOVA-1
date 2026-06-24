import React, { useState } from 'react';
import { ScreenId, Measurement, NovaAnalysisProfile, Preference, NovaAccount } from '../types';
import AccountSwitcherModal from './accounts/AccountSwitcherModal';
import { initialMeasurements, initialPreferences, products } from '../data';

interface ProfileViewProps {
  onNavigate: (screen: ScreenId) => void;
  userName: string;
  setUserName: (name: string) => void;
  userEmail?: string;
  userPhone?: string;
  profilePhoto?: string;
  analysisProfile?: NovaAnalysisProfile | null;
  onLogout: () => void;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  onAddToCart?: (prodId: string, color: string, size: string) => void;
  measurements?: Measurement[];
  onUpdateMeasurements?: (measurements: Measurement[]) => void;
  preferences?: Preference[];
  onUpdatePreferences?: (preferences: Preference[]) => void;
  isDarkMode?: boolean;
  setIsDarkMode?: (isDark: boolean) => void;
  novaPoints?: number;
  novaLevel?: number;
  pointsToNextLevel?: number;
  levelProgress?: number;
  // account management
  accounts?: NovaAccount[];
  activeUid?: string;
  onAddAccount?: (acc: NovaAccount) => void;
  onRemoveAccount?: (uid: string) => void;
  onSwitchAccount?: (uid?: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ 
  onNavigate, 
  userName,
  setUserName,
  userEmail = 'arjun.mehta@email.com',
  userPhone = '+91 98765 43210',
  profilePhoto,
  analysisProfile,
  onLogout,
  wishlist = [],
  onToggleWishlist,
  onAddToCart,
  measurements = initialMeasurements,
  onUpdateMeasurements,
  preferences = initialPreferences,
  onUpdatePreferences,
  isDarkMode = false,
  setIsDarkMode,
  novaPoints = 100,
  novaLevel = 1,
  pointsToNextLevel = 0,
  levelProgress = 0,
  accounts = [],
  activeUid,
  onAddAccount,
  onRemoveAccount,
  onSwitchAccount
}) => {
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [profileToast, setProfileToast] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Settings modals toggle states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAddressesModalOpen, setIsAddressesModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);

  // Payment Methods interactive state
  const [paymentMethods, setPaymentMethods] = useState(() => {
    try {
      const saved = localStorage.getItem('payment_methods');
      return saved ? JSON.parse(saved) : [
        { id: '1', type: 'Credit Card', provider: 'Visa Signature', number: '•••• •••• •••• 4235', cardholder: 'Arjun Mehta', expiry: '08/29', color: 'from-blue-600 via-indigo-600 to-purple-600' },
        { id: '2', type: 'UPI', provider: 'UPI Option', handle: 'arjunmehta@okaxis', isDefault: true, color: 'from-indigo-600 to-blue-500' }
      ];
    } catch {
      return [
        { id: '1', type: 'Credit Card', provider: 'Visa Signature', number: '•••• •••• •••• 4235', cardholder: 'Arjun Mehta', expiry: '08/29', color: 'from-blue-600 via-indigo-600 to-purple-600' },
        { id: '2', type: 'UPI', provider: 'UPI Option', handle: 'arjunmehta@okaxis', isDefault: true, color: 'from-indigo-600 to-blue-500' }
      ];
    }
  });

  // Saving Payment Methods changes
  React.useEffect(() => {
    localStorage.setItem('payment_methods', JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  // Temporary payment inputs states
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isAddingUPI, setIsAddingUPI] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardHolder, setNewCardHolder] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newUPIHandle, setNewUPIHandle] = useState('');

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardNumber || !newCardHolder || !newCardExpiry) {
      setProfileToast('Please specify card credentials');
      setTimeout(() => setProfileToast(null), 2500);
      return;
    }
    // Clean card number format display
    const lastDigits = newCardNumber.replace(/\D/g, '').slice(-4) || '1111';
    const formattedNumber = `•••• •••• •••• ${lastDigits}`;
    const newCard = {
      id: Date.now().toString(),
      type: 'Credit Card',
      provider: 'Mastercard Premium',
      number: formattedNumber,
      cardholder: newCardHolder,
      expiry: newCardExpiry,
      color: 'from-purple-600 via-indigo-600 to-blue-600'
    };
    setPaymentMethods([...paymentMethods, newCard]);
    setIsAddingCard(false);
    setNewCardNumber('');
    setNewCardHolder('');
    setNewCardExpiry('');
    setProfileToast('💳 New Credit Card added successfully!');
    setTimeout(() => setProfileToast(null), 2500);
  };

  const handleAddUPI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUPIHandle) {
      setProfileToast('Please write a valid UPI handle');
      setTimeout(() => setProfileToast(null), 2500);
      return;
    }
    const cleanHandle = newUPIHandle.includes('@') ? newUPIHandle : `${newUPIHandle}@oknova`;
    const newUPI = {
      id: Date.now().toString(),
      type: 'UPI',
      provider: 'GPay/UPI',
      handle: cleanHandle,
      isDefault: false,
      color: 'from-blue-600 to-indigo-500'
    };
    setPaymentMethods([...paymentMethods, newUPI]);
    setIsAddingUPI(false);
    setNewUPIHandle('');
    setProfileToast('⚡ UPI ID registered successfully!');
    setTimeout(() => setProfileToast(null), 2500);
  };

  const handleDeletePayment = (id: string) => {
    const matched = paymentMethods.find(p => p.id === id);
    setPaymentMethods(paymentMethods.filter(p => p.id !== id));
    setProfileToast(`✕ Removed ${matched?.type === 'UPI' ? 'UPI Handle' : 'Card'} successfully`);
    setTimeout(() => setProfileToast(null), 2000);
  };

  // Addresses interactive state
  const [addresses, setAddresses] = useState(() => {
    try {
      const saved = localStorage.getItem('addresses');
      return saved ? JSON.parse(saved) : [
        { id: '1', label: 'Home (Default)', name: 'Arjun Mehta', street: 'Bldg 4A, Flat 502, Raheja Palms, Bandra West', city: 'Mumbai', state: 'Maharashtra', zip: '400050', phone: '+91 98765 43210', icon: 'home' },
        { id: '2', label: 'Office', name: 'Arjun Mehta', street: 'Nova Labs HQ, 3rd Floor, Indiranagar 100ft Road', city: 'Bangalore', state: 'Karnataka', zip: '560038', phone: '+91 98765 43210', icon: 'work' }
      ];
    } catch {
      return [
        { id: '1', label: 'Home (Default)', name: 'Arjun Mehta', street: 'Bldg 4A, Flat 502, Raheja Palms, Bandra West', city: 'Mumbai', state: 'Maharashtra', zip: '400050', phone: '+91 98765 43210', icon: 'home' },
        { id: '2', label: 'Office', name: 'Arjun Mehta', street: 'Nova Labs HQ, 3rd Floor, Indiranagar 100ft Road', city: 'Bangalore', state: 'Karnataka', zip: '560038', phone: '+91 98765 43210', icon: 'work' }
      ];
    }
  });

  // Saving Addresses changes
  React.useEffect(() => {
    localStorage.setItem('addresses', JSON.stringify(addresses));
  }, [addresses]);

  // Temporary address inputs states
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrName, setAddrName] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrZip, setAddrZip] = useState('');
  const [addrPhone, setAddrPhone] = useState('');

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrName || !addrStreet || !addrCity || !addrZip) {
      setProfileToast('Please fill out all mandatory address fields');
      setTimeout(() => setProfileToast(null), 2500);
      return;
    }
    const newAddr = {
      id: Date.now().toString(),
      label: addrLabel,
      name: addrName,
      street: addrStreet,
      city: addrCity,
      state: 'Karnataka',
      zip: addrZip,
      phone: addrPhone || userPhone,
      icon: addrLabel.toLowerCase().includes('office') || addrLabel.toLowerCase().includes('work') ? 'work' : 'home'
    };
    setAddresses([...addresses, newAddr]);
    setIsAddingAddress(false);
    setAddrName('');
    setAddrStreet('');
    setAddrCity('');
    setAddrZip('');
    setAddrPhone('');
    setProfileToast('📍 Saved new delivery address!');
    setTimeout(() => setProfileToast(null), 2500);
  };

  const handleDeleteAddress = (id: string) => {
    const matched = addresses.find(a => a.id === id);
    setAddresses(addresses.filter(a => a.id !== id));
    setProfileToast(`✕ Address "${matched?.label}" deleted`);
    setTimeout(() => setProfileToast(null), 2000);
  };

  // Privacy and security dynamic state
  const [privacySettings, setPrivacySettings] = useState(() => {
    try {
      const saved = localStorage.getItem('privacy_settings');
      return saved ? JSON.parse(saved) : {
        biometricLogin: true,
        twoFactorAuth: false,
        incognitoScan: false,
        personalizedAds: true,
        shareFittings: true
      };
    } catch {
      return {
        biometricLogin: true,
        twoFactorAuth: false,
        incognitoScan: false,
        personalizedAds: true,
        shareFittings: true
      };
    }
  });

  React.useEffect(() => {
    localStorage.setItem('privacy_settings', JSON.stringify(privacySettings));
  }, [privacySettings]);

  const togglePrivacyField = (field: keyof typeof privacySettings, label: string) => {
    const updated = { ...privacySettings, [field]: !privacySettings[field] };
    setPrivacySettings(updated);
    setProfileToast(`🛡️ ${label}: ${!privacySettings[field] ? 'ON' : 'OFF'}`);
    setTimeout(() => setProfileToast(null), 1500);
  };

  // Notifications toggle dynamic state
  const [notificationsSettings, setNotificationsSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('notifications_settings');
      return saved ? JSON.parse(saved) : {
        priceDrops: true,
        newArrivals: true,
        stylistReminders: true,
        orderUpdates: true,
        marketingReminders: false
      };
    } catch {
      return {
        priceDrops: true,
        newArrivals: true,
        stylistReminders: true,
        orderUpdates: true,
        marketingReminders: false
      };
    }
  });

  React.useEffect(() => {
    localStorage.setItem('notifications_settings', JSON.stringify(notificationsSettings));
  }, [notificationsSettings]);

  const toggleNotificationField = (field: keyof typeof notificationsSettings, label: string) => {
    const updated = { ...notificationsSettings, [field]: !notificationsSettings[field] };
    setNotificationsSettings(updated);
    setProfileToast(`🔔 ${label}: ${!notificationsSettings[field] ? 'ENABLED' : 'DISABLED'}`);
    setTimeout(() => setProfileToast(null), 1500);
  };

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    return localStorage.getItem('app_language') || 'English';
  });

  const handleLanguageSelect = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem('app_language', lang);
    setLanguageModalOpen(false);
    setProfileToast(`🌐 Language configured to: ${lang}`);
    setTimeout(() => setProfileToast(null), 2500);
  };

  const setLanguageModalOpen = (open: boolean) => {
    setIsLanguageModalOpen(open);
  };

  // Modal edit values states
  const [editHeight, setEditHeight] = useState('178 cm');
  const [editWeight, setEditWeight] = useState('68 kg');
  const [editChest, setEditChest] = useState('98 cm');
  const [editWaist, setEditWaist] = useState('82 cm');
  const [editInseam, setEditInseam] = useState('78 cm');

  // Sync edits if measurements change from external action (like onboarding)
  React.useEffect(() => {
    setEditHeight(measurements.find(m => m.label === 'Height')?.value || '178 cm');
    setEditWeight(measurements.find(m => m.label === 'Weight')?.value || '68 kg');
    setEditChest(measurements.find(m => m.label === 'Chest')?.value || '98 cm');
    setEditWaist(measurements.find(m => m.label === 'Waist')?.value || '82 cm');
    setEditInseam(measurements.find(m => m.label === 'Inseam')?.value || '78 cm');
  }, [measurements]);

  // Profile modal states
  const [profileName, setProfileName] = useState(userName);
  const [profileEmail, setProfileEmail] = useState(userEmail);
  const [profilePhone, setProfilePhone] = useState(userPhone);
  const [profileLocation, setProfileLocation] = useState('Bangalore, India');

  // Sync state if user settings change or log in with another account
  React.useEffect(() => {
    setProfileName(userName);
    setProfileEmail(userEmail);
    setProfilePhone(userPhone);
  }, [userName, userEmail, userPhone]);

  const handleSaveMeasurements = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = [
      { label: 'Height', value: editHeight, iconName: 'height' },
      { label: 'Weight', value: editWeight, iconName: 'fitness_center' },
      { label: 'Chest', value: editChest, iconName: 'checkroom' },
      { label: 'Waist', value: editWaist, iconName: 'straighten' },
      { label: 'Inseam', value: editInseam, iconName: 'architecture' }
    ];
    if (onUpdateMeasurements) {
      onUpdateMeasurements(updated);
    }
    setIsEditModalOpen(false);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUserName(profileName);
    setIsProfileModalOpen(false);
  };

  const handleLogout = () => {
    onLogout();
  };

  return (
    <div className="space-y-6">
      {/* User profile picture details card */}
      <section className="glass-card rounded-3xl p-5 flex items-center gap-4 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => setIsAccountModalOpen(true)}
            className="w-20 h-20 rounded-full overflow-hidden border-2 border-white shadow shadow-indigo-200/50 relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400"
            aria-label="Manage NOVA accounts"
          >
            <img 
              alt="Arjun Mehta user picture avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              src={profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'NOVA User')}&background=ede9fe&color=6d28d9&bold=true`}
            />
          </button>
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1.5 rounded-full shadow hover:scale-110 transition-transform flex items-center justify-center border border-white"
          >
            <span className="material-symbols-outlined text-[13px] leading-none">edit</span>
          </button>
        </div>

        <div className="flex-grow min-w-0 relative z-10 leading-normal">
          <div className="flex items-center justify-between gap-1 mb-1">
            <h2 className="text-xl font-bold text-slate-800 truncate">{userName}</h2>
            <span className="shrink-0 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase">Pro</span>
          </div>
          
          <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mb-1 bg-slate-50/80 p-0.5 rounded px-1.5">
            <span className="material-symbols-outlined text-[14px]">mail</span> {profileEmail}
          </p>
          <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mb-1 bg-slate-50/80 p-0.5 rounded px-1.5">
            <span className="material-symbols-outlined text-[14px]">phone</span> {profilePhone}
          </p>
          <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">location_on</span> {profileLocation}
          </p>
        </div>
      </section>

      {analysisProfile && (
        <section className="glass-card rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">auto_awesome</span>
              NOVA AI Profile
            </h3>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
              Synced
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Skin Tone', analysisProfile.skinTone],
              ['Undertone', analysisProfile.undertone],
              ['Face Shape', analysisProfile.faceShape],
              ['Hair', analysisProfile.hairType],
              ['Eyes', analysisProfile.eyeColor],
              ['Body Type', analysisProfile.bodyType],
              ['Fit', analysisProfile.recommendedFit],
              ['Eyewear', analysisProfile.eyewearSuggestions.join(', ')]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-violet-100 bg-white/70 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-700">{value || 'unknown'}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-violet-500">Recommended Colors</p>
            <p className="mt-1 text-xs font-bold text-violet-800">
              {analysisProfile.recommendedColors.length > 0 ? analysisProfile.recommendedColors.join(' • ') : 'unknown'}
            </p>
          </div>
        </section>
      )}

      {isAccountModalOpen && (
        <AccountSwitcherModal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          accounts={accounts || []}
          activeUid={activeUid}
          onSwitch={(uid) => { onSwitchAccount?.(uid); setIsAccountModalOpen(false); }}
          onAdd={(acc) => { onAddAccount?.(acc); setIsAccountModalOpen(false); }}
          onRemove={(uid) => { onRemoveAccount?.(uid); }}
          onLogout={onLogout}
        />
      )}
      {!isAccountModalOpen && (
        <div className="mt-3 text-right">
          <button type="button" onClick={() => setIsAccountModalOpen(true)} className="px-4 py-2 rounded-full bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition-colors">
            Manage Accounts
          </button>
        </div>
      )}

      {/* NOVA Reward Points card */}
      <section className="glass-card rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <span className="material-symbols-outlined text-indigo-600 text-[14px]">stars</span> NOVA Points
          </p>
          <h3 className="text-2xl font-extrabold text-indigo-600">{novaPoints.toLocaleString()}</h3>
        </div>
        
        <div className="text-right">
          <p className="text-xs font-bold text-slate-700">Level {novaLevel}</p>
          <div className="w-32 h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, levelProgress))}%` }}></div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {pointsToNextLevel > 0 ? `Next level in ${pointsToNextLevel} pts` : 'Max level reached'}
          </p>
        </div>
      </section>

      {/* Measurements Component segment */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">My Measurements</h3>
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="text-xs font-semibold text-indigo-600 flex items-center gap-1 hover:text-indigo-800 transition-colors"
          >
            Edit <span className="material-symbols-outlined text-sm leading-none">edit</span>
          </button>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="grid grid-cols-5 gap-1 text-center divide-x divide-slate-100">
            {measurements.map((m, idx) => (
              <div key={m.label} className="flex flex-col items-center px-1">
                <span className="material-symbols-outlined text-indigo-600 text-lg mb-1 leading-none">{m.iconName}</span>
                <span className="text-[9px] font-medium text-slate-400 leading-none mb-1">{m.label}</span>
                <span className="text-xs font-bold text-slate-800 truncate block w-full">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preferences Component */}
      <section className="space-y-3">
        <h3 className="text-base font-bold text-slate-800">My Preferences</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-2xl p-3 flex flex-col items-center text-center gap-1 hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200">
            <span className="material-symbols-outlined text-indigo-600 text-xl leading-none">style</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Style</span>
            <span className="text-xs font-bold text-slate-800">{preferences.find(p => p.label === 'Style')?.value || 'Streetwear'}</span>
          </div>

          <div className="glass-card rounded-2xl p-3 flex flex-col items-center text-center gap-1 hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200">
            <span className="material-symbols-outlined text-indigo-600 text-xl leading-none">fit_screen</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fit</span>
            <span className="text-xs font-bold text-slate-800">{preferences.find(p => p.label === 'Fit')?.value || 'Regular'}</span>
          </div>

          <div className="glass-card rounded-2xl p-3 flex flex-col items-center text-center gap-1 hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200">
            <span className="material-symbols-outlined text-indigo-600 text-xl leading-none">palette</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Colors</span>
            <span className="text-xs font-bold text-slate-800">{preferences.find(p => p.label === 'Colors')?.value || 'Mix'}</span>
          </div>

          <div className="glass-card rounded-2xl p-3 flex flex-col items-center text-center gap-1 hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200">
            <span className="material-symbols-outlined text-indigo-600 text-xl leading-none">event</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Occasion</span>
            <span className="text-xs font-bold text-slate-800">{preferences.find(p => p.label === 'Occasion')?.value || 'Casual'}</span>
          </div>
        </div>

        {/* Athletic body fit indicator */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-600 text-3xl opacity-75">accessibility_new</span>
            <div className="flex-1 leading-tight">
              <p className="text-[10px] font-bold text-slate-400">BODY TYPE</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">Athletic</p>
              <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: '75%' }}></div>
              </div>
              <p className="text-[8px] text-right font-bold text-slate-400 mt-1">75% Match</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 flex flex-col justify-center">
            <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
              <span className="material-symbols-outlined text-xs">straighten</span> Size Recommend
            </p>
            <div className="flex justify-between items-end mt-2 leading-none">
              <div>
                <span className="text-[8px] font-bold text-slate-400 block mb-0.5">TOPWEAR</span>
                <span className="text-base font-extrabold text-slate-800">M</span>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="text-right">
                <span className="text-[8px] font-bold text-slate-400 block mb-0.5">BOTTOM</span>
                <span className="text-base font-extrabold text-slate-800">32</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating alert for ProfileView */}
      {profileToast && (
        <div className="fixed top-20 inset-x-4 z-50 bg-indigo-900/95 backdrop-blur-md text-white text-xs font-bold text-center px-4 py-3 rounded-xl shadow-lg border border-indigo-400/30 animate-pulse">
          {profileToast}
        </div>
      )}

      {/* Persistent Saved Items (Wishlist) Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-indigo-600 text-lg leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            Saved Items {wishlist.length > 0 && `(${wishlist.length})`}
          </h3>
          {wishlist.length > 0 && (
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              Tap bag to add
            </span>
          )}
        </div>

        {wishlist.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto border border-slate-100">
              <span className="material-symbols-outlined text-2xl font-bold">favorite_border</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700">Wishlist is empty</h4>
              <p className="text-[10px] text-slate-500 leading-normal max-w-[220px] mx-auto">
                Save your favorite styling coordinates and match pieces here!
              </p>
            </div>
            <button 
              onClick={() => onNavigate('home')}
              className="bg-indigo-600 hover:bg-indigo-700 text-[10px] font-black text-white px-3.5 py-1.5 rounded-xl uppercase tracking-wide transition-all shadow-sm shadow-indigo-600/20 cursor-pointer active:scale-95 inline-block"
            >
              Explore Looks
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {wishlist.map((productId) => {
              const matchedProd = products[productId];
              if (!matchedProd) return null;
              
              const defaultColor = matchedProd.colors && matchedProd.colors.length > 0 ? matchedProd.colors[0] : 'Default';
              const defaultSize = matchedProd.sizes && matchedProd.sizes.length > 0 ? matchedProd.sizes[0] : 'One Size';

              return (
                <div 
                  key={productId}
                  className="glass-card rounded-2xl p-3 flex items-center gap-3 hover:bg-white hover:shadow-sm transition-all border border-slate-100/30"
                >
                  <div 
                    onClick={() => {
                      if (productId === 'lavender-hoodie') {
                        onNavigate('product-details');
                      } else {
                        onNavigate('product-details');
                      }
                    }}
                    className="w-14 h-14 rounded-xl bg-slate-100/80 overflow-hidden shrink-0 border border-slate-200/20 cursor-pointer flex items-center justify-center relative group"
                  >
                    <img 
                      alt={matchedProd.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      referrerPolicy="no-referrer"
                      src={matchedProd.imageUrl}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0 leading-tight">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">{matchedProd.category}</span>
                    <h4 
                      onClick={() => onNavigate('product-details')}
                      className="text-xs font-bold text-slate-800 truncate hover:text-indigo-600 cursor-pointer transition-colors"
                    >
                      {matchedProd.name}
                    </h4>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-black text-indigo-600">
                        ₹{matchedProd.price.toLocaleString()}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        {matchedProd.rating}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={() => {
                        if (onAddToCart) {
                          onAddToCart(productId, defaultColor, defaultSize);
                          setProfileToast(`✓ Added ${matchedProd.name} (${defaultColor}) to Bag!`);
                          setTimeout(() => setProfileToast(null), 2500);
                        }
                      }}
                      className="w-9 h-9 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                      title="Add to Basket"
                    >
                      <span className="material-symbols-outlined text-base">local_mall</span>
                    </button>

                    <button 
                      onClick={() => {
                        if (onToggleWishlist) {
                          onToggleWishlist(productId);
                        }
                      }}
                      className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-500/10 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                      title="Remove"
                    >
                      <span className="material-symbols-outlined text-base">delete_outline</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Actions grids */}
      <section className="space-y-3">
        <h3 className="text-base font-bold text-slate-800">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Saved\nLooks', icon: 'favorite', target: 'ar-tryon' },
            { label: 'Try-On\nHistory', icon: 'history', target: 'scan-outfit' },
            { label: 'My\nScans', icon: 'center_focus_strong', target: 'camera-scan' },
            { label: 'Coupons\n& Offers', icon: 'local_offer', target: 'cart' }
          ].map((act) => (
            <button 
              key={act.label}
              onClick={() => onNavigate(act.target as any)}
              className="glass-card rounded-2xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform shadow-sm">
                <span className="material-symbols-outlined text-lg leading-none">{act.icon}</span>
              </div>
              <span className="text-[9px] font-bold text-slate-600 text-center leading-tight whitespace-pre-line">{act.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Settings list actions */}
      <section className={`rounded-3xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-800/40 divide-slate-700/50' : 'glass-card divide-slate-150'}`}>
        <ul className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-150'}`}>
          {[
            { label: 'Wishlist (Saved Items)', icon: 'favorite', action: () => setIsWishlistModalOpen(true), extra: wishlist.length > 0 ? `${wishlist.length} Items` : '0' },
            { label: 'Payment Methods', icon: 'payment', action: () => setIsPaymentModalOpen(true), extra: `${paymentMethods.filter((p: any) => p.type === 'Credit Card').length} Card(s), ${paymentMethods.filter((p: any) => p.type === 'UPI').length} UPI` },
            { label: 'Addresses', icon: 'location_on', action: () => setIsAddressesModalOpen(true), extra: `${addresses.length} Saved` },
            { label: 'Dark Mode', icon: isDarkMode ? 'light_mode' : 'dark_mode', action: () => { setIsDarkMode?.(!isDarkMode); localStorage.setItem('isDarkMode', JSON.stringify(!isDarkMode)); }, extra: isDarkMode ? 'ON' : 'OFF' },
            { label: 'Privacy & Security', icon: 'lock', action: () => setIsPrivacyModalOpen(true) },
            { label: 'Notifications', icon: 'notifications', action: () => setIsNotificationsModalOpen(true), extra: `${Object.values(notificationsSettings).filter(Boolean).length} Active` },
            { label: 'Language', icon: 'language', extra: selectedLanguage, action: () => setIsLanguageModalOpen(true) }
          ].map((item) => (
            <li key={item.label}>
              <button 
                onClick={() => item.action ? item.action() : alert(`Simulated link clicked: ${item.label}`)}
                className={`w-full flex items-center justify-between p-4 transition-colors text-left group ${ isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-white/40'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined transition-colors ${isDarkMode ? 'text-slate-500 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`}>{item.icon}</span>
                  <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.label}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {item.extra && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'text-indigo-300 bg-indigo-950/70' : 'text-indigo-500 bg-indigo-50/70'}`}>{item.extra}</span>}
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </div>
              </button>
            </li>
          ))}
          <li>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50/50 transition-colors text-left text-red-600"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">logout</span>
                <span className="text-sm font-bold">Logout</span>
              </div>
            </button>
          </li>
        </ul>
      </section>

      {/* Edit Measurements Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-900">Update Measurements</h3>
            <form onSubmit={handleSaveMeasurements} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">HEIGHT (cm)</label>
                <input 
                  type="text" 
                  value={editHeight} 
                  onChange={(e) => setEditHeight(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">WEIGHT (kg)</label>
                <input 
                  type="text" 
                  value={editWeight} 
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">CHEST (cm)</label>
                <input 
                  type="text" 
                  value={editChest} 
                  onChange={(e) => setEditChest(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">WAIST (cm)</label>
                <input 
                  type="text" 
                  value={editWaist} 
                  onChange={(e) => setEditWaist(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">INSEAM (cm)</label>
                <input 
                  type="text" 
                  value={editInseam} 
                  onChange={(e) => setEditInseam(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-900">Edit Profile</h3>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">FULL NAME</label>
                <input 
                  type="text" 
                  value={profileName} 
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">EMAIL ADDRESS</label>
                <input 
                  type="email" 
                  value={profileEmail} 
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">PHONE NUMBER</label>
                <input 
                  type="text" 
                  value={profilePhone} 
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 leading-none">LOCATION</label>
                <input 
                  type="text" 
                  value={profileLocation} 
                  onChange={(e) => setProfileLocation(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Methods Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">payment</span>
                Payment Methods
              </h3>
              <button 
                onClick={() => { setIsPaymentModalOpen(false); setIsAddingCard(false); setIsAddingUPI(false); }}
                className="text-slate-400 hover:text-slate-600 outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* List existing items */}
            <div className="space-y-3">
              {paymentMethods.map((pm: any) => (
                <div 
                  key={pm.id}
                  className={`bg-gradient-to-r ${pm.color} rounded-2xl p-4 text-white relative shadow-md overflow-hidden`}
                >
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-100 tracking-wider">
                        {pm.type}
                      </span>
                      <h4 className="text-sm font-black mt-0.5">{pm.provider}</h4>
                    </div>
                    {pm.isDefault && (
                      <span className="bg-white/20 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        Primary
                      </span>
                    )}
                  </div>

                  <div className="my-3 font-mono text-base font-extrabold tracking-widest">
                    {pm.type === 'Credit Card' ? pm.number : pm.handle}
                  </div>

                  <div className="flex justify-between items-center text-xs text-indigo-100 font-bold">
                    <span>{pm.cardholder || 'NOVA MEMBER'}</span>
                    {pm.expiry && <span>EXP: {pm.expiry}</span>}
                  </div>

                  {/* Delete button option */}
                  <button 
                    onClick={() => handleDeletePayment(pm.id)}
                    className="absolute right-3 top-3 w-7 h-7 bg-black/20 hover:bg-black/45 rounded-full flex items-center justify-center text-white transition-colors"
                    title="Remove method"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}

              {paymentMethods.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-2xl">
                  No payment options configured yet. Add one below!
                </p>
              )}
            </div>

            {/* Addition Forms buttons */}
            {!isAddingCard && !isAddingUPI && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  onClick={() => setIsAddingCard(true)}
                  className="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">credit_card</span> Add Card
                </button>
                <button 
                  onClick={() => setIsAddingUPI(true)}
                  className="py-2.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-600 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">g_pay</span> Register UPI
                </button>
              </div>
            )}

            {/* Add card template */}
            {isAddingCard && (
              <form onSubmit={handleAddCard} className="bg-slate-50 rounded-2xl p-4 space-y-3 animate-fade-in border border-indigo-100/40">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Card</h4>
                  <button type="button" onClick={() => setIsAddingCard(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="Card Number (16-digits)"
                    maxLength={19}
                    value={newCardNumber}
                    onChange={(e) => setNewCardNumber(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="MM/YY"
                      value={newCardExpiry}
                      onChange={(e) => setNewCardExpiry(e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Cardholder Name"
                      value={newCardHolder}
                      onChange={(e) => setNewCardHolder(e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl"
                >
                  Save Card Account
                </button>
              </form>
            )}

            {/* Add UPI handle form template */}
            {isAddingUPI && (
              <form onSubmit={handleAddUPI} className="bg-slate-50 rounded-2xl p-4 space-y-3 animate-fade-in border border-indigo-100/40">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Register UPI Handle</h4>
                  <button type="button" onClick={() => setIsAddingUPI(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="Enter UPI Address (e.g., mail@upi)"
                    value={newUPIHandle}
                    onChange={(e) => setNewUPIHandle(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                    required
                  />
                  <p className="text-[9px] text-slate-400">Instantly links Google Pay, PhonePe, Paytm, and BHIM UPI networks.</p>
                </div>
                <button 
                  type="submit"
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl"
                >
                  Link UPI Address
                </button>
              </form>
            )}

            <button 
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="w-full py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Addresses Modal */}
      {isAddressesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">location_on</span>
                Saved Addresses
              </h3>
              <button 
                onClick={() => { setIsAddressesModalOpen(false); setIsAddingAddress(false); }}
                className="text-slate-400 hover:text-slate-600 outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* List saved shipping places */}
            <div className="space-y-3">
              {addresses.map((addr: any) => (
                <div 
                  key={addr.id}
                  className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 relative hover:border-indigo-150 transition-colors"
                >
                  <div className="flex items-center gap-2 text-indigo-600 mb-1.5">
                    <span className="material-symbols-outlined text-lg">{addr.icon}</span>
                    <span className="text-xs font-extrabold uppercase tracking-wide bg-indigo-50 px-2 py-0.5 rounded-full text-indigo-700">
                      {addr.label}
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-slate-800">{addr.name}</h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                    {addr.street}, {addr.city}, PIN {addr.zip}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">phone</span> {addr.phone}
                  </p>

                  <button 
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="absolute right-3 top-3 w-7 h-7 hover:bg-slate-100/80 hover:text-red-500 rounded-xl flex items-center justify-center text-slate-400 transition-colors"
                    title="Delete shipping location"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}

              {addresses.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-2xl">
                  No addresses registered. Please input one below!
                </p>
              )}
            </div>

            {/* Addition form button toggle layout */}
            {!isAddingAddress ? (
              <button 
                onClick={() => setIsAddingAddress(true)}
                className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-sm">add_location_alt</span> Define New Address
              </button>
            ) : (
              <form onSubmit={handleAddAddress} className="bg-slate-50 rounded-2xl p-4 space-y-3 animate-fade-in border border-indigo-100/40">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Add Address</h4>
                  <button type="button" onClick={() => setIsAddingAddress(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="Label (e.g., Home, Work)"
                      value={addrLabel}
                      onChange={(e) => setAddrLabel(e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Recipient Full Name"
                      value={addrName}
                      onChange={(e) => setAddrName(e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>
                  
                  <input 
                    type="text" 
                    placeholder="Street Address, Bldg, Area details"
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                    required
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="City (e.g. Bangalore)"
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="ZIP Pin Code"
                      maxLength={6}
                      value={addrZip}
                      onChange={(e) => setAddrZip(e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>

                  <input 
                    type="text" 
                    placeholder="Phone number"
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl"
                >
                  Register Address
                </button>
              </form>
            )}

            <button 
              type="button"
              onClick={() => setIsAddressesModalOpen(false)}
              className="w-full py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Privacy & Security Modal */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">lock</span>
                Privacy & Security
              </h3>
              <button 
                onClick={() => setIsPrivacyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 space-y-3.5">
              {/* Toggle row */}
              <div className="flex justify-between items-center pt-2">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-slate-800">Biometric Sign-In</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Lock access to saved payment info with Touch/Face ID simulation.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => togglePrivacyField('biometricLogin', 'Biometric Sign-In')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${privacySettings.biometricLogin ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${privacySettings.biometricLogin ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Toggle row */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-slate-800">2-Factor Authentication</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Send secure OTP triggers during checkout processes.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => togglePrivacyField('twoFactorAuth', 'Two-Factor Authentication')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${privacySettings.twoFactorAuth ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${privacySettings.twoFactorAuth ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Toggle row */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-slate-800">Incognito AR Scan</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Do not store fitting simulation snaps or scans to local history logs.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => togglePrivacyField('incognitoScan', 'Incognito AR Scan')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${privacySettings.incognitoScan ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${privacySettings.incognitoScan ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Toggle row */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-slate-800">AI Stylist Personalization</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Share custom metric specs with neural matching algorithms.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => togglePrivacyField('shareFittings', 'AI Stylist Personalization')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${privacySettings.shareFittings ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${privacySettings.shareFittings ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setIsPrivacyModalOpen(false)}
              className="w-full mt-2 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Done & Save
            </button>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {isNotificationsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">notifications</span>
                Notification Settings
              </h3>
              <button 
                onClick={() => setIsNotificationsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 space-y-3.5">
              {/* Price Drop Alerts */}
              <div className="flex justify-between items-center pt-2">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-slate-800">Price Drop Alerts</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Notify immediately if items in your wishlist drop in price.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => toggleNotificationField('priceDrops', 'Price Drops')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${notificationsSettings.priceDrops ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${notificationsSettings.priceDrops ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* New Season Drops */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-slate-800">New Wardrobe Capsule arrivals</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Inform when fresh curated trends land on style list.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => toggleNotificationField('newArrivals', 'New Arrivals')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${notificationsSettings.newArrivals ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${notificationsSettings.newArrivals ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* AI Stylist Reminders */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-slate-800">AI Stylist Advice</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Curated fits matching current weather patterns or trips.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => toggleNotificationField('stylistReminders', 'Stylist Reminders')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${notificationsSettings.stylistReminders ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${notificationsSettings.stylistReminders ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Order Tracking */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-slate-800">Order & Delivery Tracking</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Continuous push notifications for active package transport status.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => toggleNotificationField('orderUpdates', 'Order Tracking')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${notificationsSettings.orderUpdates ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${notificationsSettings.orderUpdates ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setIsNotificationsModalOpen(false)}
              className="w-full mt-2 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Done & Save
            </button>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {isLanguageModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">language</span>
                Choose Language
              </h3>
              <button 
                onClick={() => setIsLanguageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-2">
              {[
                { label: 'English', sub: 'English' },
                { label: 'Español', sub: 'Spanish' },
                { label: 'Français', sub: 'French' },
                { label: '日本語', sub: 'Japanese' },
                { label: 'Deutsch', sub: 'German' },
                { label: 'हिन्दी', sub: 'Hindi' }
              ].map((lang) => (
                <button 
                  key={lang.label}
                  type="button"
                  onClick={() => handleLanguageSelect(lang.label)}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between border transition-all text-left ${selectedLanguage === lang.label ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold' : 'border-slate-100 hover:border-slate-300 text-slate-700 font-semibold bg-slate-50/50'}`}
                >
                  <div className="leading-none">
                    <span className="text-xs block">{lang.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{lang.sub}</span>
                  </div>
                  {selectedLanguage === lang.label && (
                    <span className="material-symbols-outlined text-indigo-600 font-bold text-base">check</span>
                  )}
                </button>
              ))}
            </div>

            <button 
              type="button"
              onClick={() => setIsLanguageModalOpen(false)}
              className="w-full py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Wishlist Modal */}
      {isWishlistModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500 fill-current" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                My Saved Wishlist
              </h3>
              <button 
                onClick={() => setIsWishlistModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* List wishlist items */}
            <div className="space-y-3.5 pt-1">
              {wishlist.length > 0 ? (
                wishlist.map((productId) => {
                  const item = products[productId];
                  if (!item) return null;
                  
                  const defaultColor = item.colors && item.colors.length > 0 ? item.colors[0] : 'Default';
                  const defaultSize = item.sizes && item.sizes.length > 0 ? item.sizes[0] : 'M';

                  return (
                    <div 
                      key={productId}
                      className="flex items-center gap-3 bg-slate-50/70 hover:bg-slate-100 border border-slate-100 p-2.5 rounded-2xl relative transition-all"
                    >
                      <img 
                        src={item.imageUrl} 
                        alt={item.name} 
                        className="w-14 h-14 object-cover rounded-xl shrink-0"
                      />
                      <div className="flex-1 min-w-0 pr-6">
                        <span className="text-[9px] uppercase font-bold text-indigo-600 block leading-none mb-0.5">
                          {item.category}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xs font-black text-indigo-700">₹{item.price.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Remove item from wishlist */}
                      <button 
                        onClick={() => {
                          if (onToggleWishlist) {
                            onToggleWishlist(productId);
                            setProfileToast(`Removed ${item.name} from Wishlist`);
                            setTimeout(() => setProfileToast(null), 2000);
                          }
                        }}
                        className="absolute right-2 top-2 p-1 text-slate-300 hover:text-rose-500 hover:bg-slate-100/60 rounded-lg transition-colors cursor-pointer"
                        title="Remove from favorites"
                      >
                        <span className="material-symbols-outlined text-sm leading-none">delete</span>
                      </button>

                      {/* Quick Add to Cart */}
                      <button 
                        onClick={() => {
                          if (onAddToCart) {
                            onAddToCart(productId, defaultColor, defaultSize);
                            setProfileToast(`✓ Added ${item.name} to Cart!`);
                            setTimeout(() => setProfileToast(null), 2500);
                          }
                        }}
                        className="absolute right-2 bottom-2 p-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg transition-all cursor-pointer"
                        title="Add to cart"
                      >
                        <span className="material-symbols-outlined text-xs leading-none">shopping_bag</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">favorite_border</span>
                  <p className="text-xs text-slate-500 font-semibold">Your wishlist is empty</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Explore garments in the showroom and tap the favorite heart icon to save products here.
                  </p>
                </div>
              )}
            </div>

            <button 
              type="button"
              onClick={() => setIsWishlistModalOpen(false)}
              className="w-full py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
