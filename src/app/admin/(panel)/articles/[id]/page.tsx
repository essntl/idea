import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { articleEditorData, tagSuggestions } from "@/lib/admin/editor-data";
import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "Edit article" };

export default async function EditArticlePage({ params }: PageProps<"/admin/articles/[id]">) {
  const { id } = await params;
  const [initial, tags, categories] = await Promise.all([
    articleEditorData(id),
    tagSuggestions(),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!initial) notFound();
  return <PostEditor key={id} kind="article" initial={initial} tagSuggestions={tags} categories={categories} />;
}
