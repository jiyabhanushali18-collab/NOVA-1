import fetch from 'node-fetch';
import fs from 'fs';

const envFile = './.env.local';
const content = fs.readFileSync(envFile, 'utf8');
const match = content.match(/GEMINI_API_KEY\s*=\s*"([^"]+)"/);
if (!match) {
  console.error('No GEMINI_API_KEY found in .env.local');
  process.exit(1);
}
const apiKey = match[1];
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
console.log('Calling', url);
const run = async () => {
  const res = await fetch(url, { method: 'GET' });
  console.log('status', res.status, res.statusText);
  const text = await res.text();
  console.log(text);
};
run().catch((err) => { console.error('ERROR', err); process.exit(1); });
