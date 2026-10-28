import { execSync } from 'node:child_process';

const args = {};
for (let i = 0; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const [rawKey, rawValue] = arg.slice(2).split('=');
  const key = rawKey.trim();
  if (!key) continue;
  if (rawValue !== undefined) {
    args[key] = rawValue;
    continue;
  }
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) {
    args[key] = next;
    i += 1;
  } else {
    args[key] = true;
  }
}

const versionName = args['version-name'];
const versionCodeInput = args['version-code'];
const repo = args.repo || process.env.GITHUB_REPOSITORY;

if (!versionName || !versionCodeInput || !repo) {
  throw new Error('Usage: node validate_release_version.mjs --version-name 1.2.3 --version-code 102 --repo owner/repo');
}

const versionCode = Number(versionCodeInput);
if (!Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error(`Invalid version code: ${versionCodeInput}`);
}

const fetchJson = (url) => {
  const response = execSync(`curl -fsSL "${url}"`, {
    std: 'pipe',
    encoding: 'utf-8',
    env: process.env,
  });
  return JSON.parse(response);
};

let previousVersionCode = null;
try {
  const release = fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
  const manifestAsset = release.assets?.find((asset) => asset.name === 'nova-update-manifest.json');
  if (manifestAsset?.browser_download_url) {
    const manifest = fetchJson(manifestAsset.browser_download_url);
    previousVersionCode = Number(manifest.versionCode);
  }
} catch {
  previousVersionCode = null;
}

if (previousVersionCode !== null && versionCode <= previousVersionCode) {
  throw new Error(
    `Release versionCode ${versionCode} is not greater than the last published versionCode ${previousVersionCode}. Failing closed.`
  );
}

console.log(`Version ${versionName} (code ${versionCode}) is valid for release.`);
