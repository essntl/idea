import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { revalidate } from "@/lib/revalidate";

const bulkSchema = z.object({
  ids: z.array(z.string().max(40)).min(1).max(500),
  action: z.enum(["show", "hide", "delete", "approve"]),
});

const STATUS = { show: "visible", approve: "visible", hide: "hidden", delete: "deleted" } as const;

/** Bulk moderation. Deletion is soft: replies stay and the comment shows as "removed". */
export const POST = adminRoute(async (req) => {
  const { ids, action } = bulkSchema.parse(await readJson(req));
  const { count } = await prisma.comment.updateMany({ where: { id: { in: ids } }, data: { status: STATUS[action] } });
  revalidate("comments");
  return NextResponse.json({ count });
});
