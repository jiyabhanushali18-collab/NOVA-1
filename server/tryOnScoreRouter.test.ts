import assert from 'node:assert/strict';
import express from 'express';
import tryOnScoreRouter from './tryOnScoreRouter';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = 'test-gemini-key';

const app = express();
app.use(express.json());
app.use('/api', tryOnScoreRouter);

const server = app.listen(0);

const getBaseUrl = async () => {
  if (server.listening) {
    const address = server.address();
    assert(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}/api/tryon/score`;
  }

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}/api/tryon/score`;
};

const responseFor = (assessment: object) => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: JSON.stringify(assessment) }] } }]
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

(async () => {
  try {
    const url = await getBaseUrl();
    let requestUrl = '';
    let requestBody: Record<string, any> = {};
    globalThis.fetch = (async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return responseFor({ assessable: true, score: 87.4, feedback: 'Colors coordinate well.' });
    }) as typeof fetch;

    const invalidImage = await originalFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: 'not-an-image' })
    });
    assert.equal(invalidImage.status, 400);

    const successful = await originalFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: 'data:image/jpeg;base64,dGVzdA==',
        garmentName: 'Lavender Hoodie'
      })
    });
    assert.equal(successful.status, 200);
    assert.deepEqual(await successful.json(), { score: 87, feedback: 'Colors coordinate well.' });
    assert.match(requestUrl, /key=test-gemini-key/);
    assert.match(requestBody.contents[0].parts[0].text, /Ignore identity, attractiveness, body shape or size/);
    assert.equal(requestBody.contents[0].parts[1].inline_data.mime_type, 'image/jpeg');

    globalThis.fetch = (async () => responseFor({
      assessable: false,
      score: 50,
      feedback: 'The outfit is not clear.'
    })) as typeof fetch;
    const unassessable = await originalFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: 'data:image/jpeg;base64,dGVzdA==' })
    });
    assert.equal(unassessable.status, 422);

    globalThis.fetch = (async () => responseFor({
      assessable: true,
      score: 101,
      feedback: 'Invalid score.'
    })) as typeof fetch;
    const outOfRange = await originalFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: 'data:image/jpeg;base64,dGVzdA==' })
    });
    assert.equal(outOfRange.status, 502);

    console.log('Try-on style score route tests passed.');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
