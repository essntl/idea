import type { Metadata } from "next";
import { getPage } from "@/lib/queries";
import { Prose } from "@/components/site/prose";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("about");
  return { title: page?.title || "About", alternates: { canonical: "/about" } };
}

export default async function AboutPage() {
  const page = await getPage("about");
  return (
    <article className="container-prose">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{page?.title || "About"}</h1>
      {page?.contentHtml ? <Prose html={page.contentHtml} /> : <p className="text-muted">Nothing here yet.</p>}
    </article>
  );
}
