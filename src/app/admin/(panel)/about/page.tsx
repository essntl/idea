import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/db";
import { EMPTY_DOC } from "@/lib/content/extensions";
import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "About page" };

export default async function AboutEditorPage() {
  const page = await prisma.page.findUnique({ where: { key: "about" } });
  return (
    <PostEditor
      kind="page"
      initial={{
        id: "about", title: page?.title ?? "About", description: "", contentJson: (page?.contentJson as JSONContent) ?? EMPTY_DOC,
        tags: [], status: "published", publishedAt: null, slug: "about", categoryId: null, previewImage: null,
        seoTitle: "", seoDescription: "", publicUrl: "/about",
      }}
    />
  );
}
