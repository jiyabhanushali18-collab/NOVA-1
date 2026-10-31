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

test('NOVA AI Clothing Preference Filtering: Eligible Candidate Set Rules', () => {
  const dummyProduct = (
    gender: 'Men' | 'Women' | 'Unisex' | 'Unknown',
    name: string,
    subcategory: string,
    rawAiGender?: string,
    verificationStatus?: 'verified_women' | 'verified_men' | 'verified_unisex' | 'unverified'
  ): any => ({
    id: 'test-1',
    name,
    gender,
    genderVerificationStatus:
      verificationStatus ||
      (gender === 'Women' ? 'verified_women' : gender === 'Men' ? 'verified_men' : gender === 'Unisex' ? 'verified_unisex' : 'unverified'),
    subcategory,
    category: 'Top Wear',
    price: 1999,
    imageUrl: 'https://example.com/p.jpg',
    colors: ['Beige'],
    primaryColor: 'Beige',
    sizes: ['M'],
    inStock: true,
    raw: {
      aiAttributes: rawAiGender ? { visual: { gender: rawAiGender } } : undefined
    }
  });

  const menHoodie = dummyProduct('Men', 'Printed Hoodie', 'Hoodie', 'men');
  const menKurta = dummyProduct('Men', "Men's Kurta", 'Kurta', 'men');
  const womenCropTop = dummyProduct('Women', 'Printed Crop Top', 'Crop Top', 'women');
  const womenKurti = dummyProduct('Women', 'Printed Kurti', 'Kurti', 'women');
  const womenSaree = dummyProduct('Women', 'Silk Saree', 'Saree', 'women');
  const unisexSneakers = dummyProduct('Unisex', 'Classic Sneakers', 'Sneakers', 'unisex');
  const unisexSunglasses = dummyProduct('Unisex', 'Retro Sunglasses', 'Accessories', 'unisex');

  // 1. Women's preference: allows Women and Unisex; strictly rejects Men
  assert.equal(isProductEligibleForPreference(womenCropTop, 'women'), true, 'Women selection must allow crop top');
  assert.equal(isProductEligibleForPreference(womenKurti, 'women'), true, 'Women selection must allow kurti');
  assert.equal(isProductEligibleForPreference(womenSaree, 'women'), true, 'Women selection must allow saree');
  assert.equal(isProductEligibleForPreference(unisexSneakers, 'women'), true, 'Women selection must allow unisex sneakers');
  assert.equal(isProductEligibleForPreference(unisexSunglasses, 'women'), true, 'Women selection must allow unisex sunglasses');
  assert.equal(isProductEligibleForPreference(menHoodie, 'women'), false, 'Women selection must strictly exclude men hoodie');
  assert.equal(isProductEligibleForPreference(menKurta, 'women'), false, 'Women selection must strictly exclude men kurta');

  // 2. Men's preference: allows Men and Unisex; strictly rejects Women
  assert.equal(isProductEligibleForPreference(menHoodie, 'men'), true, 'Men selection must allow men hoodie');
  assert.equal(isProductEligibleForPreference(menKurta, 'men'), true, 'Men selection must allow men kurta');
  assert.equal(isProductEligibleForPreference(unisexSneakers, 'men'), true, 'Men selection must allow unisex sneakers');
  assert.equal(isProductEligibleForPreference(womenCropTop, 'men'), false, 'Men selection must strictly exclude crop top');
  assert.equal(isProductEligibleForPreference(womenSaree, 'men'), false, 'Men selection must strictly exclude saree');

  // 3. Unisex preference: allows strictly unisex items
  assert.equal(isProductEligibleForPreference(unisexSneakers, 'unisex'), true, 'Unisex selection must allow sneakers');
  assert.equal(isProductEligibleForPreference(unisexSunglasses, 'unisex'), true, 'Unisex selection must allow sunglasses');
  assert.equal(isProductEligibleForPreference(menHoodie, 'unisex'), false, 'Unisex selection must exclude men hoodie');
  assert.equal(isProductEligibleForPreference(womenCropTop, 'unisex'), false, 'Unisex selection must exclude women crop top');

  // 4. Show all preference: allows all items
  assert.equal(isProductEligibleForPreference(menHoodie, 'all'), true, 'Show all must allow men hoodie');
  assert.equal(isProductEligibleForPreference(womenCropTop, 'all'), true, 'Show all must allow crop top');
  assert.equal(isProductEligibleForPreference(unisexSneakers, 'all'), true, 'Show all must allow sneakers');

  // 5. Unknown or missing gender metadata must NOT be automatically treated as confirmed Unisex
  const unconfirmedItem = dummyProduct('Unknown', 'Polo T-Shirt', 'T-Shirt', undefined, 'unverified');
  assert.equal(isProductEligibleForPreference(unconfirmedItem, 'unisex'), false, 'Unconfirmed gender must NOT be treated as Unisex');
  assert.equal(isProductEligibleForPreference(unconfirmedItem, 'women'), false, 'Unconfirmed gender must NOT be treated as Women');
  assert.equal(isProductEligibleForPreference(unconfirmedItem, 'men'), false, 'Unconfirmed gender must NOT be treated as Men');
  assert.equal(isProductEligibleForPreference(unconfirmedItem, 'all'), true, 'Unconfirmed gender IS permitted under Show All');
});

test('NOVA AI Regression Test: Polo T-Shirt (ID: polo_tshirt) is strictly excluded from Women recommendations', async () => {
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
    clothingPreference: 'women',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 12);
  const poloRec = recommendations.find((r) => r.productId === 'polo_tshirt');
  assert.equal(poloRec, undefined, 'Product polo_tshirt must NEVER be recommended for women clothing preference');
});

test('NOVA AI Recommender: Women preference retrieves real Firestore items with zero men items', async () => {
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
    clothingPreference: 'women',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 6);
  assert.ok(recommendations.length > 0, 'Should return women recommendations from real catalogue');

  for (const rec of recommendations) {
    // Assert none of the returned items are men hoodies or men garments
    assert.ok(
      !rec.productId.includes('hoodie'),
      `Men hoodie should not be recommended for women preference: ${rec.productId}`
    );
    assert.ok(
      !/\b(men|men's|mens|gents|male)\b/i.test(rec.name.replace(/\b(women|women's|womens|female|ladies)\b/gi, '')),
      `Men's specific garments should not be recommended for women preference: ${rec.name}`
    );
  }
});

test('NOVA AI Recommender: Men preference retrieves real Firestore items with zero women items', async () => {
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
    clothingPreference: 'men',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 6);
  assert.ok(recommendations.length > 0, 'Should return men recommendations from real catalogue');

  for (const rec of recommendations) {
    const nameLower = rec.name.toLowerCase();
    const subcatLower = (rec.subcategory || '').toLowerCase();
    assert.ok(!subcatLower.includes('saree'), `Saree should not be recommended for men: ${rec.name}`);
    assert.ok(!subcatLower.includes('kurti'), `Kurti should not be recommended for men: ${rec.name}`);
    assert.ok(!subcatLower.includes('crop top'), `Crop top should not be recommended for men: ${rec.name}`);
    assert.ok(!nameLower.includes("women's"), `Women's garments should not be recommended for men: ${rec.name}`);
  }
});

test('NOVA AI Recommender: Unisex preference retrieves exclusively unisex pieces', async () => {
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
    clothingPreference: 'unisex',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 6);
  assert.ok(recommendations.length > 0, 'Should return unisex recommendations from real catalogue');

  for (const rec of recommendations) {
    const nameLower = rec.name.toLowerCase();
    const subcatLower = (rec.subcategory || '').toLowerCase();
    assert.ok(!subcatLower.includes('saree'), `Saree should not be unisex: ${rec.name}`);
    assert.ok(!subcatLower.includes('kurti'), `Kurti should not be unisex: ${rec.name}`);
    assert.ok(!subcatLower.includes('crop top'), `Crop top should not be unisex: ${rec.name}`);
    assert.ok(!nameLower.includes("women's"), `Women's garments should not be in unisex: ${rec.name}`);
    assert.ok(!nameLower.includes("men's"), `Men's garments should not be in unisex: ${rec.name}`);
    assert.ok(!rec.productId.includes('hoodie'), `Men hoodies should not be in unisex: ${rec.productId}`);
  }
});

test('NOVA AI Recommender: Show All retrieves across all catalogue categories', async () => {
  const profile: NovaAiPersonalProfileInput = {
    bodyShape: 'Hourglass',
    bodyShapeConfidence: 80,
    bodyShapeExplanation: 'Hourglass proportions.',
    skinTone: 'Medium',
    undertone: 'Warm',
    skinToneConfidence: 85,
    skinToneExplanation: 'Warm tones.',
    suggestedSize: 'M',
    sizeConfidence: 75,
    sizeExplanation: 'Estimate.',
    clothingPreference: 'all',
    analyzedAt: new Date().toISOString()
  };

  const recommendations = await getNovaAiRecommendations(profile, 8);
  assert.ok(recommendations.length > 0, 'Show All should return recommendations');
});

