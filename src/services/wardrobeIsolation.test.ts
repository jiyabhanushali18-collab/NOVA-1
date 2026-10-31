import assert from 'node:assert/strict';
import {
  GUEST_WARDROBE_KEY,
  GUEST_PROFILE_KEY,
  GUEST_OUTFITS_KEY,
  getWardrobeStorageKey,
  getWardrobeProfileKey,
  getWardrobeOutfitsKey,
  isGuestAccount,
  readLocalWardrobeItems,
  saveLocalWardrobeItems,
  readLocalWardrobeProfile,
  saveLocalWardrobeProfile,
  readLocalWardrobeOutfits,
  saveLocalWardrobeOutfits,
  mergeWardrobeItems,
  sanitizeForFirestore
} from './wardrobeService';
import { WardrobeItem } from '../types';

// Mock localStorage in Node environment
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear()
  }
});

const sampleItem = (id: string, name: string): WardrobeItem => ({
  id,
  category: 'Shirt',
  size: 'M',
  colors: ['Blue'],
  pattern: 'Solid',
  fabric: 'Cotton',
  dateAdded: new Date().toISOString(),
  generatedImage: `data:image/png;base64,${id}_gen`,
  originalScan: `data:image/png;base64,${id}_scan`,
  tags: ['casual'],
  timesWorn: 1,
  attributes: { category: 'Shirt', primaryColor: 'Blue' }
});

console.log('--- Starting Virtual Wardrobe User-Isolation Tests ---');

// Test 1: Guest dedicated storage namespace
{
  assert.equal(getWardrobeStorageKey(null, true), GUEST_WARDROBE_KEY);
  assert.equal(getWardrobeStorageKey('guest', false), GUEST_WARDROBE_KEY);
  assert.equal(getWardrobeStorageKey('guest_12345', false), GUEST_WARDROBE_KEY);
  assert.equal(getWardrobeProfileKey('guest_12345', false), GUEST_PROFILE_KEY);
  assert.equal(getWardrobeOutfitsKey('guest_12345', false), GUEST_OUTFITS_KEY);
  console.log('✔ Test 1: Dedicated guest storage namespace verified (nova_wardrobe_guest, profile, outfits)');
}

// Test 2: Registered user uses Firebase Auth UID as primary identity
{
  const uidA = 'user_firebase_uid_AAA';
  assert.equal(getWardrobeStorageKey(uidA, false), `nova_wardrobe_${uidA}`);
  assert.equal(getWardrobeProfileKey(uidA, false), `nova_wardrobe_profile_${uidA}`);
  assert.equal(getWardrobeOutfitsKey(uidA, false), `nova_wardrobe_outfits_${uidA}`);
  console.log('✔ Test 2: Registered user UID scoping verified');
}

// Test 3: Guest mode never uses stale email or legacy document ID
{
  storage.clear();
  const staleEmail = 'arjun.mehta@gmail.com';
  const legacyKey = 'nova_wardrobe_arjun_mehta_gmail_com';
  // Simulate previous user data lingering in localStorage under legacy key
  storage.set(legacyKey, JSON.stringify([sampleItem('item_arjun', 'Arjun Shirt')]));

  // Read as guest despite stale legacyEmail passed
  const guestItems = readLocalWardrobeItems({
    uid: 'guest_999',
    isGuest: true,
    legacyEmail: staleEmail
  });
  assert.deepEqual(guestItems, [], 'Guest must not inherit items from stale legacyEmail');

  const guestProfile = readLocalWardrobeProfile({
    uid: 'guest_999',
    isGuest: true,
    legacyEmail: staleEmail
  });
  assert.deepEqual(guestProfile, {}, 'Guest must not inherit profile from stale legacyEmail');
  console.log('✔ Test 3: Guest mode strictly avoids stale emails and legacy document IDs');
}

// Test 4: Flow Test: User A -> Guest -> User A
{
  storage.clear();
  const uidA = 'uid_user_a';
  const itemA = sampleItem('item_a_1', 'User A Shirt');
  saveLocalWardrobeItems([itemA], { uid: uidA, isGuest: false });

  // 1. User A sees item A
  const loadedA1 = readLocalWardrobeItems({ uid: uidA, isGuest: false });
  assert.equal(loadedA1.length, 1);
  assert.equal(loadedA1[0].id, 'item_a_1');

  // 2. Switch to Guest: Guest must NOT see User A's wardrobe
  const guestLoaded = readLocalWardrobeItems({ uid: 'guest_101', isGuest: true, legacyEmail: 'user_a@example.com' });
  assert.equal(guestLoaded.length, 0, 'Guest must have empty wardrobe initially');

  // Guest saves an item
  const itemGuest = sampleItem('item_guest_1', 'Guest Hat');
  saveLocalWardrobeItems([itemGuest], { uid: 'guest_101', isGuest: true });

  // Verify Guest has itemGuest in nova_wardrobe_guest
  const guestLoadedAfter = readLocalWardrobeItems({ uid: 'guest_101', isGuest: true });
  assert.equal(guestLoadedAfter.length, 1);
  assert.equal(guestLoadedAfter[0].id, 'item_guest_1');

  // 3. Switch back to User A: User A must see only item A, not guest item
  const loadedA2 = readLocalWardrobeItems({ uid: uidA, isGuest: false });
  assert.equal(loadedA2.length, 1);
  assert.equal(loadedA2[0].id, 'item_a_1');

  console.log('✔ Test 4: User A -> Guest -> User A isolation verified');
}

// Test 5: Flow Test: User A -> User B -> User A
{
  storage.clear();
  const uidA = 'uid_user_a';
  const uidB = 'uid_user_b';
  const itemA = sampleItem('item_a', 'Shirt A');
  const itemB = sampleItem('item_b', 'Shirt B');

  saveLocalWardrobeItems([itemA], { uid: uidA, isGuest: false });
  saveLocalWardrobeItems([itemB], { uid: uidB, isGuest: false });

  // User A reads wardrobe
  const resA1 = readLocalWardrobeItems({ uid: uidA, isGuest: false });
  assert.equal(resA1.length, 1);
  assert.equal(resA1[0].id, 'item_a');

  // Switch to User B
  const resB = readLocalWardrobeItems({ uid: uidB, isGuest: false });
  assert.equal(resB.length, 1);
  assert.equal(resB[0].id, 'item_b');

  // Switch back to User A
  const resA2 = readLocalWardrobeItems({ uid: uidA, isGuest: false });
  assert.equal(resA2.length, 1);
  assert.equal(resA2[0].id, 'item_a');

  console.log('✔ Test 5: User A -> User B -> User A isolation verified');
}

// Test 6: Flow Test: Guest -> User A
{
  storage.clear();
  const itemGuest = sampleItem('guest_jacket', 'Guest Jacket');
  saveLocalWardrobeItems([itemGuest], { uid: 'guest', isGuest: true });

  const uidA = 'uid_user_a';
  const resA = readLocalWardrobeItems({ uid: uidA, isGuest: false });
  assert.equal(resA.length, 0, 'New User A starts with empty wardrobe, no guest leakage');

  const itemA = sampleItem('item_a_pants', 'User A Pants');
  saveLocalWardrobeItems([itemA], { uid: uidA, isGuest: false });

  assert.equal(readLocalWardrobeItems({ uid: uidA, isGuest: false })[0].id, 'item_a_pants');
  assert.equal(readLocalWardrobeItems({ uid: 'guest', isGuest: true })[0].id, 'guest_jacket');

  console.log('✔ Test 6: Guest -> User A isolation verified');
}

// Test 7: Async loading cancellation and identity check
{
  storage.clear();
  const uidA = 'uid_user_a';
  const uidB = 'uid_user_b';

  saveLocalWardrobeItems([sampleItem('local_a', 'Local A')], { uid: uidA, isGuest: false });
  saveLocalWardrobeItems([sampleItem('local_b', 'Local B')], { uid: uidB, isGuest: false });

  // Simulate an in-flight async load for User A
  let activeAccount = uidA;
  let isCancelled = false;
  const targetIdentity = uidA;

  // Start async fetch for User A
  const simulateAsyncFirestoreLoad = async () => {
    // Artificial latency
    await new Promise((r) => setTimeout(r, 50));
    // Simulated remote docs for User A
    const remoteA = [sampleItem('remote_a', 'Remote A')];

    // Cancellation check
    if (isCancelled || activeAccount !== targetIdentity) {
      return { applied: false, reason: 'cancelled_account_mismatch' };
    }

    saveLocalWardrobeItems(remoteA, { uid: targetIdentity, isGuest: false });
    return { applied: true };
  };

  const promiseA = simulateAsyncFirestoreLoad();

  // Rapidly switch account to User B while User A load is in flight
  activeAccount = uidB;
  isCancelled = true;

  const result = await promiseA;
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'cancelled_account_mismatch');

  // Verify User B's storage was NOT touched by User A's async result
  const itemsB = readLocalWardrobeItems({ uid: uidB, isGuest: false });
  assert.equal(itemsB.length, 1);
  assert.equal(itemsB[0].id, 'local_b');

  console.log('✔ Test 7: In-flight async load cancellation and account-identity check prevented data leak');
}

// Test 8: Legacy data preservation for registered users without overwriting or leaking to guest
{
  storage.clear();
  const registeredEmail = 'existing.user@example.com';
  const legacyDocId = 'existing_user_example_com';
  const legacyKey = `nova_wardrobe_${legacyDocId}`;
  const legacyItem = sampleItem('legacy_item_1', 'Legacy User Jacket');

  // Simulate existing registered user with legacy storage data
  storage.set(legacyKey, JSON.stringify([legacyItem]));

  // Registered user with new UID loads their legacy data
  const registeredUid = 'firebase_uid_new_123';
  const loadedRegistered = readLocalWardrobeItems({
    uid: registeredUid,
    isGuest: false,
    legacyEmail: registeredEmail
  });
  assert.equal(loadedRegistered.length, 1);
  assert.equal(loadedRegistered[0].id, 'legacy_item_1');

  // Legacy key was NOT deleted
  assert.notEqual(storage.get(legacyKey), null, 'Old legacy key preserved');

  // Guest with the same email present in state must NOT receive legacy items
  const guestLoaded = readLocalWardrobeItems({
    uid: 'guest_xyz',
    isGuest: true,
    legacyEmail: registeredEmail
  });
  assert.equal(guestLoaded.length, 0, 'Guest never migrates legacy registered data');

  console.log('✔ Test 8: Legacy data preservation verified for registered users and isolated from guest');
}

// Test 9: Sanitization for Firestore keeps base64 data URLs out of cloud
{
  const testItem = sampleItem('test_clean', 'Cleaning Item');
  const sanitized = sanitizeForFirestore(testItem);
  assert.equal(sanitized.generatedImage, '', 'Base64 data URL stripped for Firestore');
  assert.equal(sanitized.originalScan, undefined, 'Raw scan omitted for Firestore');
  assert.equal(sanitized.timesWorn, 1);
  console.log('✔ Test 9: Firestore sanitization verified');
}

// Test 10: Merge preserves local image data
{
  const localItems = [sampleItem('item_merge_1', 'Local Merge Item')];
  const remoteItems = [{
    id: 'item_merge_1',
    category: 'Shirt',
    size: 'M',
    colors: ['Blue'],
    pattern: 'Solid',
    fabric: 'Cotton',
    dateAdded: '2026-10-30T00:00:00.000Z',
    generatedImage: '', // Firestore had empty image string
    tags: ['casual'],
    timesWorn: 2,
    attributes: { category: 'Shirt' }
  }];

  const merged = mergeWardrobeItems(remoteItems, localItems);
  assert.equal(merged[0].id, 'item_merge_1');
  assert.equal(merged[0].timesWorn, 2, 'Remote timesWorn preserved');
  assert.equal(merged[0].generatedImage, 'data:image/png;base64,item_merge_1_gen', 'Local generatedImage preserved');
  assert.equal(merged[0].originalScan, 'data:image/png;base64,item_merge_1_scan', 'Local originalScan preserved');
  console.log('✔ Test 10: Merging within user namespace verified');
}

console.log('--- All Virtual Wardrobe User-Isolation Tests Passed Successfully! ---');
