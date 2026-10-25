import assert from 'node:assert/strict';
import { getScanHistory, saveOutfitScan } from './scanHistoryService';

const storage = new Map<string, string>();
const scanHistoryKey = 'nova_outfit_scans_account-a';

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value)
  }
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { dispatchEvent: () => true }
});
Object.defineProperty(globalThis, 'CustomEvent', {
  configurable: true,
  value: class {
    constructor(readonly type: string, readonly init: { detail?: unknown }) {}
  }
});

assert.deepEqual(getScanHistory('account-a'), []);

storage.set(scanHistoryKey, JSON.stringify([
  { id: 'sc-1', name: 'Demo scan' },
  { id: 'real-scan', name: 'Real scan' }
]));
assert.deepEqual(getScanHistory('account-a').map((scan) => scan.id), ['real-scan']);
assert.deepEqual(JSON.parse(storage.get(scanHistoryKey) || '[]').map((scan: { id: string }) => scan.id), ['real-scan']);

const savedScan = saveOutfitScan({ name: 'New scan', imageUrl: 'real-scan-image' }, 'account-b');
assert.equal(getScanHistory('account-b')[0]?.id, savedScan.id);
assert.equal(getScanHistory('account-a').length, 1);
assert.equal(savedScan.score, undefined);

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: () => { throw new Error('Storage quota exceeded'); }
  }
});
assert.throws(() => saveOutfitScan({ name: 'Quota test', imageUrl: 'image' }, 'account-c'), /Storage quota exceeded/);

console.log('Scan history checks passed');
