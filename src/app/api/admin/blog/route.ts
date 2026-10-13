import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/guard";
import { createBlogDraft } from "@/lib/admin/content";

/** Creates an empty draft and returns its id (the editor then autosaves into it). */
export const POST = adminRoute(async () => {
  const post = await createBlogDraft();
  return NextResponse.json({ id: post.id }, { status: 201 });
});
