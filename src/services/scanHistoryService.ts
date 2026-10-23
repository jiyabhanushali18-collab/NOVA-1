import { OutfitScanRecord } from '../types';

const STORAGE_KEY_PREFIX = 'nova_outfit_scans_';

export const INITIAL_SEED_SCANS: OutfitScanRecord[] = [
  {
    id: 'sc-1',
    name: 'Lavender Streetwear Hoodie',
    time: 'Today, 11:45 AM',
    timestamp: Date.now() - 3600000 * 2,
    score: 9.4,
    category: 'Streetwear & Casual',
    colors: ['#8B6DFD', '#553BE2', '#ECE7FF'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_DtlozI9DEUdYLQMIYnHfyp_fm3Cw5jsLiTmm4fF-DK-V1b1VUrpdO38t2top6aLDYoPLajt6CK3xvlfTqljQR1ztqY3Vf2-rI5VZ-80yTBizHhkphopu04Kc8tt_0uB8msBmbK_gludZp4Yclk-FLt5VxJnchoilYP_-XyBA2aIViuUjgm9TPfCJyyVzzcyG2f73mJiD0J_DmoLT0s-2WDDrjistvet5C8RPRMNkVXGOjY2H5tO5qZqyMN42Dxto1EwsXVxuC0iF',
    attributes: {
      fit: 'Relaxed Fit',
      style: 'Urban Streetwear',
      season: 'Autumn / Winter'
    },
    matchedProductId: 'lavender-hoodie',
    matchedProductName: 'Oversized Lavender Hoodie',
    matchedProductPrice: 2499,
  },
  {
    id: 'sc-2',
    name: 'Beige Casual Linen',
    time: 'Yesterday, 04:20 PM',
    timestamp: Date.now() - 86400000,
    score: 8.9,
    category: 'Casual Wear',
    colors: ['#E3DAC9', '#D2B48C', '#F5F5DC'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUgeGANrOmRNqcfu4jU6dHyOKzUkUmIFcfryWbaQQXJ-iF_6FuhspteyptU86lYM3jORcKT5qGeTsG9Z0PxxNEKOMUBmJfDIKAaAp5d9I1bCnJUGqHDmOLGnkVd3opGydX4vSn9aVNpUJVq8gwWnZFTIdpSijWXTJb71kZqVYWbQlpyEcdc7AwsfKN4XVjmxI0mIRylryRbM7LTx9RWlYvc5rGsaaUKU4Lyns_l-DSURVnRwklLsGzVJ-YazVRI1PMXDt9nq4NTbVa',
    attributes: {
      fit: 'Regular Fit',
      style: 'Smart Casual',
      season: 'Spring / Summer'
    },
    matchedProductId: 'beige-chinos',
    matchedProductName: 'Classic Linen Blend Chinos',
    matchedProductPrice: 1899,
  },
  {
    id: 'sc-3',
    name: 'Denim Classic Overshirt',
    time: '20 Oct, 02:15 PM',
    timestamp: Date.now() - 86400000 * 3,
    score: 9.1,
    category: 'Outerwear',
    colors: ['#4682B4', '#1E3F66', '#B0C4DE'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX9aJol6Krmm5VbrNIBE3Jah-4_TNSdaoEzCEuz1LtgIArYiTiqFhCbHqf7-UKcE9Lkg-S1B3PPHw00ISKzJc9YMfp-NwHR1VRcEUuVuZJkNNQrZgZwW84I1py3NV3z3Dgrf_8X_6bwfbY9m4zfoTPSUhve-7D3y-guULPbmhfu21pUSU0GAUIAFEK1RnlR3g-KW6Y9uCTIyYhepief0uH281I5860GxOLahrZqkZ9bqKqSMOWHGmf-AHEzjEGnCeNihIRFc8sGL9p',
    attributes: {
      fit: 'Structured Fit',
      style: 'Vintage Americana',
      season: 'All Seasons'
    },
    matchedProductId: 'denim-jacket',
    matchedProductName: 'Raw Selvedge Denim Jacket',
    matchedProductPrice: 3299,
  },
  {
    id: 'sc-4',
    name: 'Obsidian Minimalist Blazer',
    time: '18 Oct, 06:30 PM',
    timestamp: Date.now() - 86400000 * 5,
    score: 9.6,
    category: 'Formal & Smart Casual',
    colors: ['#1A1C23', '#2D3748', '#E2E8F0'],
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBAz436PJ3rbXi1LBV-sa3cN9uLMLqpSMl88xEV3gJacDoqvdlBzW37YgFuzQkyI7p_9Kep1fRAB-uC7ofCfNQeDsELcdaKgoEn81Eek8bt8nNChouMNaEEOUka2CfaeoSTi5c70u6sMESaLmJCYQtYV_rYls4TGCvf8uSjdFAn9KKS0AguyjN-0jlYW4v-08SrEtgaJcxBcSGMONz9D1fXx87S5cBnKt07ubFlpA_LvVTRRNYnwtY7zbZ6A0fPRaOaa4yoMo3hdoNj',
    attributes: {
      fit: 'Tailored Slim',
      style: 'Contemporary Formal',
      season: 'All Seasons'
    },
    matchedProductId: 'black-turtleneck',
    matchedProductName: 'Fine Knit Merino Turtleneck',
    matchedProductPrice: 2799,
  }
];

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
  if (typeof window === 'undefined') return INITIAL_SEED_SCANS;

  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Initialize with seed scans so user starts with high-value mock data
      localStorage.setItem(key, JSON.stringify(INITIAL_SEED_SCANS));
      return INITIAL_SEED_SCANS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return INITIAL_SEED_SCANS;
  } catch (err) {
    console.warn('Failed to parse scan history from storage:', err);
    return INITIAL_SEED_SCANS;
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
    score: scanData.score ?? 9.2,
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

  const updatedScans = [newRecord, ...currentScans.filter((s) => s.id !== newRecord.id)].slice(0, 50);

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updatedScans));
  } catch (e) {
    console.warn('Failed to persist scan to storage:', e);
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
