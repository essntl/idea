import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { revalidate } from "@/lib/revalidate";
import { COMMENT_LIMITS, commentDocSchema, prepareCommentBody } from "@/lib/comments";
import { getSettings } from "@/lib/settings";

type Ctx = RouteContext<"/api/admin/comments/[id]">;

export const PATCH = adminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { status } = z.object({ status: z.enum(["visible", "hidden", "deleted", "pending"]) }).parse(await readJson(req));
  await prisma.comment.update({ where: { id }, data: { status } }).catch(() => {
    throw new HttpError(404, "Comment not found");
  });
  revalidate("comments");
  return NextResponse.json({ ok: true });
});

/** Reply as the site author. Replying to a pending comment approves it. */
export const POST = adminRoute<Ctx>(async (req, { params, admin }) => {
  const { id } = await params;
  const input = z
    .object({ body: z.string().max(COMMENT_LIMITS.bodyMax * 2).optional(), bodyJson: commentDocSchema.optional() })
    .parse(await readJson(req));
  const content = await prepareCommentBody(input);
  // The author's own replies aren't link-limited.
  if (!content.body) throw new HttpError(400, "Reply is empty");
  if (content.body.length > COMMENT_LIMITS.bodyMax) throw new HttpError(400, "Reply is too long");
  const parent = await prisma.comment.findUnique({ where: { id }, select: { id: true, articleId: true, blogPostId: true, status: true } });
  if (!parent) throw new HttpError(404, "Comment not found");
  if (parent.status === "pending") await prisma.comment.update({ where: { id }, data: { status: "visible" } });
  const settings = await getSettings();
  const reply = await prisma.comment.create({
    data: {
      articleId: parent.articleId,
      blogPostId: parent.blogPostId,
      parentId: parent.id,
      authorName: settings.authorName || admin.name,
      authorEmail: admin.email,
      body: content.body,
      bodyHtml: content.bodyHtml,
      isAdminReply: true,
      status: "visible",
    },
  });
  revalidate("comments");
  return NextResponse.json({ id: reply.id }, { status: 201 });
});
