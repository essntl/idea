import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/guard";
import { createProjectDraft } from "@/lib/admin/content";

export const POST = adminRoute(async () => {
  const project = await createProjectDraft();
  return NextResponse.json({ id: project.id }, { status: 201 });
});
