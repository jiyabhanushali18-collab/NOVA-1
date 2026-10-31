import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normalizeProduct, markImageAudit } from './catalogueMigration.js';
import { ImageAudit, ProductMigrationRecord } from './catalogueSchema.js';

const require = createRequire(import.meta.url);
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const args = new Set(process.argv.slice(2));
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const outputPath = outputArg?.slice('--output='.length) || 'output/catalogue-migration-dry-run.json';
const checkImages = !args.has('--skip-image-check');

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

if (!config.projectId) {
  throw new Error('VITE_FIREBASE_PROJECT_ID is required. No Firebase credentials were read from source files.');
}

const app = initializeApp(config);
const db = getFirestore(app);

const auditUrl = async (record: ProductMigrationRecord, image: ImageAudit): Promise<ImageAudit> => {
  if (!checkImages || image.status !== 'pending') return image;
  try {
    const response = await fetch(image.url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    return {
      ...image,
      status: response.ok ? 'reachable' : 'unreachable',
      httpStatus: response.status,
      contentType: response.headers.get('content-type') || undefined
    };
  } catch (error) {
    return {
      ...image,
      status: 'unreachable',
      reason: error instanceof Error ? error.message : 'Image request failed.'
    };
  }
};

const migrate = async () => {
  const snapshot = await getDocs(collection(db, 'products'));
  const records = snapshot.docs.map((document) => normalizeProduct(document.id, document.data() as Record<string, unknown>));
  const imageResults = new Map<string, ImageAudit>();

  if (checkImages) {
    for (const record of records) {
      const audited = await Promise.all(record.imageAudit.map((image) => auditUrl(record, image)));
      audited.forEach((image) => imageResults.set(`${record.productId}:${image.sourceField}:${image.url}`, image));
    }
    records.forEach((record) => markImageAudit(record, imageResults));
  }

  const duplicateImageUrls = [...new Set(records.flatMap((record) => record.canonical.imageMetadata.duplicateUrls))];
  const report = {
    mode: 'dry-run',
    writesPerformed: 0,
    firebaseCollection: 'products',
    generatedAt: new Date().toISOString(),
    productCount: records.length,
    summary: {
      invalidOrTestRecords: records.filter((record) => record.flags.includes('invalid_catalogue_record')).map((record) => record.productId),
      missingPrimaryImages: records.filter((record) => record.flags.includes('missing_primary_image')).map((record) => record.productId),
      sourceFieldConflicts: records.filter((record) => record.conflicts.length > 0).map((record) => record.productId),
      duplicateImageUrls,
      unreachableImageCount: records.flatMap((record) => record.imageAudit).filter((image) => image.status === 'unreachable').length,
      missingFieldCounts: Object.fromEntries(
        [...new Set(records.flatMap((record) => record.missingFields))].map((field) => [
          field,
          records.filter((record) => record.missingFields.includes(field)).length
        ])
      )
    },
    records
  };

  const absoluteOutputPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await fs.writeFile(absoluteOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    mode: report.mode,
    writesPerformed: report.writesPerformed,
    productCount: report.productCount,
    output: absoluteOutputPath,
    summary: report.summary
  }, null, 2));
};

await migrate();
