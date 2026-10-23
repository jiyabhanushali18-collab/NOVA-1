import { Capacitor, registerPlugin } from '@capacitor/core';
import { SavedLook } from '../types';

interface GallerySaverPluginInterface {
  saveImageToGallery(options: { data: string; filename?: string }): Promise<{ success: boolean; uri: string; filename: string }>;
}

const GallerySaver = registerPlugin<GallerySaverPluginInterface>('GallerySaver');

const DB_NAME = 'nova_local_storage_db';
const DB_VERSION = 1;
const STORE_NAME = 'saved_looks';
const METADATA_KEY_PREFIX = 'nova_saved_looks_meta:';

/**
 * Open local IndexedDB instance for high-capacity, persistent on-device image storage.
 * Works seamlessly in Android Capacitor WebView and modern web browsers.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported on this device/browser'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate standardized filename: NOVA_Look_YYYYMMDD_HHMMSS.jpg
 */
export function generateLookFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `NOVA_Look_${yyyy}${MM}${dd}_${HH}${mm}${ss}.jpg`;
}

/**
 * Save image to phone's native gallery / Photos (Android Scoped Storage)
 * or triggers a standard browser download on Web.
 * Does NOT upload anything to the backend or cloud.
 */
export async function saveImageToDeviceGallery(
  dataUrl: string,
  suggestedFilename?: string
): Promise<{ success: boolean; uri?: string; filename: string; error?: string }> {
  const filename = suggestedFilename || generateLookFilename();

  if (!dataUrl) {
    return { success: false, filename, error: 'No image data to save' };
  }

  // 1. Android Native via GallerySaverPlugin
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      const res = await GallerySaver.saveImageToGallery({
        data: dataUrl,
        filename,
      });
      return {
        success: true,
        uri: res.uri,
        filename: res.filename || filename,
      };
    } catch (err: any) {
      console.warn('Native gallery save error:', err);
      return {
        success: false,
        filename,
        error: err?.message || 'Gallery save failed',
      };
    }
  }

  // 2. Web browser download mechanism
  if (typeof window !== 'undefined') {
    try {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return {
        success: true,
        uri: 'downloads://' + filename,
        filename,
      };
    } catch (err: any) {
      console.warn('Browser download error:', err);
      return {
        success: false,
        filename,
        error: err?.message || 'Browser download blocked',
      };
    }
  }

  return { success: false, filename, error: 'Platform not supported' };
}

/**
 * Download an existing locally stored look image:
 * On Android, writes to gallery/Downloads via GallerySaver.
 * On Web, triggers standard browser download.
 * Does NOT perform any backend upload.
 */
export async function downloadSavedLook(
  look: SavedLook
): Promise<{ success: boolean; uri?: string; filename: string; error?: string }> {
  if (!look || !look.imageUrl) {
    return { success: false, filename: '', error: 'Image not found' };
  }
  const filename = look.filename || generateLookFilename(new Date(look.savedAt || Date.now()));
  return saveImageToDeviceGallery(look.imageUrl, filename);
}

/**
 * Capture the currently displayed processed try-on result:
 * - If Live AI is active, grabs the remote stream frame directly from the video element
 * - If model preview is active, draws the high-resolution portrait model into canvas
 */
export async function captureCurrentTryOnImage(params: {
  videoElement: HTMLVideoElement | null;
  isVideoLive: boolean;
  isCameraActive: boolean;
  fallbackImageUrl: string;
}): Promise<{ dataUrl: string; width: number; height: number } | null> {
  // 1. Capture from active video element if stream is running
  if (params.videoElement && (params.isVideoLive || params.isCameraActive)) {
    const video = params.videoElement;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          return { dataUrl, width: canvas.width, height: canvas.height };
        }
      } catch (err) {
        console.warn('Canvas capture from video stream failed, falling back:', err);
      }
    }
  }

  // 2. Capture from the active portrait model image
  if (params.fallbackImageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 720;
          canvas.height = img.naturalHeight || img.height || 1280;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            return resolve({ dataUrl, width: canvas.width, height: canvas.height });
          }
        } catch {
          // If cross-origin restrictions apply, resolve with source image
        }
        resolve({ dataUrl: params.fallbackImageUrl, width: 720, height: 1280 });
      };

      img.onerror = () => {
        resolve({ dataUrl: params.fallbackImageUrl, width: 720, height: 1280 });
      };

      img.src = params.fallbackImageUrl;
    });
  }

  return null;
}

/**
 * Save a look LOCALLY on the device using IndexedDB (no backend, no cloud).
 * Large image data is kept safely in IndexedDB to avoid localStorage quota limits.
 */
export async function saveLookLocally(params: {
  userId?: string;
  imageUrl: string;
  garmentId?: string;
  garmentName: string;
  garmentCategory?: string;
  garmentImg?: string;
  gallerySaved?: boolean;
  galleryUri?: string;
  filename?: string;
  width?: number;
  height?: number;
}): Promise<SavedLook> {
  const userId = params.userId || 'local_user';
  const lookId = `look_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const savedAt = new Date().toISOString();

  const lookRecord: SavedLook = {
    id: lookId,
    userId,
    imageUrl: params.imageUrl,
    thumbnailUrl: params.imageUrl,
    garmentId: params.garmentId,
    garmentName: params.garmentName || 'Curated Look',
    garmentCategory: params.garmentCategory || 'Try-On',
    garmentImg: params.garmentImg,
    savedAt,
    gallerySaved: params.gallerySaved || false,
    galleryUri: params.galleryUri,
    filename: params.filename || generateLookFilename(new Date(savedAt)),
    width: params.width,
    height: params.height,
  };

  // 1. Store in local IndexedDB
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(lookRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbErr) {
    console.warn('IndexedDB write warning:', idbErr);
  }

  // 2. Also keep lightweight metadata index in localStorage for fast synchronous discovery
  try {
    const metaRecord = {
      id: lookId,
      userId,
      garmentName: lookRecord.garmentName,
      garmentCategory: lookRecord.garmentCategory,
      savedAt: lookRecord.savedAt,
      filename: lookRecord.filename,
      gallerySaved: lookRecord.gallerySaved,
    };
    const key = METADATA_KEY_PREFIX + userId;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = [metaRecord, ...existing.filter((m: any) => m.id !== lookId)].slice(0, 100);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {}

  // 3. Dispatch window storage event so Profile screen updates instantly if mounted
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nova:saved_look_updated', { detail: { look: lookRecord } }));
  }

  return lookRecord;
}

/**
 * Retrieve all locally saved looks for the user from on-device IndexedDB.
 * Completely local — no network requests or cloud calls.
 */
export async function getSavedLooksLocally(userId?: string): Promise<SavedLook[]> {
  const targetUser = userId || 'local_user';

  try {
    const db = await openDatabase();
    const looks: SavedLook[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Filter by user if targetUser is specific
    const filtered = looks.filter((l) => !targetUser || l.userId === targetUser || l.userId === 'local_user' || targetUser === 'local_user');

    // Sort newest first
    filtered.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    return filtered;
  } catch (err) {
    console.warn('IndexedDB read failed, fallback to empty list:', err);
    return [];
  }
}

/**
 * Retrieve a single saved look by ID from on-device IndexedDB
 */
export async function getSavedLookById(lookId: string): Promise<SavedLook | null> {
  if (!lookId) return null;

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(lookId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Delete a saved look locally from on-device IndexedDB and metadata cache
 */
export async function deleteSavedLookLocally(lookId: string, userId?: string): Promise<boolean> {
  if (!lookId) return false;
  const targetUser = userId || 'local_user';

  // 1. Delete from IndexedDB
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(lookId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete error:', err);
  }

  // 2. Remove from metadata index
  try {
    const key = METADATA_KEY_PREFIX + targetUser;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = existing.filter((m: any) => m.id !== lookId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {}

  // 3. Dispatch update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nova:saved_look_updated', { detail: { deletedId: lookId } }));
  }

  return true;
}

// Backwards-compatible aliases
export const saveLookToNovaAccount = saveLookLocally;
export const fetchUserSavedLooks = getSavedLooksLocally;
export const deleteUserSavedLook = (userId: string, lookId: string) => deleteSavedLookLocally(lookId, userId);
