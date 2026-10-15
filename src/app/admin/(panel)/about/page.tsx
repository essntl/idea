import { pageEditorData } from "@/lib/admin/editor-data";
import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "About page" };

export default async function AboutEditorPage() {
  return <PostEditor kind="page" initial={await pageEditorData("about")} />;
}
