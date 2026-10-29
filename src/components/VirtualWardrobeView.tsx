import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ScreenId, WardrobeDetectedAttributes, WardrobeGender, WardrobeItem, WardrobeProfile, WardrobeScanMethod, WardrobeSize } from '../types';
import accountService from '../services/accountService';
import aiService from "../services/aiService";
import { resolveColorHex } from '../utils/colors';
import { useI18n } from '../i18n';

interface VirtualWardrobeViewProps {
  onNavigate: (screen: ScreenId) => void;
  userEmail: string;
  userName?: string;
  isDarkMode?: boolean;
  userId?: string;
}

const sizes: WardrobeSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const maleCategories = ['T-Shirt', 'Shirt', 'Polo', 'Hoodie', 'Sweatshirt', 'Jacket', 'Jeans', 'Trousers', 'Shorts', 'Ethnic Wear', 'Blazer'];
const femaleCategories = ['Kurti', 'Co-ord Set', 'Saree', 'Crop Top', 'T-Shirt', 'Shirt', 'Leggings', 'Jeans', 'Palazzo', 'Dress', 'Jacket', 'Hoodie'];
const categoryIcons: Record<string, string> = {
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

const storageKey = (userId: string) => `nova_wardrobe_${userId}`;
const profileKey = (userId: string) => `nova_wardrobe_profile_${userId}`;
const outfitsKey = (userId: string) => `nova_wardrobe_outfits_${userId}`;
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const topCategories = ['T-Shirt', 'Shirt', 'Polo', 'Hoodie', 'Sweatshirt', 'Jacket', 'Blazer', 'Kurti', 'Crop Top'];
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

export const VirtualWardrobeView: React.FC<VirtualWardrobeViewProps> = ({ onNavigate, userEmail, userName, isDarkMode = false, userId: propUserId }) => {
  const { t } = useI18n();
  const currentUid = auth.currentUser?.uid || propUserId || null;
  const legacyUserId = accountService.getUserDocId(userEmail);
  const userId = currentUid || legacyUserId;
  const username = userEmail ? userEmail.split('@')[0] : (userName || userId);
  const [profile, setProfile] = useState<WardrobeProfile>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(profileKey(userId)) ||
        localStorage.getItem(profileKey(legacyUserId)) ||
        '{}'
      );
    } catch {
      return {};
    }
  });
  const [items, setItems] = useState<WardrobeItem[]>([]);
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
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');
  const [patternFilter, setPatternFilter] = useState('All');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [editDraft, setEditDraft] = useState<WardrobeItem | null>(null);
  const [outfitSeed, setOutfitSeed] = useState<WardrobeItem | null>(null);
  const [outfitPartnerId, setOutfitPartnerId] = useState<string>('');
  const [savedOutfitCount, setSavedOutfitCount] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(outfitsKey(userId)) ||
        localStorage.getItem(outfitsKey(legacyUserId)) ||
        '[]'
      ).length;
    } catch {
      return 0;
    }
  });

  const sanitizeForFirestore = (item: WardrobeItem) => {
    const { originalScan, ...rest } = item;
    return {
      ...rest,
      // Do not store base64 data URLs in Firestore to keep document size well under 1MB (Task 8)
      generatedImage: item.generatedImage?.startsWith('data:') ? '' : (item.generatedImage || ''),
      gender: item.gender || 'unisex',
      attributes: item.attributes || {},
      tags: Array.isArray(item.tags) ? item.tags : [],
      colors: Array.isArray(item.colors) ? item.colors : [],
      timesWorn: item.timesWorn || 0
    };
  };

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

  useEffect(() => {
    const loadWardrobe = async () => {
      setIsLoading(true);
      try {
        const localRaw = localStorage.getItem(storageKey(userId)) || 
          (legacyUserId !== userId ? localStorage.getItem(storageKey(legacyUserId)) : null);
        const localItems: WardrobeItem[] = localRaw ? JSON.parse(localRaw) : [];
        if (localItems.length) setItems(localItems);

        if (currentUid) {
          const snap = await getDocs(query(collection(db, 'users', currentUid, 'wardrobe'), orderBy('dateAdded', 'desc')));
          const remote = snap.docs.map((entry) => ({ ...(entry.data() as WardrobeItem), id: entry.id }));
          if (remote.length) {
            const merged = remote.map((remoteItem) => {
              const matchedLocal = localItems.find((l) => l.id === remoteItem.id);
              return {
                ...remoteItem,
                generatedImage: remoteItem.generatedImage || matchedLocal?.generatedImage || '',
                originalScan: remoteItem.originalScan || matchedLocal?.originalScan || ''
              };
            });
            setItems(merged);
            localStorage.setItem(storageKey(userId), JSON.stringify(merged));
          }
        }
      } catch (err) {
        console.warn('Failed to load wardrobe from cloud, using local fallback:', err);
        const localRaw = localStorage.getItem(storageKey(userId)) || 
          (legacyUserId !== userId ? localStorage.getItem(storageKey(legacyUserId)) : null);
        setItems(localRaw ? JSON.parse(localRaw) : []);
      } finally {
        setIsLoading(false);
      }
    };
    loadWardrobe();
  }, [currentUid, userId, legacyUserId]);

  useEffect(() => {
    localStorage.setItem(profileKey(userId), JSON.stringify(profile));
    accountService.upsertUserProfile(
      {
        uid: currentUid || userEmail || userId,
        username,
        name: userName || username,
        email: userEmail,
        gender: profile.gender,
        size: profile.size
      },
      { wardrobeCount: items.length }
    ).catch(() => undefined);
  }, [currentUid, items.length, profile, userEmail, userId, userName, username]);

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
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
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
      setSaveStatus('Background removed successfully.');
      window.setTimeout(() => setSaveStatus(null), 2000);
    } catch (err: any) {
      console.error('Background removal failed:', err);
      const detail = err?.message || 'Server unreachable at http://127.0.0.1:8000';
      setProcessedImage(null);
      setBgRemovalError(`Background removal failed: ${detail}`);
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

  const continueWithOriginal = () => {
    if (!uploadedImage) return;
    setUseOriginalFallback(true);
    setProcessedImage(uploadedImage);
    setBgRemovalError(null);
    setSaveStatus('Using original photo without background removal.');
    window.setTimeout(() => setSaveStatus(null), 2500);
  };

  const saveWardrobeItem = async (itemToSave: WardrobeItem) => {
    const next = [itemToSave, ...items.filter((item) => item.id !== itemToSave.id)];
    persistItems(next);

    if (!currentUid) {
      setSaveStatus('Saved locally (Guest mode — sign in to sync with cloud)');
      setSelectedCategory(null);
      setUploadedImage(null);
      setUploadedFile(null);
      setProcessedImage(null);
      setBgRemovalError(null);
      setUseOriginalFallback(false);
      window.setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    try {
      const sanitized = sanitizeForFirestore(itemToSave);
      await setDoc(doc(db, 'users', currentUid, 'wardrobe', itemToSave.id), sanitized);
      setSaveStatus('Saved to cloud wardrobe');
      try {
        await accountService.upsertUserProfile(
          {
            uid: currentUid,
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

    setSelectedCategory(null);
    setUploadedImage(null);
    setUploadedFile(null);
    setProcessedImage(null);
    setBgRemovalError(null);
    setUseOriginalFallback(false);
    window.setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleSaveGarment = () => {
    const finalImage = useOriginalFallback ? uploadedImage : (processedImage || uploadedImage);
    if (!finalImage) {
      setSaveStatus('Please select or capture a clothing photo first.');
      window.setTimeout(() => setSaveStatus(null), 2500);
      return;
    }

    const finalCategory = garmentCategory || selectedCategory || 'Clothing';
    const finalColor = garmentColor.trim() || 'Custom';

    const newItem: WardrobeItem = {
      id: makeId(),
      category: finalCategory,
      size: profile.size || 'M',
      generatedImage: finalImage,
      originalScan: uploadedImage || finalImage,
      colors: [finalColor],
      pattern: 'Solid',
      fabric: 'Standard',
      tags: [finalCategory, finalColor].filter(Boolean),
      dateAdded: new Date().toISOString(),
      timesWorn: 0,
      attributes: {
        category: finalCategory,
        primaryColor: finalColor,
        secondaryColor: '—',
        pattern: 'Solid',
        fabric: 'Standard',
        style: 'Everyday',
        neckType: 'Standard',
        sleeveType: 'Standard'
      }
    };

    saveWardrobeItem(newItem);
  };

  const deleteItem = async (item: WardrobeItem) => {
    const next = items.filter((entry) => entry.id !== item.id);
    persistItems(next);
    setSelectedItem(null);

    if (!currentUid) {
      setSaveStatus('Removed locally');
      window.setTimeout(() => setSaveStatus(null), 2000);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', currentUid, 'wardrobe', item.id));
      setSaveStatus('Removed from cloud wardrobe');
      try {
        await accountService.upsertUserProfile(
          {
            uid: currentUid,
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

    if (!currentUid) {
      setSaveStatus('Updated locally');
      window.setTimeout(() => setSaveStatus(null), 2000);
      return;
    }

    try {
      const sanitized = sanitizeForFirestore(item);
      await setDoc(doc(db, 'users', currentUid, 'wardrobe', item.id), sanitized, { merge: true });
      setSaveStatus('Updated in cloud wardrobe');
      try {
        await accountService.upsertUserProfile(
          {
            uid: currentUid,
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
    if (currentUid) {
      next
        .filter((item) => wornIds.has(item.id))
        .forEach((item) => {
          const sanitized = sanitizeForFirestore(item);
          setDoc(doc(db, 'users', currentUid, 'wardrobe', item.id), sanitized, { merge: true }).catch(() => undefined);
        });
    }
    setSaveStatus('Fit saved as worn — nice choice.');
    window.setTimeout(() => setSaveStatus(null), 2400);
  };

  const openOutfitBuilder = (item: WardrobeItem) => {
    setSelectedItem(null);
    setOutfitSeed(item);
    const complementary = topCategories.includes(item.category) ? bottoms : bottomCategories.includes(item.category) ? tops : items.filter((entry) => entry.id !== item.id);
    setOutfitPartnerId(complementary[0]?.id || '');
  };

  const saveCreatedOutfit = () => {
    if (!outfitSeed) return;
    const partner = items.find((item) => item.id === outfitPartnerId);
    if (!partner && (topCategories.includes(outfitSeed.category) || bottomCategories.includes(outfitSeed.category))) {
      setSaveStatus('Add a matching top or bottom first.'); return;
    }
    const key = outfitsKey(userId);
    let saved: Array<{ id: string; itemIds: string[]; createdAt: string }> = [];
    try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* Start a fresh local collection. */ }
    saved.unshift({ id: makeId(), itemIds: [outfitSeed.id, ...(partner ? [partner.id] : [])], createdAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(saved));
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
  const outfitIdeas = [
    ...tops.flatMap((top) => bottoms.map((bottom) => ({ title: `${top.colors[0]} ${top.category} + ${bottom.colors[0]} ${bottom.category}`, items: [top, bottom], note: 'A fresh pairing from your own closet.' }))),
    ...onePieces.map((item) => ({ title: `${item.colors[0]} ${item.category}`, items: [item], note: 'An easy one-piece look to revisit.' }))
  ].filter((idea, index, all) => all.findIndex((entry) => entry.title === idea.title) === index);
  const currentOutfit = outfitIdeas[outfitIndex % Math.max(1, outfitIdeas.length)];
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
            ['content_cut', 'Automatic Background Removal'],
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

          <section className={`rounded-[28px] p-4 ${darkPanel}`}>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-black">New fits for you</h2><p className={`text-[11px] ${muted}`}>Made only from what you own</p></div>
              {outfitIdeas.length > 1 && <button onClick={() => setOutfitIndex((index) => index + 1)} className={`rounded-lg px-3 py-2 text-[11px] font-black ${badgeSurface}`}>Shuffle</button>}
            </div>
            {currentOutfit ? (
              <div className={`mt-3 rounded-2xl border p-3 ${subCard}`}>
                <div className="flex gap-2">{currentOutfit.items.map((item) => <img key={item.id} src={item.generatedImage} alt={item.category} className={`h-20 w-16 rounded-xl object-contain p-1 ${innerSurface}`} />)}</div>
                <p className="mt-3 text-sm font-black">{currentOutfit.title}</p><p className={`mt-1 text-xs ${muted}`}>{currentOutfit.note}</p>
                <button onClick={() => markOutfitWorn(currentOutfit.items)} className={`mt-3 w-full rounded-xl py-2.5 text-xs font-black ${purpleButton}`}>I wore this fit</button>
              </div>
            ) : <div className={`mt-3 rounded-2xl border border-dashed p-4 text-center text-xs ${isDarkMode ? 'border-[#453066] text-slate-400' : 'border-[#E4DFF5] text-[#5E667A]'}`}>Add a top and a bottom to unlock outfit ideas.</div>}
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
                          Removing background...
                        </span>
                      ) : processedImage && !useOriginalFallback ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                          ✓ Background Removed
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
                          <p className={`mt-3 text-xs font-black ${accentText}`}>Removing background with rembg...</p>
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
                            Retry Background Removal
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
                <div className={`mt-3 rounded-2xl border p-3 ${subCard}`}>
                  <div className="grid grid-cols-2 gap-3">
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
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>
                        Color / Note
                      </label>
                      <input 
                        type="text"
                        value={garmentColor}
                        onChange={(e) => setGarmentColor(e.target.value)}
                        placeholder="e.g. Navy Blue"
                        className={`mt-1 w-full rounded-xl border p-2 text-xs font-bold outline-none ${
                          isDarkMode ? 'border-[#30264c] bg-[#1a1b2d] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setUploadedImage(null);
                    setUploadedFile(null);
                    setProcessedImage(null);
                    setBgRemovalError(null);
                    setUseOriginalFallback(false);
                  }} 
                  className={`flex-1 rounded-xl border py-3 text-xs font-black shadow-sm ${
                    isDarkMode ? 'border-[#30264c] bg-[#171827] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSaveGarment} 
                  disabled={!uploadedImage || isRemovingBg} 
                  className={`flex-1 rounded-xl py-3 text-xs font-black disabled:opacity-40 ${purpleButton}`}
                >
                  Save to Wardrobe
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
                <h2 className="text-xl font-black">{selectedItem.category}</h2>
                <button onClick={() => { setEditDraft(null); setSelectedItem(null); }} className={`h-9 w-9 rounded-full ${isDarkMode ? 'bg-[#171827]' : 'bg-[#F2EEFF] text-[#5E667A]'}`}><span className="material-symbols-outlined text-base">close</span></button>
              </div>
              <div className={`rounded-[24px] p-4 ${innerSurface}`}>
                <img src={selectedItem.generatedImage} alt={selectedItem.category} className="mx-auto h-72 w-full object-contain" />
              </div>
              {editDraft ? (
                <div className={`mt-4 space-y-3 rounded-2xl border p-3 ${subCard}`}>
                  <p className={`text-xs font-black ${accentText}`}>Correct the scan details</p>
                  {[
                    ['Category', 'category'], ['Primary color', 'primaryColor'], ['Secondary color', 'secondaryColor'],
                    ['Pattern', 'pattern'], ['Fabric', 'fabric'], ['Neckline', 'neckType'], ['Sleeve', 'sleeveType']
                  ].map(([label, field]) => {
                    const attributeFields = ['primaryColor', 'secondaryColor', 'neckType', 'sleeveType'];
                    const value = attributeFields.includes(field) ? editDraft.attributes[field as keyof WardrobeDetectedAttributes] : editDraft[field as keyof WardrobeItem] as string;
                    return <label key={field} className={`block text-[10px] font-black uppercase tracking-wider ${muted}`}>{label}
                      <input value={value || ''} onChange={(event) => setEditDraft((draft) => !draft ? draft : attributeFields.includes(field)
                        ? { ...draft, attributes: { ...draft.attributes, [field]: event.target.value }, ...(field === 'primaryColor' ? { colors: [event.target.value, ...draft.colors.slice(1)] } : {}) }
                        : { ...draft, [field]: event.target.value })} className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs font-semibold normal-case outline-none focus:border-[#553BE2] ${
                          isDarkMode ? 'border-[#37304d] bg-[#0d0f1a] text-white' : 'border-[#E4DFF5] bg-white text-[#131426]'
                        }`} />
                    </label>;
                  })}
                  <div className="grid grid-cols-2 gap-2 pt-1"><button onClick={() => setEditDraft(null)} className={`rounded-xl border py-3 text-xs font-black ${isDarkMode ? 'border-[#334155]' : 'border-[#E4DFF5] bg-white text-[#5E667A]'}`}>Cancel</button><button onClick={() => { if (editDraft) { updateItem({ ...editDraft, colors: [editDraft.attributes.primaryColor, ...(editDraft.attributes.secondaryColor !== '—' ? [editDraft.attributes.secondaryColor] : [])], pattern: editDraft.pattern, fabric: editDraft.fabric }); setEditDraft(null); setSaveStatus('Garment details updated.'); } }} className={`rounded-xl py-3 text-xs font-black ${purpleButton}`}>Save changes</button></div>
                </div>
              ) : <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ['Category', selectedItem.category],
                  ['Color', selectedItem.colors.join(', ')],
                  ['Pattern', selectedItem.pattern],
                  ['Fabric', selectedItem.fabric],
                  ...(isBottomWear(selectedItem.category)
                    ? [['Rise', selectedItem.attributes?.rise || 'Not specified'], ['Length', selectedItem.attributes?.length || 'Not specified']]
                    : [['Neck', selectedItem.attributes?.neckType || 'Regular'], ['Sleeve', selectedItem.attributes?.sleeveType || 'Regular']]),
                  ['Size', selectedItem.size],
                  ['Date Added', new Date(selectedItem.dateAdded).toLocaleDateString()]
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-xl border p-3 ${subCard}`}>
                    <div className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>{label}</div>
                    <div className="mt-1 text-xs font-black">{value}</div>
                  </div>
                ))}
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
