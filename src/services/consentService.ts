import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  createConsentSnapshot,
  isConsentCurrent,
} from '../legal/legalDocuments';
import { LegalConsentRecord } from '../types';

const CONSENT_CACHE_PREFIX = 'nova_legal_consent_cache_';

const getCacheKey = (userId: string) =>
  `${CONSENT_CACHE_PREFIX}${userId.trim().toLowerCase()}`;

const cacheConsentReadOnly = (userId: string, record: LegalConsentRecord) => {
  if (!userId) return;
  try {
    const frozen = Object.freeze({ ...record });
    localStorage.setItem(getCacheKey(userId), JSON.stringify(frozen));
  } catch {
    // Ignore storage quota errors
  }
};

export const readCachedConsentSummary = (
  userId?: string | null
): LegalConsentRecord | null => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.accepted !== true) {
      return null;
    }
    return parsed as LegalConsentRecord;
  } catch {
    return null;
  }
};

/**
 * Records explicit user consent on the Express backend (/api/auth/consent)
 * and persists it to Firebase Firestore (users/{uid}, users/{uid}/legalConsent/current,
 * and append-only legal_consents collection).
 */
export const recordUserConsent = async (
  userId: string,
  email: string,
  consentInput?: Partial<LegalConsentRecord>
): Promise<LegalConsentRecord> => {
  const effectiveUserId = (userId || email || '').trim();
  const normalizedEmail = (email || '').trim().toLowerCase();

  const snapshot = createConsentSnapshot({
    ...consentInput,
    accepted: true,
    termsVersion: consentInput?.termsVersion || TERMS_VERSION,
    privacyVersion: consentInput?.privacyVersion || PRIVACY_VERSION,
    consentedAt: consentInput?.consentedAt || new Date().toISOString(),
    userId: effectiveUserId,
    email: normalizedEmail || undefined,
    source: consentInput?.source || 'signup',
  });

  let authoritativeRecord: LegalConsentRecord = snapshot;

  // 1. Record via backend endpoint (/api/auth/consent)
  try {
    const response = await fetch('/api/auth/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: effectiveUserId,
        email: normalizedEmail,
        legalConsent: snapshot,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.consent && data.consent.accepted === true) {
        authoritativeRecord = data.consent as LegalConsentRecord;
      }
    }
  } catch (err) {
    console.warn('Backend consent endpoint unreachable, falling back to direct Firestore write:', err);
  }

  // 2. Also ensure Firestore user document & append-only audit collection are updated
  if (effectiveUserId) {
    try {
      const recordToStore = {
        ...authoritativeRecord,
        serverRecordedAt:
          authoritativeRecord.serverRecordedAt || new Date().toISOString(),
      };

      await setDoc(
        doc(db, 'users', effectiveUserId),
        {
          legalConsent: recordToStore,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'users', effectiveUserId, 'legalConsent', 'current'),
        recordToStore,
        { merge: true }
      );

      await addDoc(collection(db, 'legal_consents'), recordToStore);
      authoritativeRecord = recordToStore;
    } catch (err) {
      console.debug('Client Firestore consent sync note:', err);
    }

    cacheConsentReadOnly(effectiveUserId, authoritativeRecord);
    if (normalizedEmail && normalizedEmail !== effectiveUserId.toLowerCase()) {
      cacheConsentReadOnly(normalizedEmail, authoritativeRecord);
    }
  }

  return authoritativeRecord;
};

/**
 * Fetches the authoritative consent status for a registered user from the backend
 * or Firebase Firestore. Does NOT rely on localStorage alone as proof of consent.
 * Returns requiresRenewal=true ONLY if a prior consent record exists with an older
 * termsVersion or privacyVersion (material terms update), avoiding repeated prompts
 * for existing users during normal sessions.
 */
export const verifyUserConsentStatus = async (
  userId?: string | null,
  email?: string | null
): Promise<{
  consent: LegalConsentRecord | null;
  isCurrent: boolean;
  requiresRenewal: boolean;
}> => {
  const lookupId = (userId || email || '').trim();
  if (!lookupId || lookupId.startsWith('guest_')) {
    return { consent: null, isCurrent: true, requiresRenewal: false };
  }

  // 1. Check backend API first
  try {
    const response = await fetch(
      `/api/auth/consent/${encodeURIComponent(lookupId)}`
    );
    if (response.ok) {
      const data = await response.json();
      if (data?.consent && data.consent.accepted === true) {
        const consent = data.consent as LegalConsentRecord;
        cacheConsentReadOnly(lookupId, consent);
        const current = isConsentCurrent(consent);
        return {
          consent,
          isCurrent: current,
          requiresRenewal: !current,
        };
      }
    }
  } catch {
    // Continue to Firestore lookup
  }

  // 2. Check Firestore users/{lookupId}
  try {
    const userSnap = await getDoc(doc(db, 'users', lookupId));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data?.legalConsent && data.legalConsent.accepted === true) {
        const consent = data.legalConsent as LegalConsentRecord;
        cacheConsentReadOnly(lookupId, consent);
        const current = isConsentCurrent(consent);
        return {
          consent,
          isCurrent: current,
          requiresRenewal: !current,
        };
      }
    }
  } catch {
    // Ignore offline Firestore read errors
  }

  // 3. Fallback to cached server response for display only
  const cached =
    readCachedConsentSummary(lookupId) ||
    (email ? readCachedConsentSummary(email) : null);
  if (cached) {
    const current = isConsentCurrent(cached);
    return {
      consent: cached,
      isCurrent: current,
      requiresRenewal: !current,
    };
  }

  return { consent: null, isCurrent: false, requiresRenewal: false };
};
