import React, { useState, useRef } from 'react';
import { ScreenId, Measurement, NovaAnalysisProfile, Preference, NovaAccount, ProductItem, LegalConsentRecord, DeliveryAddress, SavedLook } from '../types';
import { fetchUserSavedLooks, deleteUserSavedLook, saveImageToDeviceGallery, downloadSavedLook } from '../services/savedLooksService';
import AccountSwitcherModal from './accounts/AccountSwitcherModal';
import { initialMeasurements, initialPreferences, products } from '../data';
import { languages, LocaleCode, useI18n } from '../i18n';
import { PRIVACY_VERSION, TERMS_VERSION } from '../legal/legalDocuments';
import {
  formatDeliveryAddress,
  isGuestIdentity,
  saveUserDeliveryAddress,
  writeCachedUserAddress
} from '../services/addressService';

interface ProfileViewProps {
  onNavigate: (screen: ScreenId) => void;
  userId?: string;
  userName: string;
  setUserName: (name: string) => void;
  userEmail?: string;
  onSaveProfile?: (profile: { name: string; email: string; phone: string; address: string; profilePhoto?: string }) => Promise<void>;
  userPhone?: string;
  userAddress?: string;
  userPinCode?: string;
  savedDeliveryAddress?: DeliveryAddress | null;
  savedAddresses?: DeliveryAddress[];
  isGuest?: boolean;
  onSaveAddress?: (address: DeliveryAddress, allAddresses: DeliveryAddress[]) => Promise<void> | void;
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
  legalConsent?: LegalConsentRecord | null;
}

const getDefaultProductColor = (product?: ProductItem) => (
  product?.variants?.[0]?.colorName || product?.variants?.[0]?.color || product?.colors?.[0] || 'Default'
);

const GooglePayMark = ({ className = '' }: { className?: string }) => (
  <span aria-label="Google Pay" className={`inline-flex items-center font-bold tracking-tight ${className}`}>
    <span
      className="bg-clip-text text-transparent"
      style={{
        backgroundImage: 'linear-gradient(90deg, #4285F4 0 25%, #34A853 25% 50%, #FBBC04 50% 75%, #EA4335 75%)'
      }}
    >
      G
    </span>
    <span className="ml-0.5 text-[#5F6368]">Pay</span>
  </span>
);

const compressProfileImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Could not load image file'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
};

export const ProfileView: React.FC<ProfileViewProps> = ({ 
  onNavigate, 
  userId = '',
  userName,
  setUserName,
  userAddress,
  onSaveProfile,
  userPinCode = '',
  savedDeliveryAddress = null,
  savedAddresses = [],
  isGuest = false,
  onSaveAddress,
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
  onSwitchAccount,
  legalConsent
}) => {
  const { locale, language, setLocale, t } = useI18n();
  const effectiveUid = userId || activeUid || userEmail || '';
  const paymentMethodsStorageKey = `nova_payment_methods_${encodeURIComponent(effectiveUid || 'local_user')}`;
  const profileAddressesStorageKey = `nova_profile_addresses_${encodeURIComponent(effectiveUid || 'local_user')}`;
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [profileToast, setProfileToast] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  // Settings modals toggle states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAddressesModalOpen, setIsAddressesModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [isSavedLooksModalOpen, setIsSavedLooksModalOpen] = useState(false);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [isLoadingSavedLooks, setIsLoadingSavedLooks] = useState(false);
  const [selectedLookPreview, setSelectedLookPreview] = useState<SavedLook | null>(null);

  const readPaymentMethods = (storageKey: string, migrateLegacy = false) => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        localStorage.removeItem('payment_methods');
        const parsed: unknown = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }

      if (!migrateLegacy) return [];
      const legacy = localStorage.getItem('payment_methods');
      if (!legacy) return [];

      const parsed: unknown = JSON.parse(legacy);
      const methods = Array.isArray(parsed) ? parsed.filter((method) => {
        if (!method || typeof method !== 'object') return false;
        const entry = method as Record<string, unknown>;
        const provider = String(entry.provider || '');
        const handle = String(entry.handle || '');
        const cardholder = String(entry.cardholder || '');
        const number = String(entry.number || '');
        return !(
          provider === 'Visa Signature' ||
          provider === 'UPI Option' ||
          handle === 'arjunmehta@okaxis' ||
          cardholder === 'Arjun Mehta' ||
          number.endsWith('4235')
        );
      }) : [];

      if (methods.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(methods));
      }
      localStorage.removeItem('payment_methods');
      return methods;
    } catch (error) {
      console.error('Could not load saved payment methods:', error);
      return [];
    }
  };

  const [paymentMethods, setPaymentMethods] = useState<any[]>(() => readPaymentMethods(paymentMethodsStorageKey, true));
  const [paymentMethodsOwnerKey, setPaymentMethodsOwnerKey] = useState(paymentMethodsStorageKey);

  React.useEffect(() => {
    setPaymentMethods(readPaymentMethods(paymentMethodsStorageKey, true));
    setPaymentMethodsOwnerKey(paymentMethodsStorageKey);
  }, [paymentMethodsStorageKey]);

  const persistPaymentMethods = (nextPaymentMethods: any[]) => {
    if (paymentMethodsOwnerKey !== paymentMethodsStorageKey) {
      throw new Error('Payment methods are still loading for this account. Please try again.');
    }
    try {
      localStorage.setItem(paymentMethodsStorageKey, JSON.stringify(nextPaymentMethods));
      setPaymentMethods(nextPaymentMethods);
    } catch (error) {
      console.error('Could not save payment methods:', error);
      throw new Error('Could not save payment methods on this device. Check available browser storage and try again.');
    }
  };

  // Temporary payment inputs states
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isAddingUPI, setIsAddingUPI] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardHolder, setNewCardHolder] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newUPIHandle, setNewUPIHandle] = useState('');

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = newCardNumber.replace(/\D/g, '');
    if (digits.length < 12 || digits.length > 19 || !newCardHolder.trim() || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(newCardExpiry)) {
      setProfileToast('Please specify card credentials');
      setTimeout(() => setProfileToast(null), 2500);
      return;
    }
    const lastDigits = digits.slice(-4);
    const formattedNumber = `•••• •••• •••• ${lastDigits}`;
    const provider = digits.startsWith('4')
      ? 'Visa'
      : /^(5[1-5]|2[2-7])/.test(digits)
        ? 'Mastercard'
        : /^(34|37)/.test(digits)
          ? 'American Express'
          : /^(60|65|81|82|508)/.test(digits)
            ? 'RuPay'
            : 'Card';
    const newCard = {
      id: Date.now().toString(),
      type: 'Credit Card',
      provider,
      number: formattedNumber,
      cardholder: newCardHolder.trim(),
      expiry: newCardExpiry,
      color: 'from-purple-600 via-indigo-600 to-blue-600'
    };
    try {
      persistPaymentMethods([...paymentMethods, newCard]);
    } catch (error) {
      setProfileToast(error instanceof Error ? error.message : 'Could not save this card.');
      setTimeout(() => setProfileToast(null), 3000);
      return;
    }
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
    try {
      persistPaymentMethods([...paymentMethods, newUPI]);
    } catch (error) {
      setProfileToast(error instanceof Error ? error.message : 'Could not save this UPI handle.');
      setTimeout(() => setProfileToast(null), 3000);
      return;
    }
    setIsAddingUPI(false);
    setNewUPIHandle('');
    setProfileToast('⚡ UPI ID registered successfully!');
    setTimeout(() => setProfileToast(null), 2500);
  };

  const handleDeletePayment = (id: string) => {
    const matched = paymentMethods.find(p => p.id === id);
    try {
      persistPaymentMethods(paymentMethods.filter((paymentMethod) => paymentMethod.id !== id));
    } catch (error) {
      setProfileToast(error instanceof Error ? error.message : 'Could not remove this payment method.');
      setTimeout(() => setProfileToast(null), 3000);
      return;
    }
    setProfileToast(`✕ Removed ${matched?.type === 'UPI' ? 'UPI Handle' : 'Card'} successfully`);
    setTimeout(() => setProfileToast(null), 2000);
  };

  // Convert DeliveryAddress into the UI card shape used by the Saved Addresses modal
  const toUiAddressEntry = (addr: DeliveryAddress, idx: number) => {
    const streetParts = [addr.flatNo, addr.landmark].map((s) => (s || '').trim()).filter(Boolean);
    const label = addr.label || (idx === 0 ? 'Home (Default)' : 'Address');
    return {
      id: addr.id || `addr_${idx + 1}`,
      label,
      name: addr.fullName || userName,
      street: streetParts.join(', ') || addr.city || '',
      city: addr.city || '',
      state: addr.state || 'India',
      zip: addr.pinCode || userPinCode || '',
      phone: addr.phone || userPhone || '',
      icon: label.toLowerCase().includes('office') || label.toLowerCase().includes('work') ? 'work' : 'home',
      raw: addr,
    };
  };

  // Synchronize user's saved looks from local storage
  React.useEffect(() => {
    setIsLoadingSavedLooks(true);
    fetchUserSavedLooks(effectiveUid || 'local_user')
      .then((looks) => setSavedLooks(looks))
      .catch((err) => console.warn('Failed to load saved looks:', err))
      .finally(() => setIsLoadingSavedLooks(false));
  }, [effectiveUid]);

  // Open Saved Looks modal automatically if routed from AR Try-On "View Saved Looks"
  React.useEffect(() => {
    try {
      if (localStorage.getItem('nova_open_saved_looks') === 'true') {
        localStorage.removeItem('nova_open_saved_looks');
        setIsSavedLooksModalOpen(true);
      }
    } catch {}
  }, []);

  // Listen for local updates so Saved Looks updates reactively
  React.useEffect(() => {
    const handleStorageUpdate = () => {
      fetchUserSavedLooks(effectiveUid || 'local_user').then((looks) => setSavedLooks(looks));
    };
    window.addEventListener('nova:saved_look_updated', handleStorageUpdate);
    return () => window.removeEventListener('nova:saved_look_updated', handleStorageUpdate);
  }, [effectiveUid]);

  const handleDeleteSavedLook = async (lookId: string) => {
    try {
      await deleteUserSavedLook(effectiveUid || 'local_user', lookId);
      setSavedLooks((prev) => prev.filter((l) => l.id !== lookId));
      if (selectedLookPreview?.id === lookId) {
        setSelectedLookPreview(null);
      }
      setProfileToast('✓ Look removed from Saved Looks');
      setTimeout(() => setProfileToast(null), 2500);
    } catch {
      setProfileToast('Failed to remove look');
      setTimeout(() => setProfileToast(null), 2500);
    }
  };

  const handleDownloadLook = async (look: SavedLook) => {
    try {
      const res = await downloadSavedLook(look);
      if (res.success) {
        setProfileToast('✓ Image saved to device!');
      } else {
        setProfileToast(res.error || 'Could not download image');
      }
    } catch {
      setProfileToast('Download failed');
    }
    setTimeout(() => setProfileToast(null), 2500);
  };
  const effectiveIsGuest = isGuest || isGuestIdentity(effectiveUid, isGuest);

  const buildUserAddressEntries = React.useCallback(() => {
    const list: DeliveryAddress[] = [];
    if (Array.isArray(savedAddresses) && savedAddresses.length > 0) {
      list.push(...savedAddresses);
    } else if (savedDeliveryAddress && (savedDeliveryAddress.flatNo || savedDeliveryAddress.city || savedDeliveryAddress.pinCode)) {
      list.push(savedDeliveryAddress);
    } else {
      try {
        const saved = localStorage.getItem(profileAddressesStorageKey);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) list.push(...parsed);
        }
      } catch (error) {
        console.error('Could not load saved addresses:', error);
      }
    }
    return list.map((a, idx) => toUiAddressEntry(a, idx));
  }, [profileAddressesStorageKey, savedAddresses, savedDeliveryAddress, userName, userPhone, userPinCode]);

  // Addresses interactive state (scoped per authenticated user, never shared globally)
  const [addresses, setAddresses] = useState<any[]>(() => buildUserAddressEntries());
  const selectedAddressId = savedDeliveryAddress?.id ||
    addresses.find((address: any) => address.raw?.isDefault)?.id ||
    addresses[0]?.id ||
    '';

  React.useEffect(() => {
    setAddresses(buildUserAddressEntries());
  }, [buildUserAddressEntries]);

  const handleSelectAddress = async (address: any) => {
    if (address.id === selectedAddressId) return;
    const selectedRawAddress: DeliveryAddress = {
      ...address.raw,
      isDefault: true
    };
    const otherAddresses: DeliveryAddress[] = addresses
      .filter((entry: any) => entry.id !== address.id)
      .map((entry: any) => ({ ...entry.raw, isDefault: false }));

    try {
      if (effectiveUid && !effectiveIsGuest) {
        const savedResult = await saveUserDeliveryAddress(
          {
            uid: effectiveUid,
            email: userEmail,
            name: userName,
            phone: userPhone,
            isGuest: effectiveIsGuest
          },
          selectedRawAddress,
          otherAddresses
        );
        setAddresses(savedResult.savedAddresses.map((entry, index) => toUiAddressEntry(entry, index)));
        await onSaveAddress?.(savedResult.primaryAddress, savedResult.savedAddresses);
      } else {
        const nextAddresses = [selectedRawAddress, ...otherAddresses];
        localStorage.setItem(profileAddressesStorageKey, JSON.stringify(nextAddresses));
        setAddresses(nextAddresses.map((entry, index) => toUiAddressEntry(entry, index)));
      }
      setProfileToast('Default delivery address updated.');
      setTimeout(() => setProfileToast(null), 2500);
    } catch (error) {
      console.error('Could not select delivery address:', error);
      setProfileToast(error instanceof Error ? error.message : 'Could not select this address. Please try again.');
      setTimeout(() => setProfileToast(null), 3000);
    }
  };

  // Temporary address inputs states
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrName, setAddrName] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrZip, setAddrZip] = useState('');
  const [addrPhone, setAddrPhone] = useState('');

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrName || !addrStreet || !addrCity || !addrZip) {
      setProfileToast('Please fill out all mandatory address fields');
      setTimeout(() => setProfileToast(null), 2500);
      return;
    }
    const deliveryObj: DeliveryAddress = {
      id: `addr_${Date.now()}`,
      label: addrLabel || 'Home',
      fullName: addrName.trim(),
      phone: (addrPhone || userPhone || '').trim(),
      flatNo: addrStreet.trim(),
      landmark: '',
      city: addrCity.trim(),
      state: 'India',
      pinCode: addrZip.trim(),
      country: 'India',
      isDefault: addresses.length === 0,
      updatedAt: new Date().toISOString(),
    };

    try {
      let nextRawAddresses: DeliveryAddress[];
      if (effectiveUid && !effectiveIsGuest) {
        const existingAddresses = addresses.map((address: any) => address.raw as DeliveryAddress);
        const savedResult = await saveUserDeliveryAddress(
          {
            uid: effectiveUid,
            email: userEmail,
            name: userName,
            phone: userPhone,
            isGuest: effectiveIsGuest,
          },
          deliveryObj,
          existingAddresses
        );
        nextRawAddresses = savedResult.savedAddresses;
        onSaveAddress?.(savedResult.primaryAddress, savedResult.savedAddresses);
      } else {
        nextRawAddresses = [
          ...addresses.map((address: any) => address.raw as DeliveryAddress),
          deliveryObj
        ];
      }
      localStorage.setItem(profileAddressesStorageKey, JSON.stringify(nextRawAddresses));
      setAddresses(nextRawAddresses.map((address, index) => toUiAddressEntry(address, index)));
    } catch (error) {
      console.error('Could not save delivery address:', error);
      setProfileToast(error instanceof Error ? error.message : 'Could not save address. Please try again.');
      setTimeout(() => setProfileToast(null), 3000);
      return;
    }

    setIsAddingAddress(false);
    setAddrName('');
    setAddrStreet('');
    setAddrCity('');
    setAddrZip('');
    setAddrPhone('');
    setProfileToast('📍 Saved new delivery address!');
    setTimeout(() => setProfileToast(null), 2500);
  };

  const handleDeleteAddress = async (id: string) => {
    const matched = addresses.find(a => a.id === id);
    const remaining = addresses.filter(a => a.id !== id);
    const remainingRawAddresses = remaining.map((address: any) => address.raw as DeliveryAddress);
    try {
      localStorage.setItem(profileAddressesStorageKey, JSON.stringify(remainingRawAddresses));
    } catch (error) {
      console.error('Could not update saved addresses:', error);
      setProfileToast('Could not update saved addresses on this device.');
      setTimeout(() => setProfileToast(null), 2500);
      return;
    }
    setAddresses(remaining);
    if (effectiveUid && !effectiveIsGuest && remaining.length > 0) {
      const primaryRaw: DeliveryAddress = remaining[0].raw;
      const remainingRaws: DeliveryAddress[] = remainingRawAddresses;
      writeCachedUserAddress(effectiveUid, primaryRaw, remainingRaws);
      onSaveAddress?.(primaryRaw, remainingRaws);
    } else if (effectiveUid && !effectiveIsGuest && remaining.length === 0) {
      writeCachedUserAddress(effectiveUid, null, []);
      onSaveAddress?.(
        {
          fullName: userName,
          phone: userPhone,
          flatNo: '',
          landmark: '',
          city: '',
          pinCode: '',
        },
        []
      );
    }
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

  const [pendingLocale, setPendingLocale] = useState<LocaleCode>(locale);
  const [isApplyingLanguage, setIsApplyingLanguage] = useState(false);

  React.useEffect(() => {
    if (isLanguageModalOpen) {
      setPendingLocale(locale);
    }
  }, [isLanguageModalOpen, locale]);

  const handleApplyLanguage = () => {
    if (pendingLocale === locale || isApplyingLanguage) return;
    setIsApplyingLanguage(true);
    window.setTimeout(() => {
      const nextLanguage = languages.find((item) => item.code === pendingLocale) || languages[0];
      setLocale(pendingLocale);
      setIsApplyingLanguage(false);
      setIsLanguageModalOpen(false);
      setProfileToast(t('profile.language.configured', { language: nextLanguage.label }));
      setTimeout(() => setProfileToast(null), 2500);
    }, 250);
  };

  const setLanguageModalOpen = (open: boolean) => {
    setIsLanguageModalOpen(open);
    if (open) {
      setPendingLocale(locale);
    }
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
  const [profileLocation, setProfileLocation] = useState(
    userAddress || (savedDeliveryAddress ? formatDeliveryAddress(savedDeliveryAddress) : '')
  );
  const [editProfilePhoto, setEditProfilePhoto] = useState<string | undefined>(profilePhoto);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setEditProfilePhoto(profilePhoto);
  }, [profilePhoto]);

  // Sync state if user settings change or log in with another account
  React.useEffect(() => {
    setProfileName(userName);
    setProfileEmail(userEmail);
    setProfilePhone(userPhone);
    setProfileLocation(
      userAddress || (savedDeliveryAddress ? formatDeliveryAddress(savedDeliveryAddress) : '')
    );
  }, [userName, userEmail, userPhone, userAddress, savedDeliveryAddress]);

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaveError(null);
    setIsSavingProfile(true);
    try {
      if (onSaveProfile) {
        await onSaveProfile({
          name: profileName.trim(),
          email: profileEmail.trim(),
          phone: profilePhone.trim(),
          address: profileLocation.trim(),
          profilePhoto: editProfilePhoto
        });
      } else {
        setUserName(profileName.trim());
      }
      setProfileToast('Profile changes saved.');
      setTimeout(() => setProfileToast(null), 2500);
      setIsProfileModalOpen(false);
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : 'Could not save profile changes. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  return (
    <div className="space-y-6">
      {/* User profile picture details card */}
      <section className={`rounded-3xl p-5 flex items-center gap-4 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80' : 'glass-card border-transparent'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#ECE7FF]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => setIsAccountModalOpen(true)}
            className="w-20 h-20 rounded-full overflow-hidden border-2 border-white shadow shadow-[#553BE2]/15 relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#553BE2]"
            aria-label="Manage NOVA accounts"
          >
            <img 
              alt="Arjun Mehta user picture avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              src={profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'NOVA User')}&background=ECE7FF&color=553BE2&bold=true`}
            />
          </button>
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="absolute -bottom-1 -right-1 bg-[#553BE2] text-white p-1.5 rounded-full shadow hover:scale-110 transition-transform flex items-center justify-center border border-white"
          >
            <span className="material-symbols-outlined text-[13px] leading-none">edit</span>
          </button>
        </div>

        <div className="flex-grow min-w-0 relative z-10 leading-normal">
          <div className="flex items-center justify-between gap-1 mb-1">
            <h2 className={`text-xl font-bold truncate ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{userName}</h2>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase ${isDarkMode ? 'bg-indigo-500/10 text-indigo-200' : 'bg-[#F2EEFF] text-[#553BE2]'}`}>Pro</span>
          </div>
          
          <p className={`text-xs truncate flex items-center gap-1.5 mb-1 p-0.5 rounded px-1.5 ${isDarkMode ? 'text-slate-200 bg-slate-700/80' : 'text-[#5E667A] bg-[#F2EEFF]'}`}>
            <span className="material-symbols-outlined text-[14px]">mail</span> {profileEmail}
          </p>
          <p className={`text-xs truncate flex items-center gap-1.5 mb-1 p-0.5 rounded px-1.5 ${isDarkMode ? 'text-slate-200 bg-slate-700/80' : 'text-[#5E667A] bg-[#F2EEFF]'}`}>
            <span className="material-symbols-outlined text-[14px]">phone</span> {profilePhone}
          </p>
          <p className={`text-xs truncate flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-[#5E667A]'}`}>
            <span className="material-symbols-outlined text-[14px]">location_on</span> {profileLocation}
          </p>
        </div>
      </section>

      {analysisProfile && (
        <section className={`rounded-2xl p-4 shadow-sm space-y-3 border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80' : 'glass-card border-transparent'}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={`text-base font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
              <span className="material-symbols-outlined text-[#553BE2] text-[20px]">auto_awesome</span>
              NOVA AI Profile
            </h3>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'bg-indigo-500/10 text-indigo-200' : 'bg-[#F2EEFF] text-[#553BE2]'}`}>
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
              <div key={label} className={`rounded-xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-[#E4DFF5] bg-[#F2EEFF]'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>{label}</p>
                <p className={`mt-1 text-xs font-bold leading-5 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{value || 'unknown'}</p>
              </div>
            ))}
          </div>
          <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-[#E4DFF5] bg-[#F2EEFF]'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-200' : 'text-[#553BE2]'}`}>Recommended Colors</p>
            <p className={`mt-1 text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
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
          <button type="button" onClick={() => setIsAccountModalOpen(true)} className="px-4 py-2 rounded-full bg-[#553BE2] text-white text-xs font-semibold hover:opacity-95 transition-opacity">
            Manage Accounts
          </button>
        </div>
      )}

      {/* NOVA Reward Points card */}
      <section className={`rounded-2xl p-4 flex items-center justify-between shadow-sm border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80' : 'glass-card border-transparent'}`}>
        <div className="space-y-0.5">
          <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
            <span className="material-symbols-outlined text-[#553BE2] text-[14px]">stars</span> NOVA Points
          </p>
          <h3 className="text-2xl font-extrabold text-[#553BE2]">{novaPoints.toLocaleString()}</h3>
        </div>
        
        <div className="text-right">
          <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Level {novaLevel}</p>
          <div className={`w-32 h-1.5 rounded-full mt-1.5 overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-[#ECE7FF]'}`}>
            <div className="h-full bg-[#553BE2] rounded-full" style={{ width: `${Math.max(0, Math.min(100, levelProgress))}%` }}></div>
          </div>
          <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
            {pointsToNextLevel > 0 ? `Next level in ${pointsToNextLevel} pts` : 'Max level reached'}
          </p>
        </div>
      </section>

      {/* Measurements Component segment */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>My Measurements</h3>
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="text-xs font-semibold text-[#553BE2] flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            Edit <span className="material-symbols-outlined text-sm leading-none">edit</span>
          </button>
        </div>
        <div className={`rounded-2xl p-4 border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80' : 'glass-card border-transparent'}`}>
          <div className={`grid grid-cols-5 gap-1 text-center divide-x ${isDarkMode ? 'divide-slate-700' : 'divide-[#E4DFF5]'}`}>
            {measurements.map((m, idx) => (
              <div key={m.label} className="flex flex-col items-center px-1">
                <span className="material-symbols-outlined text-[#553BE2] text-lg mb-1 leading-none">{m.iconName}</span>
                <span className={`text-[9px] font-medium leading-none mb-1 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>{m.label}</span>
                <span className={`text-xs font-bold truncate block w-full ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preferences Component */}
      <section className="space-y-3">
        <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>My Preferences</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-3 flex flex-col items-center text-center gap-1 transition-colors cursor-pointer border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600' : 'glass-card border-transparent hover:border-[#E4DFF5]'}`}>
            <span className="material-symbols-outlined text-[#553BE2] text-xl leading-none">style</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Style</span>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{preferences.find(p => p.label === 'Style')?.value || 'Streetwear'}</span>
          </div>

          <div className={`rounded-2xl p-3 flex flex-col items-center text-center gap-1 transition-colors cursor-pointer border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600' : 'glass-card border-transparent hover:border-[#E4DFF5]'}`}>
            <span className="material-symbols-outlined text-[#553BE2] text-xl leading-none">fit_screen</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Fit</span>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{preferences.find(p => p.label === 'Fit')?.value || 'Regular'}</span>
          </div>

          <div className={`rounded-2xl p-3 flex flex-col items-center text-center gap-1 transition-colors cursor-pointer border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600' : 'glass-card border-transparent hover:border-[#E4DFF5]'}`}>
            <span className="material-symbols-outlined text-[#553BE2] text-xl leading-none">palette</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Colors</span>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{preferences.find(p => p.label === 'Colors')?.value || 'Mix'}</span>
          </div>

          <div className={`rounded-2xl p-3 flex flex-col items-center text-center gap-1 transition-colors cursor-pointer border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600' : 'glass-card border-transparent hover:border-[#E4DFF5]'}`}>
            <span className="material-symbols-outlined text-[#553BE2] text-xl leading-none">event</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>Occasion</span>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{preferences.find(p => p.label === 'Occasion')?.value || 'Casual'}</span>
          </div>
        </div>

        {/* Athletic body fit indicator */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className={`rounded-2xl p-4 flex items-center gap-3 border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80' : 'glass-card border-[#E4DFF5]'}`}>
            <span className={`material-symbols-outlined text-3xl opacity-75 ${isDarkMode ? 'text-indigo-300' : 'text-[#553BE2]'}`}>accessibility_new</span>
            <div className="flex-1 leading-tight">
              <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>BODY TYPE</p>
              <p className={`text-xs font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Athletic</p>
              <div className={`w-full h-1 rounded-full mt-1.5 overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-[#ECE7FF]'}`}>
                <div className="h-full bg-[#553BE2]" style={{ width: '75%' }}></div>
              </div>
              <p className={`text-[8px] text-right font-bold mt-1 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>75% Match</p>
            </div>
          </div>

          <div className={`rounded-2xl p-4 flex flex-col justify-center border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80' : 'glass-card border-[#E4DFF5]'}`}>
            <p className={`text-[9px] font-bold flex items-center gap-1 uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
              <span className="material-symbols-outlined text-xs">straighten</span> Size Recommend
            </p>
            <div className="flex justify-between items-end mt-2 leading-none">
              <div>
                <span className={`text-[8px] font-bold block mb-0.5 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>TOPWEAR</span>
                <span className={`text-base font-extrabold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>M</span>
              </div>
              <div className={`h-6 w-px ${isDarkMode ? 'bg-slate-600' : 'bg-[#E4DFF5]'}`}></div>
              <div className="text-right">
                <span className={`text-[8px] font-bold block mb-0.5 ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>BOTTOM</span>
                <span className={`text-base font-extrabold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>32</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating alert for ProfileView */}
      {profileToast && (
        <div className="fixed top-20 inset-x-4 z-50 bg-[#131426]/95 backdrop-blur-md text-white text-xs font-bold text-center px-4 py-3 rounded-xl shadow-lg border border-[#553BE2]/30 animate-pulse">
          {profileToast}
        </div>
      )}

      {/* Persistent Saved Items (Wishlist) Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-base font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-100' : 'text-[#131426]'}`}>
            <span className="material-symbols-outlined text-[#553BE2] text-lg leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            Saved Items {wishlist.length > 0 && `(${wishlist.length})`}
          </h3>
          {wishlist.length > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDarkMode ? 'bg-indigo-500/10 text-indigo-200' : 'bg-[#F2EEFF] text-[#553BE2]'}`}>
              Tap bag to add
            </span>
          )}
        </div>

        {wishlist.length === 0 ? (
          <div className={`rounded-2xl p-6 text-center space-y-3 border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80' : 'glass-card border-[#E4DFF5]'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto border ${isDarkMode ? 'bg-indigo-500/10 text-indigo-300 border-slate-700' : 'bg-[#F2EEFF] text-[#553BE2] border-[#E4DFF5]'}`}>
              <span className="material-symbols-outlined text-2xl font-bold">favorite_border</span>
            </div>
            <div className="space-y-1">
              <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>Wishlist is empty</h4>
              <p className={`text-[10px] leading-normal max-w-[220px] mx-auto ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
                Save your favorite styling coordinates and match pieces here!
              </p>
            </div>
            <button 
              onClick={() => onNavigate('home')}
              className="bg-[#553BE2] hover:opacity-95 text-[10px] font-black text-white px-3.5 py-1.5 rounded-xl uppercase tracking-wide transition-all shadow-sm shadow-[#553BE2]/20 cursor-pointer active:scale-95 inline-block"
            >
              Explore Looks
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {wishlist.map((productId) => {
              const matchedProd = products[productId];
              if (!matchedProd) return null;
              
              const defaultColor = getDefaultProductColor(matchedProd);
              const defaultSize = matchedProd.sizes && matchedProd.sizes.length > 0 ? matchedProd.sizes[0] : 'One Size';

              return (
                <div 
                  key={productId}
                  className="glass-card rounded-2xl p-3 flex items-center gap-3 hover:bg-white hover:shadow-sm transition-all border border-[#E4DFF5]"
                >
                  <div 
                    onClick={() => {
                      if (productId === 'lavender-hoodie') {
                        onNavigate('product-details');
                      } else {
                        onNavigate('product-details');
                      }
                    }}
                    className="w-14 h-14 rounded-xl bg-[#F2EEFF] overflow-hidden shrink-0 border border-[#E4DFF5] cursor-pointer flex items-center justify-center relative group"
                  >
                    <img 
                      alt={matchedProd.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      referrerPolicy="no-referrer"
                      src={matchedProd.imageUrl}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0 leading-tight">
                    <span className="text-[8px] font-bold text-[#5E667A] uppercase tracking-widest block mb-0.5">{matchedProd.category}</span>
                    <h4 
                      onClick={() => onNavigate('product-details')}
                      className="text-xs font-bold text-[#131426] truncate hover:text-[#553BE2] cursor-pointer transition-colors"
                    >
                      {matchedProd.name}
                    </h4>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-black text-[#553BE2]">
                        ₹{matchedProd.price.toLocaleString()}
                      </span>
                      <span className="text-[9px] font-bold text-[#5E667A] flex items-center gap-0.5">
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
                      className="w-9 h-9 rounded-xl bg-[#F2EEFF] hover:bg-[#ECE7FF] text-[#553BE2] border border-[#E4DFF5] flex items-center justify-center transition-all cursor-pointer active:scale-95"
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

      {/* Persistent Saved Looks Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-base font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-100' : 'text-[#131426]'}`}>
            <span className="material-symbols-outlined text-[#553BE2] text-lg leading-none">auto_awesome</span>
            Saved Looks {savedLooks.length > 0 && `(${savedLooks.length})`}
          </h3>
          {savedLooks.length > 0 && (
            <button
              onClick={() => setIsSavedLooksModalOpen(true)}
              className="text-xs font-semibold text-[#553BE2] hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-0.5"
            >
              View All <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          )}
        </div>

        {savedLooks.length === 0 ? (
          <div className={`rounded-2xl p-6 text-center space-y-3 border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80' : 'glass-card border-[#E4DFF5]'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto border ${isDarkMode ? 'bg-indigo-500/10 text-indigo-300 border-slate-700' : 'bg-[#F2EEFF] text-[#553BE2] border-[#E4DFF5]'}`}>
              <span className="material-symbols-outlined text-2xl font-bold">checkroom</span>
            </div>
            <div className="space-y-1">
              <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>No saved looks yet</h4>
              <p className={`text-[10px] leading-normal max-w-[220px] mx-auto ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
                Try on outfits in AR and tap "Save Look" to curate your virtual wardrobe!
              </p>
            </div>
            <button 
              onClick={() => onNavigate('ar-tryon')}
              className="bg-[#553BE2] hover:opacity-95 text-[10px] font-black text-white px-3.5 py-1.5 rounded-xl uppercase tracking-wide transition-all shadow-sm shadow-[#553BE2]/20 cursor-pointer active:scale-95 inline-block"
            >
              Try On Outfits
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {savedLooks.slice(0, 4).map((look) => (
              <div
                key={look.id}
                onClick={() => setSelectedLookPreview(look)}
                className={`rounded-2xl p-2.5 flex flex-col gap-2 border transition-all cursor-pointer hover:scale-[1.02] ${
                  isDarkMode
                    ? 'bg-slate-900/60 border-slate-700/80 hover:border-[#6D4AFF]'
                    : 'glass-card border-[#E4DFF5] hover:border-[#553BE2]'
                }`}
              >
                <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 relative border border-white/10">
                  <img
                    alt={look.garmentName}
                    src={look.thumbnailUrl || look.imageUrl}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[8px] font-bold text-white flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[9px] text-[#A594FD]">auto_awesome</span>
                    <span>AI Look</span>
                  </div>
                </div>
                <div className="leading-tight px-0.5">
                  <h4 className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>
                    {look.garmentName}
                  </h4>
                  <p className={`text-[9px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                    {new Date(look.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions grids */}
      <section className="space-y-3">
        <h3 className={`text-base font-bold ${isDarkMode ? 'text-slate-100' : 'text-[#131426]'}`}>{t('profile.quickActions')}</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: t('profile.qa.savedLooks'), icon: 'auto_awesome', action: () => setIsSavedLooksModalOpen(true) },
            { label: t('profile.qa.tryOnHistory'), icon: 'history', target: 'scan-outfit' },
            { label: t('profile.qa.myScans'), icon: 'center_focus_strong', target: 'camera-scan' },
            { label: t('profile.qa.coupons'), icon: 'local_offer', target: 'cart' }
          ].map((act) => (
            <button 
              key={act.label}
              onClick={() => (act as any).action ? (act as any).action() : onNavigate((act as any).target)}
              className={`rounded-2xl p-3 flex flex-col items-center justify-center gap-2 transition-all group border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600' : 'glass-card border-transparent hover:border-[#E4DFF5]'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm ${isDarkMode ? 'bg-indigo-500/10 text-indigo-300' : 'bg-[#F2EEFF] text-[#553BE2]'}`}>
                <span className="material-symbols-outlined text-lg leading-none">{act.icon}</span>
              </div>
              <span className={`text-[9px] font-bold text-center leading-tight whitespace-pre-line ${isDarkMode ? 'text-slate-200' : 'text-[#5E667A]'}`}>{act.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Settings list actions */}
      <section className={`rounded-3xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-800/40 divide-slate-700/50' : 'glass-card divide-[#E4DFF5]'}`}>
        <ul className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-[#E4DFF5]'}`}>
          {[
            { label: t('profile.settings.wishlist'), icon: 'favorite', action: () => setIsWishlistModalOpen(true), extra: wishlist.length > 0 ? `${wishlist.length} Items` : '0' },
            { label: t('profile.settings.savedLooks'), icon: 'auto_awesome', action: () => setIsSavedLooksModalOpen(true), extra: savedLooks.length > 0 ? `${savedLooks.length} Look(s)` : '0' },
            { label: t('profile.settings.paymentMethods'), icon: 'payment', action: () => setIsPaymentModalOpen(true), extra: `${paymentMethods.filter((p: any) => p.type === 'Credit Card').length} Card(s), ${paymentMethods.filter((p: any) => p.type === 'UPI').length} UPI` },
            { label: t('profile.settings.addresses'), icon: 'location_on', action: () => setIsAddressesModalOpen(true), extra: `${addresses.length} Saved` },
            { label: t('profile.settings.darkMode'), icon: isDarkMode ? 'light_mode' : 'dark_mode', action: () => { setIsDarkMode?.(!isDarkMode); localStorage.setItem('isDarkMode', JSON.stringify(!isDarkMode)); }, extra: isDarkMode ? 'ON' : 'OFF' },
            { label: t('profile.settings.privacy'), icon: 'lock', action: () => setIsPrivacyModalOpen(true) },
            { label: t('profile.settings.terms'), icon: 'gavel', action: () => onNavigate('terms'), extra: `v${TERMS_VERSION}` },
            { label: t('profile.settings.privacyPolicy'), icon: 'policy', action: () => onNavigate('privacy'), extra: `v${PRIVACY_VERSION}` },
            { label: t('profile.settings.notifications'), icon: 'notifications', action: () => setIsNotificationsModalOpen(true), extra: `${Object.values(notificationsSettings).filter(Boolean).length} Active` },
            { label: t('profile.settings.language'), icon: 'language', extra: language.label, action: () => setIsLanguageModalOpen(true) }
          ].map((item) => (
            <li key={item.label}>
              <button 
                onClick={() => item.action ? item.action() : alert(`Simulated link clicked: ${item.label}`)}
                className={`w-full flex items-center justify-between p-4 transition-colors text-left group ${ isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-[#F2EEFF]/40'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined transition-colors ${isDarkMode ? 'text-slate-500 group-hover:text-indigo-400' : 'text-[#5E667A] group-hover:text-[#553BE2]'}`}>{item.icon}</span>
                  <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-[#131426]'}`}>{item.label}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-[#8E96AA]'}`}>
                  {item.extra && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'text-indigo-300 bg-indigo-950/70' : 'text-[#553BE2] bg-[#F2EEFF]'}`}>{item.extra}</span>}
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
                <span className="text-sm font-bold">{t('profile.settings.logout')}</span>
              </div>
            </button>
          </li>
        </ul>
      </section>

      {/* Edit Measurements Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-[#131426]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFF5] rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <h3 className="text-lg font-bold text-[#131426]">{t('profile.measurements.title')}</h3>
            <form onSubmit={handleSaveMeasurements} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">{t('profile.measurements.height')}</label>
                <input 
                  type="text" 
                  value={editHeight} 
                  onChange={(e) => setEditHeight(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">{t('profile.measurements.weight')}</label>
                <input 
                  type="text" 
                  value={editWeight} 
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">{t('profile.measurements.chest')}</label>
                <input 
                  type="text" 
                  value={editChest} 
                  onChange={(e) => setEditChest(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">{t('profile.measurements.waist')}</label>
                <input 
                  type="text" 
                  value={editWaist} 
                  onChange={(e) => setEditWaist(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">{t('profile.measurements.inseam')}</label>
                <input 
                  type="text" 
                  value={editInseam} 
                  onChange={(e) => setEditInseam(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] rounded-xl hover:bg-[#F2EEFF] hover:text-[#131426] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 text-xs font-bold text-white bg-[#553BE2] rounded-xl hover:opacity-95 transition-opacity"
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
        <div className="fixed inset-0 bg-[#131426]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFF5] rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#131426]">{t('profile.editProfile.title')}</h3>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-[#5E667A] hover:text-[#131426] p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-lg leading-none">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              {/* Profile Photo Upload & Preview */}
              <div className="flex flex-col items-center justify-center py-2 space-y-2">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#553BE2] shadow-md shadow-[#553BE2]/15 bg-[#F2EEFF] relative">
                    <img 
                      alt="Avatar preview" 
                      className="w-full h-full object-cover"
                      src={editProfilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName || userName || 'NOVA User')}&background=ECE7FF&color=553BE2&bold=true`}
                    />
                    <button
                      type="button"
                      onClick={() => profilePhotoInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer"
                      aria-label={t('profile.editProfile.changePhoto')}
                    >
                      <span className="material-symbols-outlined text-lg mb-0.5">photo_camera</span>
                      <span>{t('profile.editProfile.changePhoto')}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => profilePhotoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 bg-[#553BE2] hover:bg-[#462CC9] text-white p-2 rounded-full shadow border-2 border-white transition-all cursor-pointer hover:scale-110 active:scale-95"
                    aria-label={t('profile.editProfile.uploadPhoto')}
                  >
                    <span className="material-symbols-outlined text-[13px] leading-none">photo_camera</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => profilePhotoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F2EEFF] text-[#553BE2] hover:bg-[#E4DFF5] transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">upload</span>
                    <span>{editProfilePhoto ? t('profile.editProfile.changePhoto') : t('profile.editProfile.uploadPhoto')}</span>
                  </button>
                  {editProfilePhoto && (
                    <button
                      type="button"
                      onClick={() => setEditProfilePhoto('')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm leading-none">delete</span>
                      <span>{t('profile.editProfile.removePhoto')}</span>
                    </button>
                  )}
                </div>

                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await compressProfileImage(file);
                      setEditProfilePhoto(dataUrl);
                    } catch (err) {
                      console.error('Failed to load image:', err);
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">{t('profile.editProfile.name')}</label>
                <input 
                  type="text" 
                  value={profileName} 
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">{t('profile.editProfile.email')}</label>
                <input 
                  type="email" 
                  value={profileEmail} 
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">{t('profile.editProfile.phone')}</label>
                <input 
                  type="text" 
                  value={profilePhone} 
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5E667A] mb-1 leading-none">LOCATION</label>
                <input 
                  type="text" 
                  value={profileLocation} 
                  onChange={(e) => setProfileLocation(e.target.value)}
                  className="w-full p-2.5 bg-[#F2EEFF] border border-[#E4DFF5] rounded-xl text-sm font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] rounded-xl hover:bg-[#F2EEFF] hover:text-[#131426] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 py-3 text-xs font-bold text-white bg-[#553BE2] rounded-xl hover:opacity-95 transition-opacity"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
              {profileSaveError && (
                <p className="text-xs font-medium text-rose-600" role="alert">{profileSaveError}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Payment Methods Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#131426]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFF5] rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#131426] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#553BE2]">payment</span>
                Payment Methods
              </h3>
              <button 
                onClick={() => { setIsPaymentModalOpen(false); setIsAddingCard(false); setIsAddingUPI(false); }}
                className="text-[#8E96AA] hover:text-[#5E667A] outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* List existing items */}
            <div className="space-y-3">
              {paymentMethods.map((pm: any) => (
                <div 
                  key={pm.id}
                  className="bg-gradient-to-r from-[#553BE2] to-[#4E3AC8] rounded-2xl p-4 text-white relative shadow-md overflow-hidden"
                >
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#ECE7FF] tracking-wider">
                        {pm.type}
                      </span>
                      <div className="mt-0.5 flex items-center gap-2">
                        <h4 className="text-sm font-black">{pm.provider}</h4>
                        {pm.type === 'UPI' && <GooglePayMark className="rounded bg-white px-1.5 py-0.5 text-xs" />}
                      </div>
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

                  <div className="flex justify-between items-center text-xs text-[#ECE7FF] font-bold">
                    <span>{pm.cardholder || userName}</span>
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
                <p className="text-xs text-[#5E667A] text-center py-4 bg-[#F2EEFF] rounded-2xl border border-[#E4DFF5]">
                  No payment options configured yet. Add one below!
                </p>
              )}
            </div>

            {/* Addition Forms buttons */}
            {!isAddingCard && !isAddingUPI && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  onClick={() => setIsAddingCard(true)}
                  className="py-2.5 px-3 bg-[#F2EEFF] hover:bg-[#ECE7FF] text-[#553BE2] text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">credit_card</span> Add Card
                </button>
                <button 
                  onClick={() => setIsAddingUPI(true)}
                  className="py-2.5 px-3 bg-[#F2EEFF] hover:bg-[#ECE7FF] text-[#553BE2] text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
                >
                  <GooglePayMark className="text-sm" /> Register UPI
                </button>
              </div>
            )}

            {/* Add card template */}
            {isAddingCard && (
              <form onSubmit={handleAddCard} className="bg-[#F2EEFF] rounded-2xl p-4 space-y-3 animate-fade-in border border-[#E4DFF5]">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-[#131426] uppercase tracking-wider">Add Card</h4>
                  <button type="button" onClick={() => setIsAddingCard(false)} className="text-[#8E96AA] hover:text-[#5E667A]">
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
                    className="w-full p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="MM/YY"
                      value={newCardExpiry}
                      onChange={(e) => setNewCardExpiry(e.target.value)}
                      className="p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Cardholder Name"
                      value={newCardHolder}
                      onChange={(e) => setNewCardHolder(e.target.value)}
                      className="p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-2 bg-[#553BE2] hover:opacity-95 text-white font-bold text-xs rounded-xl transition-opacity"
                >
                  Save Card Account
                </button>
              </form>
            )}

            {/* Add UPI handle form template */}
            {isAddingUPI && (
              <form onSubmit={handleAddUPI} className="bg-[#F2EEFF] rounded-2xl p-4 space-y-3 animate-fade-in border border-[#E4DFF5]">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-[#131426] uppercase tracking-wider">Register UPI Handle</h4>
                  <button type="button" onClick={() => setIsAddingUPI(false)} className="text-[#8E96AA] hover:text-[#5E667A]">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="Enter UPI Address (e.g., mail@upi)"
                    value={newUPIHandle}
                    onChange={(e) => setNewUPIHandle(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                    required
                  />
                  <p className="text-[9px] text-[#5E667A]">Instantly links Google Pay, PhonePe, Paytm, and BHIM UPI networks.</p>
                </div>
                <button 
                  type="submit"
                  className="w-full py-2 bg-[#553BE2] hover:opacity-95 text-white font-bold text-xs rounded-xl transition-opacity"
                >
                  Link UPI Address
                </button>
              </form>
            )}

            <button 
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="w-full py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] hover:bg-[#F2EEFF] hover:text-[#131426] rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Addresses Modal */}
      {isAddressesModalOpen && (
        <div className="fixed inset-0 bg-[#131426]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFF5] rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#131426] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#553BE2]">location_on</span>
                Saved Addresses
              </h3>
              <button 
                onClick={() => { setIsAddressesModalOpen(false); setIsAddingAddress(false); }}
                className="text-[#8E96AA] hover:text-[#5E667A] outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* List saved shipping places */}
            <div className="space-y-3">
              {addresses.map((addr: any) => (
                <div 
                  key={addr.id}
                  role="radio"
                  aria-checked={selectedAddressId === addr.id}
                  aria-label={`${addr.label}, ${addr.name}, ${addr.street}, ${addr.city}`}
                  tabIndex={0}
                  onClick={() => handleSelectAddress(addr)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectAddress(addr);
                    }
                  }}
                  className={`border rounded-2xl p-4 bg-[#F2EEFF] relative transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#553BE2] ${
                    selectedAddressId === addr.id
                      ? 'border-[#8D79F5] ring-1 ring-[#8D79F5]/30'
                      : 'border-[#E4DFF5] hover:border-[#553BE2]/40'
                  }`}
                >
                  <div className="flex items-center gap-2 pr-8 text-[#553BE2] mb-1.5">
                    <span className="material-symbols-outlined text-lg">{addr.icon}</span>
                    <span className="text-xs font-extrabold uppercase tracking-wide bg-[#F2EEFF] px-2 py-0.5 rounded-full text-[#553BE2]">
                      {addr.label}
                    </span>
                    {selectedAddressId === addr.id && (
                      <span className="ml-auto text-[9px] font-bold text-[#553BE2]">{t('profile.selected')}</span>
                    )}
                  </div>

                  <h4 className="text-xs font-black text-[#131426]">{addr.name}</h4>
                  <p className="text-[11px] text-[#5E667A] mt-1 leading-normal">
                    {addr.street}, {addr.city}, PIN {addr.zip}
                  </p>
                  <p className="text-[11px] text-[#5E667A] mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">phone</span> {addr.phone}
                  </p>

                  <button 
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteAddress(addr.id);
                    }}
                    className="absolute right-3 top-3 w-7 h-7 hover:bg-white hover:text-red-500 rounded-xl flex items-center justify-center text-[#8E96AA] transition-colors"
                    title="Delete shipping location"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}

              {addresses.length === 0 && (
                <p className="text-xs text-[#5E667A] text-center py-4 bg-[#F2EEFF] border border-[#E4DFF5] rounded-2xl">
                  No addresses registered. Please input one below!
                </p>
              )}
            </div>

            {/* Addition form button toggle layout */}
            {!isAddingAddress ? (
              <button 
                onClick={() => setIsAddingAddress(true)}
                className="w-full py-2.5 px-3 bg-[#F2EEFF] hover:bg-[#ECE7FF] text-[#553BE2] text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-sm">add_location_alt</span> Define New Address
              </button>
            ) : (
              <form onSubmit={handleAddAddress} className="bg-[#F2EEFF] rounded-2xl p-4 space-y-3 animate-fade-in border border-[#E4DFF5]">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-[#131426] uppercase tracking-widest">Add Address</h4>
                  <button type="button" onClick={() => setIsAddingAddress(false)} className="text-[#8E96AA] hover:text-[#5E667A]">
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
                      className="p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Recipient Full Name"
                      value={addrName}
                      onChange={(e) => setAddrName(e.target.value)}
                      className="p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                      required
                    />
                  </div>
                  
                  <input 
                    type="text" 
                    placeholder="Street Address, Bldg, Area details"
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                    required
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="City (e.g. Bangalore)"
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      className="p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="ZIP Pin Code"
                      maxLength={6}
                      value={addrZip}
                      onChange={(e) => setAddrZip(e.target.value)}
                      className="p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                      required
                    />
                  </div>

                  <input 
                    type="text" 
                    placeholder="Phone number"
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E4DFF5] rounded-lg text-xs font-semibold text-[#131426] focus:outline-none focus:border-[#553BE2]"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2 bg-[#553BE2] hover:opacity-95 text-white font-bold text-xs rounded-xl transition-opacity"
                >
                  Register Address
                </button>
              </form>
            )}

            <button 
              type="button"
              onClick={() => setIsAddressesModalOpen(false)}
              className="w-full py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] hover:bg-[#F2EEFF] hover:text-[#131426] rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Privacy & Security Modal */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 bg-[#131426]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFF5] rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#131426] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#553BE2]">lock</span>
                Privacy & Security
              </h3>
              <button 
                onClick={() => setIsPrivacyModalOpen(false)}
                className="text-[#8E96AA] hover:text-[#5E667A] outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="divide-y divide-[#E4DFF5] space-y-3.5">
              {/* Toggle row */}
              <div className="flex justify-between items-center pt-2">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-[#131426]">Biometric Sign-In</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    Lock access to saved payment info with Touch/Face ID simulation.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => togglePrivacyField('biometricLogin', 'Biometric Sign-In')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${privacySettings.biometricLogin ? 'bg-[#553BE2]' : 'bg-[#E4DFF5]'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${privacySettings.biometricLogin ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Toggle row */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-[#131426]">2-Factor Authentication</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    Send secure OTP triggers during checkout processes.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => togglePrivacyField('twoFactorAuth', 'Two-Factor Authentication')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${privacySettings.twoFactorAuth ? 'bg-[#553BE2]' : 'bg-[#E4DFF5]'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${privacySettings.twoFactorAuth ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Toggle row */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-[#131426]">Incognito AR Scan</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    Do not store fitting simulation snaps or scans to local history logs.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => togglePrivacyField('incognitoScan', 'Incognito AR Scan')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${privacySettings.incognitoScan ? 'bg-[#553BE2]' : 'bg-[#E4DFF5]'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${privacySettings.incognitoScan ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Toggle row */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-[#131426]">AI Stylist Personalization</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    Share custom metric specs with neural matching algorithms.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => togglePrivacyField('shareFittings', 'AI Stylist Personalization')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${privacySettings.shareFittings ? 'bg-[#553BE2]' : 'bg-[#E4DFF5]'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${privacySettings.shareFittings ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Legal Documents & Read-Only Consent Record */}
              <div className="pt-3.5 space-y-2.5">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-[#131426]">Legal Documents &amp; Consent</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    {legalConsent && legalConsent.accepted
                      ? `Accepted Terms v${legalConsent.termsVersion} & Privacy v${legalConsent.privacyVersion} on ${new Date(legalConsent.consentedAt).toLocaleDateString()} (read-only record).`
                      : `Review NOVA's current Terms & Conditions (v${TERMS_VERSION}) and Privacy Policy (v${PRIVACY_VERSION}).`}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrivacyModalOpen(false);
                      onNavigate('terms');
                    }}
                    className="py-2 px-3 rounded-xl bg-[#F2EEFF] hover:bg-[#ECE7FF] border border-[#E4DFF5] text-[11px] font-bold text-[#553BE2] transition-colors cursor-pointer"
                  >
                    Terms &amp; Conditions
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrivacyModalOpen(false);
                      onNavigate('privacy');
                    }}
                    className="py-2 px-3 rounded-xl bg-[#F2EEFF] hover:bg-[#ECE7FF] border border-[#E4DFF5] text-[11px] font-bold text-[#553BE2] transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setIsPrivacyModalOpen(false)}
              className="w-full mt-2 py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] hover:bg-[#F2EEFF] hover:text-[#131426] rounded-xl transition-colors"
            >
              Done & Save
            </button>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {isNotificationsModalOpen && (
        <div className="fixed inset-0 bg-[#131426]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFF5] rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#131426] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#553BE2]">notifications</span>
                Notification Settings
              </h3>
              <button 
                onClick={() => setIsNotificationsModalOpen(false)}
                className="text-[#8E96AA] hover:text-[#5E667A] outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="divide-y divide-[#E4DFF5] space-y-3.5">
              {/* Price Drop Alerts */}
              <div className="flex justify-between items-center pt-2">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-[#131426]">Price Drop Alerts</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    Notify immediately if items in your wishlist drop in price.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => toggleNotificationField('priceDrops', 'Price Drops')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${notificationsSettings.priceDrops ? 'bg-[#553BE2]' : 'bg-[#E4DFF5]'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${notificationsSettings.priceDrops ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* New Season Drops */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-[#131426]">New Wardrobe Capsule arrivals</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    Inform when fresh curated trends land on style list.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => toggleNotificationField('newArrivals', 'New Arrivals')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${notificationsSettings.newArrivals ? 'bg-[#553BE2]' : 'bg-[#E4DFF5]'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${notificationsSettings.newArrivals ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* AI Stylist Reminders */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-[#131426]">AI Stylist Advice</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    Curated fits matching current weather patterns or trips.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => toggleNotificationField('stylistReminders', 'Stylist Reminders')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${notificationsSettings.stylistReminders ? 'bg-[#553BE2]' : 'bg-[#E4DFF5]'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${notificationsSettings.stylistReminders ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Order Tracking */}
              <div className="flex justify-between items-center pt-3.5">
                <div className="space-y-0.5 max-w-[70%]">
                  <h4 className="text-xs font-black text-[#131426]">Order & Delivery Tracking</h4>
                  <p className="text-[10px] text-[#5E667A] leading-normal">
                    Continuous push notifications for active package transport status.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => toggleNotificationField('orderUpdates', 'Order Tracking')}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 cursor-pointer select-none ${notificationsSettings.orderUpdates ? 'bg-[#553BE2]' : 'bg-[#E4DFF5]'}`}
                >
                  <span className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform ${notificationsSettings.orderUpdates ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setIsNotificationsModalOpen(false)}
              className="w-full mt-2 py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] hover:bg-[#F2EEFF] hover:text-[#131426] rounded-xl transition-colors"
            >
              Done & Save
            </button>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {isLanguageModalOpen && (
        <div className="fixed inset-0 bg-[#131426]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFF5] rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#131426] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#553BE2]">language</span>
                {t('profile.language.title')}
              </h3>
              <button 
                onClick={() => setIsLanguageModalOpen(false)}
                className="text-[#8E96AA] hover:text-[#5E667A] outline-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-2">
              {languages.map((lang) => (
                <button 
                  key={lang.code}
                  type="button"
                  onClick={() => setPendingLocale(lang.code)}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between border transition-all text-left ${pendingLocale === lang.code ? 'border-[#553BE2] bg-[#F2EEFF] text-[#131426] font-bold' : 'border-[#E4DFF5] hover:border-[#553BE2]/40 text-[#131426] font-semibold bg-[#F2EEFF]'}`}
                >
                  <div className="leading-none">
                    <span className="text-xs block">{lang.nativeName}</span>
                    <span className="text-[10px] text-[#5E667A] mt-0.5 block">{lang.label}</span>
                  </div>
                  {pendingLocale === lang.code && (
                    <span className="material-symbols-outlined text-[#553BE2] font-bold text-base">check</span>
                  )}
                </button>
              ))}
            </div>

            <button 
              type="button"
              onClick={handleApplyLanguage}
              disabled={pendingLocale === locale || isApplyingLanguage}
              className="w-full py-3 text-xs font-bold text-white bg-[#553BE2] hover:opacity-95 rounded-xl transition-opacity disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isApplyingLanguage && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
              {isApplyingLanguage ? t('profile.language.applying') : t('profile.language.apply')}
            </button>

            <button 
              type="button"
              onClick={() => setIsLanguageModalOpen(false)}
              className="w-full py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] hover:bg-[#F2EEFF] hover:text-[#131426] rounded-xl transition-colors"
            >
              {t('profile.language.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Wishlist Modal */}
      {isWishlistModalOpen && (
        <div className="fixed inset-0 bg-[#131426]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4DFF5] rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scale-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-[#E4DFF5]">
              <h3 className="text-lg font-bold text-[#131426] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#553BE2] fill-current" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                My Saved Wishlist
              </h3>
              <button 
                onClick={() => setIsWishlistModalOpen(false)}
                className="text-[#8E96AA] hover:text-[#5E667A] outline-none"
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
                  
                  const defaultColor = getDefaultProductColor(item);
                  const defaultSize = item.sizes && item.sizes.length > 0 ? item.sizes[0] : 'M';

                  return (
                    <div 
                      key={productId}
                      className="flex items-center gap-3 bg-[#F2EEFF] hover:bg-[#F2EEFF] border border-[#E4DFF5] p-2.5 rounded-2xl relative transition-all"
                    >
                      <img 
                        src={item.imageUrl} 
                        alt={item.name} 
                        className="w-14 h-14 object-cover rounded-xl shrink-0"
                      />
                      <div className="flex-1 min-w-0 pr-6">
                        <span className="text-[9px] uppercase font-bold text-[#553BE2] block leading-none mb-0.5">
                          {item.category}
                        </span>
                        <h4 className="text-xs font-bold text-[#131426] truncate">{item.name}</h4>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xs font-black text-[#553BE2]">₹{item.price.toLocaleString()}</span>
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
                        className="absolute right-2 top-2 p-1 text-[#8E96AA] hover:text-rose-500 hover:bg-white rounded-lg transition-colors cursor-pointer"
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
                        className="absolute right-2 bottom-2 p-1.5 bg-[#F2EEFF] hover:bg-[#553BE2] text-[#553BE2] hover:text-white rounded-lg transition-all cursor-pointer"
                        title="Add to cart"
                      >
                        <span className="material-symbols-outlined text-xs leading-none">shopping_bag</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 px-4 bg-[#F2EEFF] rounded-2xl border border-dashed border-[#E4DFF5]">
                  <span className="material-symbols-outlined text-3xl text-[#8E96AA] mb-2">favorite_border</span>
                  <p className="text-xs text-[#131426] font-semibold">Your wishlist is empty</p>
                  <p className="text-[10px] text-[#5E667A] mt-1 leading-normal">
                    Explore garments in the showroom and tap the favorite heart icon to save products here.
                  </p>
                </div>
              )}
            </div>

            <button 
              type="button"
              onClick={() => setIsWishlistModalOpen(false)}
              className="w-full py-3 text-xs font-bold text-[#5E667A] bg-white border border-[#E4DFF5] hover:bg-[#F2EEFF] hover:text-[#131426] rounded-xl transition-colors mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* Saved Looks Modal */}
      {isSavedLooksModalOpen && (
        <div className="fixed inset-0 bg-[#131426]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-up max-h-[85vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-[#E4DFF5] text-[#131426]'
          }`}>
            <div className={`flex justify-between items-center pb-3 border-b ${isDarkMode ? 'border-slate-800' : 'border-[#E4DFF5]'}`}>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[#553BE2]">auto_awesome</span>
                {t('profile.savedLooks.title')} ({savedLooks.length})
              </h3>
              <button 
                onClick={() => setIsSavedLooksModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {savedLooks.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-[#F2EEFF] border-[#E4DFF5] text-[#553BE2]'}`}>
                  <span className="material-symbols-outlined text-3xl">checkroom</span>
                </div>
                <h4 className="text-sm font-bold">{t('profile.savedLooks.empty')}</h4>
                <p className="text-xs text-slate-400 max-w-[260px] mx-auto">
                  Try on outfits in AR Try-On and tap "Save Look" to save them to your phone gallery and profile.
                </p>
                <button
                  onClick={() => {
                    setIsSavedLooksModalOpen(false);
                    onNavigate('ar-tryon');
                  }}
                  className="bg-[#553BE2] hover:bg-[#4830cb] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer inline-block"
                >
                  {t('profile.savedLooks.goToAr')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {savedLooks.map((look) => (
                  <div
                    key={look.id}
                    onClick={() => setSelectedLookPreview(look)}
                    className={`rounded-2xl p-2 flex flex-col gap-1.5 border transition-all cursor-pointer hover:border-[#6D4AFF] group ${
                      isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-[#E4DFF5]'
                    }`}
                  >
                    <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-black relative border border-white/10">
                      <img
                        alt={look.garmentName}
                        src={look.thumbnailUrl || look.imageUrl}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSavedLook(look.id);
                        }}
                        title="Delete look"
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                    <div className="px-1">
                      <h4 className="text-xs font-bold truncate">{look.garmentName}</h4>
                      <p className="text-[10px] text-slate-400">
                        {new Date(look.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button 
              type="button"
              onClick={() => setIsSavedLooksModalOpen(false)}
              className="w-full py-3 text-xs font-bold rounded-xl transition-colors mt-2 bg-[#553BE2] text-white hover:bg-[#4830cb] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* High-Resolution Lightbox Viewer */}
      {selectedLookPreview && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="max-w-sm w-full space-y-3">
            <div className="flex justify-between items-center text-white px-1">
              <div>
                <h3 className="text-base font-bold truncate">{selectedLookPreview.garmentName}</h3>
                <p className="text-[11px] text-slate-400">
                  {new Date(selectedLookPreview.savedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLookPreview(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden bg-black border border-white/20 shadow-2xl relative">
              <img
                alt={selectedLookPreview.garmentName}
                src={selectedLookPreview.imageUrl}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleDownloadLook(selectedLookPreview)}
                className="py-2.5 px-3 rounded-xl bg-[#553BE2] hover:bg-[#4830cb] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>{t('profile.savedLooks.download')}</span>
              </button>
              <button
                onClick={() => handleDeleteSavedLook(selectedLookPreview.id)}
                className="py-2.5 px-3 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>{t('profile.savedLooks.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
