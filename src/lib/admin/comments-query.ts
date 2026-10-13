import { prisma } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import type { AdminComment } from "@/components/admin/comment-row";

export async function listAdminComments(where: Prisma.CommentWhereInput, take: number, skip = 0): Promise<AdminComment[]> {
  const rows = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
    include: {
      article: { select: { id: true, title: true, slug: true } },
      parent: { select: { authorName: true, body: true, status: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    isAdminReply: r.isAdminReply,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    article: r.article,
    parent: r.parent,
  }));
}
