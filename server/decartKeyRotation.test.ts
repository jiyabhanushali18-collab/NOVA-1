import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config();

import {
  DecartKeyPool,
  maskApiKey,
  classifyDecartError,
  CredentialConfig
} from './decartKeyPool';

console.log('================================================================');
console.log('🧪 RUNNING 32-KEY PRODUCTION AR TRY-ON VERIFICATION SUITE');
console.log('================================================================\n');

(async () => {
  // --------------------------------------------------------------------------
  // TEST 1: All 32 Configured Credentials Discovered from Environment
  // --------------------------------------------------------------------------
  console.log('▶ Test 1: Discovering all 32 configured DECART_API_KEY_01..32 / DECART_API_KEY_1..32');
  const envPool = new DecartKeyPool();
  const envStatus = envPool.getStatusReport();

  assert.strictEqual(
    envStatus.totalCredentials >= 32,
    true,
    `Expected at least 32 credentials discovered, but found ${envStatus.totalCredentials}`
  );

  const keyIds = envStatus.credentials.map((c) => c.id);
  for (let i = 1; i <= 32; i++) {
    const expectedId = `decart-key-${i}`;
    assert.strictEqual(
      keyIds.includes(expectedId),
      true,
      `Expected pool to contain credential "${expectedId}"`
    );
  }

  // Verify all 32 have masked keys (never raw) and are initially healthy
  for (let i = 1; i <= 32; i++) {
    const cred = envStatus.credentials.find((c) => c.id === `decart-key-${i}`)!;
    assert.strictEqual(cred.maskedKey.startsWith('dct_'), true);
    assert.strictEqual(cred.maskedKey.includes('...'), true);
    assert.strictEqual(cred.enabled, true);
    assert.strictEqual(cred.eligibility, 'healthy');
  }
  console.log(`  ✓ Successfully discovered ${envStatus.totalCredentials} keys (all 32 keys verified healthy and masked).`);

  // --------------------------------------------------------------------------
  // TEST 2: Complete 32-Key Sequential Rotation Cycle & Wraparound
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 2: Full 32-key sequential rotation cycle and wraparound');
  const mock32Configs: CredentialConfig[] = [];
  for (let i = 1; i <= 32; i++) {
    const padded = String(i).padStart(2, '0');
    mock32Configs.push({
      id: `decart-key-${i}`,
      keyIdentifier: `KEY_${padded}`,
      apiKey: `dct_synthetic_test_credential_slot_${padded}_abcdef1234567890`,
      quotaGroup: `quota-group-${i}`,
      priority: 1,
      enabled: true
    });
  }

  const rotationPool = new DecartKeyPool(mock32Configs);

  // Cycle 1: should select decart-key-1 through decart-key-32 in exact order
  const selectedCycle1: string[] = [];
  for (let i = 1; i <= 32; i++) {
    const cred = rotationPool.selectEligibleCredential();
    assert.ok(cred, `Expected credential selection at step ${i}`);
    selectedCycle1.push(cred.id);
  }

  for (let i = 1; i <= 32; i++) {
    const expectedId = `decart-key-${i}`;
    assert.strictEqual(
      selectedCycle1[i - 1],
      expectedId,
      `Step ${i} selected ${selectedCycle1[i - 1]}, expected ${expectedId}`
    );
  }
  console.log('  ✓ Cycle 1 verified: Selected keys 1 through 32 in exact sequence.');

  // Wraparound check: Step 33 must be decart-key-1
  const wraparoundCred = rotationPool.selectEligibleCredential();
  assert.strictEqual(wraparoundCred?.id, 'decart-key-1', 'Step 33 must wrap around to decart-key-1');
  console.log('  ✓ Wraparound verified: Step 33 wrapped cleanly back to decart-key-1.');

  // --------------------------------------------------------------------------
  // TEST 3: Multiple Continuous Cycles (2 full cycles = 64 selections)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 3: Multiple continuous rotation cycles (2 full cycles = 64 selections)');
  const multiCyclePool = new DecartKeyPool(mock32Configs);
  for (let cycle = 1; cycle <= 2; cycle++) {
    for (let i = 1; i <= 32; i++) {
      const cred = multiCyclePool.selectEligibleCredential();
      const expectedId = `decart-key-${i}`;
      assert.strictEqual(
        cred?.id,
        expectedId,
        `Cycle ${cycle} step ${i} expected ${expectedId}, got ${cred?.id}`
      );
    }
  }
  console.log('  ✓ 2 consecutive cycles (64 selections) rotated without drift or state loss.');

  // --------------------------------------------------------------------------
  // TEST 4: Rate-Limited (429) Key is Skipped with Cooldown
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 4: Rate-limited key (429) skipped temporarily');
  const rateLimitPool = new DecartKeyPool(mock32Configs);
  // Put key 1 in 429 rate limit cooldown
  const cred1 = (rateLimitPool as any).credentials.get('decart-key-1');
  cred1.eligibility = 'rate_limited';
  cred1.cooldownUntil = Date.now() + 60000;

  // Next selection should skip key 1 and pick key 2
  const nextAfterRateLimit = rateLimitPool.selectEligibleCredential();
  assert.strictEqual(nextAfterRateLimit?.id, 'decart-key-2');
  console.log('  ✓ Key in 429 rate-limit cooldown skipped; next healthy key selected.');

  // --------------------------------------------------------------------------
  // TEST 5: Quota-Exhausted (402) Group Skipped
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 5: Quota-exhausted key/group (402) skipped');
  const creditPool = new DecartKeyPool(mock32Configs);
  creditPool.setQuotaGroupExhausted('quota-group-1', 3600000, 'Insufficient credits');

  const afterCreditExhaust = creditPool.selectEligibleCredential();
  assert.strictEqual(afterCreditExhaust?.id, 'decart-key-2');
  console.log('  ✓ Quota-exhausted credential skipped seamlessly.');

  // --------------------------------------------------------------------------
  // TEST 6: Invalid Credentials (401/403) Quarantined
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 6: Invalid credential (401/403) quarantined');
  const quarantinePool = new DecartKeyPool(mock32Configs);
  const credToQuarantine = (quarantinePool as any).credentials.get('decart-key-5');
  credToQuarantine.eligibility = 'invalid';

  const reportAfterQuarantine = quarantinePool.getStatusReport();
  assert.strictEqual(reportAfterQuarantine.invalidCount, 1);
  assert.strictEqual(reportAfterQuarantine.healthyCount, 31);
  console.log('  ✓ Invalid credential quarantined cleanly; remaining 31 keys healthy.');

  // --------------------------------------------------------------------------
  // TEST 7: Recovery After Cooldown Works
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 7: Recovery after cooldown expires');
  const recoveryPool = new DecartKeyPool(mock32Configs);
  const credToRecover = (recoveryPool as any).credentials.get('decart-key-1');
  credToRecover.eligibility = 'rate_limited';
  credToRecover.cooldownUntil = Date.now() - 1000; // already expired

  const recoveredSelection = recoveryPool.selectEligibleCredential();
  assert.strictEqual(recoveredSelection?.id, 'decart-key-1');
  assert.strictEqual(credToRecover.eligibility, 'healthy');
  console.log('  ✓ Expired cooldown restored credential back to healthy.');

  // --------------------------------------------------------------------------
  // TEST 8: Retry Logic Does Not Loop Infinitely (Bounded Fallback)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 8: Retry logic does not loop infinitely (bounded fallback)');
  const failingPool = new DecartKeyPool(mock32Configs.slice(0, 3));
  let mintAttempts = 0;
  for (const cred of (failingPool as any).credentials.values()) {
    cred.client = {
      tokens: {
        create: async () => {
          mintAttempts++;
          throw new Error('Temporary provider error');
        }
      }
    };
  }

  try {
    await failingPool.generateClientToken();
    assert.fail('Should have thrown an error');
  } catch (err: any) {
    assert.strictEqual(err.category, 'UNKNOWN');
    assert.strictEqual(mintAttempts <= 3, true, `Attempts (${mintAttempts}) must not exceed pool size`);
    console.log(`  ✓ Bounded fallback verified: stopped cleanly after ${mintAttempts} attempts without infinite loop.`);
  }

  // --------------------------------------------------------------------------
  // TEST 9: High Concurrency Integrity (128 parallel requests across 32 keys)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 9: Concurrency safety under 128 parallel async requests');
  const concurrentPool = new DecartKeyPool(mock32Configs);

  for (const cred of (concurrentPool as any).credentials.values()) {
    cred.client = {
      tokens: {
        create: async () => ({
          apiKey: `token_minted_by_${cred.id}`,
          expiresAt: new Date(Date.now() + 300000).toISOString()
        })
      }
    };
  }

  // Fire 128 concurrent token mint requests (exactly 4 per key for 32 keys)
  const concurrentRequests = Array.from({ length: 128 }, (_, idx) =>
    concurrentPool.generateClientToken({ userId: `user-${idx}` })
  );

  const results = await Promise.all(concurrentRequests);
  assert.strictEqual(results.length, 128);

  const distribution: Record<string, number> = {};
  for (const res of results) {
    distribution[res.credentialId] = (distribution[res.credentialId] || 0) + 1;
    assert.strictEqual(res.token.apiKey, `token_minted_by_${res.credentialId}`);
  }

  for (let i = 1; i <= 32; i++) {
    const id = `decart-key-${i}`;
    assert.strictEqual(
      distribution[id],
      4,
      `Key ${id} was used ${distribution[id]} times; expected exactly 4`
    );
  }
  console.log('  ✓ Concurrency integrity verified: 128 parallel requests distributed exactly 4 times per key across all 32 keys.');

  // --------------------------------------------------------------------------
  // TEST 10: Secret Isolation & Masking (Master API keys NEVER serialized)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 10: Secret isolation and masking verification');
  const statusReport = concurrentPool.getStatusReport();
  const serialized = JSON.stringify(statusReport);

  for (let i = 1; i <= 32; i++) {
    const rawSecret = `dct_synthetic_test_credential_slot_${String(i).padStart(2, '0')}_abcdef1234567890`;
    assert.strictEqual(
      serialized.includes(rawSecret),
      false,
      `Raw secret for key ${i} found in status report!`
    );
  }

  assert.strictEqual(statusReport.credentials.length, 32);
  for (const cred of statusReport.credentials) {
    assert.strictEqual(cred.maskedKey.startsWith('dct_'), true);
    assert.strictEqual(cred.maskedKey.endsWith('7890'), true);
    assert.strictEqual(cred.maskedKey.includes('...'), true);
  }
  console.log('  ✓ Secret isolation verified: zero permanent secrets serialized or exposed in telemetry.');

  console.log('\n================================================================');
  console.log('🎉 ALL 10 32-KEY ROTATION & AR TRY-ON TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
})();
