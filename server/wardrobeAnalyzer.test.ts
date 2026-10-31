import assert from 'node:assert';
import {
  analyzeGarmentImagePayload,
  buildGarmentAnalysisPrompt,
  callGeminiVision,
  MAX_IMAGE_PAYLOAD_BYTES,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_FALLBACK_MODELS
} from './wardrobeAnalyzer';
import {
  validateCanonicalGarmentData,
  canonicalToDisplayAttributes,
  CanonicalGarmentData
} from '../src/types/wardrobe';

async function runTests() {
  console.log('🧪 Starting NOVA Garment Analyzer Test Suite...\n');
  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err?.message || err}`);
      failed++;
    }
  };

  // 1. Schema Validation Tests
  await test('Schema validation accepts valid canonical garment data', () => {
    const validRaw = {
      schemaVersion: '1.0',
      category: 'top',
      subcategory: 'tshirt',
      gender: 'unisex',
      visual: {
        primaryColor: 'Black',
        secondaryColor: 'White',
        colorFamily: ['neutral'],
        pattern: 'Striped',
        texture: 'matte cotton',
        visibleDetails: ['crew neckline', 'horizontal stripes']
      },
      construction: {
        sleeveType: 'Short Sleeve',
        neckType: 'Round Neck',
        fit: 'Regular',
        length: 'Regular',
        silhouette: 'Straight',
        rise: null
      },
      material: {
        fabric: 'Cotton',
        fabricConfidence: 'medium',
        composition: null
      },
      style: {
        primary: 'Casual',
        secondary: ['Streetwear'],
        tags: ['minimal', 'everyday']
      },
      usage: {
        occasions: ['Casual', 'College'],
        seasons: ['Summer', 'Spring'],
        formality: 'Casual'
      },
      matching: {
        compatibleCategories: ['bottom', 'footwear'],
        compatibleStyles: ['Casual', 'Streetwear'],
        colorCompatibility: ['neutral']
      },
      aiMetadata: {
        description: 'Black and white striped cotton crewneck t-shirt.',
        searchTags: ['black', 'striped', 't-shirt'],
        unknownFields: [],
        extractionSource: 'gemini',
        schemaVersion: '1.0'
      }
    };

    const res = validateCanonicalGarmentData(validRaw);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.data?.category, 'top');
    assert.strictEqual(res.data?.subcategory, 'tshirt');
    assert.strictEqual(res.data?.visual.primaryColor, 'Black');
  });

  await test('Schema validation repairs and sanitizes incomplete data', () => {
    const incompleteRaw = {
      subcategory: 'jeans',
      visual: { primaryColor: 'Denim Blue' }
    };

    const res = validateCanonicalGarmentData(incompleteRaw);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.data?.category, 'bottom'); // Auto-inferred from jeans
    assert.strictEqual(res.data?.subcategory, 'jeans');
    assert.strictEqual(res.data?.visual.primaryColor, 'Denim Blue');
    assert.strictEqual(res.data?.visual.pattern, 'Solid'); // default
    assert.strictEqual(res.data?.material.fabric, 'Cotton'); // safe default
  });

  await test('canonicalToDisplayAttributes outputs backwards-compatible structure', () => {
    const canonical: CanonicalGarmentData = {
      schemaVersion: '1.0',
      category: 'top',
      subcategory: 'tshirt',
      gender: 'men',
      visual: {
        primaryColor: 'Navy Blue',
        secondaryColor: null,
        colorFamily: ['cool'],
        pattern: 'Solid',
        texture: null,
        visibleDetails: []
      },
      construction: {
        sleeveType: 'Short Sleeve',
        neckType: 'Round Neck',
        fit: 'Slim',
        length: 'Regular',
        silhouette: 'Fitted',
        rise: null
      },
      material: {
        fabric: 'Cotton',
        fabricConfidence: 'high',
        composition: null
      },
      style: {
        primary: 'Casual',
        secondary: [],
        tags: ['casual']
      },
      usage: {
        occasions: ['Casual'],
        seasons: ['Summer'],
        formality: 'Casual'
      },
      matching: {
        compatibleCategories: ['bottom'],
        compatibleStyles: ['Casual'],
        colorCompatibility: ['neutral']
      },
      aiMetadata: {
        description: 'Navy blue cotton t-shirt',
        searchTags: ['navy blue', 't-shirt'],
        unknownFields: [],
        extractionSource: 'gemini',
        schemaVersion: '1.0'
      }
    };

    const display = canonicalToDisplayAttributes(canonical);
    assert.strictEqual(display.category, 'T-Shirt');
    assert.strictEqual(display.primaryColor, 'Navy Blue');
    assert.strictEqual(display.fabric, 'Cotton');
    assert.strictEqual(display.neckType, 'Round Neck');
    assert.strictEqual(display.sleeveType, 'Short Sleeve');
  });

  // 2. Input Security & Validation Tests
  await test('analyzeGarmentImagePayload rejects empty payload with 400', async () => {
    const res = await analyzeGarmentImagePayload('');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.statusCode, 400);
  });

  await test('analyzeGarmentImagePayload rejects invalid MIME type (e.g. PDF) with 400', async () => {
    const fakePdf = 'data:application/pdf;base64,JVBERi0xLjQK';
    const res = await analyzeGarmentImagePayload(fakePdf);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.error?.includes('Invalid image format'));
  });

  await test('analyzeGarmentImagePayload rejects oversized payload (>6MB) with 400', async () => {
    const oversized = 'data:image/jpeg;base64,' + 'A'.repeat(MAX_IMAGE_PAYLOAD_BYTES + 10);
    const res = await analyzeGarmentImagePayload(oversized);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.statusCode, 400);
  });

  await test('analyzeGarmentImagePayload rejects missing API key with 503', async () => {
    const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const res = await analyzeGarmentImagePayload(validDataUrl, undefined, '   ');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.statusCode, 503);
    assert.ok(res.error?.includes('not configured'));
  });

  // 3. Prompt Construction Tests
  await test('buildGarmentAnalysisPrompt includes category hint and constraints', () => {
    const prompt = buildGarmentAnalysisPrompt('Hoodie');
    assert.ok(prompt.includes('Hoodie'));
    assert.ok(prompt.includes('Distinguish between visually detected facts'));
    assert.ok(prompt.includes('Produce a single valid JSON object strictly matching this schema'));
  });

  // 4. Retry & Backoff Mock Tests
  await test('callGeminiVision retries on HTTP 503 and succeeds on retry', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'Service unavailable' } })
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ subcategory: 'tshirt', visual: { primaryColor: 'Black' } }) }] } }]
        })
      } as any;
    };

    const res = await callGeminiVision('image/png', 'AAAA', 'fake-key', 'prompt', mockFetch as any);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(callCount, 2);
    assert.ok(res.text?.includes('tshirt'));
  });

  await test('callGeminiVision exhausts retries on permanent 503', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'Overloaded' } })
      } as any;
    };

    const res = await callGeminiVision('image/png', 'AAAA', 'fake-key', 'prompt', mockFetch as any);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, 503);
    assert.strictEqual(callCount, 3); // initial + 2 retries
    assert.ok(res.error?.includes('temporarily unavailable due to high demand'));
  });

  await test('callGeminiVision handles 429 quota exhaustion properly without retries', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Quota exceeded' } })
      } as any;
    };

    const res = await callGeminiVision('image/png', 'AAAA', 'fake-key', 'prompt', mockFetch as any);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, 429);
    assert.ok(res.error?.includes('quota exceeded'));
  });

  await test('Model configuration priority defaults to primary 2.5-flash and fallback 3.1-flash-lite', () => {
    assert.strictEqual(DEFAULT_PRIMARY_MODEL, 'gemini-2.5-flash');
    assert.deepStrictEqual(DEFAULT_FALLBACK_MODELS, ['gemini-3.1-flash-lite']);
  });

  await test('callGeminiVision automatically falls back to 3.1-flash-lite when primary returns 404 or 429', async () => {
    const attemptedUrls: string[] = [];
    const mockFetch = async (url: string) => {
      attemptedUrls.push(url);
      if (url.includes('gemini-2.5-flash')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { message: 'Model gemini-2.5-flash not available' } })
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ category: 'top' }) }] } }]
        })
      } as any;
    };

    const res = await callGeminiVision(
      'image/png',
      'AAAA',
      'fake-key',
      'prompt',
      mockFetch as any,
      ['gemini-2.5-flash', 'gemini-3.1-flash-lite']
    );

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.modelUsed, 'gemini-3.1-flash-lite');
    assert.strictEqual(attemptedUrls.length, 2);
    assert.ok(attemptedUrls[0].includes('gemini-2.5-flash'));
    assert.ok(attemptedUrls[1].includes('gemini-3.1-flash-lite'));
  });

  // 5. End-to-End Extraction & Markdown Stripping Tests
  await test('analyzeGarmentImagePayload strips markdown and validates canonical output', async () => {
    const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const mockResponseText = '```json\n' + JSON.stringify({
      schemaVersion: '1.0',
      category: 'top',
      subcategory: 'hoodie',
      gender: 'unisex',
      visual: {
        primaryColor: 'Charcoal',
        secondaryColor: null,
        colorFamily: ['neutral'],
        pattern: 'Solid',
        texture: 'fleece',
        visibleDetails: ['kangaroo pocket', 'drawstrings']
      },
      construction: {
        sleeveType: 'Long Sleeve',
        neckType: 'Hooded',
        fit: 'Oversized',
        length: 'Regular',
        silhouette: 'Relaxed',
        rise: null
      },
      material: {
        fabric: 'Fleece',
        fabricConfidence: 'medium',
        composition: null
      },
      style: {
        primary: 'Streetwear',
        secondary: ['Casual'],
        tags: ['cozy', 'winter']
      },
      usage: {
        occasions: ['Casual', 'College'],
        seasons: ['Winter', 'Autumn'],
        formality: 'Casual'
      },
      matching: {
        compatibleCategories: ['bottom', 'footwear'],
        compatibleStyles: ['Streetwear'],
        colorCompatibility: ['neutral']
      },
      aiMetadata: {
        description: 'Charcoal fleece oversized hoodie with kangaroo pocket.',
        searchTags: ['hoodie', 'charcoal', 'streetwear'],
        unknownFields: [],
        extractionSource: 'gemini',
        schemaVersion: '1.0'
      }
    }) + '\n```';

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: mockResponseText }] } }]
      })
    });

    const result = await analyzeGarmentImagePayload(
      validDataUrl,
      'Hoodie',
      'test-api-key',
      mockFetch as any
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.garment?.subcategory, 'hoodie');
    assert.strictEqual(result.garment?.visual.primaryColor, 'Charcoal');
    assert.strictEqual(result.garment?.construction.neckType, 'Hooded');
    assert.strictEqual(result.displayAttributes?.category, 'Hoodie');
  });

  await test('analyzeGarmentImagePayload handles completely malformed JSON gracefully', async () => {
    const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Here is the analysis: [Not a valid JSON]' }] } }]
      })
    });

    const result = await analyzeGarmentImagePayload(
      validDataUrl,
      undefined,
      'test-api-key',
      mockFetch as any
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 502);
    assert.ok(result.error?.includes('unreadable response format'));
  });

  console.log(`\n📊 Test Suite Complete: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
