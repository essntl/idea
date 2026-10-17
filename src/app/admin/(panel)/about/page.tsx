import { pageEditorData } from "@/lib/admin/editor-data";
import { PostEditor } from "@/components/admin/post-editor";
import { aiAvailable } from "@/lib/ai/client";

export const metadata = { title: "About page" };

export default async function AboutEditorPage() {
  const [initial, ai] = await Promise.all([pageEditorData("about"), aiAvailable()]);
  return <PostEditor kind="page" initial={initial} ai={ai} />;
}
