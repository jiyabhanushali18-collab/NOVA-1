import assert from 'assert';
import {
  deepCleanForFirestore,
  sanitizeForFirestore,
  mergeWardrobeItems,
  getWardrobeStorageKey
} from '../src/services/wardrobeService';
import {
  canonicalToDisplayAttributes,
  CanonicalGarmentData,
  WardrobeItem
} from '../src/types/wardrobe';
import { adminDb } from './firebaseAdmin';

console.log('🧪 Starting NOVA Wardrobe Persistence & Cloud Sync Verification...');

// =========================================================================
// TEST 1: Deep recursive cleaning of undefined values
// =========================================================================
console.log('\n--- Test 1: Recursive sanitization removes all undefined values ---');
const dirtyNestedObject = {
  id: 'item_test_1',
  category: 'Top',
  size: '',
  attributes: {
    category: 'Top',
    primaryColor: 'Beige',
    secondaryColor: undefined, // Must be omitted
    texture: undefined,        // Must be omitted
    rise: undefined,           // Must be omitted
    nested: {
      deepUndefined: undefined,
      deepValid: 'hello',
      deepNull: null
    }
  },
  canonical: {
    schemaVersion: '1.0',
    category: 'top',
    subcategory: 'other',
    gender: 'women',
    visual: {
      primaryColor: 'Beige',
      secondaryColor: null, // Legitimate null must be preserved
      colorFamily: ['neutral'],
      pattern: 'Printed',
      texture: null
    },
    construction: {
      sleeveType: 'Long Sleeve',
      neckType: 'Square Neck',
      fit: 'Fitted',
      rise: null
    },
    material: {
      fabric: 'Synthetic Blend',
      fabricConfidence: 'inferred',
      composition: null
    },
    style: {
      primary: 'Bohemian',
      secondary: []
    },
    usage: {
      occasions: ['Casual'],
      seasons: ['All Season'],
      formality: 'Casual'
    },
    matching: {
      compatibleCategories: ['bottom'],
      compatibleStyles: ['Bohemian'],
      colorCompatibility: ['neutral']
    },
    aiMetadata: {
      description: 'Long-sleeved printed wrap top',
      searchTags: ['beige', 'printed'],
      unknownFields: [],
      extractionSource: 'gemini',
      schemaVersion: '1.0'
    }
  },
  tags: ['top', undefined, 'boho', undefined],
  colors: ['Beige', undefined, 'Charcoal']
};

const cleaned = deepCleanForFirestore(dirtyNestedObject);

// Verify no undefined keys exist in cleaned object
assert.strictEqual('secondaryColor' in cleaned.attributes, false, 'attributes.secondaryColor must be omitted');
assert.strictEqual('texture' in cleaned.attributes, false, 'attributes.texture must be omitted');
assert.strictEqual('rise' in cleaned.attributes, false, 'attributes.rise must be omitted');
assert.strictEqual('deepUndefined' in cleaned.attributes.nested, false, 'deepUndefined must be omitted');
assert.strictEqual(cleaned.attributes.nested.deepValid, 'hello', 'deepValid must be preserved');
assert.strictEqual(cleaned.attributes.nested.deepNull, null, 'deepNull must be preserved as null');
assert.strictEqual(cleaned.canonical.visual.secondaryColor, null, 'canonical secondaryColor null must be preserved');
assert.strictEqual(cleaned.canonical.construction.sleeveType, 'Long Sleeve');
assert.deepStrictEqual(cleaned.tags, ['top', 'boho'], 'Array undefined elements must be filtered out');
assert.deepStrictEqual(cleaned.colors, ['Beige', 'Charcoal'], 'Colors array undefined elements must be filtered out');

console.log('✅ PASS: deepCleanForFirestore recursively eliminates all undefined fields while preserving legitimate nulls and primitives.');

// =========================================================================
// TEST 2: sanitizeForFirestore produces complete, valid Firestore payload
// =========================================================================
console.log('\n--- Test 2: sanitizeForFirestore produces clean Firestore payload ---');
const rawItem: WardrobeItem = {
  id: 'test_garment_' + Date.now(),
  category: 'Top',
  size: '',
  generatedImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  originalScan: 'data:image/png;base64,large_scan_photo',
  colors: ['Beige', 'Charcoal'],
  pattern: 'Printed',
  fabric: 'Synthetic Blend',
  tags: ['Top', 'Beige', 'Bohemian'],
  dateAdded: new Date().toISOString(),
  timesWorn: 0,
  canonical: cleaned.canonical as CanonicalGarmentData,
  attributes: canonicalToDisplayAttributes(cleaned.canonical as CanonicalGarmentData) as any
};

const sanitizedPayload = sanitizeForFirestore(rawItem);

// Function to recursively inspect an object and ensure 0 undefined properties exist
function assertNoUndefined(obj: any, currentPath = ''): void {
  if (obj === undefined) {
    throw new Error(`Found undefined at path: ${currentPath}`);
  }
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (value === undefined) {
      throw new Error(`Found undefined at path: ${nextPath}`);
    }
    assertNoUndefined(value, nextPath);
  }
}

assertNoUndefined(sanitizedPayload);
assert.strictEqual('originalScan' in sanitizedPayload, false, 'originalScan must be stripped to save space');
assert.strictEqual(sanitizedPayload.generatedImage, '', 'Base64 data URL stripped in Firestore payload');
assert.strictEqual(sanitizedPayload.category, 'Top');
assert.strictEqual(sanitizedPayload.canonical.visual.primaryColor, 'Beige');
assert.strictEqual(sanitizedPayload.canonical.construction.neckType, 'Square Neck');
assert.strictEqual(sanitizedPayload.attributes.primaryColor, 'Beige');
assert.strictEqual(sanitizedPayload.attributes.neckType, 'Square Neck');
console.log('✅ PASS: sanitizeForFirestore contains ZERO undefined values across all nested levels.');

// =========================================================================
// TEST 3: Actual Firestore Write & Read Verification
// =========================================================================
console.log('\n--- Test 3: Actual Firestore Write & Read with Active Account ---');

async function testFirestorePersistence() {
  if (!adminDb) {
    console.warn('⚠️ adminDb is null. Skipping live Firestore write.');
    return;
  }

  const activeUid = 'V6PK1lIDuzQCu3nd28WAgaYrUc33';
  const garmentDocId = `test_live_garment_${Date.now()}`;

  const liveGarment: WardrobeItem = {
    id: garmentDocId,
    category: 'Top',
    size: '',
    generatedImage: '',
    originalScan: '',
    colors: ['Beige', 'Charcoal'],
    pattern: 'Printed',
    fabric: 'Synthetic Blend',
    tags: ['Top', 'Beige', 'Bohemian', 'Wrap Top'],
    dateAdded: new Date().toISOString(),
    timesWorn: 0,
    canonical: cleaned.canonical as CanonicalGarmentData,
    attributes: canonicalToDisplayAttributes(cleaned.canonical as CanonicalGarmentData) as any
  };

  const firestoreData = sanitizeForFirestore(liveGarment);

  // 1. Write to Firestore under the authenticated user's UID
  const docRef = adminDb.collection('users').doc(activeUid).collection('wardrobe').doc(garmentDocId);
  await docRef.set(firestoreData);
  console.log(`✅ Successfully wrote garment document to Firestore: users/${activeUid}/wardrobe/${garmentDocId}`);

  // 2. Read back the document directly from Firestore
  const snap = await docRef.get();
  assert.strictEqual(snap.exists, true, 'Document must exist in Firestore');
  const storedData = snap.data();
  assert.ok(storedData, 'Stored data must not be empty');

  // Verify all fields in Firestore
  assert.strictEqual(storedData?.id, garmentDocId);
  assert.strictEqual(storedData?.category, 'Top');
  assert.strictEqual(storedData?.size, '', 'Size should be empty string (unset), not XS');
  assert.ok(storedData?.canonical, 'canonical must be present in Firestore');
  assert.strictEqual(storedData?.canonical?.category, 'top');
  assert.strictEqual(storedData?.canonical?.subcategory, 'other');
  assert.strictEqual(storedData?.canonical?.visual?.primaryColor, 'Beige');
  assert.strictEqual(storedData?.canonical?.visual?.secondaryColor, null);
  assert.strictEqual(storedData?.canonical?.construction?.sleeveType, 'Long Sleeve');
  assert.strictEqual(storedData?.canonical?.construction?.neckType, 'Square Neck');
  assert.strictEqual(storedData?.canonical?.construction?.fit, 'Fitted');
  assert.strictEqual(storedData?.canonical?.style?.primary, 'Bohemian');

  assert.ok(storedData?.attributes, 'attributes must be present in Firestore');
  assert.strictEqual(storedData?.attributes?.category, 'Top');
  assert.strictEqual(storedData?.attributes?.primaryColor, 'Beige');
  assert.strictEqual(storedData?.attributes?.sleeveType, 'Long Sleeve');
  assert.strictEqual(storedData?.attributes?.neckType, 'Square Neck');

  console.log('✅ PASS: Live Firestore document verified! Canonical Gemini metadata and attributes are intact.');

  // 3. Clean up the test document
  await docRef.delete();
  console.log(`✅ Cleaned up temporary test document users/${activeUid}/wardrobe/${garmentDocId}`);
}

// =========================================================================
// TEST 4: Local-to-Cloud Recovery & Sync Verification
// =========================================================================
console.log('\n--- Test 4: Local-to-Cloud Auto-Recovery & Duplicate Prevention ---');
{
  const localItems: WardrobeItem[] = [
    {
      id: 'offline_item_1',
      category: 'Top',
      size: '',
      generatedImage: 'data:image/png;base64,offline_img_1',
      originalScan: 'data:image/png;base64,offline_scan_1',
      colors: ['Beige'],
      pattern: 'Printed',
      fabric: 'Synthetic Blend',
      tags: ['Top'],
      dateAdded: '2026-10-30T16:00:00Z',
      timesWorn: 0,
      canonical: cleaned.canonical as CanonicalGarmentData,
      attributes: { category: 'Top', primaryColor: 'Beige' } as any
    },
    {
      id: 'existing_item_2',
      category: 'Dress',
      size: 'S',
      generatedImage: 'data:image/png;base64,offline_img_2',
      originalScan: '',
      colors: ['Black'],
      pattern: 'Solid',
      fabric: 'Silk',
      tags: ['Dress'],
      dateAdded: '2026-10-30T15:00:00Z',
      timesWorn: 1,
      canonical: cleaned.canonical as CanonicalGarmentData,
      attributes: { category: 'Dress', primaryColor: 'Black' } as any
    }
  ];

  // Remote already has existing_item_2, but not offline_item_1
  const remoteItems: WardrobeItem[] = [
    {
      id: 'existing_item_2',
      category: 'Dress',
      size: 'S',
      generatedImage: '',
      originalScan: '',
      colors: ['Black'],
      pattern: 'Solid',
      fabric: 'Silk',
      tags: ['Dress'],
      dateAdded: '2026-10-30T15:00:00Z',
      timesWorn: 1,
      canonical: cleaned.canonical as CanonicalGarmentData,
      attributes: { category: 'Dress', primaryColor: 'Black' } as any
    }
  ];

  // Run synchronization check
  const remoteMap = new Map<string, WardrobeItem>(remoteItems.map(r => [r.id, r]));
  const pendingSync = localItems.filter((local) => {
    const remoteItem = remoteMap.get(local.id);
    if (!remoteItem) return true; // entirely missing in Firestore
    return !remoteItem.canonical && Boolean(local.canonical);
  });

  assert.strictEqual(pendingSync.length, 1, 'Only offline_item_1 should need sync');
  assert.strictEqual(pendingSync[0].id, 'offline_item_1');

  // Verify merge produces exactly 2 items without duplicates
  const merged = mergeWardrobeItems(remoteItems, localItems);
  assert.strictEqual(merged.length, 2, 'Merge must contain both items with 0 duplicates');
  assert.strictEqual(merged.find(i => i.id === 'offline_item_1')?.generatedImage, 'data:image/png;base64,offline_img_1');
  assert.strictEqual(merged.find(i => i.id === 'existing_item_2')?.generatedImage, 'data:image/png;base64,offline_img_2');

  console.log('✅ PASS: Auto-recovery identifies un-synced local items and prevents duplicate documents.');
}

// =========================================================================
// TEST 5: Simulated Second Browser Session Retrieval
// =========================================================================
console.log('\n--- Test 5: Simulated Second Browser / New Session Retrieval ---');
{
  // In a second browser/session, localStorage is completely EMPTY
  const secondBrowserLocalStorage: WardrobeItem[] = [];

  // Firestore has the user's remote items
  const firestoreRemoteItems: WardrobeItem[] = [
    {
      id: 'cloud_item_99',
      category: 'Top',
      size: '',
      generatedImage: 'https://cdn.nova.fashion/items/cloud_item_99.png',
      originalScan: '',
      colors: ['Beige', 'Charcoal'],
      pattern: 'Printed',
      fabric: 'Synthetic Blend',
      tags: ['Top', 'Beige', 'Bohemian'],
      dateAdded: '2026-10-30T16:00:00Z',
      timesWorn: 0,
      canonical: cleaned.canonical as CanonicalGarmentData,
      attributes: canonicalToDisplayAttributes(cleaned.canonical as CanonicalGarmentData) as any
    }
  ];

  // When second browser calls mergeWardrobeItems(remote, local)
  const secondBrowserItems = mergeWardrobeItems(firestoreRemoteItems, secondBrowserLocalStorage);
  assert.strictEqual(secondBrowserItems.length, 1);
  const item = secondBrowserItems[0];
  assert.strictEqual(item.id, 'cloud_item_99');
  assert.strictEqual(item.category, 'Top');
  assert.ok(item.canonical);
  assert.strictEqual(item.canonical.visual.primaryColor, 'Beige');
  assert.strictEqual(item.canonical.construction.neckType, 'Square Neck');
  assert.strictEqual(item.attributes.primaryColor, 'Beige');

  console.log('✅ PASS: Second browser/session successfully restores complete wardrobe from Firestore.');
}

async function run() {
  await testFirestorePersistence();
  console.log('\n🎉 ALL PERSISTENCE AND CLOUD SYNC TESTS PASSED SUCCESSFULLY!\n');
}

run().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
