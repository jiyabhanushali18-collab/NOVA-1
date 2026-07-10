const OLLAMA_URL = "http://localhost:11434/api/chat";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

const conversations = new Map<string, Message[]>();

const SYSTEM_PROMPT: Message = {
  role: "system",
  content: `
You are NOVA AI.

You are friendly, intelligent and helpful.

Remember previous messages in the conversation.

Answer naturally.

Never mention that you are using memory.

Keep answers concise unless the user asks for details.
`,
};

export async function askModel(
  sessionId: string,
  message: string
): Promise<string> {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, [SYSTEM_PROMPT]);
  }

  const history = conversations.get(sessionId)!;

  history.push({
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
      messages: history,
      stream: true,
        options: {
          temperature: 0.4,
          num_predict: 120,
          top_k: 20,
          top_p: 0.9,
        },
    }),
  });

  if (!response.ok) {
    throw new Error("Ollama request failed");
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();

  let reply = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    const chunk = decoder.decode(value);

    const lines = chunk
      .split("\n")
      .filter((line) => line.trim());

    for (const line of lines) {
      try {
        const json = JSON.parse(line);

        if (json.message?.content) {
          reply += json.message.content;
        }
      } catch {}
    }
  }

  history.push({
    role: "assistant",
    content: reply,
  });
  // Keep system prompt + last 20 messages
  if (history.length > 11) {
    const system = history[0];
    const recent = history.slice(-20);

    conversations.set(sessionId, [system, ...recent]);
  }
  return reply;
}