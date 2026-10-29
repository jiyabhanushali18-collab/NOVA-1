import fs from 'node:fs';

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

const versionName = args['version-name'] || process.env.APP_VERSION_NAME || '1.0.1';
const versionCode = Number(args['version-code'] || process.env.APP_VERSION_CODE || 1);
const repo = args.repo || process.env.GITHUB_REPOSITORY || 'owner/repo';
const tag = args.tag || process.env.TAG || `v${versionName}`;
const previousVersionCode = Number(args['previous-version-code'] || process.env.PREVIOUS_VERSION_CODE || Math.max(versionCode - 1, 0));

if (!Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error(`Invalid versionCode: ${versionCode}`);
}

const releaseDate = new Date().toISOString();
const apkUrl = `https://github.com/${repo}/releases/download/${tag}/NOVA-v${versionName}.apk`;
const manifest = {
  versionName,
  versionCode,
  minimumSupportedVersionCode: previousVersionCode,
  apkUrl,
  releaseNotes: [
    'Performance improvements',
    'Bug fixes and stability updates',
    'Updated Android release metadata'
  ],
  releaseDate,
  mandatory: false,
};

fs.writeFileSync('nova-update-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote update manifest for ${versionName} at nova-update-manifest.json`);
