const OLLAMA_URL = "http://localhost:11434/api/generate";

export async function askModel(prompt: string): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen2.5:7b",
      prompt,
      stream: false,
      options: {
        temperature: 0.4,
        num_predict: 300,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to connect to Ollama");
  }

  const data = await response.json();

  return data.response.trim();
}