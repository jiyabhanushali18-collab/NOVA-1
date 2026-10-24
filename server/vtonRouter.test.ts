import assert from 'assert';
import express from 'express';
import vtonRouter from './vtonRouter';
import { decartKeyPool } from './decartKeyPool';

console.log('--- RUNNING VTON ROUTER & POOL INTEGRATION TESTS ---');
process.env.DECART_ADMIN_SECRET = 'test-secret-suite-key-2026';

const app = express();
app.use(express.json());
app.use('/api', vtonRouter);

const server = app.listen(0);
const port = (server.address() as any).port;
const baseUrl = `http://127.0.0.1:${port}/api`;

(async () => {
  try {
    // 1. Test Admin unauthorized access (no admin secret)
    {
      const res = await fetch(`${baseUrl}/vton/admin/pool-status`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Unauthorized'), true);
      console.log('✓ 1. Admin endpoints strictly protected against unauthorized access.');
    }

    // 2. Test Admin authorized access with X-Admin-Key
    {
      decartKeyPool.loadFromConfigs([
        { id: 'test-cred-1', apiKey: 'dct_dummy_admin_test_key_123', priority: 1 }
      ]);

      const res = await fetch(`${baseUrl}/vton/admin/pool-status`, {
        headers: {
          'x-admin-key': 'test-secret-suite-key-2026'
        }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.totalCredentials, 1);
      assert.strictEqual(Array.isArray(json.credentials), true);
      // Ensure no raw keys exist in the payload
      const str = JSON.stringify(json);
      assert.strictEqual(str.includes('dct_dummy_admin_test_key_123'), false);
      assert.strictEqual(str.includes('maskedKey'), true);
      console.log('✓ 2. Admin pool-status returns sanitized telemetry without exposing secrets.');
    }

    // 3. Test Session Event Feedback
    {
      const res = await fetch(`${baseUrl}/vton/session-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId: 'test-cred-id',
          event: 'session_error',
          reason: 'client test error'
        })
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.ok, true);
      console.log('✓ 3. Client runtime session-event feedback endpoint verified.');
    }

    // 4. Test Admin Key Toggle
    {
      // Add a dummy test credential into the pool
      decartKeyPool.loadFromConfigs([
        { id: 'admin-toggle-test', apiKey: 'dct_dummy_toggle_key_123', priority: 1 }
      ]);

      const toggleRes = await fetch(`${baseUrl}/vton/admin/toggle-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'test-secret-suite-key-2026'
        },
        body: JSON.stringify({ id: 'admin-toggle-test', enabled: false })
      });
      assert.strictEqual(toggleRes.status, 200);
      const toggleJson = await toggleRes.json();
      assert.strictEqual(toggleJson.ok, true);

      // Verify it's now disabled
      const cred = toggleJson.status.credentials.find((c: any) => c.id === 'admin-toggle-test');
      assert.strictEqual(cred?.enabled, false);
      console.log('✓ 4. Admin credential toggle verified.');
    }

    // 5. Test Admin Health Reset
    {
      const resetRes = await fetch(`${baseUrl}/vton/admin/reset-health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'test-secret-suite-key-2026'
        },
        body: JSON.stringify({})
      });
      assert.strictEqual(resetRes.status, 200);
      const resetJson = await resetRes.json();
      assert.strictEqual(resetJson.ok, true);
      console.log('✓ 5. Admin reset-health verified.');
    }

    // 6. Test Token Endpoint Rate Limiting (Abuse Prevention)
    {
      let rateLimited = false;
      for (let i = 0; i < 35; i++) {
        const r = await fetch(`${baseUrl}/vton/token`);
        if (r.status === 429) {
          rateLimited = true;
          break;
        }
      }
      assert.strictEqual(rateLimited, true);
      console.log('✓ 6. Abuse prevention / Token endpoint rate limiting verified.');
    }

    console.log('\nALL VTON ROUTER & POOL INTEGRATION TESTS PASSED! ✨\n');
  } finally {
    server.close();
  }
})();
