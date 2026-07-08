const OLLAMA_URL = "http://localhost:11434/api/chat";

const conversation = [
  {
    role: "system",
    content:
      "You are NOVA AI. You are friendly, intelligent and concise. Remember the conversation naturally."
  }
];

export async function askModel(message: string): Promise<string> {
  conversation.push({
    role: "user",
    content: message,
  });

  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen2.5:7b",
      messages: conversation,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to connect to Ollama");
  }

  const data = await response.json();

  const reply = data.message.content;

  conversation.push({
    role: "assistant",
    content: reply,
  });

  return reply;
}