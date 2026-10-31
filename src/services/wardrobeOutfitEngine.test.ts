import assert from 'node:assert';
import {
  generateWardrobeOutfits,
  scoreWardrobeOutfit
} from './wardrobeOutfitEngine';
import { WardrobeItem } from '../types';

async function runTests() {
  console.log('🧪 Starting Virtual Wardrobe Outfit Recommendation Engine Tests...\n');
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

  const createMockItem = (
    id: string,
    category: string,
    color: string,
    overrides: Partial<WardrobeItem> = {}
  ): WardrobeItem => ({
    id,
    category,
    colors: [color],
    pattern: 'Solid',
    fabric: 'Cotton',
    size: 'M',
    dateAdded: new Date().toISOString(),
    generatedImage: `https://example.com/${id}.png`,
    tags: ['Casual'],
    attributes: {
      category,
      primaryColor: color,
      pattern: overrides.pattern || 'Solid',
      fit: 'Regular',
      style: 'Casual',
      occasions: ['Casual', 'Everyday']
    },
    ...overrides
  });

  // 1. Structure Tests: Top + Bottom + Footwear
  await test('Generates complete 3-piece outfits (Top + Bottom + Footwear)', () => {
    const wardrobe: WardrobeItem[] = [
      createMockItem('top_1', 'Wrap Top', 'Black', {
        canonical: {
          schemaVersion: '1.0',
          category: 'top',
          subcategory: 'wrap_top',
          gender: 'women',
          visual: { primaryColor: 'Black', secondaryColor: null, colorFamily: ['neutral'], pattern: 'Solid', texture: null, visibleDetails: [] },
          construction: { sleeveType: 'Long Sleeve', neckType: 'V-Neck', fit: 'Fitted', length: 'Regular', silhouette: 'Fitted', rise: null },
          material: { fabric: 'Cotton', fabricConfidence: 'high', composition: null },
          style: { primary: 'Casual', secondary: [], tags: ['casual'] },
          usage: { occasions: ['Casual', 'Date Night'], seasons: ['All Season'], formality: 'Casual' },
          matching: { compatibleCategories: ['bottom', 'footwear'], compatibleStyles: ['Casual'], colorCompatibility: ['neutral'] },
          aiMetadata: { description: 'Black wrap top', searchTags: [], unknownFields: [], extractionSource: 'gemini', schemaVersion: '1.0' }
        }
      }),
      createMockItem('bot_1', 'Jeans', 'Beige', {
        attributes: { category: 'Jeans', primaryColor: 'Beige', fit: 'Straight', style: 'Casual', occasions: ['Casual', 'Date Night'] }
      }),
      createMockItem('shoe_1', 'Sneakers', 'White', {
        attributes: { category: 'Sneakers', primaryColor: 'White', style: 'Casual', occasions: ['Casual'] }
      })
    ];

    const result = generateWardrobeOutfits(wardrobe);
    assert.strictEqual(result.outfits.length, 1);
    const outfit = result.outfits[0];
    assert.strictEqual(outfit.structureType, 'top_bottom_footwear');
    assert.deepStrictEqual(outfit.itemIds.sort(), ['bot_1', 'shoe_1', 'top_1'].sort());
    assert.ok(outfit.compatibilityScore >= 80, `Expected score >= 80, got ${outfit.compatibilityScore}`);
    assert.ok(outfit.explanations.length >= 3);
    assert.ok(outfit.suggestedOccasion.length > 0);
    assert.ok(outfit.styleDescription.length > 0);
  });

  // 2. Structure Tests: Top + Bottom + Footwear + Outerwear
  await test('Generates layered 4-piece outfits (Top + Bottom + Footwear + Outerwear)', () => {
    const wardrobe: WardrobeItem[] = [
      createMockItem('top_1', 'T-Shirt', 'White'),
      createMockItem('bot_1', 'Trousers', 'Black'),
      createMockItem('shoe_1', 'Loafers', 'Black'),
      createMockItem('out_1', 'Blazer', 'Navy Blue', {
        attributes: { category: 'Blazer', primaryColor: 'Navy Blue', style: 'Formal', occasions: ['Office'] }
      })
    ];

    const result = generateWardrobeOutfits(wardrobe);
    const fourPiece = result.outfits.find((o) => o.structureType === 'top_bottom_footwear_outerwear');
    assert.ok(fourPiece, 'Expected a 4-piece layered outfit');
    assert.strictEqual(fourPiece.items.length, 4);
    assert.ok(fourPiece.itemIds.includes('out_1'));
  });

  // 3. Structure Tests: Full-body + Footwear + Accessories
  await test('Generates full-body outfits (Dress + Footwear + Accessories)', () => {
    const wardrobe: WardrobeItem[] = [
      createMockItem('dress_1', 'Maxi Dress', 'Burgundy', {
        attributes: { category: 'Maxi Dress', primaryColor: 'Burgundy', style: 'Evening', occasions: ['Party', 'Date Night'] }
      }),
      createMockItem('shoe_1', 'Heels', 'Black', {
        attributes: { category: 'Heels', primaryColor: 'Black', style: 'Evening', occasions: ['Party'] }
      }),
      createMockItem('acc_1', 'Watch', 'Silver', {
        attributes: { category: 'Watch', primaryColor: 'Silver', style: 'Evening', occasions: ['Party'] }
      })
    ];

    const result = generateWardrobeOutfits(wardrobe);
    assert.strictEqual(result.outfits.length, 1);
    const outfit = result.outfits[0];
    assert.strictEqual(outfit.structureType, 'fullbody_footwear');
    assert.ok(outfit.itemIds.includes('dress_1'));
    assert.ok(outfit.itemIds.includes('shoe_1'));
    assert.ok(outfit.itemIds.includes('acc_1'));
  });

  // 4. Color & Pattern Harmony
  await test('Awards high scores to curated classic combinations (White + Navy, Black + Beige)', () => {
    const top = createMockItem('t1', 'Shirt', 'White');
    const bottom = createMockItem('b1', 'Chinos', 'Beige');
    const outfit = scoreWardrobeOutfit([top, bottom], 'top_bottom_duo');
    assert.ok(outfit.breakdown.colorScore >= 30);
    assert.ok(outfit.explanations.some((e) => e.includes('Color') || e.includes('color') || e.includes('neutral') || e.includes('synergy')));
  });

  await test('Penalizes multi-pattern clash while rewarding solid + print combinations', () => {
    const solidTop = createMockItem('t_solid', 'T-Shirt', 'White', { pattern: 'Solid' });
    const printBottom = createMockItem('b_print', 'Skirt', 'Floral', { pattern: 'Floral' });
    const outfit1 = scoreWardrobeOutfit([solidTop, printBottom], 'top_bottom_duo');
    assert.strictEqual(outfit1.breakdown.patternScore, 15);

    const printTop = createMockItem('t_print', 'Shirt', 'Striped', { pattern: 'Striped' });
    const outfit2 = scoreWardrobeOutfit([printTop, printBottom], 'top_bottom_duo');
    assert.ok(outfit2.breakdown.patternScore < outfit1.breakdown.patternScore);
  });

  // 5. Fit & Silhouette Proportions
  await test('Rewards silhouette balance between fitted tops and wide-leg bottoms', () => {
    const fittedTop = createMockItem('t1', 'Wrap Top', 'Black', {
      attributes: { fit: 'Fitted', primaryColor: 'Black' }
    });
    const wideBottom = createMockItem('b1', 'Palazzo', 'Cream', {
      attributes: { fit: 'Wide Leg', primaryColor: 'Cream' }
    });
    const outfit = scoreWardrobeOutfit([fittedTop, wideBottom], 'top_bottom_duo');
    assert.strictEqual(outfit.breakdown.fitScore, 15);
  });

  // 6. User Isolation: Only uses items in the active user's array
  await test('Strict user isolation: never includes or references outside items', () => {
    const userAWardrobe = [
      createMockItem('userA_top', 'Top', 'Red'),
      createMockItem('userA_bottom', 'Jeans', 'Blue')
    ];
    const userBWardrobe = [
      createMockItem('userB_top', 'Hoodie', 'Green'),
      createMockItem('userB_bottom', 'Cargo', 'Black')
    ];

    const resultA = generateWardrobeOutfits(userAWardrobe);
    assert.ok(resultA.outfits.every((o) => o.itemIds.every((id) => id.startsWith('userA'))));

    const resultB = generateWardrobeOutfits(userBWardrobe);
    assert.ok(resultB.outfits.every((o) => o.itemIds.every((id) => id.startsWith('userB'))));
  });

  // 7. Error Handling & Edge Cases
  await test('Gracefully handles empty wardrobes and wardrobes with too few items', () => {
    const emptyResult = generateWardrobeOutfits([]);
    assert.strictEqual(emptyResult.outfits.length, 0);
    assert.ok(emptyResult.statusMessage?.includes('empty'));

    const onlyTops = [createMockItem('t1', 'T-Shirt', 'Black'), createMockItem('t2', 'Shirt', 'White')];
    const onlyTopsResult = generateWardrobeOutfits(onlyTops);
    assert.strictEqual(onlyTopsResult.outfits.length, 0);
    assert.ok(onlyTopsResult.statusMessage?.includes('bottom'));
  });

  await test('Safely handles missing or corrupted item attributes without crashing', () => {
    const brokenItem: WardrobeItem = {
      id: 'broken_1',
      category: '',
      colors: [],
      pattern: '',
      fabric: '',
      size: '',
      dateAdded: '',
      generatedImage: '',
      tags: [],
      attributes: {}
    };

    const regularBottom = createMockItem('b1', 'Jeans', 'Blue');
    assert.doesNotThrow(() => {
      const result = generateWardrobeOutfits([brokenItem, regularBottom]);
      assert.ok(result);
    });
  });

  // 8. Multi-combination scale & Deduplication
  await test('Generates up to 6–10 distinct outfit combinations when enough compatible items exist', () => {
    const wardrobe: WardrobeItem[] = [
      createMockItem('top_1', 'Wrap Top', 'Beige'),
      createMockItem('top_2', 'T-Shirt', 'White'),
      createMockItem('top_3', 'Shirt', 'Black'),
      createMockItem('bot_1', 'Jeans', 'Blue'),
      createMockItem('bot_2', 'Cargo Pants', 'Charcoal'),
      createMockItem('bot_3', 'Chinos', 'Beige'),
      createMockItem('shoe_1', 'Sneakers', 'White')
    ];

    const result = generateWardrobeOutfits(wardrobe, { limit: 10 });
    // 3 tops * 3 bottoms * 1 shoe = 9 distinct complete outfits
    assert.strictEqual(result.outfits.length, 9);
    assert.ok(result.outfits.length >= 6 && result.outfits.length <= 10);

    // Verify all combinations are unique by sorted item ID
    const keys = result.outfits.map((o) => o.itemIds.slice().sort().join('_'));
    const uniqueKeys = new Set(keys);
    assert.strictEqual(uniqueKeys.size, result.outfits.length, 'Every outfit must be a unique combination');
  });

  await test('Guarantees no duplicate combinations in different item orders', () => {
    const wardrobe: WardrobeItem[] = [
      createMockItem('top_1', 'T-Shirt', 'Black'),
      createMockItem('top_2', 'Shirt', 'White'),
      createMockItem('bot_1', 'Jeans', 'Blue'),
      createMockItem('bot_2', 'Trousers', 'Grey')
    ];

    const result = generateWardrobeOutfits(wardrobe, { limit: 10 });
    // 2 tops * 2 bottoms = 4 duos
    assert.strictEqual(result.outfits.length, 4);

    const keys = result.outfits.map((o) => o.itemIds.slice().sort().join('_'));
    const setKeys = new Set(keys);
    assert.strictEqual(setKeys.size, 4);
  });

  console.log(`\n📊 Virtual Wardrobe Outfit Tests Complete: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
