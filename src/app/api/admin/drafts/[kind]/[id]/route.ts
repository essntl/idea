import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/guard";
import { discardPendingDraft, savePendingDraft } from "@/lib/admin/content";

type Ctx = RouteContext<"/api/admin/drafts/[kind]/[id]">;

const kindSchema = z.enum(["blog", "article", "page"]);

/** Autosave pending (unpublished) changes to live content. The published version is untouched. */
export const PUT = adminRoute<Ctx>(async (req, { params }) => {
  const { kind, id } = await params;
  const saved = await savePendingDraft(kindSchema.parse(kind), id, await readJson(req));
  return NextResponse.json({ draftUpdatedAt: saved.draftUpdatedAt });
});

/** Throw away pending changes and go back to the published version. */
export const DELETE = adminRoute<Ctx>(async (_req, { params }) => {
  const { kind, id } = await params;
  await discardPendingDraft(kindSchema.parse(kind), id);
  return NextResponse.json({ ok: true });
});
