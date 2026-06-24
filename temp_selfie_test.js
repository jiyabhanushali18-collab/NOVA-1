import http from 'http';
import fs from 'fs';

const path = 'C:/Users/Jiya/Downloads/utsav.jpeg';
const buf = fs.readFileSync(path);
const dataURL = 'data:image/jpeg;base64,' + buf.toString('base64');
const body = JSON.stringify({ imageDataUrl: dataURL, userId: 'test@example.com', forceRefresh: true });

const req = http.request(
  {
    method: 'POST',
    host: '127.0.0.1',
    port: 3000,
    path: '/api/analyze-selfie',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('status', res.statusCode);
      console.log(data);
    });
  }
);

req.on('error', (e) => { console.error('ERR', e.message); });
req.write(body);
req.end();
