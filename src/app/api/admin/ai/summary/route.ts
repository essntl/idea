import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/guard";
import { runAiSummary } from "@/lib/ai/editing";

/** A short description / excerpt / summary for the editor's settings panel. */
export const POST = adminRoute(async (req) => NextResponse.json({ text: await runAiSummary(await readJson(req)) }));
