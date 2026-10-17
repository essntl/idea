import { notFound } from "next/navigation";
import { projectEditorData, stackSuggestions } from "@/lib/admin/editor-data";
import { PostEditor } from "@/components/admin/post-editor";
import { aiAvailable } from "@/lib/ai/client";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  const { id } = await params;
  const [initial, stack, ai] = await Promise.all([projectEditorData(id), stackSuggestions(), aiAvailable()]);
  if (!initial) notFound();
  return <PostEditor key={id} kind="project" initial={initial} tagSuggestions={stack} ai={ai} />;
}
