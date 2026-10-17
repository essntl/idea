import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/guard";
import { aiKeyStatus, deleteAiKey, saveAiKey } from "@/lib/ai/client";

/** Stores the AI API key encrypted. The key is never returned, only its last four characters. */
export const PUT = adminRoute(async (req) => {
  const { key } = z.object({ key: z.string().trim().min(8, "That doesn't look like an API key").max(500) }).parse(await readJson(req));
  await saveAiKey(key);
  return NextResponse.json(await aiKeyStatus());
});

export const DELETE = adminRoute(async () => {
  await deleteAiKey();
  return NextResponse.json(await aiKeyStatus());
});
