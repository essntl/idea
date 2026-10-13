import { z } from "zod";

export const listParamsSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  status: z.enum(["draft", "published", "scheduled"]).optional().catch(undefined),
  tag: z.string().max(100).optional().catch(undefined),
  category: z.string().max(100).optional().catch(undefined),
  sort: z.enum(["updated", "published", "title"]).default("updated").catch("updated"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export type ListParams = z.infer<typeof listParamsSchema>;

export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]));
  return listParamsSchema.parse(flat);
}

/** "scheduled" in filters means: not a draft and the date is in the future. */
export function statusWhere(status: ListParams["status"]) {
  const now = new Date();
  if (status === "draft") return { status: "draft" as const };
  if (status === "scheduled") return { status: { not: "draft" as const }, publishedAt: { gt: now } };
  if (status === "published") return { status: { not: "draft" as const }, publishedAt: { lte: now } };
  return {};
}

export function orderBy(sort: ListParams["sort"]) {
  if (sort === "title") return [{ title: "asc" as const }];
  if (sort === "published") return [{ publishedAt: { sort: "desc" as const, nulls: "last" as const } }];
  return [{ updatedAt: "desc" as const }];
}

export const ADMIN_PAGE_SIZE = 50;
