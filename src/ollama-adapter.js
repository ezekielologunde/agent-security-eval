// Minimal Ollama /api/chat adapter with tool-calling. Local homelab inference only
// (OLLAMA_HOST env var, default the LAN address used throughout this portfolio set);
// nothing here is reachable from the public internet.

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://192.168.1.246:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5-3b-cpu4";

export function toOllamaTools(toolDefs) {
  return toolDefs.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export async function chat(messages, toolDefs) {
  const started = Date.now();
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: toOllamaTools(toolDefs),
      stream: false,
      options: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    throw new Error(`ollama ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const latencyMs = Date.now() - started;
  const msg = data.message ?? {};
  const toolCalls = (msg.tool_calls ?? []).map((tc) => ({
    name: tc.function?.name,
    args: typeof tc.function?.arguments === "string" ? safeJson(tc.function.arguments) : (tc.function?.arguments ?? {}),
  }));
  return {
    content: msg.content ?? "",
    toolCalls,
    latencyMs,
    evalCount: data.eval_count ?? null,
    promptEvalCount: data.prompt_eval_count ?? null,
    model: MODEL,
  };
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return { _unparsed: s };
  }
}

export const ADAPTER_MODEL = MODEL;
export const ADAPTER_HOST = OLLAMA_HOST;
