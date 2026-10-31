import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUserProfileWithGemini } from './novaAiProfileAnalyzer';
import {
  getNovaAiRecommendations,
  isProductEligibleForPreference,
  NovaAiPersonalProfileInput
} from './novaAiRecommender';
import fs from 'node:fs';
import path from 'node:path';

test('NOVA AI Profile Analyzer: Rejects invalid or empty payloads gracefully', async () => {
  await assert.rejects(
    async () => {
      await analyzeUserProfileWithGemini('');
    },
    {
      message: /Invalid or empty image payload/
    }
  );

  await assert.rejects(
    async () => {
      await analyzeUserProfileWithGemini('invalid-base64');
    },
    {
      message: /Invalid or empty image payload/
    }
  );
});

test('NOVA AI Recommender: Ranks catalogue products for Hourglass + Warm Undertone', async () => {
  const profile: NovaAiPersonalProfileInput = {
    bodyShape: 'Hourglass',
    bodyShapeConfidence: 85,
    bodyShapeExplanation: 'Balanced shoulder and hip proportions with defined waist.',
    skinTone: 'Medium',
    undertone: 'Warm',
    skinToneConfidence: 80,
    skinToneExplanation: 'Warm golden tones suited to earthy and warm palettes.',
    suggestedSize: 'M',
    sizeConfidence: 65,
    sizeExplanation: 'Tentative visual estimate.',
    userConfirmedSize: 'M',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 6);

  assert.ok(Array.isArray(recommendations), 'Recommendations should be an array');
  assert.ok(recommendations.length > 0, 'Should return recommendations from catalogue');

  for (const rec of recommendations) {
    assert.ok(rec.productId, 'Each recommendation must have a productId');
    assert.ok(rec.name, 'Each recommendation must have a name');
    assert.ok(rec.imageUrl, 'Each recommendation must have an imageUrl');
    assert.ok(rec.matchScore >= 60 && rec.matchScore <= 100, `Match score ${rec.matchScore} should be in [60, 100]`);
    assert.ok(rec.recommendedSize, 'Must provide recommendedSize');
    assert.ok(
      rec.sizeStatus === 'user_confirmed' || rec.sizeStatus === 'estimated',
      `sizeStatus should be user_confirmed or estimated, got: ${rec.sizeStatus}`
    );
    assert.ok(rec.reasoning.summary, 'Must provide AI reasoning summary');
    assert.ok(rec.reasoning.colorHarmonies, 'Must provide color harmony explanation');
    assert.ok(rec.reasoning.silhouetteHarmonies, 'Must provide silhouette harmony explanation');
  }
});

test('NOVA AI Feature Isolation & Zero Dependency on recommendationEngine.ts or Virtual Wardrobe', () => {
  const checkFiles = [
    'server/novaAiProfileAnalyzer.ts',
    'server/novaAiRecommender.ts',
    'server/chatRouter.ts',
    'src/components/ChatView.tsx'
  ];

  for (const relPath of checkFiles) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Strict constraint: Do not use recommendationEngine.ts
    assert.ok(
      !content.includes('recommendationEngine'),
      `${relPath} must NOT import or reference recommendationEngine.ts`
    );

    // Strict constraint: Do not import Virtual Wardrobe
    assert.ok(
      !content.includes('wardrobeOutfitEngine'),
      `${relPath} must NOT import or reference wardrobeOutfitEngine`
    );
    assert.ok(
      !content.includes('VirtualWardrobeView'),
      `${relPath} must NOT import or reference VirtualWardrobeView`
    );

    // Strict constraint: Do not import separate Profile Analysis
    assert.ok(
      !content.includes('ProfileAnalysisView'),
      `${relPath} must NOT import or reference ProfileAnalysisView`
    );
    assert.ok(
      !content.includes('localVisionAnalyzer'),
      `${relPath} must NOT import or reference localVisionAnalyzer`
    );
  }
});

test('NOVA AI Clothing Preference Filtering: Strict Male / Female Only Candidate Set Rules', () => {
  const dummyProduct = (
    audienceGender?: 'Men' | 'Women' | 'Unisex' | 'Unknown',
    status: 'verified' | 'unknown' = 'verified',
    fallbackGender: 'Men' | 'Women' | 'Unisex' | 'Unknown' = 'Unknown'
  ): any => ({
    id: 'test-1',
    name: 'Sample Product',
    gender: fallbackGender,
    genderVerificationStatus: fallbackGender === 'Women' ? 'verified_women' : fallbackGender === 'Men' ? 'verified_men' : 'unverified',
    category: 'Top Wear',
    subcategory: 'Shirt',
    price: 1999,
    imageUrl: 'https://example.com/p.jpg',
    colors: ['Beige'],
    primaryColor: 'Beige',
    sizes: ['M'],
    inStock: true,
    raw: {
      aiAttributes: audienceGender
        ? {
            audienceClassification: {
              gender: audienceGender,
              classificationStatus: status,
              confidence: 95
            }
          }
        : undefined
    }
  });

  const femaleProduct = dummyProduct('Women', 'verified');
  const maleProduct = dummyProduct('Men', 'verified');
  const unisexProduct = dummyProduct('Unisex', 'verified');
  const unknownProduct = dummyProduct('Unknown', 'unknown');
  const unverifiedFemale = dummyProduct('Women', 'unknown');

  // Female preference tests
  assert.equal(isProductEligibleForPreference(femaleProduct, 'Female'), true, 'Female preference must include verified Women products');
  assert.equal(isProductEligibleForPreference(maleProduct, 'Female'), false, 'Female preference must strictly exclude Male products');
  assert.equal(isProductEligibleForPreference(unisexProduct, 'Female'), false, 'Female preference must strictly exclude Unisex products');
  assert.equal(isProductEligibleForPreference(unknownProduct, 'Female'), false, 'Female preference must strictly exclude Unknown products');
  assert.equal(isProductEligibleForPreference(unverifiedFemale, 'Female'), false, 'Female preference must exclude unverified products');

  // Male preference tests
  assert.equal(isProductEligibleForPreference(maleProduct, 'Male'), true, 'Male preference must include verified Men products');
  assert.equal(isProductEligibleForPreference(femaleProduct, 'Male'), false, 'Male preference must strictly exclude Female products');
  assert.equal(isProductEligibleForPreference(unisexProduct, 'Male'), false, 'Male preference must strictly exclude Unisex products');
  assert.equal(isProductEligibleForPreference(unknownProduct, 'Male'), false, 'Male preference must strictly exclude Unknown products');
});

test('NOVA AI Regression Test: Polo T-Shirt (ID: polo_tshirt) is strictly excluded from Female recommendations', async () => {
  const profile: NovaAiPersonalProfileInput = {
    bodyShape: 'Rectangle',
    bodyShapeConfidence: 80,
    bodyShapeExplanation: 'Proportional frame.',
    skinTone: 'Medium',
    undertone: 'Cool',
    skinToneConfidence: 85,
    skinToneExplanation: 'Cool tones.',
    suggestedSize: 'M',
    sizeConfidence: 75,
    sizeExplanation: 'Estimate.',
    clothingPreference: 'Female',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 12);
  const poloRec = recommendations.find((r) => r.productId === 'polo_tshirt');
  assert.equal(poloRec, undefined, 'Product polo_tshirt must NEVER be recommended for Female clothing preference');
});

test('NOVA AI Recommender: Female preference returns zero Male products and zero Unisex products', async () => {
  const profile: NovaAiPersonalProfileInput = {
    bodyShape: 'Rectangle',
    bodyShapeConfidence: 80,
    bodyShapeExplanation: 'Balanced shoulder and hip proportions with defined waist.',
    skinTone: 'Medium',
    undertone: 'Warm',
    skinToneConfidence: 85,
    skinToneExplanation: 'Warm golden tones.',
    suggestedSize: 'M',
    sizeConfidence: 75,
    sizeExplanation: 'Visual estimate.',
    clothingPreference: 'Female',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 8);
  assert.ok(recommendations.length > 0, 'Should return recommendations from Female candidate set');

  for (const rec of recommendations) {
    // Assert no male products in female recommendations
    assert.ok(
      !/\b(men|men's|mens|gents|male)\b/i.test(rec.name.replace(/\b(women|women's|womens|female|ladies)\b/gi, '')),
      `Men's specific garments should not be recommended for Female preference: ${rec.name}`
    );
    // Assert no unisex hoodie in female recommendations
    assert.ok(
      !rec.productId.includes('hoodie'),
      `Unisex hoodies should not appear in Female recommendations: ${rec.productId}`
    );
  }
});

test('NOVA AI Recommender: Male preference returns zero Female products and zero Unisex products', async () => {
  const profile: NovaAiPersonalProfileInput = {
    bodyShape: 'Rectangle',
    bodyShapeConfidence: 80,
    bodyShapeExplanation: 'Balanced shoulder and hip proportions.',
    skinTone: 'Medium',
    undertone: 'Warm',
    skinToneConfidence: 85,
    skinToneExplanation: 'Warm golden tones.',
    suggestedSize: 'M',
    sizeConfidence: 75,
    sizeExplanation: 'Visual estimate.',
    clothingPreference: 'Male',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 8);
  assert.ok(recommendations.length > 0, 'Should return recommendations from Male candidate set');

  for (const rec of recommendations) {
    const nameLower = rec.name.toLowerCase();
    const subcatLower = (rec.subcategory || '').toLowerCase();
    assert.ok(!subcatLower.includes('saree'), `Saree should not be recommended for Male: ${rec.name}`);
    assert.ok(!subcatLower.includes('kurti'), `Kurti should not be recommended for Male: ${rec.name}`);
    assert.ok(!subcatLower.includes('crop top'), `Crop top should not be recommended for Male: ${rec.name}`);
    assert.ok(!nameLower.includes("women's"), `Women's garments should not be recommended for Male: ${rec.name}`);
  }
});

