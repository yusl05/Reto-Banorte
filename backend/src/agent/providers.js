const DEFAULT_TIMEOUT_MS = 12_000;

export class ProviderError extends Error {
  constructor(provider, message, { retryable = true } = {}) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.retryable = retryable;
  }
}

function timeoutSignal(timeoutMs) {
  return AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || timeoutMs || DEFAULT_TIMEOUT_MS));
}

async function requestJson(provider, url, options) {
  try {
    const response = await fetch(url, { ...options, signal: timeoutSignal() });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ProviderError(provider, `HTTP ${response.status}`, {
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      });
    }
    return body;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(provider, error.name === "TimeoutError" ? "timeout" : error.message);
  }
}

function openAITools(tools) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function openAIMessages(messages) {
  return messages.map((message) => {
    if (message.role === "assistant" && message.toolCalls?.length) {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.input || {}) },
        })),
      };
    }
    if (message.role === "tool") {
      return {
        role: "tool",
        tool_call_id: message.toolCallId,
        content: JSON.stringify(message.content),
      };
    }
    return { role: message.role, content: message.content || "" };
  });
}

function normalizeOpenAI(provider, body) {
  const message = body?.choices?.[0]?.message;
  if (!message) throw new ProviderError(provider, "respuesta sin choices", { retryable: true });
  const toolCalls = (message.tool_calls || []).map((call) => {
    try {
      if (!call.id || !call.function?.name) throw new Error("tool call incompleto");
      const input = JSON.parse(call.function.arguments || "{}");
      return { id: call.id, name: call.function.name, input };
    } catch {
      throw new ProviderError(provider, "argumentos de tool inválidos", { retryable: true });
    }
  });
  if (!message.content && !toolCalls.length) {
    throw new ProviderError(provider, "respuesta sin texto ni tool call", { retryable: true });
  }
  return { text: message.content || "", toolCalls, assistantMessage: message };
}

function openAIProvider({ name, apiKey, endpoint, model }) {
  return {
    name,
    enabled: Boolean(apiKey),
    async complete({ systemPrompt, messages, tools }) {
      const body = await requestJson(name, endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...openAIMessages(messages)],
          tools: openAITools(tools),
          max_tokens: 512,
        }),
      });
      return normalizeOpenAI(name, body);
    },
  };
}

function geminiMessages(messages) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "user",
        parts: [{ functionResponse: { name: message.name, response: message.content } }],
      };
    }
    if (message.role === "assistant") {
      return {
        role: "model",
        parts: message.toolCalls?.length
          ? message.toolCalls.map((call) => ({ functionCall: { name: call.name, args: call.input } }))
          : [{ text: message.content || "" }],
      };
    }
    return { role: "user", parts: [{ text: message.content || "" }] };
  });
}

function geminiProvider({ apiKey, endpoint, model }) {
  return {
    name: "gemini",
    enabled: Boolean(apiKey),
    async complete({ systemPrompt, messages, tools }) {
      const body = await requestJson("gemini", `${endpoint}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages(messages),
          tools: [{ functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          })) }],
          generationConfig: { maxOutputTokens: 512 },
        }),
      });
      const parts = body?.candidates?.[0]?.content?.parts;
      if (!parts?.length) throw new ProviderError("gemini", "respuesta sin contenido", { retryable: true });
      const toolCalls = parts.filter((part) => part.functionCall).map((part, index) => ({
        id: `gemini-${index}`,
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      }));
      const text = parts.filter((part) => part.text).map((part) => part.text).join(" ").trim();
      if (!text && !toolCalls.length) throw new ProviderError("gemini", "respuesta inválida", { retryable: true });
      return { text, toolCalls, assistantMessage: { role: "assistant", content: text, toolCalls } };
    },
  };
}

export function getProviders() {
  return [
    geminiProvider({
      apiKey: process.env.GEMINI_API_KEY,
      endpoint: process.env.GEMINI_ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models",
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    }),
    openAIProvider({
      name: "grok",
      apiKey: process.env.GROK_API_KEY,
      endpoint: process.env.GROK_ENDPOINT || "https://api.x.ai/v1/chat/completions",
      model: process.env.GROK_MODEL || "grok-3-mini",
    }),
    openAIProvider({
      name: "huggingface",
      apiKey: process.env.HUGGINGFACE_API_KEY,
      endpoint: process.env.HUGGINGFACE_ENDPOINT || "https://router.huggingface.co/v1/chat/completions",
      model: process.env.HUGGINGFACE_MODEL || "meta-llama/Llama-3.1-8B-Instruct",
    }),
    openAIProvider({
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      endpoint: process.env.OPENROUTER_ENDPOINT || "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
    }),
  ].filter((provider) => provider.enabled);
}
