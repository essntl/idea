import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/guard";
import { loadSettings, saveSettings, settingsSchema } from "@/lib/settings";
import { revalidate } from "@/lib/revalidate";

export const GET = adminRoute(async () => NextResponse.json(await loadSettings()));

export const PUT = adminRoute(async (req) => {
  const patch = settingsSchema.partial().parse(await readJson(req));
  const settings = await saveSettings(patch);
  revalidate("settings", "content");
  return NextResponse.json(settings);
});
