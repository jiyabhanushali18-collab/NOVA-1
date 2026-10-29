import { apiUrl } from './apiClient';

export interface AddressSuggestion {
  id: string;
  title: string;
  subtitle: string;
  formattedAddress: string;
  flatNo?: string;
  street?: string;
  area?: string;
  city: string;
  state: string;
  country: string;
  pinCode?: string;
}

const cache = new Map<string, AddressSuggestion[]>();
let activeController: AbortController | null = null;

/**
 * Fetch smart address suggestions for Indian & Mumbai localities.
 */
export async function fetchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const clean = query.trim();
  if (clean.length < 2) {
    return [];
  }

  const cacheKey = clean.toLowerCase();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Cancel prior in-flight lookup to prevent race conditions
  if (activeController) {
    activeController.abort();
  }
  activeController = new AbortController();

  try {
    const res = await fetch(apiUrl(`/api/address/autocomplete?q=${encodeURIComponent(clean)}`), {
      signal: activeController.signal
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const suggestions: AddressSuggestion[] = data?.suggestions || [];
    cache.set(cacheKey, suggestions);
    return suggestions;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return [];
    }
    console.warn('[Address Autocomplete] Lookup notice:', err);
    return [];
  }
}

/**
 * Verify Indian 6-digit postal PIN code and resolve city/state.
 */
export async function verifyPincode(pincode: string): Promise<{
  valid: boolean;
  city?: string;
  state?: string;
  area?: string;
}> {
  const clean = pincode.replace(/\D/g, '').slice(0, 6);
  if (clean.length !== 6) {
    return { valid: false };
  }

  try {
    const res = await fetch(apiUrl(`/api/address/verify-pincode/${encodeURIComponent(clean)}`));
    if (!res.ok) {
      return { valid: /^\d{6}$/.test(clean) };
    }
    const data = await res.json();
    return {
      valid: Boolean(data.valid),
      city: data.city,
      state: data.state,
      area: data.area
    };
  } catch {
    return { valid: /^\d{6}$/.test(clean) };
  }
}
