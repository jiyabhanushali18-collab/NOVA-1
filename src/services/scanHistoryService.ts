import { OutfitScanRecord } from '../types';

const STORAGE_KEY_PREFIX = 'nova_outfit_scans_';
const LEGACY_SEED_SCAN_IDS = new Set(['sc-1', 'sc-2', 'sc-3', 'sc-4']);
const MAX_SCAN_HISTORY = 12;

function getStorageKey(userId?: string): string {
  return `${STORAGE_KEY_PREFIX}${userId || 'default'}`;
}

/**
 * Format timestamp into user-friendly string
 */
export function formatScanTime(timestamp: number): string {
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 2) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) {
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Today, ${timeStr}`;
  }
  if (diffDays === 1) {
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Yesterday, ${timeStr}`;
  }

  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Retrieve all outfit scans for the user (persistent in localStorage)
 */
export function getScanHistory(userId?: string): OutfitScanRecord[] {
  if (typeof window === 'undefined') return [];

  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const scans = parsed.filter((scan: unknown): scan is OutfitScanRecord =>
        Boolean(scan && typeof scan === 'object' && 'id' in scan &&
          typeof scan.id === 'string' && !LEGACY_SEED_SCAN_IDS.has(scan.id))
      );
      if (scans.length !== parsed.length) {
        try {
          localStorage.setItem(key, JSON.stringify(scans));
        } catch (err) {
          console.warn('Failed to remove demo records from scan history storage:', err);
        }
      }
      return scans;
    }
    console.warn('Scan history storage has an invalid format.');
    return [];
  } catch (err) {
    console.warn('Failed to load scan history from storage:', err);
    return [];
  }
}

/**
 * Save a new outfit scan
 */
export function saveOutfitScan(
  scanData: Partial<OutfitScanRecord> & { name?: string; imageUrl: string },
  userId?: string
): OutfitScanRecord {
  const currentScans = getScanHistory(userId);
  const timestamp = scanData.timestamp || Date.now();
  const time = scanData.time || formatScanTime(timestamp);

  const newRecord: OutfitScanRecord = {
    id: scanData.id || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: userId || 'default',
    name: scanData.name || 'Outfit Scan',
    time,
    timestamp,
    imageUrl: scanData.imageUrl,
    score: scanData.score,
    category: scanData.category || 'Casual wear',
    colors: scanData.colors && scanData.colors.length > 0 ? scanData.colors : ['#553BE2', '#A594FD', '#131426'],
    attributes: scanData.attributes || {
      fit: 'Regular Fit',
      style: 'Modern Casual',
      season: 'Current Season'
    },
    matchedProductId: scanData.matchedProductId,
    matchedProductName: scanData.matchedProductName,
    matchedProductPrice: scanData.matchedProductPrice,
    matchedProductImage: scanData.matchedProductImage,
  };

  const updatedScans = [newRecord, ...currentScans.filter((s) => s.id !== newRecord.id)].slice(0, MAX_SCAN_HISTORY);

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updatedScans));
  } catch (error) {
    console.error('Failed to persist scan to storage:', error);
    throw error;
  }

  // Dispatch global event for reactive UI updates across all components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nova:scan_history_updated', {
        detail: { scan: newRecord, count: updatedScans.length }
      })
    );
  }

  return newRecord;
}

/**
 * Delete a specific scan by ID
 */
export function deleteOutfitScan(scanId: string, userId?: string): boolean {
  if (!scanId) return false;
  const currentScans = getScanHistory(userId);
  const updatedScans = currentScans.filter((s) => s.id !== scanId);

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updatedScans));
  } catch (e) {
    console.warn('Failed to update scans in storage after delete:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nova:scan_history_updated', {
        detail: { deletedId: scanId, count: updatedScans.length }
      })
    );
  }

  return true;
}

/**
 * Clear all scan history
 */
export function clearAllScanHistory(userId?: string): boolean {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify([]));
  } catch (e) {
    console.warn('Failed to clear scans in storage:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nova:scan_history_updated', {
        detail: { cleared: true, count: 0 }
      })
    );
  }

  return true;
}

/**
 * Get current scan count
 */
export function getScanCount(userId?: string): number {
  return getScanHistory(userId).length;
}
