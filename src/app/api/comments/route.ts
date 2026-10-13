import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createComment } from "@/lib/comments";
import { verifyCaptcha, captchaConfig } from "@/lib/captcha";
import { rateLimit } from "@/lib/rate-limit";
import { loadSettings } from "@/lib/settings";
import { clientIp, hashIp, isSameOrigin } from "@/lib/request";
import { revalidate } from "@/lib/revalidate";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 20_000) return NextResponse.json({ error: "Request too large" }, { status: 413 });

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const settings = await loadSettings();
  const ip = clientIp(req.headers);
  const result = await createComment(
    input,
    { ip, ipHash: hashIp(ip) },
    {
      db: prisma,
      verifyCaptcha,
      rateLimit,
      settings: {
        captchaProvider: captchaConfig(settings).provider,
        requireApproval: settings.commentsRequireApproval,
        enabled: settings.commentsEnabled,
      },
    },
  );
  if (!result.ok) return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: result.status });
  if (result.status === "visible") revalidate("comments");
  return NextResponse.json({ status: result.status, id: result.id }, { status: 201 });
}
