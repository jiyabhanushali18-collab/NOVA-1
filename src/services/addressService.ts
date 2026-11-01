import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { CartItem, DeliveryAddress, OrderRecord } from '../types';
import { apiUrl } from './apiClient';

const USER_ADDRESS_KEY_PREFIX = 'nova_user_address:';
const SAVED_ADDRESSES_KEY_PREFIX = 'nova_saved_addresses:';
const USER_ORDERS_KEY_PREFIX = 'nova_orders:';
const SESSION_TOKEN_KEY_PREFIX = 'nova_session_token:';

export interface UserIdentityContext {
  uid: string;
  email?: string;
  name?: string;
  phone?: string;
  isGuest?: boolean;
  fallbackAddress?: string;
  fallbackPinCode?: string;
}

export const isGuestIdentity = (uid?: string, isGuest?: boolean): boolean => {
  if (isGuest) return true;
  if (!uid || !uid.trim()) return true;
  const clean = uid.trim().toLowerCase();
  return clean === 'guest' || clean.startsWith('guest_') || clean.endsWith('@guest.nova.ai');
};

export const formatDeliveryAddress = (addr: Partial<DeliveryAddress> | null | undefined): string => {
  if (!addr) return '';
  return [addr.flatNo, addr.landmark, addr.city, addr.state]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ');
};

export const parseAddressToDeliveryAddress = (params: {
  rawAddress?: string;
  pinCode?: string;
  fullName?: string;
  phone?: string;
  label?: string;
  existing?: Partial<DeliveryAddress> | null;
}): DeliveryAddress | null => {
  const rawAddress = typeof params.rawAddress === 'string' ? params.rawAddress.trim() : '';
  const pinCode = typeof params.pinCode === 'string' && params.pinCode.trim()
    ? params.pinCode.trim()
    : (params.existing?.pinCode || '').trim();
  const fullName = typeof params.fullName === 'string' && params.fullName.trim()
    ? params.fullName.trim()
    : (params.existing?.fullName || '').trim();
  const phone = typeof params.phone === 'string' && params.phone.trim()
    ? params.phone.trim()
    : (params.existing?.phone || '').trim();

  if (!rawAddress && !pinCode && !params.existing?.flatNo?.trim()) {
    return null;
  }

  let flatNo = (params.existing?.flatNo || '').trim();
  let landmark = (params.existing?.landmark || '').trim();
  let city = (params.existing?.city || '').trim();
  const state = (params.existing?.state || '').trim();

  if (rawAddress) {
    const parts = rawAddress
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 4) {
      flatNo = parts.slice(0, -2).join(', ');
      landmark = parts[parts.length - 2];
      city = parts[parts.length - 1];
    } else if (parts.length === 3) {
      flatNo = parts[0];
      landmark = parts[1];
      city = parts[2];
    } else if (parts.length === 2) {
      flatNo = parts[0];
      landmark = '';
      city = parts[1];
    } else if (parts.length === 1) {
      flatNo = parts[0];
    }
  }

  const label = (params.label || params.existing?.label || 'Home').trim();
  const result: DeliveryAddress = {
    id: params.existing?.id || `addr_${label.toLowerCase().replace(/\s+/g, '_')}_default`,
    label,
    fullName,
    phone,
    flatNo,
    landmark,
    city,
    state,
    pinCode,
    country: params.existing?.country || 'India',
    isDefault: params.existing?.isDefault ?? true,
    updatedAt: new Date().toISOString()
  };
  result.formattedAddress = formatDeliveryAddress(result);
  return result;
};

export const validateDeliveryAddress = (
  addr: Partial<DeliveryAddress> | null | undefined
): { valid: boolean; error?: string } => {
  if (!addr) {
    return { valid: false, error: 'Please enter your delivery address details.' };
  }

  const fullName = (addr.fullName || '').trim();
  if (!fullName) {
    return { valid: false, error: 'Please enter the recipient full name.' };
  }

  const phoneDigits = (addr.phone || '').replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    return { valid: false, error: 'Please enter a valid 10-digit phone number for delivery.' };
  }

  const flatNo = (addr.flatNo || '').trim();
  if (!flatNo) {
    return { valid: false, error: 'Please enter your Flat No., Building, or Street Address.' };
  }

  const city = (addr.city || '').trim();
  if (!city) {
    return { valid: false, error: 'Please enter your City / State.' };
  }

  const pinCode = (addr.pinCode || '').trim();
  if (!/^\d{6}$/.test(pinCode)) {
    return { valid: false, error: 'Please enter a valid 6-digit PIN code.' };
  }

  return { valid: true };
};

export const deduplicateAddresses = (
  existingList: DeliveryAddress[],
  incoming: DeliveryAddress
): DeliveryAddress[] => {
  const cleanLabel = (incoming.label || 'Home').trim();
  const targetId = incoming.id || `addr_${Date.now()}`;

  const normalizedIncoming: DeliveryAddress = {
    ...incoming,
    id: targetId,
    label: cleanLabel,
    fullName: incoming.fullName.trim(),
    phone: incoming.phone.trim(),
    flatNo: incoming.flatNo.trim(),
    landmark: (incoming.landmark || '').trim(),
    city: incoming.city.trim(),
    state: (incoming.state || '').trim(),
    pinCode: incoming.pinCode.trim(),
    country: (incoming.country || 'India').trim(),
    formattedAddress: formatDeliveryAddress(incoming),
    isDefault: incoming.isDefault ?? existingList.length === 0,
    updatedAt: new Date().toISOString()
  };

  const remaining = (existingList || []).filter((item) => {
    if (!item || !item.flatNo) return false;
    if (item.id && item.id === targetId) return false;
    return true;
  });

  return [normalizedIncoming, ...remaining];
};

export const saveSessionToken = (uid: string, token?: string) => {
  if (!uid || !token) return;
  try {
    localStorage.setItem(`${SESSION_TOKEN_KEY_PREFIX}${uid}`, token);
  } catch {}
};

export const getSessionToken = (uid?: string): string | null => {
  if (!uid) return null;
  try {
    return localStorage.getItem(`${SESSION_TOKEN_KEY_PREFIX}${uid}`);
  } catch {
    return null;
  }
};

export const readCachedUserAddress = (uid?: string): {
  primaryAddress: DeliveryAddress | null;
  savedAddresses: DeliveryAddress[];
} => {
  if (!uid || isGuestIdentity(uid)) {
    return { primaryAddress: null, savedAddresses: [] };
  }
  try {
    const rawPrimary = localStorage.getItem(`${USER_ADDRESS_KEY_PREFIX}${uid}`);
    const rawList = localStorage.getItem(`${SAVED_ADDRESSES_KEY_PREFIX}${uid}`);
    const primaryAddress = rawPrimary ? (JSON.parse(rawPrimary) as DeliveryAddress) : null;
    const savedAddresses = rawList ? (JSON.parse(rawList) as DeliveryAddress[]) : (primaryAddress ? [primaryAddress] : []);
    return {
      primaryAddress,
      savedAddresses: Array.isArray(savedAddresses) ? savedAddresses : []
    };
  } catch {
    return { primaryAddress: null, savedAddresses: [] };
  }
};

export const writeCachedUserAddress = (
  uid: string,
  primaryAddress: DeliveryAddress | null,
  savedAddresses?: DeliveryAddress[]
) => {
  if (!uid || isGuestIdentity(uid)) return;
  try {
    if (primaryAddress) {
      const deduped = deduplicateAddresses(savedAddresses || [], primaryAddress);
      localStorage.setItem(`${USER_ADDRESS_KEY_PREFIX}${uid}`, JSON.stringify(primaryAddress));
      localStorage.setItem(`${SAVED_ADDRESSES_KEY_PREFIX}${uid}`, JSON.stringify(deduped));
    } else if (savedAddresses) {
      localStorage.setItem(`${SAVED_ADDRESSES_KEY_PREFIX}${uid}`, JSON.stringify(savedAddresses));
      if (savedAddresses[0]) {
        localStorage.setItem(`${USER_ADDRESS_KEY_PREFIX}${uid}`, JSON.stringify(savedAddresses[0]));
      } else {
        localStorage.removeItem(`${USER_ADDRESS_KEY_PREFIX}${uid}`);
      }
    }
  } catch {}
};

const syncRegisteredUsersLocalRecord = (
  uid: string,
  email: string | undefined,
  address: DeliveryAddress
) => {
  try {
    const raw = localStorage.getItem('nova_registered_users');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const cleanEmail = (email || '').trim().toLowerCase();
    const updated = parsed.map((entry: any) => {
      if (!entry) return entry;
      const matchesUid = entry.uid === uid;
      const matchesEmail = cleanEmail && String(entry.email || '').trim().toLowerCase() === cleanEmail;
      if (!matchesUid && !matchesEmail) return entry;
      return {
        ...entry,
        name: address.fullName || entry.name,
        phone: address.phone || entry.phone,
        address: address.formattedAddress || formatDeliveryAddress(address),
        pinCode: address.pinCode,
        deliveryAddress: address
      };
    });
    localStorage.setItem('nova_registered_users', JSON.stringify(updated));
  } catch {}
};

export const ensureUserSessionToken = async (user: UserIdentityContext): Promise<string | null> => {
  if (isGuestIdentity(user.uid, user.isGuest)) return null;

  const existing = getSessionToken(user.uid);
  if (existing) return existing;

  try {
    const response = await fetch(apiUrl('/api/auth/session'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: user.name,
        phone: user.phone,
        address: user.fallbackAddress,
        pinCode: user.fallbackPinCode
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.sessionToken) {
        saveSessionToken(user.uid, data.sessionToken);
        if (data.deliveryAddress) {
          writeCachedUserAddress(user.uid, data.deliveryAddress, data.savedAddresses);
        }
        return data.sessionToken as string;
      }
    }
  } catch {
    // Fallback if offline
  }

  if (auth.currentUser && auth.currentUser.uid === user.uid) {
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }

  return null;
};

export const fetchUserDeliveryAddress = async (
  user: UserIdentityContext
): Promise<{ primaryAddress: DeliveryAddress | null; savedAddresses: DeliveryAddress[] }> => {
  if (isGuestIdentity(user.uid, user.isGuest)) {
    return { primaryAddress: null, savedAddresses: [] };
  }

  const cached = readCachedUserAddress(user.uid);

  // 1. Try authenticated backend endpoint (/api/auth/address)
  try {
    const token = await ensureUserSessionToken(user);
    if (token) {
      const response = await fetch(
        apiUrl(`/api/auth/address?userId=${encodeURIComponent(user.uid)}`),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data?.deliveryAddress) {
          const primary: DeliveryAddress = {
            ...data.deliveryAddress,
            fullName: data.deliveryAddress.fullName || user.name || '',
            phone: data.deliveryAddress.phone || user.phone || ''
          };
          const list: DeliveryAddress[] = Array.isArray(data.savedAddresses) && data.savedAddresses.length > 0
            ? data.savedAddresses
            : [primary];
          writeCachedUserAddress(user.uid, primary, list);
          return { primaryAddress: primary, savedAddresses: list };
        }
      }
    }
  } catch {
    // Continue to Firestore / local user-scoped fallback
  }

  // 2. Try Firestore users/{uid}
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (userSnap.exists()) {
      const data = userSnap.data() as Record<string, any>;
      const storedDelivery = data?.deliveryAddress as DeliveryAddress | undefined;
      if (storedDelivery && (storedDelivery.flatNo || storedDelivery.pinCode)) {
        const normalized: DeliveryAddress = {
          ...storedDelivery,
          fullName: storedDelivery.fullName || data.name || user.name || '',
          phone: storedDelivery.phone || data.phone || data.phoneNumber || user.phone || '',
          formattedAddress: storedDelivery.formattedAddress || formatDeliveryAddress(storedDelivery)
        };
        const list = Array.isArray(data.savedAddresses) && data.savedAddresses.length > 0
          ? (data.savedAddresses as DeliveryAddress[])
          : deduplicateAddresses(cached.savedAddresses, normalized);
        writeCachedUserAddress(user.uid, normalized, list);
        return { primaryAddress: normalized, savedAddresses: list };
      }

      if (typeof data?.address === 'string' && data.address.trim()) {
        const parsed = parseAddressToDeliveryAddress({
          rawAddress: data.address,
          pinCode: typeof data.pinCode === 'string' ? data.pinCode : user.fallbackPinCode,
          fullName: data.name || user.name || '',
          phone: data.phone || data.phoneNumber || user.phone || ''
        });
        if (parsed) {
          const list = deduplicateAddresses(cached.savedAddresses, parsed);
          writeCachedUserAddress(user.uid, parsed, list);
          return { primaryAddress: parsed, savedAddresses: list };
        }
      }
    }
  } catch {
    // Continue to user-scoped local cache
  }

  // 3. Check user-scoped cache (nova_user_address:<uid>)
  if (cached.primaryAddress && (cached.primaryAddress.flatNo || cached.primaryAddress.pinCode)) {
    const enriched: DeliveryAddress = {
      ...cached.primaryAddress,
      fullName: cached.primaryAddress.fullName || user.name || '',
      phone: cached.primaryAddress.phone || user.phone || ''
    };
    return {
      primaryAddress: enriched,
      savedAddresses: cached.savedAddresses.length > 0 ? cached.savedAddresses : [enriched]
    };
  }

  // 4. Check nova_registered_users for this specific user uid / email
  try {
    const rawUsers = localStorage.getItem('nova_registered_users');
    if (rawUsers) {
      const parsedUsers = JSON.parse(rawUsers);
      if (Array.isArray(parsedUsers)) {
        const cleanEmail = (user.email || '').trim().toLowerCase();
        const matched = parsedUsers.find(
          (u: any) =>
            u &&
            u.accountType !== 'Guest' &&
            (u.uid === user.uid || (cleanEmail && String(u.email || '').trim().toLowerCase() === cleanEmail))
        );
        if (matched?.deliveryAddress && (matched.deliveryAddress.flatNo || matched.deliveryAddress.pinCode)) {
          const addr = matched.deliveryAddress as DeliveryAddress;
          writeCachedUserAddress(user.uid, addr, [addr]);
          return { primaryAddress: addr, savedAddresses: [addr] };
        }
        if (matched && (matched.address || matched.pinCode)) {
          const parsed = parseAddressToDeliveryAddress({
            rawAddress: matched.address,
            pinCode: matched.pinCode,
            fullName: matched.name || user.name || '',
            phone: matched.phone || user.phone || ''
          });
          if (parsed) {
            writeCachedUserAddress(user.uid, parsed, [parsed]);
            return { primaryAddress: parsed, savedAddresses: [parsed] };
          }
        }
      }
    }
  } catch {}

  // 5. Check explicit fallbackAddress / fallbackPinCode passed from active signup/login state for this user
  if (user.fallbackAddress?.trim() || user.fallbackPinCode?.trim()) {
    const parsed = parseAddressToDeliveryAddress({
      rawAddress: user.fallbackAddress,
      pinCode: user.fallbackPinCode,
      fullName: user.name || '',
      phone: user.phone || ''
    });
    if (parsed) {
      writeCachedUserAddress(user.uid, parsed, [parsed]);
      return { primaryAddress: parsed, savedAddresses: [parsed] };
    }
  }

  return { primaryAddress: null, savedAddresses: [] };
};

export const saveUserDeliveryAddress = async (
  user: UserIdentityContext,
  address: DeliveryAddress,
  existingSavedList?: DeliveryAddress[]
): Promise<{ primaryAddress: DeliveryAddress; savedAddresses: DeliveryAddress[] }> => {
  if (isGuestIdentity(user.uid, user.isGuest)) {
    throw new Error('Guest users cannot save a persistent account address.');
  }

  const validation = validateDeliveryAddress(address);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid delivery address.');
  }

  const cached = readCachedUserAddress(user.uid);
  const baseList = existingSavedList?.length ? existingSavedList : cached.savedAddresses;
  const normalized: DeliveryAddress = {
    ...address,
    id: address.id || `addr_${Date.now()}`,
    label: (address.label || 'Home').trim(),
    fullName: address.fullName.trim(),
    phone: address.phone.trim(),
    flatNo: address.flatNo.trim(),
    landmark: (address.landmark || '').trim(),
    city: address.city.trim(),
    state: (address.state || '').trim(),
    pinCode: address.pinCode.trim(),
    country: (address.country || 'India').trim(),
    isDefault: address.isDefault ?? baseList.length === 0,
    updatedAt: new Date().toISOString()
  };
  normalized.formattedAddress = formatDeliveryAddress(normalized);
  const savedAddresses = deduplicateAddresses(baseList, normalized);

  // Save to per-user local cache & nova_registered_users
  writeCachedUserAddress(user.uid, normalized, savedAddresses);
  syncRegisteredUsersLocalRecord(user.uid, user.email, normalized);

  // Sync to backend API with server-side auth token verification
  try {
    const token = await ensureUserSessionToken(user);
    if (token) {
      const response = await fetch(apiUrl('/api/auth/address'), {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.uid,
          deliveryAddress: normalized,
          savedAddresses
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.deliveryAddress) {
          const serverPrimary = data.deliveryAddress as DeliveryAddress;
          const serverList = Array.isArray(data.savedAddresses) ? (data.savedAddresses as DeliveryAddress[]) : savedAddresses;
          writeCachedUserAddress(user.uid, serverPrimary, serverList);
        }
      }
    }
  } catch {
    // Continue to client Firestore sync
  }

  // Sync to client Firestore users/{uid} and users/{uid}/profile/meta
  try {
    const firestorePayload = {
      uid: user.uid,
      name: normalized.fullName,
      phone: normalized.phone,
      address: normalized.formattedAddress,
      pinCode: normalized.pinCode,
      deliveryAddress: normalized,
      savedAddresses,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', user.uid), firestorePayload, { merge: true });
    await setDoc(doc(db, 'users', user.uid, 'profile', 'meta'), firestorePayload, { merge: true });
  } catch {
    // Non-fatal if client Firestore is offline
  }

  return { primaryAddress: normalized, savedAddresses };
};

export const createOrderSnapshot = async (params: {
  user: UserIdentityContext;
  items: CartItem[];
  subtotal: number;
  taxes: number;
  discount: number;
  shipping: number;
  grandTotal: number;
  paymentMethod: 'upi' | 'card' | 'cod';
  deliveryAddress: DeliveryAddress;
}): Promise<OrderRecord> => {
  const validation = validateDeliveryAddress(params.deliveryAddress);
  if (!validation.valid) {
    throw new Error(validation.error || 'Cannot place order with incomplete delivery address.');
  }

  // Deep-clone deliveryAddress and items so later profile address edits never alter past orders
  const frozenAddress: DeliveryAddress = JSON.parse(
    JSON.stringify({
      id: params.deliveryAddress.id || `order_addr_${Date.now()}`,
      label: (params.deliveryAddress.label || 'Home').trim(),
      fullName: params.deliveryAddress.fullName.trim(),
      phone: params.deliveryAddress.phone.trim(),
      flatNo: params.deliveryAddress.flatNo.trim(),
      landmark: (params.deliveryAddress.landmark || '').trim(),
      city: params.deliveryAddress.city.trim(),
      state: (params.deliveryAddress.state || '').trim(),
      pinCode: params.deliveryAddress.pinCode.trim(),
      country: (params.deliveryAddress.country || 'India').trim(),
      formattedAddress: formatDeliveryAddress(params.deliveryAddress),
      updatedAt: new Date().toISOString()
    })
  );

  const frozenItems: CartItem[] = JSON.parse(JSON.stringify(params.items || []));
  const effectiveUserId = params.user.uid || 'guest';
  const isGuest = isGuestIdentity(params.user.uid, params.user.isGuest);

  const computedSubtotal = frozenItems.reduce((acc, curr) => {
    const p = curr.product as any;
    const rawPrice = p?.price ?? p?.discountPrice ?? p?.originalPrice ?? (curr as any).price ?? 0;
    const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[^\d.]/g, '')) : Number(rawPrice);
    const qty = Number(curr.quantity || 1);
    return acc + (isNaN(price) ? 0 : price) * (isNaN(qty) ? 1 : qty);
  }, 0);

  const effectiveSubtotal = params.subtotal > 0 ? params.subtotal : computedSubtotal;
  const effectiveTaxes = params.taxes > 0 ? params.taxes : Math.round(effectiveSubtotal * 0.05);
  const effectiveDiscount = params.discount || 0;
  const effectiveShipping = params.shipping > 0 ? params.shipping : (effectiveSubtotal > 999 || effectiveSubtotal === 0 ? 0 : 99);
  const effectiveGrandTotal = params.grandTotal > 0
    ? params.grandTotal
    : Math.max(0, effectiveSubtotal + effectiveTaxes + effectiveShipping - effectiveDiscount);

  const order: OrderRecord = {
    orderId: `#NV-${1000 + Math.floor(Math.random() * 9000)}`,
    userId: effectiveUserId,
    isGuest,
    items: frozenItems,
    subtotal: effectiveSubtotal,
    taxes: effectiveTaxes,
    discount: effectiveDiscount,
    shipping: effectiveShipping,
    grandTotal: effectiveGrandTotal,
    paymentMethod: params.paymentMethod,
    deliveryAddress: frozenAddress,
    createdAt: new Date().toISOString()
  };

  const cleanOrderDocId = order.orderId.replace(/[^a-zA-Z0-9_-]/g, '') || `NV-${Date.now()}`;
  const customerName = frozenAddress.fullName || params.user.name || 'Customer';
  const customerInitials = customerName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('') || 'C';

  const flattenedItems = frozenItems.map((item) => {
    const prod = (item.product || {}) as any;
    const rawPrice = prod?.price ?? prod?.discountPrice ?? prod?.originalPrice ?? (item as any).price ?? 0;
    const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[^\d.]/g, '')) : Number(rawPrice);
    const qty = Number(item.quantity ?? 1);
    return {
      productId: String(prod.id || prod.productId || (item as any).productId || ''),
      productName: String(prod.name || (item as any).productName || 'Fashion Item'),
      imageUrl: String(prod.imageUrl || prod.images?.[0] || (item as any).imageUrl || ''),
      category: String(prod.category || (item as any).category || 'Apparel'),
      vendorId: String(prod.vendorId || (item as any).vendorId || 'VEN001'),
      vendorName: String(prod.vendorName || (item as any).vendorName || 'Trendy Threads'),
      price: isNaN(price) ? 0 : price,
      quantity: isNaN(qty) ? 1 : qty,
      amount: (isNaN(price) ? 0 : price) * (isNaN(qty) ? 1 : qty),
      status: 'Pending',
      color: String(item.color || ''),
      size: String(item.size || 'M')
    };
  });

  const primaryItem: any = flattenedItems[0] || {};
  const totalQuantity = flattenedItems.reduce((sum, it) => sum + (it.quantity || 1), 0) || (flattenedItems.length > 0 ? 1 : 0);
  let vendorIds = Array.from(new Set(flattenedItems.map((it) => it.vendorId).filter(Boolean)));
  if (vendorIds.length === 0) vendorIds = ['VEN001'];

  const dateFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const rootOrderPayload = {
    id: order.orderId,
    orderId: order.orderId,
    userId: effectiveUserId,
    customerName,
    customerInitials,
    customerAvatar: '',
    productName: primaryItem.productName || 'Fashion Item',
    productId: primaryItem.productId || '',
    quantity: totalQuantity,
    amount: effectiveGrandTotal,
    subtotal: effectiveSubtotal,
    taxes: effectiveTaxes,
    discount: effectiveDiscount,
    shipping: effectiveShipping,
    grandTotal: effectiveGrandTotal,
    paymentMethod: params.paymentMethod,
    date: dateFormatted,
    status: 'Pending',
    salesEligible: true,
    vendorId: primaryItem.vendorId || 'VEN001',
    vendorName: primaryItem.vendorName || 'Trendy Threads',
    vendorIds,
    deliveryAddress: frozenAddress,
    items: flattenedItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Persist to per-user local orders history
  try {
    const key = `${USER_ORDERS_KEY_PREFIX}${effectiveUserId}`;
    const existingRaw = localStorage.getItem(key);
    const existingOrders: OrderRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updatedOrders = [order, ...(Array.isArray(existingOrders) ? existingOrders : [])];
    localStorage.setItem(key, JSON.stringify(updatedOrders));
  } catch {}

  // 1. Direct Firestore root orders collection write
  try {
    await setDoc(doc(db, 'orders', cleanOrderDocId), rootOrderPayload);
  } catch (err) {
    console.warn('[Orders] Direct client root orders write warning:', err);
  }

  // 2. Direct Firestore user orders subcollection write
  if (!isGuest) {
    try {
      await setDoc(
        doc(db, 'users', effectiveUserId, 'orders', cleanOrderDocId),
        order
      );
    } catch {}
  }

  // 3. Authoritative backend write via Admin SDK
  try {
    const token = await ensureUserSessionToken(params.user);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    await fetch(apiUrl('/api/auth/orders'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: effectiveUserId,
        order,
        rootOrderPayload
      })
    });
  } catch (err) {
    console.warn('[Orders] Backend order dispatch warning:', err);
  }

  return order;
};

export const getUserOrders = (uid?: string): OrderRecord[] => {
  const effectiveUserId = uid || 'guest';
  try {
    const raw = localStorage.getItem(`${USER_ORDERS_KEY_PREFIX}${effectiveUserId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OrderRecord[]) : [];
  } catch {
    return [];
  }
};
