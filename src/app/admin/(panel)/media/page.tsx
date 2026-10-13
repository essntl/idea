import { z } from "zod";
import { prisma } from "@/lib/db";
import { toMediaItem } from "@/lib/admin/media-service";
import { PageHeader } from "@/components/admin/page-header";
import { MediaLibrary } from "@/components/admin/media-library";
import { AdminPagination } from "@/components/admin/admin-pagination";

export const metadata = { title: "Media" };
const PER_PAGE = 60;

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  const sp = await searchParams;
  const page = z.coerce.number().int().min(1).catch(1).parse(sp.page ?? 1);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : "";
  const where = q ? { OR: [{ filename: { contains: q, mode: "insensitive" as const } }, { alt: { contains: q, mode: "insensitive" as const } }] } : {};
  const [rows, total] = await Promise.all([
    prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.media.count({ where }),
  ]);
  return (
    <div className="max-w-6xl">
      <PageHeader title="Media" description={`${total} image${total === 1 ? "" : "s"}`}>
        <form method="get" className="flex gap-2" role="search">
          <label htmlFor="mq" className="sr-only">Search media</label>
          <input id="mq" name="q" type="search" defaultValue={q} placeholder="Search" className="field sm:w-48" />
        </form>
      </PageHeader>
      <MediaLibrary items={rows.map(toMediaItem)} />
      <AdminPagination base="/admin/media" params={{ q: q || undefined }} page={page} total={total} perPage={PER_PAGE} />
    </div>
  );
}
