import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/lib/guard";
import { createProjectDraft } from "@/lib/admin/content";
import { createProjectFromRepo } from "@/lib/admin/project-from-repo";

const bodySchema = z.object({ repoUrl: z.string().trim().max(500).optional(), ai: z.boolean().optional() });

/** Blank draft, or (with `repoUrl`) a draft filled in from a GitHub repository, optionally written by AI. */
export const POST = adminRoute(async (req) => {
  const body = bodySchema.parse(await req.json().catch(() => ({})));
  if (body.repoUrl) {
    const { id, warnings } = await createProjectFromRepo(body.repoUrl, !!body.ai);
    return NextResponse.json({ id, warnings }, { status: 201 });
  }
  const project = await createProjectDraft();
  return NextResponse.json({ id: project.id, warnings: [] }, { status: 201 });
});
