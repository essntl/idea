import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { aiText, getAiConfig } from "@/lib/ai/client";

const schema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  model: z.string().trim().max(120),
  baseUrl: z.string().trim().max(500),
});

/** Sends a tiny request with the settings from the form (saved or not) and the stored key. */
export const POST = adminRoute(async (req) => {
  const form = schema.parse(await readJson(req));
  const cfg = await getAiConfig({ ...form, ignoreEnabled: true });
  if (!cfg) {
    throw new HttpError(400, form.provider === "anthropic" ? "Add an API key first." : "Enter the base URL and a model name first.");
  }
  const reply = await aiText(cfg, { system: "You are a connection test. Reply with the single word OK.", prompt: "Test", maxTokens: 16 });
  return NextResponse.json({ ok: true, model: cfg.model, reply: reply.slice(0, 40) });
});
