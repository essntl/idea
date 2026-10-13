import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/guard";
import { createArticleDraft } from "@/lib/admin/content";

export const POST = adminRoute(async () => {
  const article = await createArticleDraft();
  return NextResponse.json({ id: article.id }, { status: 201 });
});
