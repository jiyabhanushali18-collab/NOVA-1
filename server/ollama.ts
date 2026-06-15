import { GoogleGenAI } from '@google/genai';

const getGeminiResponse = async (prompt: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in .env.');
  }

  console.log('Calling Gemini model', model);

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.35,
      maxOutputTokens: 512,
    },
  });

  if (typeof response === 'string') {
    return response;
  }

  if (response?.text) {
    return response.text;
  }

  throw new Error('Invalid response from Gemini.');
};

export async function askModel(prompt: string): Promise<string> {
  return await getGeminiResponse(prompt);
}
