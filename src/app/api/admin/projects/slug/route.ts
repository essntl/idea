import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/lib/guard";
import { isProjectSlugTaken } from "@/lib/admin/content";
import { uniqueSlug, validateSlug } from "@/lib/slug";

const query = z.object({ slug: z.string().max(200), excludeId: z.string().max(40).optional() });

/** Live slug validation for the editor sidebar. */
export const GET = adminRoute(async (req) => {
  const { slug, excludeId } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const error = validateSlug(slug);
  if (error) return NextResponse.json({ available: false, error });
  const taken = await isProjectSlugTaken(slug, excludeId);
  if (!taken) return NextResponse.json({ available: true });
  const suggestion = await uniqueSlug(slug, (s) => isProjectSlugTaken(s, excludeId));
  return NextResponse.json({ available: false, error: "Already used by another project", suggestion });
});
