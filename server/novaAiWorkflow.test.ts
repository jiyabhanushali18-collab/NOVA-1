import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUserProfileWithGemini } from './novaAiProfileAnalyzer';
import { getNovaAiRecommendations, NovaAiPersonalProfileInput } from './novaAiRecommender';
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
