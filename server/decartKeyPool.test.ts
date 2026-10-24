import assert from 'assert';
import {
  DecartKeyPool,
  maskApiKey,
  classifyDecartError,
  CredentialConfig
} from './decartKeyPool';

console.log('--- RUNNING DECART KEY POOL TESTS ---');

// 1. Test Key Masking Security
{
  const masked1 = maskApiKey('dct_sample_test_credential_dummy_key_0123456789abcdef');
  assert.strictEqual(masked1.startsWith('dct_'), true);
  assert.strictEqual(masked1.endsWith('cdef'), true);
  assert.strictEqual(masked1.includes('...'), true);
  assert.strictEqual(masked1.length < 20, true);
  assert.strictEqual(maskApiKey(''), '***');
  console.log('✓ 1. Key Masking Security verified (secrets never exposed).');
}

// 2. Test Error Classification
{
  // 402 Insufficient credits
  const c402 = classifyDecartError({ status: 402, message: 'insufficient_credits for this organization' });
  assert.strictEqual(c402.category, 'INSUFFICIENT_CREDITS');
  assert.strictEqual(c402.statusCode, 402);
  assert.strictEqual(c402.retryable, true);

  // 401 Invalid key
  const c401 = classifyDecartError({ status: 401, message: 'invalid_api_key' });
  assert.strictEqual(c401.category, 'INVALID_API_KEY');
  assert.strictEqual(c401.quarantine, true);

  // 429 Rate limited
  const c429 = classifyDecartError({ status: 429, message: 'too many requests' });
  assert.strictEqual(c429.category, 'RATE_LIMITED');
  assert.strictEqual(c429.quarantine, false);

  // 1013 Concurrent session limit
  const c1013 = classifyDecartError({ message: 'session limit reached: concurrent session limit reached' });
  assert.strictEqual(c1013.category, 'CONCURRENT_SESSION_LIMIT');

  // Temporary capacity
  const cCap = classifyDecartError({ message: 'capacity_exceeded: Try Again Later' });
  assert.strictEqual(cCap.category, 'TEMPORARY_CAPACITY');

  // Network failure
  const cNet = classifyDecartError({ message: 'fetch failed: ECONNREFUSED' });
  assert.strictEqual(cNet.category, 'NETWORK_FAILURE');

  console.log('✓ 2. Error Classification verified across all Decart error codes.');
}

// 3. Test Backward-Compatible Single Key Pool Initialization
{
  const pool = new DecartKeyPool([
    { id: 'single-key', apiKey: 'dct_dummy_single_key_1234567890' }
  ]);
  const status = pool.getStatusReport();
  assert.strictEqual(status.totalCredentials, 1);
  assert.strictEqual(status.healthyCount, 1);
  assert.strictEqual(status.credentials[0].id, 'single-key');
  assert.strictEqual(status.credentials[0].maskedKey, 'dct_...7890');
  console.log('✓ 3. Single-Key backward compatibility verified.');
}

// 4. Test Atomic Round-Robin Selection
{
  const pool = new DecartKeyPool([
    { id: 'key-a', apiKey: 'dct_dummy_a_1234567890', priority: 1, quotaGroup: 'acct-1' },
    { id: 'key-b', apiKey: 'dct_dummy_b_1234567890', priority: 1, quotaGroup: 'acct-2' },
    { id: 'key-c', apiKey: 'dct_dummy_c_1234567890', priority: 1, quotaGroup: 'acct-3' },
  ]);

  const sel1 = pool.selectEligibleCredential();
  const sel2 = pool.selectEligibleCredential();
  const sel3 = pool.selectEligibleCredential();
  const sel4 = pool.selectEligibleCredential();

  assert.strictEqual(sel1?.id, 'key-a');
  assert.strictEqual(sel2?.id, 'key-b');
  assert.strictEqual(sel3?.id, 'key-c');
  assert.strictEqual(sel4?.id, 'key-a'); // Wraps around
  console.log('✓ 4. Atomic Round-Robin selection verified.');
}

// 5. Test Quota Group Awareness and Exclusion
{
  const pool = new DecartKeyPool([
    { id: 'key-1a', apiKey: 'dct_dummy_org1_key_a_1234567890', quotaGroup: 'org-1' },
    { id: 'key-1b', apiKey: 'dct_dummy_org1_key_b_1234567890', quotaGroup: 'org-1' },
    { id: 'key-2a', apiKey: 'dct_dummy_org2_key_a_1234567890', quotaGroup: 'org-2' },
  ]);

  // Mark org-1 as exhausted
  pool.setQuotaGroupExhausted('org-1', 60000, 'Credits depleted');

  // Both key-1a and key-1b should now be marked exhausted
  const status = pool.getStatusReport();
  assert.strictEqual(status.healthyCount, 1);
  assert.strictEqual(status.exhaustedCount, 2);

  // Selection must choose key-2a (the only healthy quota group)
  const sel = pool.selectEligibleCredential();
  assert.strictEqual(sel?.id, 'key-2a');
  assert.strictEqual(sel?.quotaGroup, 'org-2');
  console.log('✓ 5. Quota Group Awareness verified (keys sharing account skipped when account exhausted).');
}

// 6. Test Cooldown Expiration Handling
{
  const pool = new DecartKeyPool([
    { id: 'cooldown-key', apiKey: 'dct_dummy_cooldown_key_1234567890', quotaGroup: 'acct-cd' }
  ]);

  pool.setQuotaGroupExhausted('acct-cd', 10, 'Brief test exhaustion');
  assert.strictEqual(pool.getEligibleCredentialsCount(), 0);

  // Wait for 20ms so cooldown expires
  setTimeout(() => {
    assert.strictEqual(pool.getEligibleCredentialsCount(), 1);
    const sel = pool.selectEligibleCredential();
    assert.strictEqual(sel?.id, 'cooldown-key');
    console.log('✓ 6. Cooldown Expiration Handling verified.');
  }, 25);
}

// 7. Test Fallback Token Generation
(async () => {
  const pool = new DecartKeyPool([
    { id: 'exhausted-key', apiKey: 'dct_fake_key_1', quotaGroup: 'group-1' },
    { id: 'healthy-key', apiKey: 'dct_fake_key_2', quotaGroup: 'group-2' },
  ]);

  // Mock Decart client on exhausted-key to throw 402 insufficient_credits
  const cred1 = (pool as any).credentials.get('exhausted-key');
  cred1.client = {
    tokens: {
      create: async () => {
        const err: any = new Error('insufficient_credits');
        err.status = 402;
        throw err;
      }
    }
  };

  // Mock Decart client on healthy-key to succeed
  const cred2 = (pool as any).credentials.get('healthy-key');
  cred2.client = {
    tokens: {
      create: async () => ({
        apiKey: 'ek_mock_ephemeral_client_token_12345',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      })
    }
  };

  const result = await pool.generateClientToken({ expiresIn: 3600 });
  assert.strictEqual(result.credentialId, 'healthy-key');
  assert.strictEqual(result.quotaGroup, 'group-2');
  assert.strictEqual(result.fallbackCount, 1);
  assert.strictEqual(result.token.apiKey, 'ek_mock_ephemeral_client_token_12345');

  // Verify exhausted-key is now marked exhausted
  const status = pool.getStatusReport();
  const s1 = status.credentials.find(c => c.id === 'exhausted-key');
  assert.strictEqual(s1?.eligibility, 'exhausted');
  assert.strictEqual(s1?.lastErrorCategory, 'INSUFFICIENT_CREDITS');

  console.log('✓ 7. Bounded Automatic Fallback verified (automatically pivoted to independent quota group).');

  // 8. Test All Credentials Exhausted Error
  cred2.client.tokens.create = async () => {
    const err: any = new Error('insufficient_credits');
    err.status = 402;
    throw err;
  };

  let threw = false;
  try {
    await pool.generateClientToken();
  } catch (err: any) {
    threw = true;
    assert.strictEqual(err.category, 'INSUFFICIENT_CREDITS');
    assert.strictEqual(err.status, 402);
  }
  assert.strictEqual(threw, true);
  console.log('✓ 8. Clean error propagation when all credentials exhausted verified.');

  // 9. Test Secret Isolation in Status Report
  const fullStatus = pool.getStatusReport();
  const statusString = JSON.stringify(fullStatus);
  assert.strictEqual(statusString.includes('dct_fake_key_1'), false);
  assert.strictEqual(statusString.includes('dct_fake_key_2'), false);
  assert.strictEqual(statusString.includes('...'), true);
  console.log('✓ 9. Secret Isolation verified: raw API keys completely absent from status report.');

  // 10. Test Runtime Feedback Recording
  pool.recordSessionFeedback('healthy-key', 'terminal_error', 'insufficient_credits');
  assert.strictEqual((pool as any).quotaGroupStates.get('group-2')?.exhausted, true);
  console.log('✓ 10. Runtime client session feedback handling verified.');

  console.log('\nALL DECART KEY POOL TESTS PASSED SUCCESSFULLY! ✨\n');
})();
