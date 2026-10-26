import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config();

import {
  DecartKeyPool,
  maskApiKey,
  classifyDecartError,
  CredentialConfig
} from './decartKeyPool';

console.log('======================================================');
console.log('🧪 RUNNING 16-KEY AR API ROTATION VERIFICATION SUITE');
console.log('======================================================\n');

(async () => {
  // --------------------------------------------------------------------------
  // TEST 1: All 16 Configured Credentials Discovered from Environment
  // --------------------------------------------------------------------------
  console.log('▶ Test 1: Discovering all 16 configured DECART_API_KEY_1..16');
  const envPool = new DecartKeyPool();
  const envStatus = envPool.getStatusReport();

  assert.strictEqual(
    envStatus.totalCredentials >= 16,
    true,
    `Expected at least 16 credentials discovered, but found ${envStatus.totalCredentials}`
  );

  const keyIds = envStatus.credentials.map((c) => c.id);
  for (let i = 1; i <= 16; i++) {
    const expectedId = `decart-key-${i}`;
    assert.strictEqual(
      keyIds.includes(expectedId),
      true,
      `Expected pool to contain credential "${expectedId}"`
    );
  }

  // Verify all 16 have masked keys (never raw) and are initially healthy
  for (let i = 1; i <= 16; i++) {
    const cred = envStatus.credentials.find((c) => c.id === `decart-key-${i}`)!;
    assert.strictEqual(cred.maskedKey.startsWith('dct_'), true);
    assert.strictEqual(cred.maskedKey.includes('...'), true);
    assert.strictEqual(cred.enabled, true);
    assert.strictEqual(cred.eligibility, 'healthy');
  }
  console.log(`  ✓ Successfully discovered ${envStatus.totalCredentials} keys (all 16 decart-key-1..16 verified).`);

  // --------------------------------------------------------------------------
  // TEST 2: Complete Rotation Cycle (Keys 1 -> 16 -> Wraparound to 1)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 2: Full 16-key sequential rotation cycle and wraparound');
  // Create an isolated 16-key pool with synthetic credentials
  const mock16Configs: CredentialConfig[] = [];
  for (let i = 1; i <= 16; i++) {
    mock16Configs.push({
      id: `key-${String(i).padStart(2, '0')}`,
      apiKey: `dct_synthetic_test_credential_slot_${i}_abcdef1234567890`,
      quotaGroup: `quota-group-${i}`,
      priority: 1,
      enabled: true
    });
  }

  const rotationPool = new DecartKeyPool(mock16Configs);

  // Cycle 1: should select key-01 through key-16 in exact order
  const selectedCycle1: string[] = [];
  for (let i = 1; i <= 16; i++) {
    const cred = rotationPool.selectEligibleCredential();
    assert.ok(cred, `Expected credential selection at step ${i}`);
    selectedCycle1.push(cred.id);
  }

  for (let i = 1; i <= 16; i++) {
    const expectedId = `key-${String(i).padStart(2, '0')}`;
    assert.strictEqual(
      selectedCycle1[i - 1],
      expectedId,
      `Step ${i} selected ${selectedCycle1[i - 1]}, expected ${expectedId}`
    );
  }
  console.log('  ✓ Cycle 1 verified: Selected keys 01 through 16 in exact sequence.');

  // Wraparound check: Step 17 must be key-01
  const wraparoundCred = rotationPool.selectEligibleCredential();
  assert.strictEqual(wraparoundCred?.id, 'key-01', 'Step 17 must wrap around to key-01');
  console.log('  ✓ Wraparound verified: Step 17 wrapped cleanly back to key-01.');

  // --------------------------------------------------------------------------
  // TEST 3: Multiple Complete Rotation Cycles
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 3: Multiple continuous rotation cycles (3 full cycles = 48 selections)');
  // Reset index to start
  const multiCyclePool = new DecartKeyPool(mock16Configs);
  for (let cycle = 1; cycle <= 3; cycle++) {
    for (let i = 1; i <= 16; i++) {
      const cred = multiCyclePool.selectEligibleCredential();
      const expectedId = `key-${String(i).padStart(2, '0')}`;
      assert.strictEqual(
        cred?.id,
        expectedId,
        `Cycle ${cycle} step ${i} expected ${expectedId}, got ${cred?.id}`
      );
    }
  }
  console.log('  ✓ 3 consecutive cycles (48 selections) rotated without drift or state loss.');

  // --------------------------------------------------------------------------
  // TEST 4: Missing, Placeholder, and Disabled Credentials Safely Handled
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 4: Missing, placeholder, and disabled credentials handled safely');
  const poolWithGaps = new DecartKeyPool([
    { id: 'key-01', apiKey: 'dct_valid_key_01_abcdef1234567890' },
    { id: 'key-02', apiKey: '' }, // empty key
    { id: 'key-03', apiKey: 'your_decart_api_key_placeholder' }, // placeholder
    { id: 'key-04', apiKey: 'dct_valid_key_04_abcdef1234567890' },
    { id: 'key-05', apiKey: 'dct_valid_key_05_abcdef1234567890', enabled: false }, // administratively disabled
    { id: 'key-06', apiKey: 'dct_valid_key_06_abcdef1234567890' },
  ]);

  const gapStatus = poolWithGaps.getStatusReport();
  // Keys 02 and 03 should not even be loaded or should have been ignored
  assert.strictEqual(gapStatus.totalCredentials, 4); // 01, 04, 05, 06 loaded

  // Selections should strictly rotate only between healthy enabled keys (01, 04, 06)
  const gapSelections = [
    poolWithGaps.selectEligibleCredential()?.id,
    poolWithGaps.selectEligibleCredential()?.id,
    poolWithGaps.selectEligibleCredential()?.id,
    poolWithGaps.selectEligibleCredential()?.id,
  ];

  assert.deepStrictEqual(gapSelections, ['key-01', 'key-04', 'key-06', 'key-01']);
  console.log('  ✓ Gaps, placeholders, and disabled keys skipped cleanly without interrupting rotation.');

  // --------------------------------------------------------------------------
  // TEST 5: Failure, Rate-Limiting, and Quota-Exhaustion Isolation
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 5: Failure isolation (429, 402, 401 do NOT disable eligible pool)');
  const isolationPool = new DecartKeyPool(mock16Configs);

  // Simulate Key 03 hitting 429 rate limit
  const cred03 = (isolationPool as any).credentials.get('key-03');
  cred03.eligibility = 'rate_limited';
  cred03.cooldownUntil = Date.now() + 45000;

  // Simulate Quota Group 07 hitting 402 Insufficient Credits
  isolationPool.setQuotaGroupExhausted('quota-group-7', 3600000, 'Credits depleted');

  // Simulate Key 12 hitting 401 Invalid Key
  const cred12 = (isolationPool as any).credentials.get('key-12');
  cred12.eligibility = 'invalid';

  const reportAfterFailures = isolationPool.getStatusReport();
  assert.strictEqual(reportAfterFailures.healthyCount, 13);
  assert.strictEqual(reportAfterFailures.inCooldownCount, 1); // key-03
  assert.strictEqual(reportAfterFailures.exhaustedCount, 1);  // key-07
  assert.strictEqual(reportAfterFailures.invalidCount, 1);    // key-12

  // Verify that rotation continues seamlessly across the remaining 13 healthy keys
  const activeSelected = new Set<string>();
  for (let i = 0; i < 26; i++) {
    const cred = isolationPool.selectEligibleCredential();
    assert.ok(cred);
    assert.notStrictEqual(cred.id, 'key-03');
    assert.notStrictEqual(cred.id, 'key-07');
    assert.notStrictEqual(cred.id, 'key-12');
    activeSelected.add(cred.id);
  }
  assert.strictEqual(activeSelected.size, 13);
  console.log('  ✓ Failure isolation verified: key-03 (429), key-07 (402), and key-12 (401) skipped while 13 remaining keys rotated normally.');

  // --------------------------------------------------------------------------
  // TEST 6: Concurrency Safety Under Parallel Requests
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 6: Concurrent selection state integrity under parallel async requests');
  const concurrentPool = new DecartKeyPool(mock16Configs);

  // Mock Decart client on all 16 credentials so tokens.create returns mock token with credential ID
  for (const cred of (concurrentPool as any).credentials.values()) {
    cred.client = {
      tokens: {
        create: async (opts: any) => ({
          apiKey: `token_minted_by_${cred.id}`,
          expiresAt: new Date(Date.now() + 300000).toISOString()
        })
      }
    };
  }

  // Fire 64 concurrent token mint requests
  const concurrentRequests = Array.from({ length: 64 }, (_, idx) =>
    concurrentPool.generateClientToken({ userId: `user-${idx}` })
  );

  const results = await Promise.all(concurrentRequests);
  assert.strictEqual(results.length, 64);

  // Count distribution across all 16 keys: with 64 requests across 16 keys, each key should be used exactly 4 times!
  const distribution: Record<string, number> = {};
  for (const res of results) {
    distribution[res.credentialId] = (distribution[res.credentialId] || 0) + 1;
    assert.strictEqual(res.token.apiKey, `token_minted_by_${res.credentialId}`);
  }

  for (let i = 1; i <= 16; i++) {
    const id = `key-${String(i).padStart(2, '0')}`;
    assert.strictEqual(
      distribution[id],
      4,
      `Key ${id} was used ${distribution[id]} times; expected exactly 4`
    );
  }
  console.log('  ✓ Concurrency integrity verified: 64 parallel requests distributed exactly 4 times per key across all 16 keys.');

  // --------------------------------------------------------------------------
  // TEST 7: Token Generation Uses the Selected Credential (Not a Default Key)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 7: Confirming token generation uses the selected credential');
  const tokenCredCheckPool = new DecartKeyPool(mock16Configs.slice(0, 3));
  const calls: string[] = [];

  for (const cred of (tokenCredCheckPool as any).credentials.values()) {
    cred.client = {
      tokens: {
        create: async () => {
          calls.push(cred.id);
          return { apiKey: `tok-${cred.id}` };
        }
      }
    };
  }

  const t1 = await tokenCredCheckPool.generateClientToken();
  const t2 = await tokenCredCheckPool.generateClientToken();
  const t3 = await tokenCredCheckPool.generateClientToken();

  assert.strictEqual(t1.credentialId, 'key-01');
  assert.strictEqual(t1.token.apiKey, 'tok-key-01');
  assert.strictEqual(t2.credentialId, 'key-02');
  assert.strictEqual(t2.token.apiKey, 'tok-key-02');
  assert.strictEqual(t3.credentialId, 'key-03');
  assert.strictEqual(t3.token.apiKey, 'tok-key-03');
  assert.deepStrictEqual(calls, ['key-01', 'key-02', 'key-03']);
  console.log('  ✓ Verified: Each call invoked the respective credential client, not a shared default.');

  console.log('\n======================================================');
  console.log('🎉 ALL 7 16-KEY ROTATION VERIFICATION TESTS PASSED!');
  console.log('======================================================\n');
})();
