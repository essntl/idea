import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/guard";
import { savePage } from "@/lib/admin/content";
import { revalidate } from "@/lib/revalidate";

const keySchema = z.enum(["about"]);

export const PUT = adminRoute<RouteContext<"/api/admin/pages/[key]">>(async (req, { params }) => {
  const key = keySchema.parse((await params).key);
  const page = await savePage(key, await readJson(req));
  revalidate("content");
  return NextResponse.json({ updatedAt: page.updatedAt });
});
