import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  analyseProductImage,
  backfillConfiguration,
  createFailedAiAttributes,
  fingerprintImage,
  getBackfillSummary,
  planProductBackfill,
  type ProductAiAttributes,
  type ProductBackfillRecord
} from '../server/productAiBackfill.js';

import { adminDb, initialized, initError } from '../server/firebaseAdmin.js';

const getArg = (name: string, fallback: string) => {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return value ? value.slice(name.length + 3) : fallback;
};

const execute = process.argv.includes('--execute');
const confirmed = process.argv.includes('--confirm-live-backfill');
if (!execute || !confirmed) {
  throw new Error('Refusing to run. Use --execute --confirm-live-backfill only after explicit approval.');
}

if (!process.env.GEMINI_API_KEY?.trim()) throw new Error('GEMINI_API_KEY is required on the server process.');

if (!initialized || !adminDb) {
  throw new Error(`Firebase Admin SDK is not initialized: ${initError?.message || 'Check service account credentials'}`);
}

const batchSize = Math.max(1, Number(getArg('batch-size', String(backfillConfiguration.defaultBatchSize))));
const concurrency = Math.max(1, Number(getArg('concurrency', String(backfillConfiguration.defaultConcurrency))));
const retryFailed = process.argv.includes('--retry-failed');
const outputPath = getArg('output', 'output/product-ai-backfill-progress.json');

const snapshot = await adminDb.collection('products').get();
const allRecords = snapshot.docs.map((document) =>
  planProductBackfill(document.id, document.data() as Record<string, unknown>)
);
const planned = allRecords.filter(
  (record) => record.needsAnalysis && (retryFailed || record.reason !== 'failed_analysis')
);

const progress = {
  mode: 'live-approved',
  writesPerformed: 0,
  geminiRequestsPerformed: 0,
  batchSize,
  concurrency,
  retryFailed,
  startedAt: new Date().toISOString(),
  summary: getBackfillSummary(allRecords),
  skipped: allRecords
    .filter((record) => !record.needsAnalysis)
    .map((record) => ({ productId: record.productId, name: record.name, reason: record.reason })),
  successful: [] as Array<{ productId: string; name: string | null; model: string | null }>,
  failed: [] as Array<{ productId: string; name: string | null; error: string }>
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const processRecord = async (record: ProductBackfillRecord) => {
  try {
    progress.geminiRequestsPerformed += 1;
    // Pre-write snapshot for vendor field preservation check
    const preDoc = await adminDb.collection('products').doc(record.productId).get();
    const preData = preDoc.data() as Record<string, unknown> | undefined;

    const attributes = await analyseProductImage(record, { apiKey: process.env.GEMINI_API_KEY });
    await adminDb.collection('products').doc(record.productId).update({
      aiAttributes: attributes satisfies ProductAiAttributes
    });

    // Read-back verification
    const postDoc = await adminDb.collection('products').doc(record.productId).get();
    if (!postDoc.exists) {
      throw new Error(`Read-back failed: document ${record.productId} not found after write.`);
    }
    const postData = postDoc.data() as Record<string, unknown>;
    const stored = postData.aiAttributes as ProductAiAttributes | undefined;
    if (stored?.status !== 'complete') {
      throw new Error(`Read-back verification failed for ${record.productId}: status is ${stored?.status}`);
    }

    // Vendor field preservation check
    if (preData) {
      const origVendor = { ...preData };
      const newVendor = { ...postData };
      delete origVendor.aiAttributes;
      delete newVendor.aiAttributes;
      if (JSON.stringify(origVendor) !== JSON.stringify(newVendor)) {
        throw new Error(`Vendor field preservation check failed for ${record.productId}`);
      }
    }

    progress.writesPerformed += 1;
    progress.successful.push({
      productId: record.productId,
      name: record.name,
      model: attributes.model
    });
    console.log(`[${progress.writesPerformed}/${planned.length}] ✅ Saved: ${record.productId} (${record.name || 'unnamed'})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Product analysis failed.';
    const hasPreviousCompleteAnalysis = record.aiAttributes?.status === 'complete';
    if (!hasPreviousCompleteAnalysis) {
      await adminDb.collection('products').doc(record.productId).update({
        aiAttributes: createFailedAiAttributes(
          record.image ? fingerprintImage(record.image) : '',
          message
        )
      });
      progress.writesPerformed += 1;
    }
    progress.failed.push({
      productId: record.productId,
      name: record.name,
      error: message
    });
    console.error(`[${progress.writesPerformed}/${planned.length}] ❌ Failed: ${record.productId} (${record.name || 'unnamed'}): ${message}`);
  }
};

const processBatch = async (batch: ProductBackfillRecord[]) => {
  let cursor = 0;
  const worker = async () => {
    while (cursor < batch.length) {
      const record = batch[cursor];
      cursor += 1;
      await processRecord(record);
      await delay(backfillConfiguration.minimumInterRequestDelayMs);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker));
};

for (let index = 0; index < planned.length; index += batchSize) {
  await processBatch(planned.slice(index, index + batchSize));
  const absoluteOutput = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });
  await fs.writeFile(absoluteOutput, `${JSON.stringify({
    ...progress,
    completedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({
  ...progress,
  completedAt: new Date().toISOString(),
  failedCount: progress.failed.length
}, null, 2));
