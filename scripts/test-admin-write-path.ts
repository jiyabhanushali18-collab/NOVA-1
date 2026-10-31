import assert from 'node:assert/strict';
import { adminDb, initialized, initError } from '../server/firebaseAdmin.js';
import { planProductBackfill } from '../server/productAiBackfill.js';

async function testWritePath() {
  console.log('🧪 Testing Server-Side Admin SDK Write Authorization Path...\n');

  // 1. Verify Admin SDK initialization
  assert.equal(initialized, true, `Firebase Admin SDK not initialized: ${initError?.message}`);
  assert.notEqual(adminDb, null, 'adminDb is null');
  console.log('  ✅ Admin SDK is properly initialized with server credentials.');

  // 2. Perform isolated write to diagnostic collection (never touches live products)
  const testRef = adminDb.collection('_diagnostics').doc('pilot_write_path_test');
  const testPayload = {
    testName: 'product_ai_attribute_write_path',
    testedAt: new Date().toISOString(),
    allowedFieldOnly: {
      status: 'complete',
      model: 'gemini-3.1-flash-lite'
    }
  };

  await testRef.set(testPayload);
  console.log('  ✅ Admin SDK wrote to Firestore without permission errors.');

  // 3. Round-trip read
  const snap = await testRef.get();
  assert.equal(snap.exists, true, 'Test document was not found on read-back.');
  const data = snap.data();
  assert.equal(data?.testName, testPayload.testName);
  assert.equal(data?.allowedFieldOnly?.status, 'complete');
  console.log('  ✅ Admin SDK round-trip read verified successfully.');

  // 4. Cleanup
  await testRef.delete();
  console.log('  ✅ Diagnostic test document cleaned up.');

  // 5. Test Pilot Product Selection (strictly read-only)
  const productsSnap = await adminDb.collection('products').get();
  const selected = productsSnap.docs
    .map((document) => ({
      document,
      record: planProductBackfill(document.id, document.data() as Record<string, unknown>)
    }))
    .filter(({ record }) => Boolean(record.name) && record.image && /^https?:\/\//i.test(record.image.url))
    .sort(({ record: left }, { record: right }) => left.productId.localeCompare(right.productId))
    .slice(0, 3);

  assert.equal(selected.length, 3, `Expected exactly 3 pilot products, found ${selected.length}`);
  console.log(`  ✅ Pilot product selection verified: exactly 3 products ready (${selected.map((s) => s.record.productId).join(', ')}).`);

  console.log('\n🎉 ALL ADMIN WRITE PATH VERIFICATIONS PASSED!\n');
  process.exit(0);
}

testWritePath().catch((err) => {
  console.error('❌ Write path test failed:', err);
  process.exit(1);
});
