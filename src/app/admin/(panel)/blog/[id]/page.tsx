import { notFound } from "next/navigation";
import { blogEditorData, projectOptions, tagSuggestions } from "@/lib/admin/editor-data";
import { PostEditor } from "@/components/admin/post-editor";
import { aiAvailable } from "@/lib/ai/client";

export const metadata = { title: "Edit post" };

export default async function EditBlogPostPage({ params }: PageProps<"/admin/blog/[id]">) {
  const { id } = await params;
  const [initial, tags, projects, ai] = await Promise.all([blogEditorData(id), tagSuggestions(), projectOptions(), aiAvailable()]);
  if (!initial) notFound();
  return <PostEditor key={id} kind="blog" initial={initial} tagSuggestions={tags} projects={projects} ai={ai} />;
}
