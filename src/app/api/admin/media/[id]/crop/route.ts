import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson, HttpError } from "@/lib/guard";
import { cropMedia, toMediaItem } from "@/lib/admin/media-service";
import { MediaError } from "@/lib/media";

const fraction = z.number().min(0).max(1);
const schema = z.object({ x: fraction, y: fraction, width: fraction, height: fraction });

export const POST = adminRoute<RouteContext<"/api/admin/media/[id]/crop">>(async (req, { params }) => {
  const { id } = await params;
  const crop = schema.parse(await readJson(req));
  try {
    const media = await cropMedia(id, crop);
    return NextResponse.json({ item: toMediaItem(media) }, { status: 201 });
  } catch (err) {
    if (err instanceof MediaError) throw new HttpError(400, err.message);
    throw err;
  }
});
