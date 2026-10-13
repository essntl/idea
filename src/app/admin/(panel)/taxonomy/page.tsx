import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export const metadata = { title: "Categories & tags" };

export default async function TaxonomyPage() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { articles: true } } } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { articles: true, blogPosts: true } } } }),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Categories & tags" description="Categories group articles. Tags are shared by blog posts and articles." />
      <div className="grid gap-12 lg:grid-cols-2">
        <TaxonomyManager
          kind="category"
          items={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, count: c._count.articles }))}
        />
        <TaxonomyManager kind="tag" items={tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug, count: t._count.articles + t._count.blogPosts }))} />
      </div>
    </div>
  );
}
