import { notFound } from "next/navigation";
import { projectEditorData, stackSuggestions } from "@/lib/admin/editor-data";
import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  const { id } = await params;
  const [initial, stack] = await Promise.all([projectEditorData(id), stackSuggestions()]);
  if (!initial) notFound();
  return <PostEditor key={id} kind="project" initial={initial} tagSuggestions={stack} />;
}
