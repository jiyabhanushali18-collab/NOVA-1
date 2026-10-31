import 'dotenv/config';
import {
  analyseProductImage,
  backfillConfiguration,
  fingerprintImage,
  planProductBackfill,
  type ProductAiAttributes,
  type ProductBackfillRecord
} from '../server/productAiBackfill.js';
import { adminDb, initialized, initError } from '../server/firebaseAdmin.js';

const PILOT_SIZE = 3;
const execute = process.argv.includes('--execute');
const confirmed = process.argv.includes('--confirm-pilot');

if (!execute || !confirmed) {
  throw new Error('Refusing to run. Use --execute --confirm-pilot only after explicit approval.');
}

if (!process.env.GEMINI_API_KEY?.trim()) {
  throw new Error('GEMINI_API_KEY is required on the server process.');
}

// 1. Verify Admin SDK initialization and authorization before attempting any write
if (!initialized || !adminDb) {
  throw new Error(
    `Firebase Admin SDK is not authorized or initialized: ${initError?.message || 'Check server-side service account credentials'}`
  );
}

// 2. Fetch products using Firebase Admin SDK
const snapshot = await adminDb.collection('products').get();
const hasUsableImageUrl = (record: ProductBackfillRecord) =>
  Boolean(
    record.image &&
      (record.image.url.startsWith('data:image/') ||
        /^https?:\/\//i.test(record.image.url))
  );

const selected = snapshot.docs
  .map((document) => ({
    document,
    record: planProductBackfill(document.id, document.data() as Record<string, unknown>)
  }))
  .filter(({ record }) => Boolean(record.name) && hasUsableImageUrl(record))
  .sort(({ record: left }, { record: right }) => left.productId.localeCompare(right.productId))
  .slice(0, PILOT_SIZE);

if (selected.length !== PILOT_SIZE) {
  throw new Error(`Pilot requires exactly ${PILOT_SIZE} valid products with usable images; found ${selected.length}.`);
}

const records = selected.map(({ record }) => record);
console.log(`Selected exactly ${PILOT_SIZE} products for pilot: ${records.map((record) => record.productId).join(', ')}`);

const before = new Map<string, Record<string, unknown>>(
  selected.map(({ document }) => [document.id, document.data() as Record<string, unknown>])
);

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

for (const record of records) {
  let attributes: ProductAiAttributes;
  try {
    attributes = await analyseProductImage(record, { apiKey: process.env.GEMINI_API_KEY });
  } catch (error) {
    throw new Error(
      `Pilot analysis failed for ${record.productId}: ${error instanceof Error ? error.message : 'Unknown error.'}`
    );
  }

  // 3. Write strictly to aiAttributes field using Firebase Admin SDK (server-side authorization)
  const docRef = adminDb.collection('products').doc(record.productId);
  await docRef.update({
    aiAttributes: attributes
  });

  // 4. Round-trip read and verification
  const reread = await docRef.get();
  if (!reread.exists) {
    throw new Error(`Round-trip read failed for ${record.productId}.`);
  }
  const after = reread.data() as Record<string, unknown>;
  const original = before.get(record.productId);
  if (!original) {
    throw new Error(`Missing pre-write snapshot for ${record.productId}.`);
  }

  // 5. Verify vendor fields are 100% preserved
  const originalVendorData = { ...original };
  const updatedVendorData = { ...after };
  delete originalVendorData.aiAttributes;
  delete updatedVendorData.aiAttributes;
  if (JSON.stringify(originalVendorData) !== JSON.stringify(updatedVendorData)) {
    throw new Error(`Vendor-field preservation check failed for ${record.productId}.`);
  }

  // 6. Verify aiAttributes structure, status, model, and fingerprint
  const stored = after.aiAttributes as ProductAiAttributes | undefined;
  if (
    stored?.status !== 'complete' ||
    stored.model !== attributes.model ||
    stored.analyzedAt !== attributes.analyzedAt ||
    stored.imageFingerprint !== fingerprintImage(record.image)
  ) {
    throw new Error(`aiAttributes round-trip verification failed for ${record.productId}.`);
  }

  console.log(JSON.stringify({
    productId: record.productId,
    name: record.name,
    status: stored.status,
    model: stored.model,
    analyzedAt: stored.analyzedAt,
    imageFingerprint: stored.imageFingerprint,
    attributes: stored.visual
  }, null, 2));

  await delay(backfillConfiguration.minimumInterRequestDelayMs);
}

console.log(`Pilot complete: ${PILOT_SIZE} products processed; no other products were modified.`);
