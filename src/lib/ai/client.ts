import "server-only";
import { prisma } from "../db";
import { loadSettings } from "../settings";
import { HttpError } from "../errors";
import { decryptSecret, encryptSecret, SECRET_PREFIX } from "../secrets";

/**
 * Minimal AI client for two API shapes: Anthropic's Messages API and the OpenAI-compatible Chat Completions API
 * (OpenAI, OpenRouter, a local Ollama, …). Plain fetch, no SDK: requests are small and non-streaming.
 */

const KEY_SETTING = `${SECRET_PREFIX}aiApiKey`;
const TIMEOUT_MS = 120_000;

export type AiProvider = "anthropic" | "openai";
export type AiConfig = { provider: AiProvider; model: string; baseUrl: string; apiKey: string };

/* ---------------------------------- key ---------------------------------- */

async function storedKey(): Promise<{ key: string | null; unreadable: boolean }> {
  const row = await prisma.setting.findUnique({ where: { key: KEY_SETTING } });
  if (!row || typeof row.value !== "string") return { key: null, unreadable: false };
  const key = decryptSecret(row.value);
  return { key, unreadable: key === null };
}

/** For the settings page: where the key comes from and its last characters. Never the key itself. */
export async function aiKeyStatus(): Promise<{ source: "env" | "saved" | null; hint: string | null; unreadable: boolean }> {
  const env = process.env.AI_API_KEY?.trim();
  if (env) return { source: "env", hint: env.slice(-4), unreadable: false };
  const { key, unreadable } = await storedKey();
  return { source: key ? "saved" : null, hint: key ? key.slice(-4) : null, unreadable };
}

export async function saveAiKey(key: string) {
  const value = encryptSecret(key.trim());
  await prisma.setting.upsert({ where: { key: KEY_SETTING }, create: { key: KEY_SETTING, value }, update: { value } });
}

export async function deleteAiKey() {
  await prisma.setting.deleteMany({ where: { key: KEY_SETTING } });
}

/* --------------------------------- config -------------------------------- */

/** Used when the model field is empty. OpenAI-compatible endpoints host different models, so they need one entered. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";

/**
 * The active configuration, or null when AI is off or incomplete. `overrides` lets the settings page test
 * unsaved provider/model choices with the stored key.
 */
export async function getAiConfig(overrides: Partial<Omit<AiConfig, "apiKey">> & { ignoreEnabled?: boolean } = {}): Promise<AiConfig | null> {
  const s = await loadSettings();
  if (!s.aiEnabled && !overrides.ignoreEnabled) return null;
  const provider = overrides.provider ?? s.aiProvider;
  const model = (overrides.model ?? s.aiModel).trim() || (provider === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : "");
  const baseUrl = (overrides.baseUrl ?? s.aiBaseUrl).trim().replace(/\/+$/, "");
  const apiKey = process.env.AI_API_KEY?.trim() || (await storedKey()).key || "";
  if (provider === "anthropic" && !apiKey) return null;
  if (provider === "openai" && (!baseUrl || !model)) return null; // a local endpoint (Ollama) may not need a key
  return { provider, model, baseUrl, apiKey };
}

export async function requireAiConfig(): Promise<AiConfig> {
  const cfg = await getAiConfig();
  if (!cfg) throw new HttpError(400, "AI isn't set up. Turn it on and add an API key in Admin → Settings → AI assistant.");
  return cfg;
}

/* -------------------------------- requests -------------------------------- */

type Request = { system: string; prompt: string; maxTokens?: number };
type JsonRequest<T> = Request & {
  name: string;
  description: string;
  /** JSON Schema of the expected object. */
  schema: Record<string, unknown>;
  parse: (value: unknown) => T;
};

/** Sends a request and returns the response once it's OK; connection and HTTP errors become readable messages. */
async function send(url: string, init: RequestInit, opts: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<Response> {
  let res: Response | null = null;
  // One retry for connection failures (e.g. a connect timeout); never for slow answers.
  for (let attempt = 0; !res; attempt++) {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS);
    try {
      res = await fetch(url, { ...init, cache: "no-store", signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout });
    } catch (err) {
      const e = err as Error & { cause?: { code?: string } };
      if (opts.signal?.aborted) throw new HttpError(499, "Stopped.");
      if (e.name === "TimeoutError") throw new HttpError(502, "The AI provider took too long to answer.");
      if (attempt >= 1) throw new HttpError(502, `Couldn't reach the AI provider (${e.cause?.code ?? e.message}). Check the server's internet connection or the base URL.`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (res.ok) return res;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } | string; message?: string } | null;
  const detail = typeof body?.error === "string" ? body.error : (body?.error?.message ?? body?.message ?? "");
  const reason =
    res.status === 401 || res.status === 403
      ? "The AI provider rejected the API key."
      : res.status === 404
        ? "The AI provider doesn't know this model (or the base URL is wrong)."
        : res.status === 429
          ? "The AI provider is rate limiting requests. Try again in a moment."
          : `The AI provider returned an error (${res.status}).`;
  throw new HttpError(502, detail ? `${reason} ${detail}`.trim() : reason);
}

async function call(url: string, init: RequestInit): Promise<unknown> {
  return (await send(url, init)).json();
}

const anthropicRequest = (cfg: AiConfig, body: Record<string, unknown>): [string, RequestInit] => [
  "https://api.anthropic.com/v1/messages",
  {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: cfg.model, ...body }),
  },
];

const openaiRequest = (cfg: AiConfig, body: Record<string, unknown>): [string, RequestInit] => [
  `${cfg.baseUrl}/chat/completions`,
  {
    method: "POST",
    headers: { "content-type": "application/json", ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify({ model: cfg.model, ...body }),
  },
];

const anthropic = (cfg: AiConfig, body: Record<string, unknown>) => call(...anthropicRequest(cfg, body));
const openai = (cfg: AiConfig, body: Record<string, unknown>) => call(...openaiRequest(cfg, body));

type AnthropicResponse = { content?: ({ type: "text"; text: string } | { type: "tool_use"; name: string; input: unknown })[] };
type OpenAiResponse = {
  choices?: { finish_reason?: string | null; message?: { content?: string | { type?: string; text?: string }[] | null } }[];
};

/**
 * Reasoning models (GPT-5/6, o-series, DeepSeek R1, …) spend part of the token limit thinking before they answer,
 * so a small limit can end before any text. OpenAI-compatible requests therefore always get room for that;
 * the limit is a cap, not a cost, so unused tokens aren't billed.
 */
const MIN_OPENAI_TOKENS = 8192;

export async function aiText(cfg: AiConfig, req: Request): Promise<string> {
  const maxTokens = req.maxTokens ?? 2048;
  let text: string;
  let cutOff = false;
  if (cfg.provider === "anthropic") {
    const res = (await anthropic(cfg, { max_tokens: maxTokens, system: req.system, messages: [{ role: "user", content: req.prompt }] })) as AnthropicResponse;
    text = (res.content ?? []).map((b) => (b.type === "text" ? b.text : "")).join("");
  } else {
    const res = (await openai(cfg, {
      max_tokens: Math.max(maxTokens, MIN_OPENAI_TOKENS),
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
    })) as OpenAiResponse;
    const choice = res.choices?.[0];
    const content = choice?.message?.content;
    // Some providers return the answer as a list of parts.
    text = Array.isArray(content) ? content.map((p) => p.text ?? "").join("") : (content ?? "");
    cutOff = choice?.finish_reason === "length";
  }
  if (!text.trim()) {
    throw new HttpError(
      502,
      cutOff
        ? "The model used its whole token budget before answering (reasoning models think first). Try again, or pick a model with less reasoning."
        : "The AI returned an empty answer. Check that the model name is right for this provider.",
    );
  }
  return text.trim();
}

/** First JSON object in a model's text answer (tolerates ```json fences and surrounding prose). */
export function extractJson(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new HttpError(502, "The AI didn't return the expected data.");
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    throw new HttpError(502, "The AI returned malformed data.");
  }
}

/**
 * Structured answer. Anthropic: a forced tool call, so the output always matches the schema's shape.
 * OpenAI-compatible endpoints differ in their JSON support, so they get the schema in the prompt instead.
 */
export async function aiJson<T>(cfg: AiConfig, req: JsonRequest<T>): Promise<T> {
  const maxTokens = req.maxTokens ?? 4096;
  let value: unknown;
  if (cfg.provider === "anthropic") {
    const res = (await anthropic(cfg, {
      max_tokens: maxTokens,
      system: req.system,
      tools: [{ name: req.name, description: req.description, input_schema: req.schema }],
      tool_choice: { type: "tool", name: req.name },
      messages: [{ role: "user", content: req.prompt }],
    })) as AnthropicResponse;
    const block = res.content?.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new HttpError(502, "The AI didn't return the expected data.");
    value = block.input;
  } else {
    const text = await aiText(cfg, {
      system: `${req.system}\n\nAnswer with a single JSON object and nothing else. It must match this JSON Schema:\n${JSON.stringify(req.schema)}`,
      prompt: req.prompt,
      maxTokens,
    });
    value = extractJson(text);
  }
  try {
    return req.parse(value);
  } catch {
    throw new HttpError(502, "The AI's answer was incomplete. Try again.");
  }
}

/** Whether editors should offer AI features. */
export async function aiAvailable(): Promise<boolean> {
  return !!(await getAiConfig());
}

/* -------------------------------- streaming ------------------------------- */

/** `data:` payloads of a server-sent event stream. */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line.startsWith("data:")) yield line.slice(5).trimStart();
    }
  }
  if (buffer.startsWith("data:")) yield buffer.slice(5).trimStart();
}

const STREAM_TIMEOUT_MS = 180_000;

/**
 * Streams the answer as text deltas. The request is sent (and HTTP errors are thrown) before this resolves,
 * so callers can still answer with a proper error status; errors during the stream are thrown from the iterator.
 */
export async function aiStream(cfg: AiConfig, req: Request, signal?: AbortSignal): Promise<AsyncGenerator<string>> {
  const maxTokens = req.maxTokens ?? 4096;
  const opts = { signal, timeoutMs: STREAM_TIMEOUT_MS };
  if (cfg.provider === "anthropic") {
    const res = await send(
      ...anthropicRequest(cfg, { max_tokens: maxTokens, stream: true, system: req.system, messages: [{ role: "user", content: req.prompt }] }),
      opts,
    );
    return (async function* () {
      for await (const data of sseData(res.body!)) {
        const ev = JSON.parse(data) as { type: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) yield ev.delta.text;
        else if (ev.type === "error") throw new HttpError(502, ev.error?.message ?? "The AI provider stopped with an error.");
      }
    })();
  }
  const res = await send(
    ...openaiRequest(cfg, {
      max_tokens: Math.max(maxTokens, MIN_OPENAI_TOKENS),
      stream: true,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
    }),
    opts,
  );
  return (async function* () {
    for await (const data of sseData(res.body!)) {
      if (data === "[DONE]") return;
      if (!data.startsWith("{")) continue; // keep-alive comments some providers send
      const ev = JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[]; error?: { message?: string } };
      if (ev.error) throw new HttpError(502, ev.error.message ?? "The AI provider stopped with an error.");
      const text = ev.choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  })();
}
