import { CanonicalGarmentData, WardrobeItem, WardrobeProfile } from '../types';

export const getUserDocId = (id: string) => {
  return (id || 'guestuser@nova.ai').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
};

export const GUEST_WARDROBE_KEY = 'nova_wardrobe_guest';
export const GUEST_PROFILE_KEY = 'nova_wardrobe_profile_guest';
export const GUEST_OUTFITS_KEY = 'nova_wardrobe_outfits_guest';

export interface WardrobeIdentityOptions {
  uid?: string | null;
  isGuest?: boolean;
  legacyEmail?: string | null;
}

/**
 * Determines whether a given account or session corresponds to guest mode.
 * Evaluates explicit guest flags, guest-specific UIDs, guest email patterns,
 * and the active localStorage session type.
 */
export const isGuestAccount = (params?: {
  isGuest?: boolean;
  uid?: string | null;
  email?: string | null;
}): boolean => {
  if (!params) return false;
  if (params.isGuest === true) return true;
  if (!params.uid || params.uid === 'guest' || params.uid.startsWith('guest_')) {
    return true;
  }
  if (params.email && params.email.toLowerCase().endsWith('@guest.nova.ai')) {
    return true;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      if (localStorage.getItem('novaSessionType') === 'guest') {
        return true;
      }
    } catch {
      // Storage access may throw in restricted environments
    }
  }
  return false;
};

/**
 * Resolves the primary wardrobe items localStorage key.
 * Guest mode strictly maps to `nova_wardrobe_guest`.
 */
export const getWardrobeStorageKey = (uid?: string | null, isGuest = false): string => {
  if (isGuest || !uid || uid === 'guest' || uid.startsWith('guest_')) {
    return GUEST_WARDROBE_KEY;
  }
  return `nova_wardrobe_${uid}`;
};

/**
 * Resolves the wardrobe profile localStorage key.
 * Guest mode strictly maps to `nova_wardrobe_profile_guest`.
 */
export const getWardrobeProfileKey = (uid?: string | null, isGuest = false): string => {
  if (isGuest || !uid || uid === 'guest' || uid.startsWith('guest_')) {
    return GUEST_PROFILE_KEY;
  }
  return `nova_wardrobe_profile_${uid}`;
};

/**
 * Resolves the wardrobe outfits localStorage key.
 * Guest mode strictly maps to `nova_wardrobe_outfits_guest`.
 */
export const getWardrobeOutfitsKey = (uid?: string | null, isGuest = false): string => {
  if (isGuest || !uid || uid === 'guest' || uid.startsWith('guest_')) {
    return GUEST_OUTFITS_KEY;
  }
  return `nova_wardrobe_outfits_${uid}`;
};

/**
 * Reads local wardrobe items for the given identity.
 * - Guest mode reads exclusively from `nova_wardrobe_guest` with no legacy fallback.
 * - Registered users check their UID namespace first, falling back to their legacy
 *   email document ID if registered and present, preserving the old key without deleting it.
 */
export const readLocalWardrobeItems = (options: WardrobeIdentityOptions): WardrobeItem[] => {
  if (typeof localStorage === 'undefined') return [];
  const { uid, isGuest = false, legacyEmail } = options;

  if (isGuest || !uid || uid === 'guest' || uid.startsWith('guest_')) {
    try {
      const raw = localStorage.getItem(GUEST_WARDROBE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  const primaryKey = getWardrobeStorageKey(uid, false);
  try {
    const raw = localStorage.getItem(primaryKey);
    if (raw) {
      return JSON.parse(raw);
    }

    // Preserve existing users' data: check legacy email storage key only for registered accounts
    if (legacyEmail && !legacyEmail.toLowerCase().endsWith('@guest.nova.ai')) {
      const legacyId = getUserDocId(legacyEmail);
      if (legacyId && legacyId !== uid) {
        const legacyRaw = localStorage.getItem(`nova_wardrobe_${legacyId}`);
        if (legacyRaw) {
          return JSON.parse(legacyRaw);
        }
      }
    }
    return [];
  } catch {
    return [];
  }
};

/**
 * Persists wardrobe items to the appropriate local storage namespace.
 */
export const saveLocalWardrobeItems = (
  items: WardrobeItem[],
  options: { uid?: string | null; isGuest: boolean }
): void => {
  if (typeof localStorage === 'undefined') return;
  const key = getWardrobeStorageKey(options.uid, options.isGuest);
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`Failed to save wardrobe items to ${key}:`, err);
  }
};

/**
 * Reads local wardrobe profile for the given identity.
 */
export const readLocalWardrobeProfile = (options: WardrobeIdentityOptions): WardrobeProfile => {
  if (typeof localStorage === 'undefined') return {};
  const { uid, isGuest = false, legacyEmail } = options;

  if (isGuest || !uid || uid === 'guest' || uid.startsWith('guest_')) {
    try {
      const raw = localStorage.getItem(GUEST_PROFILE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  const primaryKey = getWardrobeProfileKey(uid, false);
  try {
    const raw = localStorage.getItem(primaryKey);
    if (raw) return JSON.parse(raw);

    if (legacyEmail && !legacyEmail.toLowerCase().endsWith('@guest.nova.ai')) {
      const legacyId = getUserDocId(legacyEmail);
      if (legacyId && legacyId !== uid) {
        const legacyRaw = localStorage.getItem(`nova_wardrobe_profile_${legacyId}`);
        if (legacyRaw) return JSON.parse(legacyRaw);
      }
    }
    return {};
  } catch {
    return {};
  }
};

/**
 * Persists wardrobe profile to the appropriate local storage namespace.
 */
export const saveLocalWardrobeProfile = (
  profile: WardrobeProfile,
  options: { uid?: string | null; isGuest: boolean }
): void => {
  if (typeof localStorage === 'undefined') return;
  const key = getWardrobeProfileKey(options.uid, options.isGuest);
  try {
    localStorage.setItem(key, JSON.stringify(profile));
  } catch (err) {
    console.warn(`Failed to save wardrobe profile to ${key}:`, err);
  }
};

/**
 * Reads local wardrobe outfits for the given identity.
 */
export const readLocalWardrobeOutfits = (options: WardrobeIdentityOptions): any[] => {
  if (typeof localStorage === 'undefined') return [];
  const { uid, isGuest = false, legacyEmail } = options;

  if (isGuest || !uid || uid === 'guest' || uid.startsWith('guest_')) {
    try {
      const raw = localStorage.getItem(GUEST_OUTFITS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  const primaryKey = getWardrobeOutfitsKey(uid, false);
  try {
    const raw = localStorage.getItem(primaryKey);
    if (raw) return JSON.parse(raw);

    if (legacyEmail && !legacyEmail.toLowerCase().endsWith('@guest.nova.ai')) {
      const legacyId = getUserDocId(legacyEmail);
      if (legacyId && legacyId !== uid) {
        const legacyRaw = localStorage.getItem(`nova_wardrobe_outfits_${legacyId}`);
        if (legacyRaw) return JSON.parse(legacyRaw);
      }
    }
    return [];
  } catch {
    return [];
  }
};

/**
 * Persists wardrobe outfits to the appropriate local storage namespace.
 */
export const saveLocalWardrobeOutfits = (
  outfits: any[],
  options: { uid?: string | null; isGuest: boolean }
): void => {
  if (typeof localStorage === 'undefined') return;
  const key = getWardrobeOutfitsKey(options.uid, options.isGuest);
  try {
    localStorage.setItem(key, JSON.stringify(outfits));
  } catch (err) {
    console.warn(`Failed to save wardrobe outfits to ${key}:`, err);
  }
};

/**
 * Merges remote Firestore items with locally stored items, preserving
 * local image data (e.g. data URLs) that are omitted from Firestore.
 */
export const mergeWardrobeItems = (
  remoteItems: WardrobeItem[],
  localItems: WardrobeItem[]
): WardrobeItem[] => {
  const mergedMap = new Map<string, WardrobeItem>();

  // 1. Start with local items (which have local images and canonical data)
  for (const local of localItems) {
    if (local && local.id) {
      mergedMap.set(local.id, local);
    }
  }

  // 2. Merge remote items
  for (const remote of remoteItems) {
    if (!remote || !remote.id) continue;
    const local = mergedMap.get(remote.id);
    mergedMap.set(remote.id, {
      ...remote,
      // Preserve canonical data from local if remote has null/undefined
      canonical: remote.canonical || local?.canonical || undefined,
      attributes: {
        ...(local?.attributes || {}),
        ...(remote.attributes || {})
      },
      // Preserve local heavy base64 data URLs that were omitted from Firestore
      generatedImage: remote.generatedImage || local?.generatedImage || '',
      originalScan: remote.originalScan || local?.originalScan || ''
    });
  }

  return Array.from(mergedMap.values());
};

/**
 * Recursively cleans an object or array for Firestore storage.
 * Firestore strictly rejects `undefined` values anywhere in a document (top-level or nested).
 *
 * Rules:
 * 1. Omit any object key whose value is `undefined`.
 * 2. Filter out `undefined` elements from arrays.
 * 3. Preserve `null`, boolean, number, string (including empty strings), and valid objects/arrays.
 * 4. Never introduce fake attributes or alter legitimate values.
 * 5. Handle nested objects and arrays of arbitrary depth.
 */
export const deepCleanForFirestore = <T>(value: T): T => {
  if (value === undefined) {
    return null as any;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => deepCleanForFirestore(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      cleaned[key] = deepCleanForFirestore(val);
    }
  }
  return cleaned as any;
};

/**
 * Prepares a wardrobe item for Firestore storage by omitting large base64 data URLs
 * and original raw scans to keep document size within limits, and recursively
 * stripping any `undefined` values so Firestore setDoc never throws.
 */
export const sanitizeForFirestore = (item: WardrobeItem): Record<string, any> => {
  if (!item || typeof item !== 'object') {
    return {};
  }
  const { originalScan, ...rest } = item;
  const base: Record<string, any> = {
    ...rest,
    id: item.id,
    category: item.category || 'Clothing',
    size: typeof item.size === 'string' ? item.size : '',
    generatedImage: item.generatedImage?.startsWith('data:') ? '' : (item.generatedImage || ''),
    gender: item.gender || 'unisex',
    attributes: item.attributes ? deepCleanForFirestore(item.attributes) : {},
    canonical: item.canonical ? deepCleanForFirestore(item.canonical) : null,
    tags: Array.isArray(item.tags) ? item.tags.filter((t) => typeof t === 'string' && Boolean(t)) : [],
    colors: Array.isArray(item.colors) ? item.colors.filter((c) => typeof c === 'string' && Boolean(c) && c !== 'Custom') : [],
    pattern: item.pattern || 'Not specified',
    fabric: item.fabric || 'Unknown',
    dateAdded: item.dateAdded || new Date().toISOString(),
    timesWorn: typeof item.timesWorn === 'number' ? item.timesWorn : 0
  };

  if (item.lastWorn) {
    base.lastWorn = item.lastWorn;
  }

  return deepCleanForFirestore(base);
};

export interface GarmentAnalysisClientResponse {
  success: boolean;
  garment?: CanonicalGarmentData;
  displayAttributes?: Record<string, any>;
  error?: string;
}

/**
 * Client service to request Gemini-powered garment intelligence from backend.
 */
export const requestGarmentAnalysis = async (
  imageDataUrl: string,
  garmentHint?: string
): Promise<GarmentAnalysisClientResponse> => {
  try {
    const response = await fetch('/api/wardrobe/analyze-garment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageDataUrl,
        garmentHint
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Analysis failed with status ${response.status}`
      };
    }

    return {
      success: true,
      garment: data.garment,
      displayAttributes: data.displayAttributes
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while contacting AI analysis service.'
    };
  }
};

export default {
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
  deepCleanForFirestore,
  sanitizeForFirestore
};
