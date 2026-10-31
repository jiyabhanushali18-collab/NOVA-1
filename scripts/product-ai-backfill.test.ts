import assert from 'node:assert/strict';
import {
  fingerprintImage,
  findProductImage,
  getBackfillSummary,
  planProductBackfill
} from '../server/productAiBackfill.js';

const imageUrl = 'https://example.com/product.jpg';
const currentFingerprint = fingerprintImage({ url: imageUrl, sourceField: 'imageUrl', role: 'primary' });

const current = planProductBackfill('current', {
  name: 'Current Product',
  imageUrl,
  aiAttributes: {
    schemaVersion: '1.0',
    status: 'complete',
    source: 'gemini',
    model: 'gemini-2.5-flash',
    analyzedAt: '2026-10-30T00:00:00.000Z',
    imageFingerprint: currentFingerprint,
    confidence: 90,
    visual: {}
  }
});
assert.equal(current.needsAnalysis, false);
assert.equal(current.reason, 'already_current');

const changed = planProductBackfill('changed', {
  name: 'Changed Product',
  imageUrl: 'https://example.com/new-product.jpg',
  aiAttributes: current.aiAttributes
});
assert.equal(changed.needsAnalysis, true);
assert.equal(changed.reason, 'image_changed');

const failed = planProductBackfill('failed', {
  name: 'Failed Product',
  imageUrl,
  aiAttributes: {
    ...current.aiAttributes,
    status: 'failed',
    error: { code: 'GEMINI_ERROR', message: 'Temporary failure', at: '2026-10-30T00:00:00.000Z' }
  }
});
assert.equal(failed.needsAnalysis, true);
assert.equal(failed.reason, 'failed_analysis');

const legacy = planProductBackfill('legacy', {
  Name: 'Legacy Product',
  imageurl: imageUrl,
  Sizes: 'S, M'
});
assert.equal(legacy.needsAnalysis, true);
assert.equal(legacy.reason, 'missing_ai_attributes');
assert.equal(findProductImage({ imageurl: imageUrl })?.sourceField, 'imageurl');

const missingImage = planProductBackfill('missing', { name: 'No Image' });
assert.equal(missingImage.needsAnalysis, false);
assert.equal(missingImage.reason, 'missing_image');

const summary = getBackfillSummary([current, changed, failed, legacy, missingImage]);
assert.deepEqual(summary, {
  discovered: 5,
  alreadyAnalysed: 1,
  requiringAnalysis: 3,
  missingUsableImages: 1,
  successful: 0,
  failed: 0,
  estimatedGeminiRequests: 3,
  skippedUnchangedImages: 1
});

console.log('product-ai-backfill tests passed');
