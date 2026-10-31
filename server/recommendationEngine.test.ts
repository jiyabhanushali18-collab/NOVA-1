import assert from 'node:assert';
import {
  normalizeProductRecord,
  NormalizedProduct
} from './productIntelligence';
import {
  rankProductsForGarment,
  calculateColorHarmonyScore,
  calculateFitHarmonyScore,
  getComplementaryCategories,
  GarmentRecommendationQuery
} from './recommendationEngine';
import { consultAiStylist } from './aiStylist';

async function runTests() {
  console.log('🧪 Starting NOVA Product Intelligence & Recommendation Core Tests...\n');
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

  // ==========================================
  // 1. PRODUCT INTELLIGENCE & NORMALIZATION
  // ==========================================
  await test('normalizeProductRecord handles messy real-world catalogue variations', () => {
    const rawMessyDoc = {
      Name: '  Oversized Street Hoodie  ',
      Category: 'Hoodies',
      Collors: 'navy, off white, creme',
      Sizes: 'S, M, L, XL',
      'Original Price': '₹2,499',
      price: '1499',
      mainImage: 'https://cdn.example.com/hoodie_1.jpg',
      images: ['https://cdn.example.com/hoodie_2.jpg'],
      'vendorId ': 'VENDOR_XYZ',
      style: 'streetwear',
      fit: 'Oversized',
      occasion: 'College, Casual'
    };

    const normalized = normalizeProductRecord(rawMessyDoc, 'prod_123');
    assert.ok(normalized);
    assert.strictEqual(normalized.id, 'prod_123');
    assert.strictEqual(normalized.name, 'Oversized Street Hoodie');
    assert.strictEqual(normalized.category, 'Top Wear');
    assert.strictEqual(normalized.subcategory, 'Hoodie');
    assert.strictEqual(normalized.price, 1499);
    assert.strictEqual(normalized.originalPrice, 2499);
    assert.strictEqual(normalized.discountedPrice, 1499);
    assert.strictEqual(normalized.primaryColor, 'Navy Blue');
    assert.ok(normalized.colors.includes('Off White'));
    assert.ok(normalized.colors.includes('Cream'));
    assert.deepStrictEqual(normalized.sizes, ['S', 'M', 'L', 'XL']);
    assert.strictEqual(normalized.imageUrl, 'https://cdn.example.com/hoodie_1.jpg');
    assert.strictEqual(normalized.vendorId, 'VENDOR_XYZ');
    assert.strictEqual(normalized.fit, 'Oversized');
  });

  await test('normalizeProductRecord safely rejects invalid non-product documents without throwing', () => {
    const testDoc = { test: true, createdAt: { seconds: 1782243091 } };
    const normalized = normalizeProductRecord(testDoc, 'test_doc_1');
    assert.strictEqual(normalized, null);
  });

  await test('normalizeProductRecord infers category hierarchy for pants, skirts, and dresses', () => {
    const rawJeans = { name: 'Straight Denim Pants', price: 1899, imageUrl: 'https://img.com/j.jpg' };
    const normJeans = normalizeProductRecord(rawJeans, 'jeans_1');
    assert.ok(normJeans);
    assert.strictEqual(normJeans.category, 'Bottom Wear');

    const rawDress = { name: 'Floral Maxi Dress', price: 2999, imageUrl: 'https://img.com/d.jpg' };
    const normDress = normalizeProductRecord(rawDress, 'dress_1');
    assert.ok(normDress);
    assert.strictEqual(normDress.category, 'Full Body');
  });

  // ==========================================
  // 2. COMPLEMENTARY CATEGORIES & PAIRING
  // ==========================================
  await test('getComplementaryCategories correctly pairs Tops with Bottoms and vice versa', () => {
    const topPairing = getComplementaryCategories('Top Wear', 'Wrap Top');
    assert.ok(topPairing.includes('Bottom Wear'));
    assert.ok(topPairing.includes('Footwear'));

    const bottomPairing = getComplementaryCategories('Bottom Wear', 'Jeans');
    assert.ok(bottomPairing.includes('Top Wear'));

    const dressPairing = getComplementaryCategories('Full Body', 'Maxi Dress');
    assert.ok(dressPairing.includes('Footwear'));
  });

  // ==========================================
  // 3. COLOR HARMONY SCORING
  // ==========================================
  await test('calculateColorHarmonyScore awards top scores for curated knowledge-base combos', () => {
    const blackAndBeige = calculateColorHarmonyScore('Black', 'Beige');
    assert.ok(blackAndBeige.score >= 30);
    assert.ok(blackAndBeige.reason.length > 0);

    const whiteAndNavy = calculateColorHarmonyScore('White', 'Navy Blue');
    assert.ok(whiteAndNavy.score >= 30);

    const monochrome = calculateColorHarmonyScore('Charcoal', 'Charcoal');
    assert.strictEqual(monochrome.score, 30);
    assert.ok(monochrome.reason.includes('Monochrome'));
  });

  await test('calculateColorHarmonyScore safely handles missing or unknown colors', () => {
    const unknownScore = calculateColorHarmonyScore('', 'Unknown');
    assert.ok(unknownScore.score > 0);
  });

  // ==========================================
  // 4. FIT & SILHOUETTE PROPORTION HARMONY
  // ==========================================
  await test('calculateFitHarmonyScore rewards balanced proportions (oversized top + straight bottom)', () => {
    const balanced = calculateFitHarmonyScore('Oversized', 'Straight', 'Top Wear', 'Bottom Wear');
    assert.strictEqual(balanced.score, 10);
    assert.ok(balanced.reason?.includes('Proportional balance'));

    const fittedAndWide = calculateFitHarmonyScore('Fitted', 'Wide Leg', 'Top Wear', 'Bottom Wear');
    assert.strictEqual(fittedAndWide.score, 10);
    assert.ok(fittedAndWide.reason?.includes('Silhouette harmony'));
  });

  // ==========================================
  // 5. DETERMINISTIC RECOMMENDATION RANKING
  // ==========================================
  await test('rankProductsForGarment ranks complementary bottom wear for a black wrap top', () => {
    const mockCatalogue: NormalizedProduct[] = [
      {
        id: 'p_tshirt',
        name: 'Graphic T-Shirt',
        category: 'Top Wear',
        subcategory: 'T-Shirt',
        price: 799,
        colors: ['White'],
        primaryColor: 'White',
        sizes: ['M'],
        imageUrl: 'https://img.com/tee.jpg',
        images: [],
        vendorId: 'V1',
        gender: 'Women',
        fit: 'Regular',
        occasions: ['Casual'],
        seasons: ['Summer'],
        styles: ['Casual'],
        tags: [],
        inStock: true,
        stockQuantity: 10,
        rating: 4.2,
        reviewsCount: 5,
        searchableText: 'graphic t-shirt white',
        raw: {}
      },
      {
        id: 'p_beige_trousers',
        name: 'High-Waist Pleated Trousers',
        category: 'Bottom Wear',
        subcategory: 'Trousers',
        price: 1899,
        colors: ['Beige'],
        primaryColor: 'Beige',
        sizes: ['S', 'M', 'L'],
        imageUrl: 'https://img.com/pants.jpg',
        images: [],
        vendorId: 'V1',
        gender: 'Women',
        fit: 'Wide Leg',
        occasions: ['Casual', 'Date Night', 'College'],
        seasons: ['All Season'],
        styles: ['Old Money', 'Casual'],
        tags: [],
        inStock: true,
        stockQuantity: 20,
        rating: 4.8,
        reviewsCount: 34,
        searchableText: 'high-waist pleated trousers beige',
        raw: {}
      },
      {
        id: 'p_black_jeans',
        name: 'Classic Straight Denim Jeans',
        category: 'Bottom Wear',
        subcategory: 'Jeans',
        price: 1599,
        colors: ['Black'],
        primaryColor: 'Black',
        sizes: ['M', 'L'],
        imageUrl: 'https://img.com/jeans.jpg',
        images: [],
        vendorId: 'V1',
        gender: 'Women',
        fit: 'Straight',
        occasions: ['Casual', 'Everyday'],
        seasons: ['All Season'],
        styles: ['Casual'],
        tags: [],
        inStock: true,
        stockQuantity: 15,
        rating: 4.6,
        reviewsCount: 22,
        searchableText: 'classic straight denim jeans black',
        raw: {}
      }
    ];

    const blackWrapTop: GarmentRecommendationQuery = {
      category: 'Top Wear',
      subcategory: 'Wrap Top',
      primaryColor: 'Black',
      fit: 'Fitted',
      style: 'Casual',
      occasion: 'Date Night',
      gender: 'Women'
    };

    const results = rankProductsForGarment(blackWrapTop, mockCatalogue, {
      targetCategory: 'Bottom Wear',
      limit: 5
    });

    assert.ok(results.length >= 2);
    // T-shirt should not be recommended when targetCategory is Bottom Wear
    assert.ok(results.every((r) => r.product.category === 'Bottom Wear'));
    // Highest ranked product should be high confidence
    assert.strictEqual(results[0].product.id, 'p_beige_trousers');
    assert.ok(results[0].score >= 80);
    assert.ok(results[0].explanations.length > 0);
  });

  // ==========================================
  // 6. AI STYLIST CONSULTATION & FALLBACK
  // ==========================================
  await test('consultAiStylist provides structured intent and recommendations', async () => {
    const result = await consultAiStylist(
      'Find me classy beige trousers for date night',
      { category: 'Top Wear', subcategory: 'Wrap Top', primaryColor: 'Black', gender: 'Women' },
      5
    );

    assert.strictEqual(result.success, true);
    assert.ok(result.stylistAdvice.length > 0);
    assert.ok(result.intent.targetCategory === 'Bottom Wear' || result.intent.desiredColors.includes('Beige'));
    assert.ok(Array.isArray(result.recommendations));
  });

  console.log(`\n📊 Phase 2 Test Suite Complete: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
