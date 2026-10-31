import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  ScreenId,
  WardrobeDetectedAttributes,
  WardrobeGender,
  WardrobeItem,
  WardrobeProfile,
  WardrobeScanMethod,
  WardrobeSize,
  CanonicalGarmentData,
  CANONICAL_COLORS,
  CANONICAL_PATTERNS,
  CANONICAL_FABRICS,
  CANONICAL_SLEEVE_TYPES,
  CANONICAL_NECK_TYPES,
  CANONICAL_FITS,
  CANONICAL_STYLES,
  CANONICAL_OCCASIONS,
  CANONICAL_SEASONS,
  CANONICAL_FORMALITIES,
  SUBCATEGORY_TO_DISPLAY_MAP,
  DISPLAY_TO_SUBCATEGORY_MAP,
  SUBCATEGORY_TO_BODY_SECTION_MAP,
  canonicalToDisplayAttributes,
  resolveDisplayCategory
} from '../types';
import accountService from '../services/accountService';
import aiService from "../services/aiService";
import { resolveColorHex } from '../utils/colors';
import { useI18n } from '../i18n';
import {
  GUEST_WARDROBE_KEY,
  GUEST_PROFILE_KEY,
  GUEST_OUTFITS_KEY,
  isGuestAccount,
  getWardrobeStorageKey,
  getWardrobeProfileKey,
  getWardrobeOutfitsKey,
  readLocalWardrobeItems,
  saveLocalWardrobeItems,
  readLocalWardrobeProfile,
  saveLocalWardrobeProfile,
  readLocalWardrobeOutfits,
  saveLocalWardrobeOutfits,
  mergeWardrobeItems,
  sanitizeForFirestore,
  requestGarmentAnalysis
} from '../services/wardrobeService';
import { generateWardrobeOutfits } from '../services/wardrobeOutfitEngine';
import { useBackHandler } from '../services/backButtonService';

interface VirtualWardrobeViewProps {
  onNavigate: (screen: ScreenId) => void;
  userEmail?: string;
  userName?: string;
  isDarkMode?: boolean;
  userId?: string;
  isGuest?: boolean;
}

const sizes: WardrobeSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const maleCategories = ['Top', 'T-Shirt', 'Shirt', 'Polo', 'Hoodie', 'Sweatshirt', 'Jacket', 'Jeans', 'Trousers', 'Shorts', 'Ethnic Wear', 'Blazer'];
const femaleCategories = ['Top', 'Blouse', 'Crop Top', 'T-Shirt', 'Shirt', 'Kurti', 'Co-ord Set', 'Saree', 'Dress', 'Jacket', 'Hoodie', 'Jeans', 'Leggings', 'Palazzo'];
const categoryIcons: Record<string, string> = {
  Top: 'apparel',
  Blouse: 'styler',
  'T-Shirt': 'apparel',
  Shirt: 'styler',
  Polo: 'apparel',
  Hoodie: 'checkroom',
  Sweatshirt: 'checkroom',
  Jacket: 'dry_cleaning',
  Jeans: 'laundry',
  Trousers: 'laundry',
  Shorts: 'apparel',
  'Ethnic Wear': 'style',
  Blazer: 'business_center',
  Kurti: 'apparel',
  'Co-ord Set': 'select_all',
  Saree: 'gesture',
  'Crop Top': 'apparel',
  Leggings: 'laundry',
  Palazzo: 'laundry',
  Dress: 'styler'
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const topCategories = ['Top', 'Blouse', 'T-Shirt', 'Shirt', 'Polo', 'Hoodie', 'Sweatshirt', 'Jacket', 'Blazer', 'Kurti', 'Crop Top'];
const bottomCategories = ['Jeans', 'Trousers', 'Shorts', 'Leggings', 'Palazzo'];
const isBottomWear = (category: string) => bottomCategories.includes(category);

interface NormalizedUpload {
  dataUrl: string;
  file: File;
  isPng: boolean;
}

/**
 * Validates image type and size, normalizes orientation, and resizes large dimensions
 * while strictly preserving aspect ratio and PNG alpha transparency.
 */
const validateAndNormalizeImage = async (file: File): Promise<NormalizedUpload> => {
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Unsupported image format. Please upload a JPEG, PNG, or WebP photo.');
  }

  const maxSizeBytes = 15 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error('Image size is too large (max 15MB). Please choose a smaller photo.');
  }

  return new Promise<NormalizedUpload>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const maxDimension = 1200;
        let { width, height } = img;
        if (width <= 0 || height <= 0) {
          throw new Error('Invalid image dimensions');
        }

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not initialize canvas context');
        }

        // Preserve transparency for PNG: clearRect, do not fill with solid background
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const outputType = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputType, 0.92);

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve({ dataUrl, file, isPng });
            return;
          }
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          const normalizedFile = new File([blob], `${cleanName}${isPng ? '.png' : '.jpg'}`, {
            type: outputType,
            lastModified: Date.now()
          });
          resolve({ dataUrl, file: normalizedFile, isPng });
        }, outputType, 0.92);
      } catch (err: any) {
        reject(new Error(err?.message || 'Failed to normalize image.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image file. Could not read image data.'));
    };
    img.src = objectUrl;
  });
};

export const VirtualWardrobeView: React.FC<VirtualWardrobeViewProps> = ({
  onNavigate,
  userEmail = '',
  userName,
  isDarkMode = false,
  userId: propUserId,
  isGuest
}) => {
  const { t } = useI18n();

  // 1. Determine if current session is Guest mode (Requirement 1, 3)
  const isGuestMode = isGuestAccount({
    isGuest,
    uid: propUserId,
    email: userEmail
  });

  // 2. Primary storage identity for registered users: Firebase Auth UID (Requirement 2)
  const registeredUid = !isGuestMode
    ? (auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : (propUserId && !propUserId.startsWith('guest_') ? propUserId : null))
    : null;

  // 3. Never use a stale email or legacy doc ID as Guest identity (Requirement 3)
  const effectiveIdentity = isGuestMode ? 'guest' : (registeredUid || 'unknown');

  // 4. Firestore reads/writes scoped strictly to authenticated user's UID (Requirement 6)
  const authenticatedUid = (!isGuestMode && auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.uid === registeredUid)
    ? auth.currentUser.uid
    : null;

  // 5. Legacy doc ID for registered users only (Requirement 9, 10)
  const legacyUserId = (!isGuestMode && userEmail && !userEmail.toLowerCase().endsWith('@guest.nova.ai'))
    ? accountService.getUserDocId(userEmail)
    : null;

  const username = userEmail && !isGuestMode ? userEmail.split('@')[0] : (userName || (isGuestMode ? 'Guest' : effectiveIdentity));

  const activeIdentityRef = useRef(effectiveIdentity);
  activeIdentityRef.current = effectiveIdentity;

  const [profile, setProfile] = useState<WardrobeProfile>(() => {
    return readLocalWardrobeProfile({ uid: effectiveIdentity, isGuest: isGuestMode, legacyEmail: userEmail });
  });
  const [items, setItems] = useState<WardrobeItem[]>(() => {
    return readLocalWardrobeItems({ uid: effectiveIdentity, isGuest: isGuestMode, legacyEmail: userEmail });
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scanMethod, setScanMethod] = useState<WardrobeScanMethod>('Upload Photo');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [bgRemovalError, setBgRemovalError] = useState<string | null>(null);
  const [useOriginalFallback, setUseOriginalFallback] = useState(false);
  const [garmentCategory, setGarmentCategory] = useState<string>('');
  const [garmentColor, setGarmentColor] = useState<string>('Custom');

  // Gemini Garment Intelligence State
  const [isAnalyzingGarment, setIsAnalyzingGarment] = useState(false);
  const isAnalyzingRef = useRef(false);
  const [garmentAiError, setGarmentAiError] = useState<string | null>(null);
  const [detectedGarment, setDetectedGarment] = useState<CanonicalGarmentData | null>(null);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);

  // Editable Canonical Form Attributes
  const [formPrimaryColor, setFormPrimaryColor] = useState<string>('');
  const [formSecondaryColor, setFormSecondaryColor] = useState<string>('—');
  const [formPattern, setFormPattern] = useState<string>('');
  const [formFabric, setFormFabric] = useState<string>('');
  const [formSleeveType, setFormSleeveType] = useState<string>('');
  const [formNeckType, setFormNeckType] = useState<string>('');
  const [formFit, setFormFit] = useState<string>('');
  const [formStyle, setFormStyle] = useState<string>('');
  const [formOccasions, setFormOccasions] = useState<string[]>([]);
  const [formSeasons, setFormSeasons] = useState<string[]>(['All Season']);
  const [formFormality, setFormFormality] = useState<string>('Casual');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formSize, setFormSize] = useState<string>('');

  const resetGarmentForm = () => {
    setSelectedCategory(null);
    setUploadedImage(null);
    setUploadedFile(null);
    setProcessedImage(null);
    setIsRemovingBg(false);
    setBgRemovalError(null);
    setUseOriginalFallback(false);
    setIsAnalyzingGarment(false);
    setGarmentAiError(null);
    setDetectedGarment(null);
    setAnalysisSuccess(false);
    setGarmentCategory('');
    setGarmentColor('');
    setFormPrimaryColor('');
    setFormSecondaryColor('—');
    setFormPattern('');
    setFormFabric('');
    setFormSleeveType('');
    setFormNeckType('');
    setFormFit('');
    setFormStyle('');
    setFormOccasions([]);
    setFormSeasons(['All Season']);
    setFormFormality('Casual');
    setFormDescription('');
    setFormSize('');
  };

  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');
  const [patternFilter, setPatternFilter] = useState('All');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [outfitOccasionFilter, setOutfitOccasionFilter] = useState('All');
  const [editDraft, setEditDraft] = useState<WardrobeItem | null>(null);
  const [outfitSeed, setOutfitSeed] = useState<WardrobeItem | null>(null);
  const [outfitPartnerId, setOutfitPartnerId] = useState<string>('');
  // Priority 1: Close active item details, editing draft, or outfit seed overlays
  const hasWardrobeOverlay = Boolean(selectedItem || editDraft || outfitSeed);
  useBackHandler('virtual-wardrobe-overlays', () => {
    if (editDraft) {
      setEditDraft(null);
      return true;
    }
    if (selectedItem) {
      setSelectedItem(null);
      return true;
    }
    if (outfitSeed) {
      setOutfitSeed(null);
      return true;
    }
    return false;
  }, 100, hasWardrobeOverlay);

  const [savedOutfitCount, setSavedOutfitCount] = useState<number>(() => {
    return readLocalWardrobeOutfits({ uid: effectiveIdentity, isGuest: isGuestMode, legacyEmail: userEmail }).length;
  });

  // Reset transient wardrobe state when active account changes (Requirement 4)
  useEffect(() => {
    setSelectedItem(null);
    setEditDraft(null);
    setOutfitSeed(null);
    setOutfitPartnerId('');
    resetGarmentForm();
    setSaveStatus(null);
    setOutfitIndex(0);
    setOutfitOccasionFilter('All');

    const freshProfile = readLocalWardrobeProfile({ uid: effectiveIdentity, isGuest: isGuestMode, legacyEmail: userEmail });
    setProfile(freshProfile);
    const freshOutfits = readLocalWardrobeOutfits({ uid: effectiveIdentity, isGuest: isGuestMode, legacyEmail: userEmail });
    setSavedOutfitCount(freshOutfits.length);
  }, [effectiveIdentity, isGuestMode, userEmail]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const result = await aiService.checkConnection();
        console.log("✅ AI Server:", result);
      } catch (error) {
        console.error("❌ Could not connect to AI Server", error);
      }
    };
    testConnection();
  }, []);

  // Async wardrobe loading with cancellation (Requirement 5, 6, 7)
  useEffect(() => {
    let isCancelled = false;
    const targetIdentity = effectiveIdentity;
    const targetIsGuest = isGuestMode;
    const targetAuthUid = authenticatedUid;

    const loadWardrobe = async () => {
      setIsLoading(true);
      const localItems = readLocalWardrobeItems({
        uid: targetIdentity,
        isGuest: targetIsGuest,
        legacyEmail: userEmail
      });

      // Cancellation check before updating state (Requirement 5)
      if (isCancelled || activeIdentityRef.current !== targetIdentity) return;
      setItems(localItems);

      // Keep Firestore reads scoped to authenticated user's UID (Requirement 6, 7)
      if (!targetIsGuest && targetAuthUid) {
        try {
          const snap = await getDocs(
            query(collection(db, 'users', targetAuthUid, 'wardrobe'), orderBy('dateAdded', 'desc'))
          );
          if (isCancelled || activeIdentityRef.current !== targetIdentity) return;

          const remote = snap.docs.map((entry) => ({ ...(entry.data() as WardrobeItem), id: entry.id }));
          
          // Merge localStorage and Firestore within the user namespace
          const merged = mergeWardrobeItems(remote, localItems);
          if (isCancelled || activeIdentityRef.current !== targetIdentity) return;
          setItems(merged);
          saveLocalWardrobeItems(merged, { uid: targetIdentity, isGuest: false });

          // Recovery & synchronization: upload any local items that are missing from cloud
          // (e.g. saved during an offline session or when a prior sync encountered errors)
          const remoteMap = new Map<string, WardrobeItem>(remote.map((r) => [r.id, r]));
          const pendingSync = localItems.filter((local) => {
            const remoteItem = remoteMap.get(local.id);
            if (!remoteItem) return true; // entirely missing in Firestore
            return !remoteItem.canonical && Boolean(local.canonical);
          });

          if (pendingSync.length > 0) {
            for (const itemToSync of pendingSync) {
              if (isCancelled || activeIdentityRef.current !== targetIdentity) break;
              try {
                const sanitized = sanitizeForFirestore(itemToSync);
                await setDoc(doc(db, 'users', targetAuthUid, 'wardrobe', itemToSync.id), sanitized, { merge: true });
              } catch (syncErr) {
                console.warn(`[Wardrobe Sync] Auto-sync to cloud failed for ${itemToSync.id}:`, syncErr);
              }
            }
          }
        } catch (err) {
          if (isCancelled || activeIdentityRef.current !== targetIdentity) return;
          console.warn('Failed to load wardrobe from cloud, using local fallback:', err);
        }
      }

      if (!isCancelled && activeIdentityRef.current === targetIdentity) {
        setIsLoading(false);
      }
    };

    loadWardrobe();

    return () => {
      isCancelled = true;
    };
  }, [effectiveIdentity, isGuestMode, authenticatedUid, userEmail]);

  useEffect(() => {
    saveLocalWardrobeProfile(profile, { uid: effectiveIdentity, isGuest: isGuestMode });
    if (!isGuestMode && authenticatedUid) {
      accountService.upsertUserProfile(
        {
          uid: authenticatedUid,
          username,
          name: userName || username,
          email: userEmail,
          gender: profile.gender,
          size: profile.size
        },
        { wardrobeCount: items.length }
      ).catch(() => undefined);
    }
  }, [authenticatedUid, effectiveIdentity, isGuestMode, items.length, profile, userEmail, userName, username]);

  const categories = profile.gender === 'Male' ? maleCategories : femaleCategories;
  const categoryOptions = ['All', ...new Set(items.map((item) => item.category))];
  const colorOptions = ['All', ...new Set(items.flatMap((item) => item.colors))];
  const patternOptions = ['All', ...new Set(items.map((item) => item.pattern))];

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.category.toLowerCase().includes(search.toLowerCase()) || item.tags.join(' ').toLowerCase().includes(search.toLowerCase()))
      .filter((item) => categoryFilter === 'All' || item.category === categoryFilter)
      .filter((item) => colorFilter === 'All' || item.colors.includes(colorFilter))
      .filter((item) => patternFilter === 'All' || item.pattern === patternFilter)
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [categoryFilter, colorFilter, items, patternFilter, search]);

  const persistItems = (next: WardrobeItem[]) => {
    setItems(next);
    saveLocalWardrobeItems(next, { uid: effectiveIdentity, isGuest: isGuestMode });
  };

  const triggerGeminiAnalysis = async (imageToAnalyze: string, categoryHint?: string) => {
    if (!imageToAnalyze || isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzingGarment(true);
    setGarmentAiError(null);
    setAnalysisSuccess(false);

    try {
      const res = await requestGarmentAnalysis(imageToAnalyze, categoryHint);
      if (res.success && res.garment) {
        const g = res.garment;
        setDetectedGarment(g);
        setAnalysisSuccess(true);
        const mappedCat = resolveDisplayCategory(g.category, g.subcategory) || categoryHint || garmentCategory || selectedCategory || 'Top';
        setGarmentCategory(mappedCat);
        setGarmentColor(g.visual.primaryColor || '');
        setFormPrimaryColor(g.visual.primaryColor || '');
        setFormSecondaryColor(g.visual.secondaryColor || '—');
        setFormPattern(g.visual.pattern || 'Not specified');
        setFormFabric(g.material.fabric || 'Unknown');
        setFormSleeveType(g.construction.sleeveType || (isBottomWear(mappedCat) ? 'Not Applicable' : 'Not specified'));
        setFormNeckType(g.construction.neckType || (isBottomWear(mappedCat) ? 'Not Applicable' : 'Not specified'));
        setFormFit(g.construction.fit || 'Not specified');
        setFormStyle(g.style.primary || 'Casual');
        setFormOccasions(g.usage.occasions && g.usage.occasions.length > 0 ? g.usage.occasions : ['Casual']);
        setFormSeasons(g.usage.seasons && g.usage.seasons.length > 0 ? g.usage.seasons : ['All Season']);
        setFormFormality(g.usage.formality || 'Casual');
        setFormDescription(g.aiMetadata.description || '');
        setSaveStatus('Garment details analyzed.');
        window.setTimeout(() => setSaveStatus(null), 3000);
      } else {
        const errMsg = res.error || 'Garment analysis notice: please verify attributes below.';
        setGarmentAiError(errMsg);
      }
    } catch (err: any) {
      setGarmentAiError(err?.message || 'Analysis notice: please verify attributes below.');
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzingGarment(false);
    }
  };

  const processBackgroundRemoval = async (file: File, category: string) => {
    setIsRemovingBg(true);
    setBgRemovalError(null);
    try {
      const result = await aiService.uploadGarment(file, category);
      if (!result?.processed_image) {
        throw new Error('Garment processor did not return an image.');
      }
      setProcessedImage(result.processed_image);
      setUseOriginalFallback(false);
      setSaveStatus('Garment isolated. Analyzing details...');
      await triggerGeminiAnalysis(result.processed_image, category);
    } catch (err: any) {
      console.error('Garment processing failed:', err);
      const detail = err?.message || 'Server unreachable at http://127.0.0.1:8000';
      setProcessedImage(null);
      setBgRemovalError(`Garment processing notice: ${detail}`);
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setBgRemovalError(null);
      setUseOriginalFallback(false);
      setProcessedImage(null);

      const normalized = await validateAndNormalizeImage(file);
      setUploadedImage(normalized.dataUrl);
      setUploadedFile(normalized.file);

      await processBackgroundRemoval(normalized.file, garmentCategory || selectedCategory || '');
    } catch (err: any) {
      console.error('Image upload validation failed:', err);
      setBgRemovalError(err.message || 'Failed to process selected image.');
      setSaveStatus(err.message || 'Image processing error.');
      window.setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      event.target.value = '';
    }
  };

  const retryBackgroundRemoval = () => {
    if (uploadedFile) {
      processBackgroundRemoval(uploadedFile, garmentCategory || selectedCategory || '');
    }
  };

  const continueWithOriginal = async () => {
    if (!uploadedImage) return;
    setUseOriginalFallback(true);
    setProcessedImage(uploadedImage);
    setBgRemovalError(null);
    setSaveStatus('Using original photo. Analyzing garment details...');
    await triggerGeminiAnalysis(uploadedImage, garmentCategory || selectedCategory || '');
  };

  const retryAiAnalysis = () => {
    const targetImage = useOriginalFallback ? uploadedImage : (processedImage || uploadedImage);
    if (targetImage) {
      triggerGeminiAnalysis(targetImage, garmentCategory || selectedCategory || '');
    }
  };

  const saveWardrobeItem = async (itemToSave: WardrobeItem) => {
    const next = [itemToSave, ...items.filter((item) => item.id !== itemToSave.id)];
    persistItems(next);

    if (isGuestMode || !authenticatedUid) {
      setSaveStatus(isGuestMode ? 'Saved locally (Guest mode — sign in to sync with cloud)' : 'Saved locally');
      resetGarmentForm();
      window.setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    try {
      const sanitized = sanitizeForFirestore(itemToSave);
      await setDoc(doc(db, 'users', authenticatedUid, 'wardrobe', itemToSave.id), sanitized);
      setSaveStatus('Saved to cloud wardrobe');
      try {
        await accountService.upsertUserProfile(
          {
            uid: authenticatedUid,
            username,
            name: userName || username,
            email: userEmail,
            gender: profile.gender,
            size: profile.size
          },
          { wardrobeCount: next.length, wardrobeUpdatedAt: itemToSave.dateAdded }
        );
      } catch {
        // Non-critical profile metadata update
      }
    } catch (err: any) {
      console.warn('Firestore wardrobe cloud save failed:', err);
      const isPermission = err?.code === 'permission-denied';
      setSaveStatus(
        isPermission
          ? 'Saved locally (Cloud save permission denied — check Firestore rules)'
          : `Saved locally (Cloud sync failed: ${err?.message || 'Network error'})`
      );
    }

    resetGarmentForm();
    window.setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleSaveGarment = () => {
    const finalImage = useOriginalFallback ? uploadedImage : (processedImage || uploadedImage);
    if (!finalImage) {
      setSaveStatus('Please select or capture a clothing photo first.');
      window.setTimeout(() => setSaveStatus(null), 2500);
      return;
    }

    const finalCategory = garmentCategory || selectedCategory || 'Top';
    const finalPrimaryColor = formPrimaryColor || (garmentColor && garmentColor !== 'Custom' ? garmentColor.trim() : '') || detectedGarment?.visual.primaryColor || 'Not specified';
    const finalSubcategory = DISPLAY_TO_SUBCATEGORY_MAP[finalCategory] || detectedGarment?.subcategory || 'other';
    const bodyCategory = SUBCATEGORY_TO_BODY_SECTION_MAP[finalSubcategory] || (isBottomWear(finalCategory) ? 'bottom' : (detectedGarment?.category || 'top'));

    const finalCanonical: CanonicalGarmentData = {
      schemaVersion: '1.0',
      id: makeId(),
      category: bodyCategory,
      subcategory: finalSubcategory,
      gender: profile.gender === 'Male' ? 'men' : profile.gender === 'Female' ? 'women' : 'unisex',
      visual: {
        primaryColor: finalPrimaryColor,
        secondaryColor: formSecondaryColor === '—' ? null : formSecondaryColor,
        colorFamily: detectedGarment?.visual.colorFamily || ['neutral'],
        pattern: formPattern || detectedGarment?.visual.pattern || 'Not specified',
        texture: detectedGarment?.visual.texture || null,
        visibleDetails: detectedGarment?.visual.visibleDetails || []
      },
      construction: {
        sleeveType: isBottomWear(finalCategory) ? 'Not Applicable' : (formSleeveType || detectedGarment?.construction.sleeveType || 'Not specified'),
        neckType: isBottomWear(finalCategory) ? 'Not Applicable' : (formNeckType || detectedGarment?.construction.neckType || 'Not specified'),
        fit: formFit || detectedGarment?.construction.fit || 'Not specified',
        length: detectedGarment?.construction.length || 'regular',
        silhouette: detectedGarment?.construction.silhouette || 'regular',
        rise: isBottomWear(finalCategory) ? (detectedGarment?.construction.rise || 'mid') : null
      },
      material: {
        fabric: formFabric || detectedGarment?.material.fabric || 'Unknown',
        fabricConfidence: detectedGarment ? detectedGarment.material.fabricConfidence : 'inferred',
        composition: detectedGarment?.material.composition || null
      },
      style: {
        primary: formStyle || detectedGarment?.style.primary || 'Casual',
        secondary: detectedGarment?.style.secondary || [],
        tags: [formStyle.toLowerCase(), formPattern.toLowerCase(), finalCategory.toLowerCase()].filter(Boolean)
      },
      usage: {
        occasions: formOccasions.length > 0 ? formOccasions : (detectedGarment?.usage.occasions || ['Casual']),
        seasons: formSeasons.length > 0 ? formSeasons : (detectedGarment?.usage.seasons || ['All Season']),
        formality: formFormality || detectedGarment?.usage.formality || 'Casual'
      },
      matching: {
        compatibleCategories: detectedGarment?.matching.compatibleCategories || (isBottomWear(finalCategory) ? ['top', 'outerwear', 'footwear'] : ['bottom', 'outerwear', 'footwear']),
        compatibleStyles: detectedGarment?.matching.compatibleStyles || [formStyle || 'Casual'],
        colorCompatibility: detectedGarment?.matching.colorCompatibility || ['neutral']
      },
      aiMetadata: {
        description: formDescription || detectedGarment?.aiMetadata.description || `${finalPrimaryColor} ${finalCategory}`,
        searchTags: [finalPrimaryColor, finalCategory, formPattern, formFabric, formStyle].filter(Boolean).map((s) => s.toLowerCase()),
        unknownFields: detectedGarment?.aiMetadata.unknownFields || [],
        extractionSource: detectedGarment ? 'gemini' : 'manual',
        schemaVersion: '1.0'
      }
    };

    const displayAttrs = canonicalToDisplayAttributes(finalCanonical);

    // Garment size: only set when user explicitly provided it; never default to user profile size
    const finalSize = formSize && formSize.trim() && formSize !== 'Not specified' ? formSize.trim() : '';

    const newItem: WardrobeItem = {
      id: finalCanonical.id!,
      category: finalCategory,
      size: finalSize,
      generatedImage: finalImage,
      originalScan: uploadedImage || finalImage,
      colors: [finalPrimaryColor, ...(finalCanonical.visual.secondaryColor ? [finalCanonical.visual.secondaryColor] : [])],
      pattern: finalCanonical.visual.pattern,
      fabric: finalCanonical.material.fabric,
      tags: [finalCategory, finalPrimaryColor, formStyle, formPattern].filter(Boolean),
      dateAdded: new Date().toISOString(),
      timesWorn: 0,
      canonical: finalCanonical,
      attributes: displayAttrs as WardrobeDetectedAttributes
    };

    saveWardrobeItem(newItem);
  };

  const deleteItem = async (item: WardrobeItem) => {
    const next = items.filter((entry) => entry.id !== item.id);
    persistItems(next);
    setSelectedItem(null);

    if (isGuestMode || !authenticatedUid) {
      setSaveStatus('Removed locally');
      window.setTimeout(() => setSaveStatus(null), 2000);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', authenticatedUid, 'wardrobe', item.id));
      setSaveStatus('Removed from cloud wardrobe');
      try {
        await accountService.upsertUserProfile(
          {
            uid: authenticatedUid,
            username,
            name: userName || username,
            email: userEmail,
            gender: profile.gender,
            size: profile.size
          },
          { wardrobeCount: Math.max(0, next.length), wardrobeUpdatedAt: new Date().toISOString() }
        );
      } catch {}
    } catch (err: any) {
      console.warn('Firestore wardrobe delete failed:', err);
      setSaveStatus('Removed locally (Cloud sync failed)');
    }
    window.setTimeout(() => setSaveStatus(null), 2500);
  };

  const updateItem = async (item: WardrobeItem) => {
    const next = items.map((entry) => (entry.id === item.id ? item : entry));
    persistItems(next);
    setSelectedItem(item);

    if (isGuestMode || !authenticatedUid) {
      setSaveStatus('Updated locally');
      window.setTimeout(() => setSaveStatus(null), 2000);
      return;
    }

    try {
      const sanitized = sanitizeForFirestore(item);
      await setDoc(doc(db, 'users', authenticatedUid, 'wardrobe', item.id), sanitized, { merge: true });
      setSaveStatus('Updated in cloud wardrobe');
      try {
        await accountService.upsertUserProfile(
          {
            uid: authenticatedUid,
            username,
            name: userName || username,
            email: userEmail,
            gender: profile.gender,
            size: profile.size
          },
          { wardrobeCount: next.length, wardrobeUpdatedAt: new Date().toISOString() }
        );
      } catch {}
    } catch (err: any) {
      console.warn('Firestore wardrobe update failed:', err);
      setSaveStatus('Updated locally (Cloud sync failed)');
    }
    window.setTimeout(() => setSaveStatus(null), 2500);
  };

  const markOutfitWorn = (outfitItems: WardrobeItem[]) => {
    const wornIds = new Set(outfitItems.map((item) => item.id));
    const now = new Date().toISOString();
    const next = items.map((item) => wornIds.has(item.id) ? { ...item, timesWorn: (item.timesWorn || 0) + 1, lastWorn: now } : item);
    persistItems(next);
    if (!isGuestMode && authenticatedUid) {
      next
        .filter((item) => wornIds.has(item.id))
        .forEach((item) => {
          const sanitized = sanitizeForFirestore(item);
          setDoc(doc(db, 'users', authenticatedUid, 'wardrobe', item.id), sanitized, { merge: true }).catch(() => undefined);
        });
    }
    setSaveStatus('Fit saved as worn — nice choice.');
    window.setTimeout(() => setSaveStatus(null), 2400);
  };

  const openOutfitBuilder = (item: WardrobeItem) => {
    setSelectedItem(null);
    setOutfitSeed(item);
    const recs = generateWardrobeOutfits(items, { seedItemId: item.id, limit: 1 });
    const smartPartner = recs.outfits[0]?.items.find((i) => i.id !== item.id);
    if (smartPartner) {
      setOutfitPartnerId(smartPartner.id);
    } else {
      const complementary = topCategories.includes(item.category) ? bottoms : bottomCategories.includes(item.category) ? tops : items.filter((entry) => entry.id !== item.id);
      setOutfitPartnerId(complementary[0]?.id || '');
    }
  };

  const saveCreatedOutfit = () => {
    if (!outfitSeed) return;
    const partner = items.find((item) => item.id === outfitPartnerId);
    if (!partner && (topCategories.includes(outfitSeed.category) || bottomCategories.includes(outfitSeed.category))) {
      setSaveStatus('Add a matching top or bottom first.'); return;
    }
    const saved = readLocalWardrobeOutfits({ uid: effectiveIdentity, isGuest: isGuestMode, legacyEmail: userEmail });
    saved.unshift({ id: makeId(), itemIds: [outfitSeed.id, ...(partner ? [partner.id] : [])], createdAt: new Date().toISOString() });
    saveLocalWardrobeOutfits(saved, { uid: effectiveIdentity, isGuest: isGuestMode });
    setSavedOutfitCount(saved.length);
    setSaveStatus('Outfit saved to your closet.');
    window.setTimeout(() => setSaveStatus(null), 2400);
    setOutfitSeed(null);
  };

  const darkPanel = isDarkMode
    ? 'border border-white/10 bg-[#121322]/92 text-white shadow-[0_18px_48px_rgba(0,0,0,0.32)]'
    : 'border border-[#E4DFF5] bg-white text-[#131426] shadow-[0_6px_20px_rgba(23,24,43,0.05)]';
  const purpleButton = isDarkMode
    ? 'bg-gradient-to-r from-[#8b4cf6] to-[#b45cf7] text-white shadow-lg shadow-purple-950/35'
    : 'bg-[#553BE2] hover:bg-[#462CC9] text-white shadow-md shadow-[#553BE2]/25';
  const muted = isDarkMode ? 'text-slate-400' : 'text-[#5E667A]';
  const subCard = isDarkMode ? 'border-[#25253a] bg-[#171827] text-white' : 'border-[#E4DFF5] bg-[#F2EEFF]/65 text-[#131426]';
  const innerSurface = isDarkMode ? 'bg-[#0d0f1a]' : 'bg-[#F2EEFF]';
  const accentText = isDarkMode ? 'text-[#c084fc]' : 'text-[#553BE2]';
  const badgeSurface = isDarkMode ? 'bg-[#251a3b] text-[#d8b4fe]' : 'bg-[#F2EEFF] text-[#553BE2]';
  const modalSurface = isDarkMode
    ? 'border-white/10 bg-[#080913] text-white'
    : 'border-[#E4DFF5] bg-white text-[#131426]';
  const colorCounts = items.flatMap((item) => item.colors).reduce<Record<string, number>>((counts, color) => {
    counts[color] = (counts[color] || 0) + 1; return counts;
  }, {});
  const mostCommonColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const colorStats = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([label, count]) => [label, Math.round((count / Math.max(1, items.length)) * 100), resolveColorHex(label) || '#553BE2']);
  const tops = items.filter((item) => topCategories.includes(item.category));
  const bottoms = items.filter((item) => bottomCategories.includes(item.category));
  const onePieces = items.filter((item) => ['Dress', 'Saree', 'Co-ord Set', 'Ethnic Wear'].includes(item.category));
  const outfitEngineResult = useMemo(() => {
    return generateWardrobeOutfits(items, { limit: 10 });
  }, [items]);

  const outfitIdeas = useMemo(() => {
    if (outfitEngineResult.outfits.length > 0) {
      return outfitEngineResult.outfits.map((outfit) => ({
        id: outfit.id,
        title: outfit.title,
        items: outfit.items,
        note: outfit.explanations[0] || `${outfit.styleDescription} • ${outfit.suggestedOccasion}`,
        score: outfit.compatibilityScore,
        occasion: outfit.suggestedOccasion,
        style: outfit.styleDescription,
        breakdown: outfit.breakdown,
        explanations: outfit.explanations,
        structureType: outfit.structureType
      }));
    }
    return [
      ...tops.flatMap((top) => bottoms.map((bottom) => ({
        id: `fallback_${top.id}_${bottom.id}`,
        title: `${top.colors[0]} ${top.category} + ${bottom.colors[0]} ${bottom.category}`,
        items: [top, bottom],
        note: 'A fresh pairing from your own closet.',
        score: undefined,
        occasion: 'Casual',
        style: 'Casual',
        breakdown: undefined,
        explanations: ['A fresh pairing from your own closet.'],
        structureType: 'top_bottom_duo' as const
      }))),
      ...onePieces.map((item) => ({
        id: `fallback_${item.id}`,
        title: `${item.colors[0]} ${item.category}`,
        items: [item],
        note: 'An easy one-piece look to revisit.',
        score: undefined,
        occasion: 'Casual',
        style: 'Casual',
        breakdown: undefined,
        explanations: ['An easy one-piece look to revisit.'],
        structureType: 'partial' as const
      }))
    ];
  }, [outfitEngineResult, tops, bottoms, onePieces]);

  // Strict deduplication by sorted item IDs (Requirement 5: Do not show duplicate combinations in different orders)
  const distinctOutfits = useMemo(() => {
    const seen = new Set<string>();
    return outfitIdeas.filter((outfit) => {
      const key = outfit.items.map((i) => i.id).sort().join('_');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [outfitIdeas]);

  const availableOccasions = useMemo(() => {
    const occs = new Set<string>();
    distinctOutfits.forEach((o) => {
      if (o.occasion) occs.add(o.occasion);
    });
    return ['All', ...Array.from(occs)];
  }, [distinctOutfits]);

  const displayedOutfits = useMemo(() => {
    if (outfitOccasionFilter === 'All') return distinctOutfits;
    return distinctOutfits.filter((o) => o.occasion.toLowerCase() === outfitOccasionFilter.toLowerCase());
  }, [distinctOutfits, outfitOccasionFilter]);

  const currentOutfit = distinctOutfits[outfitIndex % Math.max(1, distinctOutfits.length)];
  const totalOutfits = savedOutfitCount;

  return (
    <div className={`min-h-full -mx-4 -my-3 space-y-5 px-4 py-4 ${isDarkMode ? 'bg-[#080913] text-white' : 'bg-[#F2EEFF] text-[#131426]'}`}>
      {saveStatus && (
        <div className={`fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-bold shadow-xl backdrop-blur ${
          isDarkMode ? 'bg-[#151426]/95 text-white' : 'bg-[#131426] text-white'
        }`}>
          {saveStatus}
        </div>
      )}

      <section data-tutorial-target="wardrobe-header" className={`rounded-[28px] p-5 backdrop-blur-2xl ${darkPanel}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.28em] ${accentText}`}>NOVA</p>
            <h1 className="mt-1 text-3xl font-black leading-tight tracking-tight">{t('wardrobe.title')}</h1>
            <p className={`mt-3 max-w-[250px] text-sm leading-relaxed ${muted}`}>{t('wardrobe.subtitle')}</p>
          </div>
          <button data-tutorial-target="wardrobe-add-btn" onClick={() => onNavigate('scan-outfit')} className={`h-11 w-11 rounded-2xl ${purpleButton}`}>
            <span className="material-symbols-outlined text-xl leading-10">center_focus_strong</span>
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          {[
            ['photo_camera', 'Garment Photo Capture'],
            ['content_cut', 'Smart Garment Isolation'],
            ['checkroom', 'Organized Wardrobe'],
            ['auto_awesome', 'Outfit & Styling Assistant'],
            ['donut_large', 'Closet Insights']
          ].map(([icon, label]) => (
            <div key={label} className={`flex items-center gap-3 text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-[#131426]'}`}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                isDarkMode ? 'border-[#7c3aed]/45 bg-[#6d28d9]/15 text-[#c084fc]' : 'border-[#E4DFF5] bg-[#F2EEFF] text-[#553BE2]'
              }`}>
                <span className="material-symbols-outlined text-lg">{icon}</span>
              </span>
              {label}
            </div>
          ))}
        </div>
      </section>

      {!profile.gender && (
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`rounded-[28px] p-5 ${darkPanel}`}>
          <p className={`text-center text-[11px] font-black uppercase tracking-[0.28em] ${accentText}`}>NOVA</p>
          <h2 className="mt-5 text-center text-2xl font-black">Who are we styling today?</h2>
          <p className={`mt-1 text-center text-xs ${muted}`}>Choose your style profile</p>
          <div className="mt-5 grid gap-3">
            {(['Male', 'Female'] as WardrobeGender[]).map((gender) => (
              <button key={gender} onClick={() => setProfile({ gender })} className={`flex min-h-24 items-center gap-4 rounded-xl border p-3 text-left transition ${
                isDarkMode ? 'border-[#3b3158] bg-[#171827] hover:border-[#a855f7]' : 'border-[#E4DFF5] bg-[#F2EEFF]/65 hover:border-[#553BE2]'
              }`}>
                <div className={`flex h-16 w-20 items-center justify-center rounded-lg ${
                  isDarkMode ? 'bg-gradient-to-br from-[#2b2145] to-[#090a13] text-[#d8b4fe]' : 'bg-[#F2EEFF] text-[#553BE2]'
                }`}>
                  <span className="material-symbols-outlined text-4xl">{gender === 'Male' ? 'man_2' : 'woman_2'}</span>
                </div>
                <span className="flex-1">
                  <span className="block text-base font-black">{gender === 'Male' ? 'Menswear' : 'Womenswear'}</span>
                  <span className={`mt-1 block text-xs ${muted}`}>Style for {gender === 'Male' ? 'men' : 'women'}</span>
                </span>
                <span className={`material-symbols-outlined ${accentText}`}>check</span>
              </button>
            ))}
            <button onClick={() => setProfile({ gender: 'Female' })} className={`flex min-h-24 items-center gap-4 rounded-xl border p-3 text-left transition ${
              isDarkMode ? 'border-[#3b3158] bg-[#171827] hover:border-[#a855f7]' : 'border-[#E4DFF5] bg-[#F2EEFF]/65 hover:border-[#553BE2]'
            }`}>
              <div className={`flex h-16 w-20 items-center justify-center rounded-lg ${
                isDarkMode ? 'bg-gradient-to-br from-[#312047] to-[#090a13] text-[#d8b4fe]' : 'bg-[#F2EEFF] text-[#553BE2]'
              }`}>
                <span className="material-symbols-outlined text-4xl">diversity_3</span>
              </div>
              <span className="flex-1">
                <span className="block text-base font-black">Both</span>
                <span className={`mt-1 block text-xs ${muted}`}>Style for everyone</span>
              </span>
            </button>
          </div>
        </motion.section>
      )}

      {profile.gender && !profile.size && (
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`rounded-[28px] p-5 ${darkPanel}`}>
          <h2 className="mt-4 text-center text-2xl font-black">What's your size?</h2>
          <p className={`mx-auto mt-1 max-w-[190px] text-center text-xs ${muted}`}>This helps us personalize your styling experience</p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {sizes.map((size) => (
              <button key={size} onClick={() => setProfile((prev) => ({ ...prev, size }))} className={`h-16 rounded-xl border text-lg font-black transition ${
                size === 'M'
                  ? purpleButton
                  : isDarkMode
                    ? 'border-[#292940] bg-[#171827] text-white hover:border-[#a855f7]'
                    : 'border-[#E4DFF5] bg-[#F2EEFF]/65 text-[#131426] hover:border-[#553BE2]'
              }`}>
                {size}
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {profile.gender && profile.size && (
        <>
          <section className={`rounded-[28px] p-4 ${darkPanel}`}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-black leading-tight">Pick a category<br />to add items</h2>
                <p className={`mt-1 text-[11px] ${muted}`}>Build your virtual wardrobe</p>
              </div>
              <button onClick={() => setProfile({})} className={`text-xs font-bold ${accentText}`}>Reset</button>
            </div>
            <div className={`mb-3 grid grid-cols-3 rounded-xl border p-1 text-[11px] font-bold ${
              isDarkMode ? 'border-[#27233d] bg-[#090a13]' : 'border-[#E4DFF5] bg-[#F2EEFF]'
            }`}>
              <button onClick={() => setProfile((prev) => ({ ...prev, gender: 'Male' }))} className={`rounded-lg py-2 ${
                profile.gender === 'Male'
                  ? isDarkMode ? 'bg-[#251a3b] text-[#d8b4fe]' : 'bg-white text-[#553BE2] shadow-sm'
                  : muted
              }`}>Menswear</button>
              <button onClick={() => setProfile((prev) => ({ ...prev, gender: 'Female' }))} className={`rounded-lg py-2 ${
                profile.gender === 'Female'
                  ? isDarkMode ? 'bg-[#251a3b] text-[#d8b4fe]' : 'bg-white text-[#553BE2] shadow-sm'
                  : muted
              }`}>Womenswear</button>
              <button className={`rounded-lg py-2 ${muted}`}>Both</button>
            </div>
            <div data-tutorial-target="wardrobe-categories" className="grid grid-cols-3 gap-2">
              {categories.map((category, index) => (
                <motion.button
                  key={category}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025 }}
                  onClick={() => {
                    setSelectedCategory(category);
                    setGarmentCategory(category);
                    setUploadedImage(null);
                    setUploadedFile(null);
                    setProcessedImage(null);
                    setBgRemovalError(null);
                    setUseOriginalFallback(false);
                    setGarmentColor('Custom');
                  }}
                  className={`min-h-24 rounded-xl border p-2 text-center shadow-sm transition-transform active:scale-[0.98] ${subCard}`}
                >
                  <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg ${
                    isDarkMode ? 'bg-[#0d0f1a] text-[#c084fc]' : 'bg-[#F2EEFF] text-[#553BE2]'
                  }`}>
                    <span className="material-symbols-outlined text-3xl">{categoryIcons[category] || 'checkroom'}</span>
                  </div>
                  <div className="text-[11px] font-black leading-tight">{category}</div>
                </motion.button>
              ))}
            </div>
          </section>

          <section data-tutorial-target="wardrobe-items-grid" className={`rounded-[28px] p-4 ${darkPanel}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">My Wardrobe</h2>
                <p className={`text-[11px] ${muted}`}>{items.length} {items.length === 1 ? 'item' : 'items'}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${badgeSurface}`}>{profile.size}</span>
            </div>
            <div className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 ${
              isDarkMode ? 'border-[#25253a] bg-[#0d0f1a]' : 'border-[#E4DFF5] bg-[#F2EEFF]'
            }`}>
              <span className={`material-symbols-outlined text-base ${accentText}`}>search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your wardrobe" className={`w-full bg-transparent text-xs font-semibold outline-none ${
                isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-[#131426] placeholder:text-[#8E96AA]'
              }`} />
            </div>
            <div className="mb-4 flex gap-2 overflow-x-auto hide-scrollbar">
              {[
                { value: categoryFilter, set: setCategoryFilter, options: categoryOptions, icon: 'category' },
                { value: colorFilter, set: setColorFilter, options: colorOptions, icon: 'palette' },
                { value: patternFilter, set: setPatternFilter, options: patternOptions, icon: 'texture' }
              ].map((filter) => (
                <label key={filter.icon} className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold ${
                  isDarkMode ? 'border-[#30264c] bg-[#201733] text-[#d8b4fe]' : 'border-[#E4DFF5] bg-[#F2EEFF] text-[#553BE2]'
                }`}>
                  <span className={`material-symbols-outlined text-sm ${accentText}`}>{filter.icon}</span>
                  <select value={filter.value} onChange={(e) => filter.set(e.target.value)} className={`${isDarkMode ? 'bg-[#201733]' : 'bg-[#F2EEFF]'} outline-none`}>
                    {filter.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((item) => <div key={item} className={`h-48 animate-pulse rounded-xl ${isDarkMode ? 'bg-[#171827]' : 'bg-[#F2EEFF]'}`} />)}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className={`rounded-xl border border-dashed p-6 text-center ${
                isDarkMode ? 'border-[#453066] bg-[#141020]' : 'border-[#E4DFF5] bg-[#F2EEFF]/65'
              }`}>
                <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full shadow-sm ${
                  isDarkMode ? 'bg-[#201733] text-[#c084fc]' : 'bg-[#F2EEFF] text-[#553BE2]'
                }`}>
                  <span className="material-symbols-outlined text-3xl">checkroom</span>
                </div>
                <p className="text-sm font-black">Your wardrobe is ready for its first scan.</p>
                <p className={`mt-1 text-xs ${muted}`}>Choose a category above and add a fabric detail, print, or front portion.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredItems.map((item) => (
                  <button key={item.id} onClick={() => { setEditDraft(null); setSelectedItem(item); }} className={`overflow-hidden rounded-xl border text-left shadow-sm ${subCard}`}>
                    <div className={`flex aspect-[4/5] items-center justify-center ${innerSurface}`}>
                      <img src={item.generatedImage} alt={item.category} className="h-full w-full object-contain p-3" />
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-black">{item.category}</div>
                      <div className={`mt-1 text-[11px] font-semibold ${muted}`}>{item.colors[0]} - {new Date(item.dateAdded).toLocaleDateString()}</div>
                      <div className="mt-3 flex gap-1.5">
                        {['visibility', 'edit', 'delete'].map((icon) => <span key={icon} className={`flex h-7 w-7 items-center justify-center rounded-full ${badgeSurface}`}><span className="material-symbols-outlined text-sm">{icon}</span></span>)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`rounded-[28px] p-4 ${darkPanel}`}>
            <h2 className="text-lg font-black">My Closet Insights</h2>
            <p className={`text-[11px] ${muted}`}>Based on your wardrobe</p>
            <div className={`mt-3 rounded-xl border p-3 ${subCard}`}>
              <div className={`mb-2 text-xs font-black ${accentText}`}>Overview</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-2xl font-black">{items.length}</div><div className={`text-[10px] ${muted}`}>Total Items</div></div>
                <div><div className="text-2xl font-black">{Math.max(0, categoryOptions.length - 1)}</div><div className={`text-[10px] ${muted}`}>Categories</div></div>
                <div><div className="text-2xl font-black">{totalOutfits}</div><div className={`text-[10px] ${muted}`}>Outfits Created</div></div>
              </div>
            </div>
            <div className={`mt-3 space-y-2 rounded-xl border p-3 text-xs font-semibold ${subCard}`}>
              {[
                ['apparel', `You own ${tops.length} tops.`],
                ['palette', `Most common color: ${mostCommonColor}`],
                ['schedule', items.length ? `${items.filter((item) => !item.timesWorn).length} pieces are waiting for their first wear.` : 'Add pieces to unlock wear insights.'],
                ['insights', items.length ? `${Math.round((tops.length / items.length) * 100)}% of your wardrobe is top wear.` : 'Your insights will appear here.']
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-base ${accentText}`}>{icon}</span>
                  <span className="flex-1">{text}</span>
                </div>
              ))}
              <div className={`h-2 overflow-hidden rounded-full ${isDarkMode ? 'bg-[#0d0f1a]' : 'bg-[#ECE7FF]'}`}>
                <div className={`h-full w-[68%] rounded-full ${isDarkMode ? 'bg-gradient-to-r from-[#8b4cf6] to-[#e879f9]' : 'bg-[#553BE2]'}`} />
              </div>
            </div>
            <div className={`mt-3 rounded-xl border p-3 ${subCard}`}>
              <div className="mb-3 text-xs font-black">Color Distribution</div>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-[conic-gradient(#553BE2_0_35%,#ECE7FF_35%_62%,#F2EEFF_62%_78%,#131426_78%_100%)] p-4">
                  <div className={`h-full w-full rounded-full ${isDarkMode ? 'bg-[#171827]' : 'bg-white'}`} />
                </div>
                <div className="flex-1 space-y-1">
                  {colorStats.map(([label, value, color]) => (
                    <div key={label} className={`flex items-center gap-2 text-[11px] ${muted}`}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: String(color) }} />
                      <span className="flex-1">{label}</span>
                      <span>{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section data-tutorial-target="wardrobe-outfits-section" className={`rounded-[28px] p-4 sm:p-5 ${darkPanel}`}>
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-[#a855f7] dark:text-[#c084fc]">auto_awesome</span>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">New fits for you</h2>
                </div>
                <p className={`mt-0.5 text-xs ${muted}`}>
                  NOVA AI combinations • Made only from what you own ({distinctOutfits.length} available)
                </p>
              </div>
              {distinctOutfits.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black ${badgeSurface}`}>
                    {displayedOutfits.length} {displayedOutfits.length === 1 ? 'Look' : 'Looks'}
                  </span>
                </div>
              )}
            </div>

            {/* Occasion Filter Pills (if multiple occasions present) */}
            {availableOccasions.length > 2 && (
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                {availableOccasions.map((occ) => (
                  <button
                    key={occ}
                    onClick={() => setOutfitOccasionFilter(occ)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                      outfitOccasionFilter === occ
                        ? purpleButton
                        : isDarkMode
                          ? 'bg-[#1b1c2e] text-slate-300 hover:bg-[#25263d]'
                          : 'bg-[#ECE7FF] text-[#553BE2] hover:bg-[#E2DBFE]'
                    }`}
                  >
                    {occ} {occ !== 'All' && `(${distinctOutfits.filter(o => o.occasion.toLowerCase() === occ.toLowerCase()).length})`}
                  </button>
                ))}
              </div>
            )}

            {/* Quick jump anchor navigation if there are multiple outfits */}
            {displayedOutfits.length > 3 && (
              <div className="mt-2 flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-1 text-[11px]">
                <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${muted}`}>Quick jump:</span>
                {displayedOutfits.map((_, idx) => (
                  <a
                    key={idx}
                    href={`#outfit-card-${idx}`}
                    className={`shrink-0 rounded-lg px-2.5 py-0.5 font-bold transition ${
                      isDarkMode ? 'bg-[#161726] hover:bg-[#23243a] text-slate-300' : 'bg-[#EFEAFF] hover:bg-[#E3DCFF] text-[#553BE2]'
                    }`}
                  >
                    Fit {idx + 1}
                  </a>
                ))}
              </div>
            )}

            {/* Outfits List / Scrollable Feed */}
            {displayedOutfits.length > 0 ? (
              <div className="mt-4 space-y-5">
                {displayedOutfits.map((outfit, index) => (
                  <article
                    key={outfit.id || index}
                    id={`outfit-card-${index}`}
                    className={`scroll-mt-6 rounded-3xl border p-4 sm:p-5 transition-all shadow-md ${
                      isDarkMode
                        ? 'border-[#2d2547] bg-[#121324]/90 hover:border-[#8b5cf6]/50'
                        : 'border-[#E4DFF5] bg-white/95 hover:border-[#553BE2]/40 shadow-xs'
                    }`}
                  >
                    {/* Outfit Card Top Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                          <span className="material-symbols-outlined text-sm">auto_awesome</span>
                          {outfit.style}
                        </span>
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${badgeSurface}`}>
                          {outfit.occasion}
                        </span>
                      </div>
                      {outfit.score !== undefined && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-400 border border-emerald-500/30">
                          <span className="material-symbols-outlined text-sm">verified</span>
                          {outfit.score}% Match
                        </span>
                      )}
                    </div>

                    {/* Outfit Title */}
                    <h3 className="mt-3 text-base sm:text-lg font-black leading-snug tracking-tight">
                      {outfit.title}
                    </h3>

                    {/* Garment Images Showcase (Large, visually clear) */}
                    <div className={`mt-4 grid gap-3 ${
                      outfit.items.length === 2 ? 'grid-cols-2' :
                      outfit.items.length === 3 ? 'grid-cols-3' :
                      outfit.items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                      'grid-cols-2 sm:grid-cols-3'
                    }`}>
                      {outfit.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`group relative flex flex-col items-center rounded-2xl border p-2 sm:p-3 transition-all cursor-pointer ${
                            isDarkMode
                              ? 'border-[#2d2448] bg-[#0c0d1a] hover:border-[#9333ea]/60 hover:bg-[#121324]'
                              : 'border-[#E4DFF5] bg-[#F9F7FF] hover:border-[#553BE2]/40 hover:bg-[#F2EEFF]'
                          }`}
                          title={`Click to view ${item.category} details`}
                        >
                          {/* Garment Image */}
                          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-transparent flex items-center justify-center">
                            {item.generatedImage ? (
                              <img
                                src={item.generatedImage}
                                alt={item.category}
                                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-3xl">checkroom</span>
                                <span className="text-[10px] mt-1">{item.category}</span>
                              </div>
                            )}
                          </div>

                          {/* Details below image */}
                          <div className="mt-2 w-full text-center">
                            <p className="truncate text-xs font-black tracking-tight">{item.category}</p>
                            <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px]">
                              <span
                                className="inline-block h-2 w-2 shrink-0 rounded-full border border-black/10 shadow-xs"
                                style={{ backgroundColor: resolveColorHex(item.colors[0]) || '#888' }}
                              />
                              <span className={`truncate font-semibold ${muted}`}>
                                {item.colors[0] || 'Custom'}
                              </span>
                            </div>
                            {item.attributes?.fit && item.attributes.fit !== 'Regular' && (
                              <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                                isDarkMode ? 'bg-[#1b1c2e] text-slate-300' : 'bg-[#ECE7FF] text-[#553BE2]'
                              }`}>
                                {item.attributes.fit}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI Stylist Explanation Box */}
                    <div className={`mt-4 rounded-2xl border p-3.5 sm:p-4 ${
                      isDarkMode ? 'border-[#30264e] bg-[#0e0f1e]/80' : 'border-[#E4DFF5] bg-[#F6F3FF]'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-[#a855f7] dark:text-[#c084fc]">psychology</span>
                        <span className="text-xs font-black uppercase tracking-wider text-[#a855f7] dark:text-[#c084fc]">
                          NOVA AI Styling Analysis
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {outfit.explanations && outfit.explanations.length > 0 ? (
                          outfit.explanations.slice(0, 3).map((exp, expIdx) => (
                            <p key={expIdx} className={`flex items-start gap-2 text-xs leading-relaxed ${muted}`}>
                              <span className="text-[#a855f7] dark:text-[#c084fc] font-bold">•</span>
                              <span>{exp}</span>
                            </p>
                          ))
                        ) : (
                          <p className={`text-xs leading-relaxed ${muted}`}>{outfit.note}</p>
                        )}
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5">
                      <button
                        onClick={() => markOutfitWorn(outfit.items)}
                        className={`w-full sm:flex-1 rounded-xl py-3 text-xs font-black flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] ${purpleButton}`}
                      >
                        <span className="material-symbols-outlined text-base">checkroom</span>
                        I wore this fit
                      </button>
                      <button
                        onClick={() => openOutfitBuilder(outfit.items[0])}
                        className={`w-full sm:w-auto rounded-xl border px-4 py-3 text-xs font-black transition ${
                          isDarkMode
                            ? 'border-[#3b2d5a] bg-[#171828] text-slate-200 hover:border-[#8b5cf6]'
                            : 'border-[#E4DFF5] bg-white text-[#131426] hover:border-[#553BE2]'
                        }`}
                      >
                        Customize look
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={`mt-4 rounded-2xl border border-dashed p-6 text-center ${
                isDarkMode ? 'border-[#453066] bg-[#141020] text-slate-400' : 'border-[#E4DFF5] bg-[#F2EEFF]/65 text-[#5E667A]'
              }`}>
                <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${
                  isDarkMode ? 'bg-[#201733] text-[#c084fc]' : 'bg-[#F2EEFF] text-[#553BE2]'
                }`}>
                  <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                </div>
                <p className="text-sm font-bold">
                  {outfitEngineResult.statusMessage || 'Add a top and a bottom to your Virtual Wardrobe to unlock AI outfit combinations.'}
                </p>
                <p className={`mt-1 text-xs ${muted}`}>
                  NOVA AI creates outfits only from genuine items in your closet.
                </p>
                <button
                  onClick={() => onNavigate('scan-outfit')}
                  className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${purpleButton}`}
                >
                  <span className="material-symbols-outlined text-base">add_a_photo</span>
                  Scan a garment
                </button>
              </div>
            )}
          </section>
        </>
      )}

      <AnimatePresence>
        {selectedCategory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3">
            <motion.section initial={{ y: 420 }} animate={{ y: 0 }} exit={{ y: 420 }} className={`max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border p-4 shadow-2xl ${modalSurface}`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">Add to Wardrobe</h2>
                  <p className={`text-xs ${muted}`}>Category: <span className={`font-bold ${accentText}`}>{garmentCategory || selectedCategory}</span></p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedCategory(null);
                    setUploadedImage(null);
                    setUploadedFile(null);
                    setProcessedImage(null);
                    setBgRemovalError(null);
                    setUseOriginalFallback(false);
                  }} 
                  className={`h-9 w-9 rounded-full ${isDarkMode ? 'bg-[#171827]' : 'bg-[#F2EEFF] text-[#5E667A]'}`}
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              {/* Upload method selection */}
              <div className={`mb-3 grid grid-cols-2 gap-2 rounded-xl p-1 ${isDarkMode ? 'bg-[#111220]' : 'bg-[#F2EEFF] border border-[#E4DFF5]'}`}>
                {(['Upload Photo', 'Live Scan'] as WardrobeScanMethod[]).map((method) => (
                  <button 
                    key={method} 
                    type="button"
                    onClick={() => setScanMethod(method)} 
                    className={`rounded-lg py-2 text-xs font-black transition ${scanMethod === method ? purpleButton : muted}`}
                  >
                    <span className="material-symbols-outlined mr-1 align-middle text-sm">
                      {method === 'Live Scan' ? 'photo_camera' : 'photo_library'}
                    </span>
                    {method === 'Live Scan' ? 'Take Photo' : 'Upload File'}
                  </button>
                ))}
              </div>

              {/* Hidden file input */}
              <input 
                id="wardrobe-file-input"
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                capture={scanMethod === 'Live Scan' ? 'environment' : undefined} 
                onChange={handleFile} 
                className="hidden" 
              />

              {/* Main Photo Upload & Preview Card */}
              <div className={`rounded-[24px] border p-4 ${
                isDarkMode ? 'border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-2xl' : 'border-[#E4DFF5] bg-[#F2EEFF]/60 shadow-sm'
              }`}>
                {!uploadedImage ? (
                  <label 
                    htmlFor="wardrobe-file-input"
                    className={`flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
                      isDarkMode 
                        ? 'border-[#7041a8]/60 bg-[#121324] text-[#d8b4fe] hover:border-[#a855f7]' 
                        : 'border-[#553BE2]/40 bg-white text-[#553BE2] hover:border-[#553BE2]'
                    }`}
                  >
                    <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${
                      isDarkMode ? 'bg-[#251a3b] text-[#c084fc]' : 'bg-[#F2EEFF] text-[#553BE2]'
                    }`}>
                      <span className="material-symbols-outlined text-3xl">
                        {scanMethod === 'Live Scan' ? 'add_a_photo' : 'cloud_upload'}
                      </span>
                    </div>
                    <p className="text-sm font-black">
                      {scanMethod === 'Live Scan' ? 'Take a Clothing Photo' : 'Choose a Clothing Photo'}
                    </p>
                    <p className={`mt-1 text-xs ${muted}`}>JPEG, PNG, or WebP (up to 15MB)</p>
                    <span className={`mt-4 rounded-xl px-4 py-2 text-xs font-black shadow-sm ${purpleButton}`}>
                      Select Photo
                    </span>
                  </label>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${muted}`}>Garment Preview</span>
                      {isRemovingBg ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                          Processing...
                        </span>
                      ) : processedImage && !useOriginalFallback ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                          ✓ Ready
                        </span>
                      ) : useOriginalFallback ? (
                        <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                          Original Photo
                        </span>
                      ) : null}
                    </div>

                    {/* Preview box with checkerboard background to visualize transparency */}
                    <div 
                      className={`relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl border ${
                        isDarkMode ? 'border-white/10 bg-[#090a13]' : 'border-[#E4DFF5] bg-white'
                      }`}
                      style={{
                        backgroundImage: isDarkMode
                          ? 'linear-gradient(45deg, #131424 25%, transparent 25%), linear-gradient(-45deg, #131424 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #131424 75%), linear-gradient(-45deg, transparent 75%, #131424 75%)'
                          : 'linear-gradient(45deg, #f0eefa 25%, transparent 25%), linear-gradient(-45deg, #f0eefa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0eefa 75%), linear-gradient(-45deg, transparent 75%, #f0eefa 75%)',
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                      }}
                    >
                      {isRemovingBg ? (
                        <div className="flex flex-col items-center justify-center p-6 text-center">
                          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#553BE2] border-t-transparent" />
                          <p className={`mt-3 text-xs font-black ${accentText}`}>Processing garment...</p>
                          <p className={`mt-1 text-[11px] ${muted}`}>Preserving garment silhouette</p>
                        </div>
                      ) : (
                        <img 
                          src={processedImage || uploadedImage} 
                          alt="Garment preview" 
                          className="h-full w-full object-contain p-3 drop-shadow-xl" 
                        />
                      )}
                    </div>

                    {/* Error display with clear retry and fallback options */}
                    {bgRemovalError && !isRemovingBg && (
                      <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs">
                        <div className="flex items-start gap-2 text-rose-500">
                          <span className="material-symbols-outlined text-base">warning</span>
                          <span className="font-semibold">{bgRemovalError}</span>
                        </div>
                        <div className="mt-2.5 flex gap-2">
                          <button 
                            type="button"
                            onClick={retryBackgroundRemoval}
                            className="flex-1 rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white shadow hover:bg-rose-600"
                          >
                            Retry Processing
                          </button>
                          <button 
                            type="button"
                            onClick={continueWithOriginal}
                            className={`flex-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                              isDarkMode ? 'border-white/20 bg-white/10 text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                            }`}
                          >
                            Use Original Photo
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <label 
                        htmlFor="wardrobe-file-input"
                        className={`cursor-pointer text-xs font-bold ${accentText} hover:underline`}
                      >
                        Choose a different photo
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Garment details configuration */}
              {uploadedImage && (
                <>
                  {isAnalyzingGarment && (
                    <div className="mt-3 rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/30 to-indigo-950/30 p-4 text-center backdrop-blur">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-purple-400">progress_activity</span>
                        <span className={`text-xs font-black ${accentText}`}>Analyzing garment...</span>
                      </div>
                      <p className={`mt-1 text-[11px] ${muted}`}>Extracting colors, pattern, fabric, construction, and style tags...</p>
                    </div>
                  )}

                  {analysisSuccess && (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <span className="material-symbols-outlined text-base">auto_awesome</span>
                        <span className="font-bold">Garment Details Extracted</span>
                      </div>
                      <button
                        type="button"
                        onClick={retryAiAnalysis}
                        className="text-[10px] font-bold text-emerald-300 underline hover:text-emerald-200"
                      >
                        Re-analyze
                      </button>
                    </div>
                  )}

                  {garmentAiError && !isAnalyzingGarment && (
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                      <div className="flex items-start gap-2 text-amber-400">
                        <span className="material-symbols-outlined text-base">info</span>
                        <div className="flex-1">
                          <p className="font-bold">AI Analysis Notice</p>
                          <p className="mt-0.5 text-[11px] opacity-90">{garmentAiError}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between pt-1">
                        <span className="text-[10px] text-amber-300/80">You can adjust or verify the attributes below.</span>
                        <button
                          type="button"
                          onClick={retryAiAnalysis}
                          className="rounded-lg bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30"
                        >
                          Retry AI Analysis
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={`mt-3 space-y-3 rounded-2xl border p-3.5 ${subCard}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${accentText}`}>
                        Garment Attributes
                      </span>
                      {detectedGarment && (
                        <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-400">
                          AI Verified
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Category
                        </label>
                        <select 
                          value={garmentCategory || selectedCategory || ''} 
                          onChange={(e) => setGarmentCategory(e.target.value)}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          {garmentCategory && !categories.includes(garmentCategory) && (
                            <option value={garmentCategory}>{garmentCategory}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Size (Optional)
                        </label>
                        <select 
                          value={formSize}
                          onChange={(e) => setFormSize(e.target.value)}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          <option value="">Not specified</option>
                          {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'].map((sz) => (
                            <option key={sz} value={sz}>{sz}</option>
                          ))}
                          {formSize && !['', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'].includes(formSize) && (
                            <option value={formSize}>{formSize}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Primary Color
                        </label>
                        <select 
                          value={formPrimaryColor}
                          onChange={(e) => setFormPrimaryColor(e.target.value)}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          <option value="">Not specified</option>
                          {CANONICAL_COLORS.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                          {formPrimaryColor && !CANONICAL_COLORS.includes(formPrimaryColor as any) && (
                            <option value={formPrimaryColor}>{formPrimaryColor}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Secondary Color
                        </label>
                        <select 
                          value={formSecondaryColor}
                          onChange={(e) => setFormSecondaryColor(e.target.value)}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          <option value="—">None (—)</option>
                          {CANONICAL_COLORS.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                          {formSecondaryColor && formSecondaryColor !== '—' && !CANONICAL_COLORS.includes(formSecondaryColor as any) && (
                            <option value={formSecondaryColor}>{formSecondaryColor}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Pattern
                        </label>
                        <select 
                          value={formPattern}
                          onChange={(e) => setFormPattern(e.target.value)}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          <option value="Not specified">Not specified</option>
                          {CANONICAL_PATTERNS.map((pat) => (
                            <option key={pat} value={pat}>{pat}</option>
                          ))}
                          {formPattern && formPattern !== 'Not specified' && !CANONICAL_PATTERNS.includes(formPattern as any) && (
                            <option value={formPattern}>{formPattern}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Fabric
                        </label>
                        <select 
                          value={formFabric}
                          onChange={(e) => setFormFabric(e.target.value)}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          <option value="Unknown">Unknown</option>
                          {CANONICAL_FABRICS.map((fab) => (
                            <option key={fab} value={fab}>{fab}</option>
                          ))}
                          {formFabric && formFabric !== 'Unknown' && !CANONICAL_FABRICS.includes(formFabric as any) && (
                            <option value={formFabric}>{formFabric}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Fit / Silhouette
                        </label>
                        <select 
                          value={formFit}
                          onChange={(e) => setFormFit(e.target.value)}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          <option value="Not specified">Not specified</option>
                          {CANONICAL_FITS.map((fit) => (
                            <option key={fit} value={fit}>{fit}</option>
                          ))}
                          {formFit && formFit !== 'Not specified' && !CANONICAL_FITS.includes(formFit as any) && (
                            <option value={formFit}>{formFit}</option>
                          )}
                        </select>
                      </div>

                      {!isBottomWear(garmentCategory || selectedCategory || '') ? (
                        <>
                          <div>
                            <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                              Sleeve Type
                            </label>
                            <select 
                              value={formSleeveType}
                              onChange={(e) => setFormSleeveType(e.target.value)}
                              className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                                isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                              }`}
                            >
                              <option value="Not specified">Not specified</option>
                              {CANONICAL_SLEEVE_TYPES.map((slv) => (
                                <option key={slv} value={slv}>{slv}</option>
                              ))}
                              {formSleeveType && formSleeveType !== 'Not specified' && !CANONICAL_SLEEVE_TYPES.includes(formSleeveType as any) && (
                                <option value={formSleeveType}>{formSleeveType}</option>
                              )}
                            </select>
                          </div>

                          <div>
                            <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                              Neckline
                            </label>
                            <select 
                              value={formNeckType}
                              onChange={(e) => setFormNeckType(e.target.value)}
                              className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                                isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                              }`}
                            >
                              <option value="Not specified">Not specified</option>
                              {CANONICAL_NECK_TYPES.map((nck) => (
                                <option key={nck} value={nck}>{nck}</option>
                              ))}
                              {formNeckType && formNeckType !== 'Not specified' && !CANONICAL_NECK_TYPES.includes(formNeckType as any) && (
                                <option value={formNeckType}>{formNeckType}</option>
                              )}
                            </select>
                          </div>
                        </>
                      ) : null}

                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Primary Style
                        </label>
                        <select 
                          value={formStyle}
                          onChange={(e) => setFormStyle(e.target.value)}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          <option value="Casual">Casual</option>
                          {CANONICAL_STYLES.map((sty) => (
                            <option key={sty} value={sty}>{sty}</option>
                          ))}
                          {formStyle && !CANONICAL_STYLES.includes(formStyle as any) && (
                            <option value={formStyle}>{formStyle}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          Season
                        </label>
                        <select 
                          value={formSeasons[0] || 'All Season'}
                          onChange={(e) => setFormSeasons([e.target.value])}
                          className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                            isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        >
                          {CANONICAL_SEASONS.map((sea) => (
                            <option key={sea} value={sea}>{sea}</option>
                          ))}
                          {formSeasons[0] && !CANONICAL_SEASONS.includes(formSeasons[0] as any) && (
                            <option value={formSeasons[0]}>{formSeasons[0]}</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {formDescription ? (
                      <div className="pt-1">
                        <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                          AI Garment Description
                        </label>
                        <p className={`mt-0.5 text-xs italic ${muted}`}>
                          "{formDescription}"
                        </p>
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={resetGarmentForm} 
                  className={`flex-1 rounded-xl border py-3 text-xs font-black shadow-sm ${
                    isDarkMode ? 'border-[#30264c] bg-[#171827] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSaveGarment} 
                  disabled={!uploadedImage || isRemovingBg || isAnalyzingGarment} 
                  className={`flex-1 rounded-xl py-3 text-xs font-black disabled:opacity-40 ${purpleButton}`}
                >
                  {isAnalyzingGarment ? 'Analyzing...' : 'Save to Wardrobe'}
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3">
            <motion.section initial={{ y: 420 }} animate={{ y: 0 }} exit={{ y: 420 }} className={`max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border p-4 shadow-2xl ${modalSurface}`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black">{selectedItem.category}</h2>
                  {selectedItem.canonical && (
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-400">
                      AI Verified
                    </span>
                  )}
                </div>
                <button onClick={() => { setEditDraft(null); setSelectedItem(null); }} className={`h-9 w-9 rounded-full ${isDarkMode ? 'bg-[#171827]' : 'bg-[#F2EEFF] text-[#5E667A]'}`}><span className="material-symbols-outlined text-base">close</span></button>
              </div>
              <div className={`rounded-[24px] p-4 ${innerSurface}`}>
                <img src={selectedItem.generatedImage} alt={selectedItem.category} className="mx-auto h-72 w-full object-contain" />
              </div>
              {editDraft ? (
                <div className={`mt-4 space-y-3 rounded-2xl border p-3 ${subCard}`}>
                  <p className={`text-xs font-black ${accentText}`}>Correct the scan details</p>
                  {[
                    ['Category', 'category'],
                    ['Primary color', 'primaryColor'],
                    ['Secondary color', 'secondaryColor'],
                    ['Pattern', 'pattern'],
                    ['Fabric', 'fabric'],
                    ['Neckline', 'neckType'],
                    ['Sleeve', 'sleeveType'],
                    ['Size', 'size']
                  ].map(([label, field]) => {
                    const attributeFields = ['primaryColor', 'secondaryColor', 'neckType', 'sleeveType'];
                    const value = field === 'size'
                      ? (editDraft.size || '')
                      : attributeFields.includes(field)
                        ? editDraft.attributes?.[field as keyof WardrobeDetectedAttributes]
                        : (editDraft[field as keyof WardrobeItem] as string);
                    return (
                      <label key={field} className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                        {label}
                        <input
                          value={value || ''}
                          placeholder={field === 'size' ? 'e.g. S, M, L (optional)' : ''}
                          onChange={(event) => {
                            const val = event.target.value;
                            setEditDraft((draft) => {
                              if (!draft) return draft;
                              if (field === 'size') {
                                return { ...draft, size: val };
                              }
                              if (attributeFields.includes(field)) {
                                return {
                                  ...draft,
                                  attributes: { ...draft.attributes, [field]: val },
                                  ...(field === 'primaryColor' ? { colors: [val, ...draft.colors.slice(1)] } : {})
                                };
                              }
                              return { ...draft, [field]: val };
                            });
                          }}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs font-semibold normal-case outline-none focus:border-[#553BE2] ${
                            isDarkMode ? 'border-[#37304d] bg-[#0d0f1a] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                          }`}
                        />
                      </label>
                    );
                  })}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setEditDraft(null)}
                      className={`rounded-xl border py-3 text-xs font-black ${isDarkMode ? 'border-[#334155]' : 'border-[#E4DFF5] bg-white text-[#5E667A]'}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (editDraft) {
                          const primaryCol = editDraft.attributes?.primaryColor || editDraft.colors[0] || 'Not specified';
                          const secCol = editDraft.attributes?.secondaryColor && editDraft.attributes.secondaryColor !== '—'
                            ? editDraft.attributes.secondaryColor
                            : null;
                          const updatedColors = [primaryCol, ...(secCol ? [secCol] : [])];

                          const updatedCanonical: CanonicalGarmentData = editDraft.canonical ? {
                            ...editDraft.canonical,
                            category: SUBCATEGORY_TO_BODY_SECTION_MAP[DISPLAY_TO_SUBCATEGORY_MAP[editDraft.category] || 'other'] || (isBottomWear(editDraft.category) ? 'bottom' : 'top'),
                            subcategory: DISPLAY_TO_SUBCATEGORY_MAP[editDraft.category] || editDraft.canonical.subcategory || 'other',
                            visual: {
                              ...editDraft.canonical.visual,
                              primaryColor: primaryCol,
                              secondaryColor: secCol,
                              pattern: editDraft.pattern || editDraft.canonical.visual.pattern
                            },
                            construction: {
                              ...editDraft.canonical.construction,
                              neckType: editDraft.attributes?.neckType || editDraft.canonical.construction.neckType,
                              sleeveType: editDraft.attributes?.sleeveType || editDraft.canonical.construction.sleeveType
                            },
                            material: {
                              ...editDraft.canonical.material,
                              fabric: editDraft.fabric || editDraft.canonical.material.fabric
                            }
                          } : {
                            schemaVersion: '1.0',
                            id: editDraft.id,
                            category: isBottomWear(editDraft.category) ? 'bottom' : 'top',
                            subcategory: DISPLAY_TO_SUBCATEGORY_MAP[editDraft.category] || 'other',
                            gender: 'unisex',
                            visual: {
                              primaryColor: primaryCol,
                              secondaryColor: secCol,
                              colorFamily: ['neutral'],
                              pattern: editDraft.pattern || 'Not specified',
                              texture: null,
                              visibleDetails: []
                            },
                            construction: {
                              sleeveType: editDraft.attributes?.sleeveType || 'Not specified',
                              neckType: editDraft.attributes?.neckType || 'Not specified',
                              fit: editDraft.attributes?.fit || 'Not specified',
                              length: 'regular',
                              silhouette: 'regular',
                              rise: null
                            },
                            material: {
                              fabric: editDraft.fabric || 'Unknown',
                              fabricConfidence: 'inferred',
                              composition: null
                            },
                            style: {
                              primary: editDraft.attributes?.style || 'Casual',
                              secondary: [],
                              tags: [editDraft.category.toLowerCase()]
                            },
                            usage: {
                              occasions: editDraft.attributes?.occasions || ['Casual'],
                              seasons: editDraft.attributes?.seasons || ['All Season'],
                              formality: 'Casual'
                            },
                            matching: {
                              compatibleCategories: isBottomWear(editDraft.category) ? ['top', 'outerwear'] : ['bottom', 'outerwear'],
                              compatibleStyles: [editDraft.attributes?.style || 'Casual'],
                              colorCompatibility: ['neutral']
                            },
                            aiMetadata: {
                              description: `${primaryCol} ${editDraft.category}`,
                              searchTags: [primaryCol, editDraft.category, editDraft.pattern, editDraft.fabric].filter(Boolean).map((s) => s.toLowerCase()),
                              unknownFields: [],
                              extractionSource: 'manual',
                              schemaVersion: '1.0'
                            }
                          };

                          updateItem({
                            ...editDraft,
                            size: editDraft.size ? editDraft.size.trim() : '',
                            colors: updatedColors,
                            pattern: editDraft.pattern,
                            fabric: editDraft.fabric,
                            canonical: updatedCanonical,
                            attributes: {
                              ...editDraft.attributes,
                              category: editDraft.category,
                              primaryColor: primaryCol,
                              secondaryColor: secCol || '—',
                              pattern: editDraft.pattern,
                              fabric: editDraft.fabric
                            }
                          });
                          setEditDraft(null);
                          setSaveStatus('Garment details updated.');
                        }
                      }}
                      className={`rounded-xl py-3 text-xs font-black ${purpleButton}`}
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              ) : <>
              {selectedItem.canonical?.aiMetadata?.description && (
                <div className={`mt-3 rounded-xl border p-3 ${subCard}`}>
                  <div className={`text-[10px] font-black uppercase tracking-wider ${accentText}`}>AI Description</div>
                  <p className="mt-1 text-xs font-medium leading-relaxed">{selectedItem.canonical.aiMetadata.description}</p>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ['Category', selectedItem.category],
                  [
                    'Color',
                    selectedItem.canonical?.visual?.primaryColor
                      ? [selectedItem.canonical.visual.primaryColor, ...(selectedItem.canonical.visual.secondaryColor ? [selectedItem.canonical.visual.secondaryColor] : [])].join(', ')
                      : selectedItem.colors.filter((c: string) => c && c !== 'Custom' && c !== '—').join(', ') || 'Not specified'
                  ],
                  [
                    'Pattern',
                    selectedItem.canonical?.visual?.pattern ||
                    (selectedItem.pattern && selectedItem.pattern !== 'Solid' ? selectedItem.pattern : selectedItem.pattern || 'Not specified')
                  ],
                  [
                    'Fabric',
                    selectedItem.canonical?.material?.fabric ||
                    (selectedItem.fabric && selectedItem.fabric !== 'Standard' ? selectedItem.fabric : 'Not specified')
                  ],
                  ...(isBottomWear(selectedItem.category)
                    ? [
                        ['Rise', selectedItem.canonical?.construction?.rise || selectedItem.attributes?.rise || 'Not specified'],
                        ['Length', selectedItem.canonical?.construction?.length || selectedItem.attributes?.length || 'Not specified']
                      ]
                    : [
                        [
                          'Neck',
                          selectedItem.canonical?.construction?.neckType ||
                          (selectedItem.attributes?.neckType && selectedItem.attributes.neckType !== 'Standard' ? selectedItem.attributes.neckType : 'Not specified')
                        ],
                        [
                          'Sleeve',
                          selectedItem.canonical?.construction?.sleeveType ||
                          (selectedItem.attributes?.sleeveType && selectedItem.attributes.sleeveType !== 'Standard' ? selectedItem.attributes.sleeveType : 'Not specified')
                        ]
                      ]),
                  ['Fit', selectedItem.canonical?.construction?.fit || (selectedItem.attributes?.fit && selectedItem.attributes.fit !== 'Regular' ? selectedItem.attributes.fit : 'Not specified')],
                  ['Style', selectedItem.canonical?.style?.primary || selectedItem.attributes?.style || 'Not specified'],
                  ['Occasions', (selectedItem.canonical?.usage?.occasions || selectedItem.attributes?.occasions || ['Not specified']).join(', ')],
                  ['Seasons', (selectedItem.canonical?.usage?.seasons || selectedItem.attributes?.seasons || ['Not specified']).join(', ')],
                  ['Size', selectedItem.size && selectedItem.size.trim() ? selectedItem.size : 'Not specified'],
                  ['Date Added', new Date(selectedItem.dateAdded).toLocaleDateString()]
                ].map(([label, value]) => {
                  const displayValue = (!value || value === 'Standard' || value === 'Custom') ? 'Not specified' : value;
                  return (
                    <div key={label} className={`rounded-xl border p-3 ${subCard}`}>
                      <div className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>{label}</div>
                      <div className="mt-1 text-xs font-black">{displayValue}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => onNavigate('ar-tryon')} className={`rounded-xl py-3 text-xs font-black ${purpleButton}`}>Wear Virtually</button>
                <button onClick={() => openOutfitBuilder(selectedItem)} className={`rounded-xl border py-3 text-xs font-black ${isDarkMode ? 'border-[#7041a8] text-white' : 'border-[#E4DFF5] bg-[#F2EEFF] text-[#553BE2]'}`}>Create Outfit</button>
                <button onClick={() => setEditDraft({ ...selectedItem, attributes: { ...selectedItem.attributes }, colors: [...selectedItem.colors], tags: [...selectedItem.tags] })} className={`rounded-xl border py-3 text-xs font-black ${isDarkMode ? 'border-[#334155] text-slate-200' : 'border-[#E4DFF5] bg-white text-[#131426]'}`}>Edit</button>
                <button onClick={() => deleteItem(selectedItem)} className="rounded-xl border border-rose-500/35 bg-rose-500/10 py-3 text-xs font-black text-rose-500">Delete</button>
              </div>
              </>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {outfitSeed && (() => {
          const needsBottom = topCategories.includes(outfitSeed.category);
          const needsTop = bottomCategories.includes(outfitSeed.category);
          const partners = items.filter((item) => item.id !== outfitSeed.id && (needsBottom ? bottomCategories.includes(item.category) : needsTop ? topCategories.includes(item.category) : true));
          return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-3">
            <motion.section initial={{ y: 420 }} animate={{ y: 0 }} exit={{ y: 420 }} className={`max-h-[82vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border p-4 shadow-2xl ${modalSurface}`}>
              <div className="flex items-center justify-between"><div><p className={`text-[10px] font-black uppercase tracking-[.2em] ${accentText}`}>Outfit builder</p><h2 className="mt-1 text-xl font-black">Complete this look</h2></div><button onClick={() => setOutfitSeed(null)} className={`h-9 w-9 rounded-full ${isDarkMode ? 'bg-[#171827]' : 'bg-[#F2EEFF] text-[#5E667A]'}`}><span className="material-symbols-outlined">close</span></button></div>
              <div className={`mt-4 flex items-center gap-3 rounded-2xl border p-3 ${subCard}`}><img src={outfitSeed.generatedImage} alt={outfitSeed.category} className={`h-20 w-16 rounded-xl object-contain ${innerSurface}`}/><div><p className="font-black">{outfitSeed.colors[0]} {outfitSeed.category}</p><p className={`mt-1 text-xs ${muted}`}>Pick {needsBottom ? 'a bottom' : needsTop ? 'a top' : 'another piece'} from your wardrobe.</p></div></div>
              {partners.length ? <div className="mt-4 grid grid-cols-2 gap-3">{partners.map((item) => <button key={item.id} onClick={() => setOutfitPartnerId(item.id)} className={`overflow-hidden rounded-xl border p-2 text-left ${outfitPartnerId === item.id ? (isDarkMode ? 'border-[#c084fc] bg-[#251a3b]' : 'border-[#553BE2] bg-[#F2EEFF]') : subCard}`}><img src={item.generatedImage} alt={item.category} className={`h-28 w-full rounded-lg object-contain ${innerSurface}`}/><p className="mt-2 text-xs font-black">{item.colors[0]} {item.category}</p></button>)}</div> : <div className={`mt-4 rounded-2xl border border-dashed p-5 text-center text-sm ${isDarkMode ? 'border-[#7041a8] text-slate-400' : 'border-[#E4DFF5] text-[#5E667A]'}`}>You need to add {needsBottom ? 'a bottom' : needsTop ? 'a top' : 'another item'} before creating this outfit.</div>}
              <button disabled={!outfitPartnerId && partners.length > 0} onClick={partners.length ? saveCreatedOutfit : () => setOutfitSeed(null)} className={`mt-4 w-full rounded-xl py-3 text-sm font-black disabled:opacity-40 ${purpleButton}`}>{partners.length ? 'Save this outfit' : 'Close'}</button>
            </motion.section>
          </motion.div>;
        })()}
      </AnimatePresence>
    </div>
  );
};

export default VirtualWardrobeView;
