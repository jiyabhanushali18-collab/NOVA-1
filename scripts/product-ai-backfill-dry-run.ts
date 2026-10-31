import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  backfillConfiguration,
  fingerprintImage,
  getBackfillSummary,
  planProductBackfill
} from '../server/productAiBackfill.js';

const require = createRequire(import.meta.url);
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const args = new Set(process.argv.slice(2));
if (args.has('--execute') || args.has('--confirm-live-backfill')) {
  throw new Error('Live backfill is intentionally disabled in this dry-run tool. Obtain explicit approval before adding an execution command.');
}

const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const outputPath = outputArg?.slice('--output='.length) || 'output/product-ai-backfill-dry-run.json';
const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

if (!config.projectId) throw new Error('VITE_FIREBASE_PROJECT_ID is required.');

const app = initializeApp(config);
const snapshot = await getDocs(collection(getFirestore(app), 'products'));
const records = snapshot.docs.map((document) => planProductBackfill(document.id, document.data() as Record<string, unknown>));
const reportRecords = records.map((record) => ({
  ...record,
  image: record.image
    ? {
        sourceField: record.image.sourceField,
        role: record.image.role,
        fingerprint: fingerprintImage(record.image),
        url: record.image.url.startsWith('data:')
          ? `[inline ${record.image.url.slice(5, record.image.url.indexOf(';')) || 'image'} payload omitted]`
          : record.image.url
      }
    : null
}));
const report = {
  mode: 'dry-run',
  writesPerformed: 0,
  geminiRequestsPerformed: 0,
  batchSize: backfillConfiguration.defaultBatchSize,
  concurrency: backfillConfiguration.defaultConcurrency,
  modelConfiguration: backfillConfiguration,
  generatedAt: new Date().toISOString(),
  summary: getBackfillSummary(records),
  records: reportRecords
};

const absoluteOutput = path.resolve(outputPath);
await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });
await fs.writeFile(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  mode: report.mode,
  writesPerformed: report.writesPerformed,
  geminiRequestsPerformed: report.geminiRequestsPerformed,
  output: absoluteOutput,
  summary: report.summary,
  startCommandAfterApproval: 'npx tsx scripts/product-ai-backfill.ts --execute --confirm-live-backfill --batch-size=5 --concurrency=2'
}, null, 2));
