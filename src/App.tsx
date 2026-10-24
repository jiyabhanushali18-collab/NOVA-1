import React, { useEffect, useRef, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where, setDoc, doc } from 'firebase/firestore';
import { ScreenId, CartItem, Measurement, NovaAnalysisProfile, Preference, ProductItem, ProductReview, LegalConsentRecord, DeliveryAddress, NovaAccount } from './types';
import { products, swipeModels, recentScans as staticRecentScans } from './data';
import { auth, db, firebaseProjectId, saveUserToFirestore, waitForFirebaseAuthReady } from './firebase';

// Modular View Imports
import { analytics } from './services/analyticsService';
import { HomeView } from './components/HomeView';
import { ArTryOnView } from './components/ArTryOnView';
import { TryOnResultView } from './components/TryOnResultView';
import { CameraScanView } from './components/CameraScanView';
import { ProfileView } from './components/ProfileView';
import { ProductDetailsView } from './components/ProductDetailsView';
import { ScanOutfitView } from './components/ScanOutfitView';
import { ChatView } from './components/ChatView';
import { CartView } from './components/CartView';
import { ShowroomView } from './components/ShowroomView';
import { AuthView } from './components/AuthView';
import { EmailVerificationView } from './components/EmailVerificationView';
import { SplashView } from './components/SplashView';
import { OnboardingView } from './components/OnboardingView';
import { SetupPreferencesView } from './components/SetupPreferencesView';
import { VirtualWardrobeView } from './components/VirtualWardrobeView';
import { ProfileAnalysisView } from './components/ProfileAnalysisView';
import { LegalDocumentView } from './components/LegalDocumentView';
import { BottomNavBar } from './components/navigation/BottomNavBar';
import { QuickHubModal } from './components/navigation/QuickHubModal';
import useAccounts from './hooks/useAccounts';
import useActiveAccount from './hooks/useActiveAccount';
import accountService from './services/accountService';
import { recordUserConsent, verifyUserConsentStatus } from './services/consentService';
import {
  ensureUserSessionToken,
  fetchUserDeliveryAddress,
  formatDeliveryAddress,
  parseAddressToDeliveryAddress,
  saveSessionToken,
  writeCachedUserAddress,
} from './services/addressService';
import { PRIVACY_VERSION, TERMS_VERSION } from './legal/legalDocuments';
import { EMAIL_FOR_SIGN_IN_KEY, PENDING_EMAIL_SIGNUP_KEY } from './services/emailLinkAuth';
import { normalizeProductVariants } from './utils/productVariants';
import { useI18n } from './i18n';

const getStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const candidate = record.imageUrl || record.url || record.src || record.image;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  return undefined;
};

const getTimestampMs = (value: any) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const getProductImageVersion = (data: Record<string, any>) => (
  getTimestampMs(data.imageUpdatedAt)
  || getTimestampMs(data.updatedAt)
  || getTimestampMs(data.modifiedAt)
  || getTimestampMs(data.createdAt)
  || Number(data.version || 0)
);

const withImageVersion = (url: string, version: number) => {
  if (!url || !version || url.startsWith('data:') || url.startsWith('blob:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(String(version))}`;
};

const getColorValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const candidate = record.color || record.name || record.label;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  return undefined;
};

const normalizeColor = (value: unknown) => {
  return typeof value === 'string'
    ? value.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    : '';
};

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : typeof item === 'number' ? String(item).trim() : ''))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
};

const collectImageValues = (value: unknown): string[] => {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (typeof value === 'number') return [String(value).trim()];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectImageValues(item));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.imageUrl, record.url, record.src, record.image, record.img, record.image1, record.imageUrl1];
    return candidates.flatMap((item) => collectImageValues(item)).filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
  }

  return [];
};

const calculateRatingFromReviews = (product: ProductItem, reviews: ProductReview[]) => {
  if (!reviews || reviews.length === 0) {
    return {
      rating: product.rating,
      reviewsCount: product.reviewsCount
    };
  }

  const existingBaseCount = product.reviewsCount || 0;
  const existingTotal = existingBaseCount * (product.rating || 0);
  const reviewTotal = reviews.reduce((sum, review) => sum + review.rating, 0);
  const totalCount = existingBaseCount + reviews.length;
  const average = totalCount > 0 ? Number(((existingTotal + reviewTotal) / totalCount).toFixed(1)) : 0;

  return {
    rating: average,
    reviewsCount: totalCount
  };
};

const productReviewsStorageKey = 'nova_product_reviews';

const loadStoredProductReviews = (): Record<string, ProductReview[]> => {
  try {
    const stored = localStorage.getItem(productReviewsStorageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce((acc, [productId, reviews]) => {
      if (!Array.isArray(reviews)) return acc;
      const normalizedReviews = reviews
        .map((item): ProductReview | null => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
          const reviewObj = item as Record<string, unknown>;
          const source: 'product' | 'tryon' = reviewObj.source === 'tryon' ? 'tryon' : 'product';
          return {
            id: String(reviewObj.id || `${productId}-${Date.now()}`),
            reviewer: String(reviewObj.reviewer || 'Guest'),
            rating: Number(reviewObj.rating || 0),
            text: String(reviewObj.text || ''),
            date: String(reviewObj.date || new Date().toLocaleDateString()),
            source,
            accountUid: reviewObj.accountUid ? String(reviewObj.accountUid) : undefined
          };
        })
        .filter((review): review is ProductReview => review !== null && review.rating > 0);
      acc[productId] = normalizedReviews;
      return acc;
    }, {} as Record<string, ProductReview[]>);
  } catch {
    return {};
  }
};

const saveStoredProductReviews = (reviews: Record<string, ProductReview[]>) => {
  try {
    localStorage.setItem(productReviewsStorageKey, JSON.stringify(reviews));
  } catch {
    // ignore storage writing failures
  }
};

const addColorImage = (result: Record<string, string[]>, color: unknown, imageUrl: unknown) => {
  const imageUrls = collectImageValues(imageUrl);
  const colorString = getColorValue(color) || (typeof color === 'string' ? color.trim() : '');
  const normalized = normalizeColor(colorString);

  if (!normalized || imageUrls.length === 0) return;

  imageUrls.forEach((imageUrlString) => {
    if (!imageUrlString) return;
    result[normalized] = result[normalized] || [];
    if (!result[normalized].includes(imageUrlString)) result[normalized].push(imageUrlString);

    if (colorString) {
      result[colorString] = result[colorString] || [];
      if (!result[colorString].includes(imageUrlString)) result[colorString].push(imageUrlString);
    }
  });
};

const processColorImageSource = (result: Record<string, string[]>, source: unknown) => {
  if (!source) return;
  if (Array.isArray(source)) {
    source.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      addColorImage(result, (entry as any).color || (entry as any).name || (entry as any).label, (entry as any).imageUrl || (entry as any).image || (entry as any).url || (entry as any).src || entry);
    });
    return;
  }
  if (typeof source === 'object') {
    Object.entries(source).forEach(([key, value]) => {
      addColorImage(result, key, value);
    });
  }
};

const buildColorImages = (data: Record<string, any>, colors: string[]) => {
  const tmp: Record<string, string[]> = {};
  const mapSources = [data.colorImages, data.imagesByColor, data.colorImageUrls, data.imageUrls, data.images];

  mapSources.forEach((source) => processColorImageSource(tmp, source));

  const variantSources = [data.variants, data.colorVariants, data.colorsData];
  variantSources.forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((variant) => {
      if (!variant || typeof variant !== 'object') return;
      addColorImage(
        tmp,
        (variant as any).color || (variant as any).name || (variant as any).label,
        [
          (variant as any).images,
          (variant as any).imageUrls,
          (variant as any).imageUrl,
          (variant as any).image,
          (variant as any).url,
          (variant as any).src
        ]
      );
    });
  });

  // Enhanced: scan all fields for color-based image naming (e.g., redImage, pinkImage, yellowImage)
  Object.entries(data).forEach(([fieldName, value]) => {
    const lowerField = fieldName.trim().toLowerCase();
    const imageValues = collectImageValues(value);
    if (imageValues.length === 0) return;

    // Check if any word from the color name appears in the field name
    colors.forEach((color) => {
      const colorWords = color.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
      const matchesAnyWord = colorWords.some((word) => lowerField.includes(word));
      
      if (matchesAnyWord) {
        imageValues.forEach((imageValue) => addColorImage(tmp, color, imageValue));
      }
    });
  });

  // convert tmp (arrays) into result where values are single string or array
  const result: Record<string, string | string[]> = {};
  Object.entries(tmp).forEach(([k, arr]) => {
    if (!arr || arr.length === 0) return;
    result[k] = arr.length === 1 ? arr[0] : arr.slice();
  });

  // If some colors have mappings but others don't, try to use numbered/global image fields
  if (Object.keys(result).length > 0) {
    const mappedColors = Object.keys(result).map((k) => normalizeColor(k));
    const missing = colors.filter((c) => !mappedColors.includes(normalizeColor(c)));
    if (missing.length > 0) {
      // collect numbered/global images (imageUrl, imageUrl2, image2...)
      let numbered: string[] = [];
      const base = getStringValue(data.imageUrl) || getStringValue(data.image) || getStringValue(data.image1) || getStringValue(data.img1);
      if (base) numbered.push(base);
      for (let i = 2; i <= 8; i += 1) {
        const candidates = [
          `imageUrl${i}`,
          `image${i}`,
          `img${i}`,
          `image_url${i}`,
          `url${i}`
        ];
        for (const key of candidates) {
          const val = getStringValue((data as any)[key]);
          if (val && !numbered.includes(val)) {
            numbered.push(val);
            break;
          }
        }
      }

      if (numbered.length > 0) {
        if (missing.length === 1) {
          const colorKey = missing[0];
          const norm = normalizeColor(colorKey);
          result[colorKey] = numbered.length === 1 ? numbered[0] : numbered.slice();
          if (!(norm in result)) result[norm] = result[colorKey];
        } else {
          // distribute images across missing colors in order
          for (let i = 0; i < Math.min(missing.length, numbered.length); i += 1) {
            const colorKey = missing[i];
            const norm = normalizeColor(colorKey);
            result[colorKey] = numbered[i];
            if (!(norm in result)) result[norm] = numbered[i];
          }
        }
      }
    }

    return result;
  }

  // Try common list field first
  let imageUrlsArray = asStringArray(data.imageUrls);
  // If not present, also collect numbered image fields like imageUrl2, image2, image_2, img2, etc.
  if (imageUrlsArray.length === 0) {
    const numbered: string[] = [];
    // include base imageUrl if present
    const base = getStringValue(data.imageUrl) || getStringValue(data.image) || getStringValue(data.image1) || getStringValue(data.img1);
    if (base) numbered.push(base);
    for (let i = 2; i <= 8; i += 1) {
      const candidates = [
        `imageUrl${i}`,
        `image${i}`,
        `img${i}`,
        `image_url${i}`,
        `url${i}`
      ];
      for (const key of candidates) {
        const val = getStringValue((data as any)[key]);
        if (val && !numbered.includes(val)) {
          numbered.push(val);
          break;
        }
      }
    }
    imageUrlsArray = numbered;
  }
  if (imageUrlsArray.length > 0 && colors.length > 0) {
    const count = Math.min(colors.length, imageUrlsArray.length);
    for (let idx = 0; idx < count; idx += 1) {
      const key = normalizeColor(colors[idx]);
      if (key && imageUrlsArray[idx]) {
        result[key] = imageUrlsArray[idx];
      }
    }
  }

  if (Object.keys(result).length > 0) return result;

  const imageUrl = getStringValue(data.imageUrl) || getStringValue(data.image) || '';
  if (imageUrl && colors.length > 0) {
    colors.forEach((color) => {
      const key = normalizeColor(color);
      if (key) {
        result[key] = imageUrl;
      }
    });
    return result;
  }

  return undefined;
};

const getFirebaseErrorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : undefined;
const getFirebaseErrorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : undefined;

const getFirebaseDebugContext = (collectionName: string, queryDescription: string, documentsReceived?: number) => ({
  collectionName,
  query: queryDescription,
  firebaseProjectId,
  currentUser: auth.currentUser ? {
    uid: auth.currentUser.uid,
    isAnonymous: auth.currentUser.isAnonymous
  } : null,
  ...(documentsReceived !== undefined ? { documentsReceived } : {})
});

const logFirebaseProductFetchError = (error: unknown, collectionName: string, queryDescription: string) => {
  console.error(
    'Firebase Product Fetch Error:',
    error,
    getFirebaseErrorCode(error),
    getFirebaseErrorMessage(error),
    getFirebaseDebugContext(collectionName, queryDescription)
  );
};

const getDefaultProductColor = (product?: ProductItem) => (
  product?.variants?.[0]?.colorName || product?.variants?.[0]?.color || product?.colors?.[0] || 'Default'
);

const getAccountPhone = (account: NovaAccount) => {
  const accountPhone = account.phone?.trim()
    || account.deliveryAddress?.phone?.trim()
    || account.savedAddresses?.find((address) => address.phone?.trim())?.phone?.trim();
  if (accountPhone) return accountPhone;

  try {
    const registeredUsers = JSON.parse(localStorage.getItem('nova_registered_users') || '[]');
    if (Array.isArray(registeredUsers)) {
      const accountEmail = account.email.trim().toLowerCase();
      const storedAccount = registeredUsers.find((user: unknown) => {
        if (!user || typeof user !== 'object') return false;
        const record = user as Record<string, unknown>;
        return record.uid === account.uid
          || (accountEmail && typeof record.email === 'string' && record.email.trim().toLowerCase() === accountEmail);
      });
      if (storedAccount && typeof storedAccount.phone === 'string' && storedAccount.phone.trim()) {
        return storedAccount.phone.trim();
      }
    }
  } catch (error) {
    console.error('Could not read the saved account phone number:', error);
  }

  if (localStorage.getItem('novaSelectedAccountUid') === account.uid) {
    return localStorage.getItem('userPhone')?.trim() || '';
  }
  return '';
};

export default function App() {
  const { t } = useI18n();
  // Session authorization states loaded from localStorage
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem('isLoggedIn') === 'true');
  const [screen, setScreen] = useState<ScreenId>('splash');
  const screenRef = useRef<ScreenId>('splash');
  const screenHistoryRef = useRef<ScreenId[]>(['splash']);
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('userName') || 'Arjun Mehta');
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem('userEmail') || 'arjun.mehta@gmail.com');
  const [userPhone, setUserPhone] = useState<string>(() => localStorage.getItem('userPhone') || '+91 98765 43210');
  const [userAddress, setUserAddress] = useState<string>(() => localStorage.getItem('userAddress') || '');
  const [userPinCode, setUserPinCode] = useState<string>(() => localStorage.getItem('userPinCode') || '');
  const [userDeliveryAddress, setUserDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [userSavedAddresses, setUserSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    try {
      return /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768);
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      const onResize = () => setIsMobile(/Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent) || window.innerWidth < 768);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    } catch (e) {
      // noop in non-browser environments
    }
  }, []);

  // Email verification state
  const [pendingEmailVerification, setPendingEmailVerification] = useState<{
    email: string;
    name: string;
    address?: string;
    pinCode?: string;
    phone?: string;
    legalConsent?: LegalConsentRecord;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(PENDING_EMAIL_SIGNUP_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return typeof parsed.email === 'string' && typeof parsed.name === 'string' ? parsed : null;
    } catch {
      return null;
    }
  });

  const [userLegalConsent, setUserLegalConsent] = useState<LegalConsentRecord | null>(null);
  const [requiresConsentRenewal, setRequiresConsentRenewal] = useState<boolean>(false);
  const [isRenewingConsent, setIsRenewingConsent] = useState<boolean>(false);

  const replaceScreen = (to: ScreenId) => {
    const historyStack = screenHistoryRef.current;
    screenHistoryRef.current = historyStack.length > 0
      ? [...historyStack.slice(0, -1), to]
      : [to];
    screenRef.current = to;

    if (typeof window !== 'undefined') {
      window.history.replaceState({ novaScreen: to }, '', window.location.href);
    }

    setScreen(to);
  };

  const resetScreenHistory = (to: ScreenId) => {
    screenHistoryRef.current = [to];
    screenRef.current = to;

    if (typeof window !== 'undefined') {
      window.history.replaceState({ novaScreen: to }, '', window.location.href);
    }

    setScreen(to);
  };

  const navigateBackFromLegal = () => {
    const historyStack = [...screenHistoryRef.current];
    while (
      historyStack.length > 0 &&
      (historyStack[historyStack.length - 1] === 'terms' ||
        historyStack[historyStack.length - 1] === 'privacy')
    ) {
      historyStack.pop();
    }
    const previousScreen = historyStack[historyStack.length - 1] || 'profile';
    screenHistoryRef.current = historyStack.length > 0 ? historyStack : [previousScreen];
    screenRef.current = previousScreen;
    setScreen(previousScreen);
  };

  // Account management
  const { accounts, addAccount, removeAccount, replaceAccounts } = useAccounts();
  const { activeUid, activeAccount, setActiveAccountUid } = useActiveAccount({
    onAccountSwitched: (acc) => {
      if (acc) {
        const nextName = acc.name || acc.username || '';
        const nextEmail = acc.email || '';
        const nextPhone = getAccountPhone(acc);
        const nextAddr = acc.address || (acc.deliveryAddress ? formatDeliveryAddress(acc.deliveryAddress) : '');
        const nextPin = acc.pinCode || acc.deliveryAddress?.pinCode || '';
        setUserName(nextName);
        setUserEmail(nextEmail);
        setUserPhone(nextPhone);
        setUserAddress(nextAddr);
        setUserPinCode(nextPin);
        setUserDeliveryAddress(acc.deliveryAddress || null);
        setUserSavedAddresses(acc.savedAddresses || (acc.deliveryAddress ? [acc.deliveryAddress] : []));
        setIsLoggedIn(true);
        try {
          localStorage.setItem('userName', nextName);
          localStorage.setItem('userEmail', nextEmail);
          localStorage.setItem('userPhone', nextPhone);
          localStorage.setItem('userAddress', nextAddr);
          localStorage.setItem('userPinCode', nextPin);
        } catch {}
      }
    }
  });

  const isGuestSession = Boolean(
    !isLoggedIn ||
      activeAccount?.isGuest ||
      localStorage.getItem('novaSessionType') === 'guest' ||
      (activeUid && activeUid.startsWith('guest_'))
  );

  // Sync the authenticated user's saved delivery address whenever active user changes
  useEffect(() => {
    let cancelled = false;
    if (isGuestSession) {
      setUserDeliveryAddress(null);
      setUserSavedAddresses([]);
      return;
    }

    const targetUid = activeUid || userEmail;
    if (!targetUid) return;

    fetchUserDeliveryAddress({
      uid: targetUid,
      email: userEmail,
      name: userName,
      phone: userPhone,
      isGuest: isGuestSession,
      fallbackAddress: userAddress || activeAccount?.address,
      fallbackPinCode: userPinCode || activeAccount?.pinCode,
    })
      .then((res) => {
        if (cancelled) return;
        setUserDeliveryAddress(res.primaryAddress);
        setUserSavedAddresses(res.savedAddresses);
        if (res.primaryAddress) {
          const formatted = formatDeliveryAddress(res.primaryAddress);
          if (formatted && !userAddress) {
            setUserAddress(formatted);
          }
          if (res.primaryAddress.pinCode && !userPinCode) {
            setUserPinCode(res.primaryAddress.pinCode);
          }
        }
      })
      .catch(() => {
        // Keep current in-memory state on transient error
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, activeUid, userEmail, isGuestSession]);

  const handleAddressSaved = (updatedAddress: DeliveryAddress, allAddresses?: DeliveryAddress[]) => {
    const hasValidAddress = Boolean(
      updatedAddress && (updatedAddress.flatNo || updatedAddress.city || updatedAddress.pinCode)
    );
    const nextDeliveryAddress = hasValidAddress ? updatedAddress : null;
    const nextSavedList = Array.isArray(allAddresses)
      ? allAddresses
      : nextDeliveryAddress
      ? [nextDeliveryAddress]
      : [];
    const formatted = nextDeliveryAddress ? formatDeliveryAddress(nextDeliveryAddress) : '';
    const nextPin = nextDeliveryAddress?.pinCode || '';
    const nextPhone = updatedAddress?.phone || userPhone;
    const nextName = updatedAddress?.fullName || userName;

    setUserDeliveryAddress(nextDeliveryAddress);
    setUserSavedAddresses(nextSavedList);
    setUserAddress(formatted);
    setUserPinCode(nextPin);
    if (nextPhone) setUserPhone(nextPhone);
    if (nextName) setUserName(nextName);

    if (!isGuestSession) {
      try {
        localStorage.setItem('userAddress', formatted);
        localStorage.setItem('userPinCode', nextPin);
        if (nextPhone) localStorage.setItem('userPhone', nextPhone);
        if (nextName) localStorage.setItem('userName', nextName);
      } catch {}

      const currentUid = activeUid || userEmail;
      if (currentUid) {
        const updatedAccount = {
          ...activeAccount,
          uid: currentUid,
          username: activeAccount?.username || userEmail.split('@')[0] || nextName,
          name: nextName,
          email: userEmail,
          phone: nextPhone,
          address: formatted,
          pinCode: nextPin,
          deliveryAddress: nextDeliveryAddress || undefined,
          savedAddresses: nextSavedList,
          createdAt: activeAccount?.createdAt || Date.now(),
        };
        replaceAccounts([
          updatedAccount,
          ...accounts.filter((a) => a.uid !== currentUid),
        ]);
      }
    }
  };

  // Verify stored legal consent status for registered accounts (checks if a material terms update requires renewal)
  useEffect(() => {
    let cancelled = false;
    if (isGuestSession) {
      setUserLegalConsent(null);
      setRequiresConsentRenewal(false);
      return;
    }

    const targetUid = activeUid || userEmail;
    verifyUserConsentStatus(targetUid, userEmail)
      .then((status) => {
        if (cancelled) return;
        setUserLegalConsent(status.consent);
        setRequiresConsentRenewal(status.requiresRenewal);
      })
      .catch(() => {
        if (!cancelled) {
          setRequiresConsentRenewal(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, activeUid, userEmail, isGuestSession]);

  // Persistent measurements state
  const [measurements, setMeasurements] = useState<Measurement[]>(() => {
    try {
      const saved = localStorage.getItem('measurements');
      return saved ? JSON.parse(saved) : [
        { label: 'Height', value: '178 cm', iconName: 'height' },
        { label: 'Weight', value: '68 kg', iconName: 'fitness_center' },
        { label: 'Chest', value: '98 cm', iconName: 'checkroom' },
        { label: 'Waist', value: '82 cm', iconName: 'straighten' },
        { label: 'Inseam', value: '78 cm', iconName: 'architecture' }
      ];
    } catch (e) {
      return [
        { label: 'Height', value: '178 cm', iconName: 'height' },
        { label: 'Weight', value: '68 kg', iconName: 'fitness_center' },
        { label: 'Chest', value: '98 cm', iconName: 'checkroom' },
        { label: 'Waist', value: '82 cm', iconName: 'straighten' },
        { label: 'Inseam', value: '78 cm', iconName: 'architecture' }
      ];
    }
  });

  // Persistent preferences state
  const [preferences, setPreferences] = useState<Preference[]>(() => {
    try {
      const saved = localStorage.getItem('preferences');
      return saved ? JSON.parse(saved) : [
        { label: 'Style', value: 'Streetwear', iconName: 'style' },
        { label: 'Fit', value: 'Regular', iconName: 'fit_screen' },
        { label: 'Colors', value: 'Mix', iconName: 'palette' },
        { label: 'Occasion', value: 'Casual', iconName: 'event' }
      ];
    } catch (e) {
      return [
        { label: 'Style', value: 'Streetwear', iconName: 'style' },
        { label: 'Fit', value: 'Regular', iconName: 'fit_screen' },
        { label: 'Colors', value: 'Mix', iconName: 'palette' },
        { label: 'Occasion', value: 'Casual', iconName: 'event' }
      ];
    }
  });

  const handleUpdateMeasurements = (newMeasurements: Measurement[]) => {
    setMeasurements(newMeasurements);
    localStorage.setItem('measurements', JSON.stringify(newMeasurements));
  };

  const handleUpdatePreferences = (newPreferences: Preference[]) => {
    setPreferences(newPreferences);
    localStorage.setItem('preferences', JSON.stringify(newPreferences));
    syncCurrentUserProfile({ preferences: newPreferences, measurements }).catch(() => undefined);
  };

  const [userProfilePhoto, setUserProfilePhoto] = useState<string>(() => {
    try {
      return localStorage.getItem('userProfilePhoto') || '';
    } catch {
      return '';
    }
  });

  const [analysisProfile, setAnalysisProfile] = useState<NovaAnalysisProfile | null>(() => {
    try {
      const saved = localStorage.getItem('nova_analysis_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleCompleteProfileAnalysis = async (profile: NovaAnalysisProfile) => {
    setAnalysisProfile(profile);
    localStorage.setItem('nova_analysis_profile', JSON.stringify(profile));

    if (profile.selfieUrl) {
      setUserProfilePhoto(profile.selfieUrl);
      localStorage.setItem('userProfilePhoto', profile.selfieUrl);
    }

    const personalizedPreferences: Preference[] = [
      { label: 'Style', value: profile.stylePreference.replace(' Style Preference', ''), iconName: 'style' },
      { label: 'Fit', value: profile.recommendedFit || 'Regular', iconName: 'fit_screen' },
      { label: 'Colors', value: profile.recommendedColors.join(', ') || 'Mix', iconName: 'palette' },
      { label: 'Eyewear', value: profile.eyewearSuggestions.join(', ') || 'Any', iconName: 'visibility' }
    ];

    handleUpdatePreferences(personalizedPreferences);

    const currentUid = activeUid || userEmail;
    const updatedAccount = {
      ...activeAccount,
      uid: currentUid,
      username: activeAccount?.username || userEmail.split('@')[0] || userName,
      email: userEmail,
      name: userName,
      phone: userPhone,
      profilePhoto: profile.selfieUrl || activeAccount?.profilePhoto,
      createdAt: activeAccount?.createdAt || Date.now()
    };

    replaceAccounts([
      updatedAccount,
      ...accounts.filter((account) => account.uid !== currentUid)
    ]);

    try {
      await accountService.upsertUserProfile(updatedAccount, {
        preferences: personalizedPreferences,
        measurements
      });
    } catch (error) {
      console.error('Failed to save NOVA profile analysis:', error);
    }

    resetScreenHistory('profile');
  };

  const syncCurrentUserProfile = (extra?: { preferences?: Preference[]; measurements?: Measurement[] }) => {
    return accountService.upsertUserProfile(
      {
        ...activeAccount,
        uid: activeUid || activeAccount?.uid || userEmail,
        username: activeAccount?.username || userEmail.split('@')[0] || userName,
        name: userName,
        email: userEmail,
        phone: userPhone
      },
      extra
    );
  };

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.history.replaceState({ novaScreen: screenRef.current }, '', window.location.href);

    const handleBrowserBack = () => {
      const historyStack = screenHistoryRef.current;

      if (historyStack.length > 1) {
        historyStack.pop();
        const previousScreen = historyStack[historyStack.length - 1] || 'home';
        screenRef.current = previousScreen;
        setScreen(previousScreen);
        return;
      }

      if (screenRef.current !== 'home' && screenRef.current !== 'splash' && screenRef.current !== 'onboarding') {
        screenHistoryRef.current = ['home'];
        screenRef.current = 'home';
        setScreen('home');
      }
    };

    window.addEventListener('popstate', handleBrowserBack);

    return () => {
      window.removeEventListener('popstate', handleBrowserBack);
    };
  }, []);
  

  const [novaPoints, setNovaPoints] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('nova_points');
      const parsed = saved ? Number(saved) : NaN;
      return Number.isFinite(parsed) && parsed >= 100 ? parsed : 100;
    } catch {
      return 100;
    }
  });

  const levelThresholds = [100, 300, 600, 1000, 1500, 2200];
  const getNovaLevel = (points: number) => {
    if (points < 300) return 1;
    if (points < 600) return 2;
    if (points < 1000) return 3;
    if (points < 1500) return 4;
    return 5;
  };

  const getNextLevelThreshold = (points: number) => {
    return levelThresholds.find((threshold) => threshold > Math.max(points, 100)) ?? levelThresholds[levelThresholds.length - 1];
  };

  const awardNovaPoints = (amount: number, description: string, associatedImage?: string) => {
    if (amount <= 0) return;
    setNovaPoints((prevPoints) => {
      const nextPoints = Math.max(100, prevPoints + amount);
      localStorage.setItem('nova_points', String(nextPoints));
      addRecentActivity({
        id: Date.now().toString(),
        name: `${description}`,
        time: new Date().toLocaleTimeString(),
        badge: 'NOVA Rewards',
        icon: 'stars',
        color: 'bg-amber-500/80',
        imageUrl: associatedImage || ''
      });
      return nextPoints;
    });
  };

  const novaLevel = getNovaLevel(novaPoints);
  const nextLevelThreshold = getNextLevelThreshold(novaPoints);
  const currentLevelFloor = novaLevel === 1 ? 100 : levelThresholds[novaLevel - 1];
  const pointsToNextLevel = Math.max(0, nextLevelThreshold - novaPoints);
  const levelProgress = Math.min(
    100,
    Math.round(((novaPoints - currentLevelFloor) / Math.max(1, nextLevelThreshold - currentLevelFloor)) * 100)
  );

  const [productsData, setProductsData] = useState<Record<string, ProductItem>>({});
  const [productReviews, setProductReviews] = useState<Record<string, ProductReview[]>>(() => loadStoredProductReviews());
  const productReviewsRef = useRef(productReviews);
  const [reviewListenerError, setReviewListenerError] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    productReviewsRef.current = productReviews;
  }, [productReviews]);

  useEffect(() => {
    setProductsData((current) => {
      let updated = current;
      Object.entries(productReviews).forEach(([productId, reviews]) => {
        const prod = current[productId];
        if (prod && reviews.length > 0) {
          const agg = calculateRatingFromReviews(prod, reviews);
          if (agg.rating !== prod.rating || agg.reviewsCount !== prod.reviewsCount) {
            updated = {
              ...updated,
              [productId]: {
                ...prod,
                rating: agg.rating,
                reviewsCount: agg.reviewsCount
              }
            };
          }
        }
      });
      return updated;
    });
  }, [productReviews]);

  const handleSubmitProductReview = async (productId: string, rating: number, text: string, source: 'product' | 'tryon' = 'product') => {
    if (!productId || rating <= 0 || !text.trim()) return;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error('Sign in with your verified account before submitting a review.');
    }

    const reviewerName = activeAccount?.name || activeAccount?.username || userName || 'Guest';
    const reviewText = text.trim();
    let savedReviewId: string;
    try {
      const reviewRef = await addDoc(collection(db, 'product_reviews'), {
        productId,
        reviewer: reviewerName,
        userName: reviewerName,
        rating,
        text: reviewText,
        comment: reviewText,
        date: new Date().toLocaleDateString(),
        source,
        accountUid: firebaseUser.uid,
        createdAt: serverTimestamp()
      });
      savedReviewId = reviewRef.id;
    } catch (error) {
      console.error('Error saving review to Firestore:', error);
      throw new Error('Your review could not be saved. Check your connection and Firestore permissions, then try again.');
    }

    const savedReview: ProductReview = {
      id: savedReviewId,
      productId,
      reviewer: reviewerName,
      userName: reviewerName,
      rating,
      text: reviewText,
      comment: reviewText,
      date: new Date().toLocaleDateString(),
      source,
      accountUid: firebaseUser.uid,
      createdAt: new Date()
    };
    setProductReviews((prev) => {
      const nextReviews = {
        ...prev,
        [productId]: [savedReview, ...(prev[productId] || []).filter((review) => review.id !== savedReviewId)]
      };
      saveStoredProductReviews(nextReviews);
      return nextReviews;
    });

    const prod = productsData[productId] || products[productId];
    if (prod) {
      const updatedAggregate = calculateRatingFromReviews(prod, [savedReview, ...(productReviewsRef.current[productId] || [])]);
      setProductsData((current) => ({
        ...current,
        [productId]: {
          ...prod,
          rating: updatedAggregate.rating,
          reviewsCount: updatedAggregate.reviewsCount
        }
      }));
      awardNovaPoints(20, 'Submitted product review');
      addRecentActivity({
        id: Date.now().toString(),
        name: `${prod.name} review`,
        time: new Date().toLocaleTimeString(),
        badge: 'Review',
        icon: 'star',
        color: 'bg-amber-500/80',
        imageUrl: prod.imageUrl
      });
    }
  };

  useEffect(() => {
    // Real-time listener for product_reviews so new reviews are visible to all users immediately
    const coll = collection(db, 'product_reviews');
    const unsub = onSnapshot(coll, (snapshot) => {
      try {
        setReviewListenerError(null);
        const reviewsByProduct: Record<string, ProductReview[]> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          const productId = data.productId;
          if (productId) {
            const review: ProductReview = {
              id: doc.id,
              reviewer: String(data.reviewer || data.userName || 'Guest'),
              userName: String(data.userName || data.reviewer || 'Guest'),
              rating: Number(data.rating || 0),
              text: String(data.text || data.comment || ''),
              comment: String(data.comment || data.text || ''),
              date: String(data.date || new Date().toLocaleDateString()),
              source: data.source === 'tryon' ? 'tryon' : 'product',
              accountUid: data.accountUid ? String(data.accountUid) : undefined,
              createdAt: data.createdAt
            };

            if (!reviewsByProduct[productId]) reviewsByProduct[productId] = [];
            reviewsByProduct[productId].push(review);
          }
        });

        // Always update local state from Firestore snapshot (empty means no remote reviews)
        setProductReviews(reviewsByProduct);
        saveStoredProductReviews(reviewsByProduct);
      } catch (err) {
        console.error('Error processing realtime reviews snapshot:', err);
      }
    }, (error) => {
      console.error('Realtime reviews listener error:', error);
      setReviewListenerError('Reviews could not be loaded. Please try again later.');
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const collectionName = 'products';
    const queryDescription = 'products realtime listener';

    setProductsLoading(true);
    setProductsError(null);
    console.debug('Firestore products listener connecting:', getFirebaseDebugContext(collectionName, queryDescription));

    waitForFirebaseAuthReady().then(() => {
      if (cancelled) return;

      unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
        const changedDocumentIds = snapshot.docChanges().map((change) => `${change.type}:${change.doc.id}`);
        console.debug('Firestore products snapshot received:', {
          ...getFirebaseDebugContext(collectionName, queryDescription, snapshot.size),
          fromCache: snapshot.metadata.fromCache,
          changedDocumentIds
        });

        try {
          const fetchedProducts: Record<string, ProductItem> = {};

          snapshot.forEach((doc: any) => {
            const data = doc.data() as any;
            const id = doc.id;
            const colors = Array.isArray(data.colors)
              ? data.colors
                  .map((value: unknown) => String(value))
                  .map((value: string) => value.trim())
                  .filter((value: string) => value.length > 0)
              : ['Standard'];
            const imageVersion = getProductImageVersion(data);
            const imageUrls = [
              ...asStringArray(data.images),
              ...asStringArray(data.imageUrls)
            ]
              .map((value) => withImageVersion(value, imageVersion))
              .filter((value, index, array) => value && array.indexOf(value) === index);
            const colorImages = buildColorImages({ ...data }, colors);
            const versionedColorImages = colorImages
              ? Object.fromEntries(Object.entries(colorImages).map(([key, value]) => [
                  key,
                  Array.isArray(value)
                    ? value.map((item) => withImageVersion(item, imageVersion))
                    : withImageVersion(value, imageVersion)
                ]))
              : undefined;
            const variants = normalizeProductVariants(data, colors, versionedColorImages);
            const versionedVariants = variants.map((variant) => ({
              ...variant,
              images: variant.images.map((image) => withImageVersion(image, imageVersion)),
              thumbnail: withImageVersion(variant.thumbnail, imageVersion)
            }));
            const variantImages = versionedVariants.flatMap((variant) => variant.images || []);
            const images = [
              ...imageUrls,
              ...variantImages
            ].filter((value, index, array) => value && array.indexOf(value) === index);
            const rawImageUrl = getStringValue(data.mainImage) || getStringValue(data.imageUrl) || getStringValue(data.image) || versionedVariants[0]?.images?.[0] || images[0] || '';
            const imageUrl = withImageVersion(rawImageUrl, imageVersion);
            const stock = data.stock !== undefined ? Number(data.stock) : undefined;
            const vendorName = getStringValue(data.vendorName) || getStringValue(data.brandName) || getStringValue(data.companyName) || getStringValue(data.storeName);
            const vendorLogoUrl = getStringValue(data.vendorLogoUrl) || getStringValue(data.logoUrl) || getStringValue(data.logo) || getStringValue(data.imageUrl);

            const productName = String(data.name || data.productName || '');
            const productPrice = Number(data.discountPrice || data.price || 0);
            if (!productName || productName === 'Unnamed Product' || productPrice === 0 || !imageUrl) {
              return;
            }

            const nextProduct: ProductItem = {
              id,
              productId: String(data.productId || id),
              vendorId: data.vendorId ? String(data.vendorId) : undefined,
              vendorName,
              vendorLogoUrl,
              name: productName,
              category: String(data.category || 'Uncategorized'),
              price: productPrice,
              originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : data.discountPrice !== undefined ? Number(data.price || 0) : undefined,
              discountPrice: data.discountPrice !== undefined ? Number(data.discountPrice) : undefined,
              rating: Number(data.rating || 0),
              reviewsCount: Number(data.reviewsCount || data.reviewCount || 0),
              imageUrl,
              mainImage: imageUrl,
              images: images.length > 0 ? images : imageUrl ? [imageUrl] : undefined,
              imageUrls: images.length > 0 ? images : undefined,
              colorImages: versionedColorImages,
              variants: versionedVariants.length > 0 ? versionedVariants : undefined,
              defaultVariantId: versionedVariants[0]?.id,
              colors: versionedVariants.length > 0 ? versionedVariants.map((variant) => variant.colorName) : colors,
              sizes: Array.isArray(data.sizes)
                ? data.sizes
                    .map((value: unknown) => String(value))
                    .map((value: string) => value.trim())
                    .filter((value: string) => value.length > 0)
                : ['One Size'],
              inStock: data.inStock !== undefined ? Boolean(data.inStock) : stock !== undefined ? stock > 0 : true,
              stockLeft: data.stockLeft !== undefined ? Number(data.stockLeft) : stock,
              isTopRated: Boolean(data.isTopRated),
              isFeatured: Boolean(data.isFeatured),
              badge: data.badge ? String(data.badge) : data.isTopRated ? 'Top Pick' : undefined,
              details: Array.isArray(data.details) ? data.details.map(String) : Array.isArray(data.description) ? data.description.map(String) : data.description ? [String(data.description)] : [],
              createdAt: data.createdAt
            };

            const reviews = productReviewsRef.current[id] || [];
            if (reviews.length > 0) {
              const aggregate = calculateRatingFromReviews(nextProduct, reviews);
              nextProduct.rating = aggregate.rating;
              nextProduct.reviewsCount = aggregate.reviewsCount;
            }

            fetchedProducts[id] = nextProduct;
          });

          if (Object.keys(fetchedProducts).length > 0) {
            setProductsData(fetchedProducts);
            setProductsError(null);
          } else {
            console.warn('Firestore returned no products.', getFirebaseDebugContext(collectionName, queryDescription, 0));
            setProductsData({});
            setProductsError('Firestore returned no products from the products collection.');
          }
        } catch (error) {
          logFirebaseProductFetchError(error, collectionName, queryDescription);
          setProductsData({});
          setProductsError('Unable to process products from Firebase. Check the console for Firebase Product Fetch Error details.');
        } finally {
          setProductsLoading(false);
        }
      }, (error) => {
        logFirebaseProductFetchError(error, collectionName, queryDescription);
        setProductsData({});
        setProductsError('Unable to load products from Firebase. Check the console for Firebase Product Fetch Error details.');
        setProductsLoading(false);
      });
    }).catch((error) => {
      logFirebaseProductFetchError(error, collectionName, queryDescription);
      setProductsData({});
      setProductsError('Unable to connect to Firebase. Check the console for Firebase Product Fetch Error details.');
      setProductsLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      console.debug('Firestore products listener disconnected:', getFirebaseDebugContext(collectionName, queryDescription));
    };
  }, []);

  // Persistent wishlist/favorites state
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Local modal to quickly view wishlist without navigating away
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  // NOVA Hub quick navigation bottom sheet
  const [isQuickHubOpen, setIsQuickHubOpen] = useState<boolean>(false);

  const handleToggleWishlist = (productId: string) => {
    const prod = productsData[productId] || products[productId] || { id: productId };
    setWishlist((prev) => {
      const isAdding = !prev.includes(productId);
      const updated = isAdding ? [...prev, productId] : prev.filter((id) => id !== productId);
      localStorage.setItem('wishlist', JSON.stringify(updated));
      if (isAdding) {
        awardNovaPoints(15, 'Saved item to Wishlist');
        analytics.trackWishlistAdd(prod, screenRef.current || 'wishlist');
      } else {
        analytics.trackWishlistRemove(prod, screenRef.current || 'wishlist');
      }
      return updated;
    });
  };

  // Dark mode state (persisted)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('isDarkMode');
      return saved ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  // Recent activity state (persisted per-account) - starts empty, populated only by real user interactions
  const recentKeyFor = (uid?: string) => `recent_activity_${uid || 'guest'}`;

  const [recentActivityState, setRecentActivityState] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(recentKeyFor(activeUid));
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Synchronize analytics identity
  useEffect(() => {
    analytics.setUserId(activeUid || userEmail || undefined);
  }, [activeUid, userEmail]);

  // reload recent activity whenever active account changes (new account => no recent activity)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(recentKeyFor(activeUid));
      setRecentActivityState(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setRecentActivityState([]);
    }
  }, [activeUid]);

  const addRecentActivity = (entry: any) => {
    setRecentActivityState((prev: any[]) => {
      const updated = [entry, ...prev.filter((p) => p.name !== entry.name)];
      if (updated.length > 12) updated.splice(12);
      try { localStorage.setItem(recentKeyFor(activeUid), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const recentScanItems = recentActivityState
    .filter((entry) => entry.badge === 'Scan' || entry.badge === 'Camera Scan')
    .slice(0, 6);

  const scanCount = recentScanItems.length;

  // Navigation wrapper that logs activity for relevant screens
  const navigate = (to: ScreenId, opts?: { productId?: string; product?: ProductItem }) => {
    const currentScreen = screenRef.current;
    if (opts?.product && opts?.productId) {
      setProductsData((prev) => ({ ...prev, [opts.productId!]: opts.product! }));
    }
    if (opts?.productId) {
      const selectedId = opts.productId;
      setSelectedProductId(selectedId);
      const prod = opts?.product || productsData[selectedId] || products[selectedId];
      if (prod) {
        setSelectedColor(getDefaultProductColor(prod));
        if (to === 'product-details') {
          analytics.trackProductView(prod, currentScreen || 'home');
        }
      }
    }

    const time = new Date().toLocaleString();
    if (to === 'ar-tryon') {
      const prodId = opts?.productId || selectedProductId;
      const prod = productsData[prodId] || products[prodId];
      const tryonImg = (prod && prod.imageUrl) ? prod.imageUrl : (swipeModels[selectedColor] || swipeModels['Lavender'] || '');
      addRecentActivity({ id: Date.now().toString(), name: prod?.name ? `${prod.name} AR Try-On` : 'AR Virtual Fitting', time, badge: 'AR Try-On', icon: 'view_in_ar', color: 'bg-primary/80', imageUrl: tryonImg });
      awardNovaPoints(25, 'Engaged in AR Try-On', tryonImg);
    } else if (to === 'tryon-result') {
      const prodId = opts?.productId || selectedProductId;
      const prod = productsData[prodId] || products[prodId];
      const tryonImg = swipeModels[selectedColor] || (prod ? prod.imageUrl : swipeModels['Lavender']);
      addRecentActivity({ id: Date.now().toString(), name: prod?.name ? `${prod.name} Try-On` : 'AR Try-On Result', time, badge: 'AR Try-On', icon: 'view_in_ar', color: 'bg-primary/80', imageUrl: tryonImg });
    } else if (to === 'camera-scan') {
      const prodId = opts?.productId || selectedProductId;
      const prod = productsData[prodId] || products[prodId];
      const scanImg = prod?.imageUrl || '';
      addRecentActivity({ id: Date.now().toLocaleString(), name: prod?.name ? `${prod.name} Scan` : 'Camera Scan', time, badge: 'Camera Scan', icon: 'photo_camera', color: 'bg-secondary/80', imageUrl: scanImg });
    } else if (to === 'product-details') {
      const id = opts?.productId || selectedProductId;
      const prod = opts?.product || productsData[id] || products[id];
      if (prod) addRecentActivity({ id: Date.now().toString(), name: prod.name, time, badge: 'Viewed', icon: 'checkroom', color: 'bg-primary/80', imageUrl: prod.imageUrl });
    } else if (to === 'scan-outfit') {
      const scanImg = staticRecentScans[0]?.imageUrl || '';
      addRecentActivity({ id: Date.now().toString(), name: 'Scan Outfit', time, badge: 'Scan', icon: 'center_focus_strong', color: 'bg-teal-600/80', imageUrl: scanImg });
    } else if (to === 'wardrobe') {
      addRecentActivity({ id: Date.now().toString(), name: 'Virtual Wardrobe', time, badge: 'Wardrobe', icon: 'checkroom', color: 'bg-indigo-600/80', imageUrl: '' });
    }

    if (to !== currentScreen) {
      screenHistoryRef.current = [...screenHistoryRef.current, to].slice(-30);
      screenRef.current = to;

      if (typeof window !== 'undefined') {
        window.history.pushState({ novaScreen: to }, '', window.location.href);
      }
    }

    setScreen(to);
  };

  const cartStorageKey = `nova_cart_${activeUid || 'guest'}`;
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(`nova_cart_${activeUid || 'guest'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
    } catch {
      // Keep the in-memory cart usable when browser storage is unavailable.
    }
  }, [cartItems, cartStorageKey]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(cartStorageKey);
      setCartItems(stored ? JSON.parse(stored) : []);
    } catch {
      setCartItems([]);
    }
  }, [cartStorageKey]);

  const [selectedColor, setSelectedColor] = useState<string>('Lavender');
  const [selectedGarment, setSelectedGarment] = useState<string>('Lavender');
  const [selectedProductId, setSelectedProductId] = useState<string>('lavender-hoodie');
  const [capturedTryOnImage, setCapturedTryOnImage] = useState<string | null>(null);

  const handleScannedProductMatched = (product: ProductItem, scanImageUrl?: string) => {
    if (!product?.id) return;
    setProductsData((current) => current[product.id] ? current : { ...current, [product.id]: product });
    setSelectedProductId(product.id);
    setSelectedColor(getDefaultProductColor(product));

    const actualImg = scanImageUrl || product.imageUrl || '';
    addRecentActivity({
      id: Date.now().toString(),
      name: `${product.name} Scan`,
      time: new Date().toLocaleString(),
      badge: 'Camera Scan',
      icon: 'photo_camera',
      color: 'bg-secondary/80',
      imageUrl: actualImg
    });
  };

  // Interactive Cart Handlers
  const handleAddToCart = (prodId: string, color: string, size: string) => {
    const p = productsData[prodId] || products[prodId];
    const isPresentIndex = cartItems.findIndex(
      (item) => item.product.id === prodId && item.color === color && item.size === size
    );

    if (isPresentIndex > -1) {
      const updated = [...cartItems];
      updated[isPresentIndex].quantity += 1;
      setCartItems(updated);
      if (p) {
        analytics.trackCartAdd(p, color, size, 1, screenRef.current || 'cart');
      }
    } else {
      if (p) {
        setCartItems([
          ...cartItems,
          {
            product: p,
            quantity: 1,
            color,
            size
          }
        ]);
        analytics.trackCartAdd(p, color, size, 1, screenRef.current || 'cart');
      }
    }
  };

  const handleUpdateQuantity = (idx: number, dQ: number) => {
    const item = cartItems[idx];
    const updated = [...cartItems];
    const newQty = updated[idx].quantity + dQ;
    if (newQty <= 0) {
      updated.splice(idx, 1);
    } else {
      updated[idx].quantity = newQty;
    }
    setCartItems(updated);
    if (item && item.product) {
      analytics.trackCartQuantityUpdate(item.product, item.quantity, newQty);
    }
  };

  const handleRemoveItem = (idx: number) => {
    const item = cartItems[idx];
    const updated = [...cartItems];
    updated.splice(idx, 1);
    setCartItems(updated);
    if (item && item.product) {
      analytics.trackCartRemove(item.product, item.color, item.size);
    }
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const countCartTotalItems = () => {
    return cartItems.reduce((acc, curr) => acc + curr.quantity, 0);
  };

  // Safe router render switcher
  const renderActiveScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeView 
            userName={userName} 
            onNavigate={navigate} 
            wishlist={wishlist}
            recentActivity={recentActivityState}
            onToggleWishlist={handleToggleWishlist}
            isDarkMode={isDarkMode}
            products={{ ...products, ...productsData }}
            onSelectProduct={(id, selectedItem) => {
              if (selectedItem) {
                setProductsData((prev) => ({ ...prev, [id]: selectedItem }));
              }
              setSelectedProductId(id);
              const prod = selectedItem || productsData[id] || products[id];
              if (prod) {
                setSelectedColor(getDefaultProductColor(prod));
              }
              navigate('product-details', { productId: id, product: selectedItem });
            }}
          />
        );
      case 'ar-tryon':
        return (
          <ArTryOnView 
            onNavigate={navigate} 
            selectedGarment={selectedGarment}
            setSelectedGarment={setSelectedGarment}
            onCaptureImage={(captured) => setCapturedTryOnImage(captured)}
            isDarkMode={isDarkMode}
            userId={activeUid || userEmail}
            userEmail={userEmail}
            userName={userName}
          />
        );
      case 'tryon-result':
        return (
          <TryOnResultView 
            onNavigate={navigate} 
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            onAddToCart={handleAddToCart}
            selectedProductId={selectedProductId}
            onSubmitReview={handleSubmitProductReview}
            capturedImage={capturedTryOnImage}
          />
        );
      case 'camera-scan':
        return <CameraScanView onNavigate={navigate} onProductMatched={handleScannedProductMatched} userGender={activeAccount?.gender} />;
      case 'profile':
        return (
          <ProfileView 
            onNavigate={navigate} 
            userId={activeUid || userEmail}
            userName={userName} 
            setUserName={setUserName} 
            userEmail={userEmail}
            userPhone={userPhone}
            userAddress={userAddress}
            userPinCode={userPinCode}
            savedDeliveryAddress={userDeliveryAddress}
            savedAddresses={userSavedAddresses}
            isGuest={isGuestSession}
            onSaveAddress={handleAddressSaved}
            profilePhoto={userProfilePhoto || activeAccount?.profilePhoto}
            analysisProfile={analysisProfile}
            onLogout={handleLogout}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            measurements={measurements}
            onUpdateMeasurements={handleUpdateMeasurements}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            novaPoints={novaPoints}
            novaLevel={novaLevel}
            pointsToNextLevel={pointsToNextLevel}
            levelProgress={levelProgress}
            accounts={accounts}
            activeUid={activeUid}
            onAddAccount={(acc) => addAccount(acc)}
            onRemoveAccount={(uid) => removeAccount(uid)}
            onSwitchAccount={(uid) => setActiveAccountUid(uid)}
            legalConsent={userLegalConsent}
          />
        );
      case 'terms':
      case 'privacy':
        return (
          <LegalDocumentView
            documentType={screen}
            onSelectDocument={(docType) => navigate(docType)}
            onBack={navigateBackFromLegal}
            backLabel="Back"
            isDarkMode={isDarkMode}
            consentRecord={userLegalConsent}
          />
        );
      case 'setup-preferences':
        return (
          <SetupPreferencesView 
            userName={userName}
            onComplete={(newPrefs, newMeasures) => {
              handleUpdatePreferences(newPrefs);
              handleUpdateMeasurements(newMeasures);
              syncCurrentUserProfile({ preferences: newPrefs, measurements: newMeasures }).catch(() => undefined);
              replaceScreen('profile-analysis');
            }}
          />
        );
      case 'profile-analysis':
        return (
          <ProfileAnalysisView
            userName={userName}
            userId={userEmail}
            onComplete={handleCompleteProfileAnalysis}
          />
        );
      case 'product-details':
        {
          const allProducts = { ...products, ...productsData };
          const selectedReviewProduct = allProducts[selectedProductId]
            || Object.values(allProducts).find((product) => product.productId === selectedProductId);
          const reviewKeys = [...new Set([
            selectedProductId,
            selectedReviewProduct?.id,
            selectedReviewProduct?.productId
          ].filter((key): key is string => Boolean(key)))];
          const selectedReviews = Array.from(new Map(
            reviewKeys.flatMap((key) => productReviews[key] || []).map((review) => [review.id, review])
          ).values());

        return (
          <ProductDetailsView 
            products={allProducts}
            onNavigate={navigate} 
            onAddToCart={handleAddToCart}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            selectedProductId={selectedProductId}
            isDarkMode={isDarkMode}
            reviews={selectedReviews}
            reviewsCount={selectedReviewProduct?.reviewsCount}
            averageRating={selectedReviewProduct?.rating}
            reviewListenerError={reviewListenerError}
            currentReviewerName={activeAccount?.name || activeAccount?.username || userName}
            activeUid={activeUid}
            onSubmitReview={handleSubmitProductReview}
          />
        );
        }
      case 'showroom':
        return (
          <ShowroomView 
            products={Object.values({ ...products, ...productsData })}
            loading={productsLoading}
            error={productsError}
            onNavigate={navigate}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            isDarkMode={isDarkMode}
            onSelectProduct={(id, selectedItem) => {
              if (selectedItem) {
                setProductsData((prev) => ({ ...prev, [id]: selectedItem }));
              }
              setSelectedProductId(id);
              const prod = selectedItem || productsData[id] || products[id];
              if (prod) {
                setSelectedColor(getDefaultProductColor(prod));
              }
              navigate('product-details', { productId: id, product: selectedItem });
            }}
            cartItemsCount={countCartTotalItems()}
            productReviews={productReviews}
          />
        );
      case 'scan-outfit':
        return <ScanOutfitView onNavigate={navigate} scanCount={scanCount} recentScans={recentScanItems} isDarkMode={isDarkMode} userId={activeUid || userEmail} />;
      case 'wardrobe':
        return <VirtualWardrobeView onNavigate={navigate} userEmail={userEmail} isDarkMode={isDarkMode} />;
      case 'chat':
        return <ChatView userName={userName} onNavigate={navigate} products={productsData} />;
      case 'cart':
        return (
          <CartView 
            onNavigate={navigate} 
            cartItems={cartItems} 
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            isDarkMode={isDarkMode}
            userId={activeUid || userEmail}
            userName={userName}
            userEmail={userEmail}
            userPhone={userPhone}
            userAddress={userAddress}
            userPinCode={userPinCode}
            savedDeliveryAddress={userDeliveryAddress}
            savedAddresses={userSavedAddresses}
            isGuest={isGuestSession}
            onSaveAddress={handleAddressSaved}
          />
        );
      default:
        return <HomeView userName={userName} onNavigate={navigate} recentActivity={recentActivityState} isDarkMode={isDarkMode} products={productsData} />;
    }
  };

  const handleSplashComplete = () => {
    replaceScreen('onboarding');
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    if (!isLoggedIn) {
      replaceScreen('login');
    } else {
      resetScreenHistory('home');
    }
  };

  const handleProceedToEmailVerification = (
    email: string,
    name: string,
    address?: string,
    pinCode?: string,
    phone?: string,
    legalConsent?: LegalConsentRecord
  ) => {
    const pendingSignup = { email, name, address, pinCode, phone, legalConsent };
    localStorage.setItem(PENDING_EMAIL_SIGNUP_KEY, JSON.stringify(pendingSignup));
    setPendingEmailVerification(pendingSignup);
    resetScreenHistory('email-verification');
  };

  const handlePendingVerificationEmailChange = (email: string) => {
    setPendingEmailVerification((pending) => {
      if (!pending) return pending;
      const updated = { ...pending, email };
      localStorage.setItem(PENDING_EMAIL_SIGNUP_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleEmailVerificationSuccess = async (verificationResult: {
    uid?: string;
    email: string;
    customToken?: string;
    sessionToken?: string;
    legalConsent?: LegalConsentRecord;
    deliveryAddress?: DeliveryAddress;
  }) => {
    if (!pendingEmailVerification) {
      // Fallback to home if no pending verification data
      resetScreenHistory('home');
      return;
    }

    const { email, name, address, pinCode, phone, legalConsent } = pendingEmailVerification;
    const firebaseUid = verificationResult.uid || email;

    if (verificationResult.sessionToken) {
      saveSessionToken(firebaseUid, verificationResult.sessionToken);
      if (email && email !== firebaseUid) {
        saveSessionToken(email, verificationResult.sessionToken);
      }
    }

    const effectiveConsent = verificationResult.legalConsent || legalConsent;
    const structuredAddress =
      verificationResult.deliveryAddress ||
      parseAddressToDeliveryAddress({
        rawAddress: address,
        pinCode,
        fullName: name,
        phone: phone || '',
      });
    const initialSavedAddresses = structuredAddress ? [structuredAddress] : [];
    writeCachedUserAddress(firebaseUid, structuredAddress, initialSavedAddresses);

    // Complete the signup with email verified
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('novaSessionType', 'registered');
    localStorage.setItem('novaSelectedAccountUid', firebaseUid);
    localStorage.setItem('userName', name);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userPhone', phone || '');
    localStorage.setItem('userAddress', address || (structuredAddress ? formatDeliveryAddress(structuredAddress) : ''));
    localStorage.setItem('userPinCode', pinCode || structuredAddress?.pinCode || '');

    setUserName(name);
    setUserEmail(email);
    setUserPhone(phone || '');
    setUserAddress(address || (structuredAddress ? formatDeliveryAddress(structuredAddress) : ''));
    setUserPinCode(pinCode || structuredAddress?.pinCode || '');
    setUserDeliveryAddress(structuredAddress);
    setUserSavedAddresses(initialSavedAddresses);
    setIsLoggedIn(true);
    setPendingEmailVerification(null);
    localStorage.removeItem(PENDING_EMAIL_SIGNUP_KEY);
    localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);

    // Record authoritative legal consent against the verified user account
    if (effectiveConsent && effectiveConsent.accepted) {
      recordUserConsent(firebaseUid, email, effectiveConsent)
        .then((recorded) => {
          setUserLegalConsent(recorded);
          setRequiresConsentRenewal(false);
        })
        .catch((err) => {
          console.error('Failed to record legal consent:', err);
        });
    }

    // Save user details to Firestore (isSignUp=true for email-based signup)
    saveUserToFirestore(
      name,
      email,
      phone || '',
      true,
      address,
      pinCode,
      firebaseUid,
      effectiveConsent,
      structuredAddress || undefined
    ).then(() => {
      console.debug('Firestore write success after OTP verification.', { uid: firebaseUid, email, phone });
    }).catch(err => {
      console.error('Failed to save user data:', err);
    });

    // Also register the verified account in nova_registered_users so subsequent phone sign-in works without duplicate accounts
    try {
      const existingRaw = localStorage.getItem('nova_registered_users');
      const existingUsers = existingRaw ? JSON.parse(existingRaw) : [];
      if (Array.isArray(existingUsers)) {
        const normalizedPhone = (phone || '').replace(/\s+/g, '');
        const newEntry = {
          uid: firebaseUid,
          name,
          email,
          phone: normalizedPhone,
          address: address || (structuredAddress ? formatDeliveryAddress(structuredAddress) : ''),
          pinCode: pinCode || structuredAddress?.pinCode || '',
          deliveryAddress: structuredAddress || undefined,
          savedAddresses: initialSavedAddresses,
          username: email.split('@')[0] || name,
          accountType: 'Registered',
          createdAt: 'Today',
          lastActive: 'Today',
          linkedPhone: Boolean(normalizedPhone)
        };
        const deduplicated = [
          newEntry,
          ...existingUsers.filter(
            (u: any) =>
              u &&
              u.uid !== firebaseUid &&
              String(u.email || '').toLowerCase() !== email.toLowerCase()
          )
        ];
        localStorage.setItem('nova_registered_users', JSON.stringify(deduplicated));
      }
    } catch {}

    // Persist account to device list and set active
    try {
      const uid = firebaseUid;
      const acc = {
        uid,
        username: email.split('@')[0] || name,
        name,
        email,
        phone: phone || '',
        address: address || (structuredAddress ? formatDeliveryAddress(structuredAddress) : ''),
        pinCode: pinCode || structuredAddress?.pinCode || '',
        deliveryAddress: structuredAddress || undefined,
        savedAddresses: initialSavedAddresses,
        profilePhoto: undefined,
        createdAt: Date.now(),
        legalConsent: effectiveConsent
      };
      addAccount(acc as any);
      try { localStorage.removeItem(`recent_activity_${uid}`); } catch {}
      accountService.setActiveLocalAccount(uid);
      setActiveAccountUid(uid);
    } catch (err) {
      console.error('Failed to manage account:', err);
    }

    // Navigate to setup preferences for new signup
    resetScreenHistory('setup-preferences');
  };

  const handleLoginSuccess = (
    name: string,
    email: string,
    phone: string,
    isSignUp?: boolean,
    address?: string,
    pinCode?: string,
    uid?: string,
    legalConsent?: LegalConsentRecord
  ) => {
    const selectedUid = uid || email;
    const structuredAddress = parseAddressToDeliveryAddress({
      rawAddress: address,
      pinCode,
      fullName: name,
      phone,
    });

    if (structuredAddress) {
      writeCachedUserAddress(selectedUid, structuredAddress, [structuredAddress]);
    } else if (isSignUp) {
      writeCachedUserAddress(selectedUid, null, []);
    }

    // Issue or refresh session token for the authenticated user
    ensureUserSessionToken({
      uid: selectedUid,
      email,
      name,
      phone,
      fallbackAddress: address,
      fallbackPinCode: pinCode,
    }).catch(() => undefined);

    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('novaSessionType', 'registered');
    localStorage.setItem('novaSelectedAccountUid', selectedUid);
    localStorage.setItem('userName', name);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userPhone', phone);
    localStorage.setItem('userAddress', address || (structuredAddress ? formatDeliveryAddress(structuredAddress) : ''));
    localStorage.setItem('userPinCode', pinCode || structuredAddress?.pinCode || '');
    setUserName(name);
    setUserEmail(email);
    setUserPhone(phone);
    setUserAddress(address || (structuredAddress ? formatDeliveryAddress(structuredAddress) : ''));
    setUserPinCode(pinCode || structuredAddress?.pinCode || '');
    if (structuredAddress) {
      setUserDeliveryAddress(structuredAddress);
      setUserSavedAddresses([structuredAddress]);
    } else if (isSignUp) {
      setUserDeliveryAddress(null);
      setUserSavedAddresses([]);
    }
    setIsLoggedIn(true);

    if (isSignUp && legalConsent && legalConsent.accepted) {
      recordUserConsent(selectedUid, email, legalConsent)
        .then((recorded) => {
          setUserLegalConsent(recorded);
          setRequiresConsentRenewal(false);
        })
        .catch((err) => {
          console.error('Failed to record signup consent:', err);
        });
    }
    
    // Save user details to Firestore
    saveUserToFirestore(
      name,
      email,
      phone,
      isSignUp,
      address,
      pinCode,
      selectedUid,
      legalConsent,
      structuredAddress || undefined
    ).catch(err => {
      console.error('Failed to save user data:', err);
    });
    
    // Persist account to device list and set active
    try {
      const acc = {
        uid: selectedUid,
        username: email.split('@')[0] || name,
        name,
        email,
        phone,
        address: address || (structuredAddress ? formatDeliveryAddress(structuredAddress) : undefined),
        pinCode: pinCode || structuredAddress?.pinCode || undefined,
        deliveryAddress: structuredAddress || undefined,
        savedAddresses: structuredAddress ? [structuredAddress] : undefined,
        profilePhoto: undefined,
        createdAt: Date.now(),
        legalConsent
      };
      addAccount(acc as any);
      // if this is a newly signed-up account, clear any prior recent activity and then set active
      if (isSignUp) {
        try { localStorage.removeItem(`recent_activity_${selectedUid}`); } catch {}
      }
      accountService.setActiveLocalAccount(selectedUid);
      setActiveAccountUid(selectedUid);
    } catch {}
    resetScreenHistory(isSignUp ? 'setup-preferences' : 'home');
  };

  const handleAcceptUpdatedTerms = async () => {
    if (isRenewingConsent) return;
    setIsRenewingConsent(true);
    try {
      const targetUid = activeUid || userEmail;
      const updated = await recordUserConsent(targetUid, userEmail, {
        accepted: true,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        consentedAt: new Date().toISOString(),
        source: 'renewal'
      });
      setUserLegalConsent(updated);
      setRequiresConsentRenewal(false);
    } catch (err) {
      console.error('Failed to renew legal consent:', err);
    } finally {
      setIsRenewingConsent(false);
    }
  };

  const handleGuestContinue = () => {
    const guestId = `guest_${Date.now()}`;
    const guestName = 'Guest User';
    const guestEmail = `${guestId}@guest.nova.ai`;

    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('novaSessionType', 'guest');
    localStorage.setItem('novaGuestId', guestId);
    localStorage.setItem('userName', guestName);
    localStorage.setItem('userEmail', guestEmail);
    localStorage.setItem('userPhone', '');
    localStorage.removeItem('userAddress');
    localStorage.removeItem('userPinCode');
    localStorage.setItem('novaGuestProfile', JSON.stringify({
      guestId,
      profileType: 'anonymous',
      preferences: [],
      featureAccess: 'limited',
      createdAt: Date.now()
    }));

    setUserName(guestName);
    setUserEmail(guestEmail);
    setUserPhone('');
    setUserAddress('');
    setUserPinCode('');
    setUserDeliveryAddress(null);
    setUserSavedAddresses([]);
    setIsLoggedIn(true);

    try {
      const acc = {
        uid: guestId,
        username: guestName,
        email: guestEmail,
        profilePhoto: undefined,
        isGuest: true,
        createdAt: Date.now()
      };
      addAccount(acc as any);
      accountService.setActiveLocalAccount(guestId);
      setActiveAccountUid(guestId);
    } catch {}

    resetScreenHistory('home');
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('novaSessionType');
    localStorage.removeItem('novaGuestId');
    localStorage.removeItem('novaGuestProfile');
    localStorage.removeItem('userAddress');
    localStorage.removeItem('userPinCode');
    accountService.setActiveLocalAccount(undefined);
    setActiveAccountUid(undefined);
    localStorage.removeItem('userProfilePhoto');
    localStorage.removeItem('nova_analysis_profile');
    setIsLoggedIn(false);
    setUserAddress('');
    setUserPinCode('');
    setUserDeliveryAddress(null);
    setUserSavedAddresses([]);
    setUserProfilePhoto('');
    setAnalysisProfile(null);
    setUserLegalConsent(null);
    setRequiresConsentRenewal(false);
    resetScreenHistory('home');
  };

  // Navigation highlights checks
  const isTabActive = (tab: string) => {
    if (tab === 'home' && screen === 'home') return true;
    if (tab === 'scan' && (screen === 'scan-outfit' || screen === 'camera-scan')) return true;
    if (tab === 'wardrobe' && screen === 'wardrobe') return true;
    if (tab === 'ar' && (screen === 'ar-tryon' || screen === 'tryon-result')) return true;
    if (tab === 'chat' && screen === 'chat') return true;
    if (tab === 'profile' && (screen === 'profile' || screen === 'terms' || screen === 'privacy')) return true;
    if (tab === 'showroom' && (screen === 'showroom' || screen === 'cart')) return true;
    return false;
  };

  // Determine if full-screen preview camera active (setup preferences, profile analysis, email verification)
  const isImmersiveAR = screen === 'setup-preferences' || screen === 'profile-analysis' || screen === 'email-verification';

  // Splash Screen Guard
  if (screen === 'splash') {
    return <SplashView onComplete={handleSplashComplete} />;
  }

  // Onboarding Slides Guard
  if (screen === 'onboarding') {
    return <OnboardingView onComplete={handleOnboardingComplete} />;
  }

  // Email Verification Screen Guard
  if (screen === 'email-verification' && pendingEmailVerification) {
    return (
      <div className="min-h-screen bg-[#F2EEFF] nova-page-wash flex flex-col justify-center max-w-md mx-auto relative shadow-2xl overflow-hidden font-sans border-x border-[#E4DFF5] text-[#131426]">
        <main className="flex-grow relative px-4 py-3 flex flex-col justify-center">
          <EmailVerificationView
            email={pendingEmailVerification.email}
            onVerificationSuccess={handleEmailVerificationSuccess}
            onChangeEmail={handlePendingVerificationEmailChange}
          />
        </main>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F2EEFF] nova-page-wash flex flex-col justify-center max-w-md mx-auto relative shadow-2xl overflow-hidden font-sans border-x border-[#E4DFF5] text-[#131426]">
        <main className="flex-grow relative px-4 py-3 flex flex-col justify-center">
          <AuthView 
            onLoginSuccess={handleLoginSuccess} 
            onGuestContinue={handleGuestContinue}
            onProceedToEmailVerification={handleProceedToEmailVerification}
            prefilledName={pendingEmailVerification?.name}
            prefilledAddress={pendingEmailVerification?.address}
            prefilledPinCode={pendingEmailVerification?.pinCode}
          />
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col justify-between ${screen === 'setup-preferences' || screen === 'profile-analysis' ? 'max-w-[920px]' : 'max-w-md'} mx-auto relative shadow-2xl overflow-hidden font-sans transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-slate-950 border-x border-slate-800 text-white' 
        : 'bg-[#F2EEFF] nova-page-wash border-x border-[#E4DFF5] text-[#131426]'
    }`}>
      
      {/* 1. Header Toolbar (Hidden when immersive AR camera is loaded to mimic device viewport) */}
      {!isImmersiveAR && (
        <header className={`sticky top-0 z-40 backdrop-blur-xl px-6 py-4 flex items-center justify-between transition-colors duration-300 ${
          isDarkMode
            ? 'bg-slate-900/85 border-b border-slate-800/40'
            : 'bg-white/95 border-b border-[#E4DFF5] shadow-[0_6px_20px_-4px_rgba(85,59,226,0.06),0_2px_6px_-1px_rgba(19,20,38,0.03)]'
        }`}>
          <div 
            onClick={() => navigate('home')}
            className="flex items-center space-x-2 cursor-pointer select-none group"
          >
            <span
              aria-hidden="true"
              className="h-8 w-8 shrink-0 rounded-xl bg-white border border-[#E4DFF5] p-1 flex items-center justify-center shadow-[0_2px_6px_rgba(19,20,38,0.04)] transition-transform group-hover:scale-105"
            >
              <img
                src="/nova-logo.png"
                alt="NOVA"
                className="w-full h-full object-contain block"
              />
            </span>
            <div className="leading-none flex items-center">
              <span className={`text-base font-black tracking-tight group-hover:text-[#553BE2] transition-colors ${
                isDarkMode ? 'text-white' : 'text-[#131426]'
              }`}>NOVA</span>
              {/* subtitle intentionally removed to show only brand name */}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Wishlist widget (opens modal) */}
            <button 
              onClick={() => setIsWishlistOpen(true)}
              className="nova-interactive w-10 h-10 rounded-full bg-white hover:bg-[#F2EEFF] flex items-center justify-center relative border border-[#E4DFF5] shadow-[0_2px_6px_rgba(19,20,38,0.04)]"
              title="View Wishlist"
            >
              <span className="material-symbols-outlined text-rose-500 text-[20px]" style={{ fontVariationSettings: wishlist.length > 0 ? "'FILL' 1" : undefined }}>favorite</span>
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow border border-white">
                  {wishlist.length}
                </span>
              )}
            </button>

            {/* Quick Shopping Cart widget */}
            <button 
              onClick={() => navigate('cart')}
              className="nova-interactive w-10 h-10 rounded-full bg-[#F2EEFF] flex items-center justify-center relative hover:bg-[#ECE7FF] border border-[#E2DBF8] shadow-[0_2px_6px_rgba(19,20,38,0.03)]"
              title="View Cart"
            >
              <span className="material-symbols-outlined text-[#553BE2] text-[20px]">local_mall</span>
              {countCartTotalItems() > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#553BE2] text-white text-[10px] font-black flex items-center justify-center shadow border border-white animate-pulse">
                  {countCartTotalItems()}
                </span>
              )}
            </button>

            {/* Quick profile thumbnail widget */}
            <button 
              onClick={() => navigate('profile')}
              className="nova-interactive w-9 h-9 rounded-full overflow-hidden border-2 border-white ring-2 ring-[#ECE7FF] hover:ring-[#553BE2]/40 shadow-[0_4px_12px_rgba(85,59,226,0.14)]"
            >
              <img 
                alt="Account profile" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                src={userProfilePhoto || activeAccount?.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'NOVA User')}&background=F2EEFF&color=553BE2&bold=true`}
              />
            </button>
          </div>
        </header>
      )}

      {/* 2. Primary Page Contents Body (with comfortable padding, except AR which covers background fully) */}
      <main className={`flex-grow relative transition-colors duration-300 ${isImmersiveAR ? '' : `px-4 py-3 pb-28 ${isDarkMode ? 'bg-slate-950/10' : 'bg-transparent'}`}`}>
        {requiresConsentRenewal && !isImmersiveAR && (
          <div
            role="region"
            aria-label="Updated Legal Terms Notice"
            className={`mb-4 rounded-2xl p-4 border space-y-2.5 ${
              isDarkMode
                ? 'bg-slate-900 border-indigo-800/60 text-slate-100'
                : 'bg-white border-[#D5CBF7] text-[#131426] shadow-[0_8px_20px_-4px_rgba(85,59,226,0.1)]'
            }`}
          >
            <div className="text-xs font-extrabold text-[#553BE2]">
              Updated Terms &amp; Privacy Policy (v{TERMS_VERSION})
            </div>
            <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'}`}>
              NOVA&apos;s{' '}
              <button
                type="button"
                onClick={() => navigate('terms')}
                className="font-bold text-[#553BE2] underline underline-offset-2 cursor-pointer"
              >
                Terms &amp; Conditions
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => navigate('privacy')}
                className="font-bold text-[#553BE2] underline underline-offset-2 cursor-pointer"
              >
                Privacy Policy
              </button>{' '}
              have been materially updated since your previous acceptance. Please review and accept the updated terms to continue using account features.
            </p>
            <button
              type="button"
              disabled={isRenewingConsent}
              onClick={handleAcceptUpdatedTerms}
              className="w-full py-2.5 px-4 rounded-xl bg-[#553BE2] hover:bg-[#462CC9] text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
            >
              {isRenewingConsent ? 'Recording Acceptance...' : 'I Agree to Updated Terms & Privacy Policy'}
            </button>
          </div>
        )}
        {renderActiveScreen()}
      </main>

      {/* Wishlist Modal (quick view) */}
      {isWishlistOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsWishlistOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl shadow-xl p-4 overflow-y-auto max-h-[70vh] transition-colors duration-300 border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#E4DFF5]'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{t('profile.settings.wishlist')} ({wishlist.length})</h3>
              <button onClick={() => setIsWishlistOpen(false)} className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-[#5E667A] hover:text-[#131426]'}`}>{t('common.close')}</button>
            </div>
            {wishlist.length === 0 ? (
              <div className={`p-6 text-center ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                No saved items yet â€” tap the heart on products to save them.
              </div>
            ) : (
              <div className="space-y-3">
                {wishlist.map((productId) => {
                  const prod = productsData[productId] || products[productId];
                  if (!prod) return null;
                  const defaultColor = getDefaultProductColor(prod);
                  const defaultSize = prod.sizes && prod.sizes.length > 0 ? prod.sizes[0] : 'One Size';
                  return (
                    <div key={productId} className={`flex items-center gap-3 p-2 rounded-xl border ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-[#E4DFF5] hover:bg-[#F2EEFF]'}`}>
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#F2EEFF] border border-[#E2DBF8]">
                        <img alt={prod.name} src={prod.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-[#131426]'}`}>{prod.name}</div>
                        <div className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>â‚¹{prod.price}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            handleAddToCart(productId, defaultColor, defaultSize);
                          }}
                          className="py-2 px-3 bg-[#553BE2] hover:bg-[#462CC9] text-white rounded-xl text-xs font-bold"
                        >Add</button>
                        <button
                          onClick={() => {
                            handleToggleWishlist(productId);
                          }}
                          className="py-2 px-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100"
                        >Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* 3. Bottom persistent device Navigation Tab-Bar & NOVA Hub Modal (Hidden during immersive Tryon filtering) */}
      {!isImmersiveAR && (
        <>
          <BottomNavBar
            currentScreen={screen}
            onNavigate={navigate}
            onOpenQuickHub={() => setIsQuickHubOpen(true)}
          />
          <QuickHubModal
            isOpen={isQuickHubOpen}
            onClose={() => setIsQuickHubOpen(false)}
            onNavigate={navigate}
          />
        </>
      )}
    </div>
  );
}
