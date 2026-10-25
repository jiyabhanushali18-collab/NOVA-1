import { apiUrl } from './apiClient';

export interface TryOnStyleScore {
  score: number;
  feedback: string;
}

export async function getTryOnStyleScore(
  imageDataUrl: string,
  garmentName: string,
  signal?: AbortSignal
): Promise<TryOnStyleScore> {
  const response = await fetch(apiUrl('/api/tryon/score'), {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ imageDataUrl, garmentName })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `AI style scoring failed with HTTP ${response.status}.`);
  }

  if (
    typeof data.score !== 'number' ||
    !Number.isInteger(data.score) ||
    data.score < 0 ||
    data.score > 100 ||
    typeof data.feedback !== 'string'
  ) {
    throw new Error('AI style scoring returned an invalid assessment.');
  }

  return { score: data.score, feedback: data.feedback };
}
