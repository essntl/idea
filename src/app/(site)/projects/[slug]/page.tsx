import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getProject, getProjectUpdates } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";
import { DateText } from "@/components/site/date-text";
import { Prose } from "@/components/site/prose";
import { ArrowLeft } from "@/components/ui/icons";
import { PhaseBadge } from "@/components/site/projects/phase-badge";
import { StackList } from "@/components/site/projects/stack-list";
import { ProjectLinkButtons } from "@/components/site/projects/project-links";
import { RepoPanel, RepoPanelSkeleton } from "@/components/site/projects/repo-panel";

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const p = await getProject((await params).slug);
  if (!p) return {};
  const image = p.previewImage
    ? [{ url: `${p.previewImage.url}?w=1200`, width: 1200, height: Math.round((1200 * p.previewImage.height) / p.previewImage.width), alt: p.previewImage.alt || p.title }]
    : undefined;
  return {
    title: p.title,
    description: p.summary || undefined,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: { type: "website", title: p.title, description: p.summary || undefined, url: `/projects/${p.slug}`, images: image },
    twitter: { card: image ? "summary_large_image" : "summary", title: p.title, description: p.summary || undefined, images: image?.map((i) => i.url) },
  };
}

/** True when the write-up has more than empty paragraphs. */
const hasContent = (html: string) => html.replace(/<p>\s*<\/p>/g, "").trim().length > 0;

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const project = await getProject((await params).slug);
  if (!project) notFound();
  const [updates, settings, nonce] = await Promise.all([
    getProjectUpdates(project.id),
    getSettings(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": project.repoUrl ? "SoftwareSourceCode" : "CreativeWork",
    name: project.title,
    description: project.summary || undefined,
    url: `${base}/projects/${project.slug}`,
    codeRepository: project.repoUrl ?? undefined,
    programmingLanguage: project.stack.length ? project.stack : undefined,
    sameAs: [project.siteUrl, project.packageUrl].filter(Boolean),
    image: project.previewImage ? [`${base}${project.previewImage.url}?w=1200`] : undefined,
    dateCreated: project.createdAt,
    dateModified: project.updatedAt,
    author: { "@type": "Person", name: settings.authorName, url: settings.portfolioUrl || undefined },
  };

  return (
    <article className="container-wide">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href="/projects" className="tap -ml-1 gap-1.5 px-1 text-sm text-muted hover:text-fg">
        <ArrowLeft width={16} height={16} /> Projects
      </Link>

      <header className="mt-4 max-w-3xl">
        <PhaseBadge phase={project.phase} />
        <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight sm:text-[2.5rem]">{project.title}</h1>
        {project.summary && <p className="mt-3 text-lg text-muted">{project.summary}</p>}
        <div className="mt-6">
          <ProjectLinkButtons links={project} />
        </div>
      </header>

      {project.previewImage && (
        <figure className="mt-8 sm:mt-10" data-zoomable>
          <Image
            src={project.previewImage.url}
            alt={project.previewImage.alt || ""}
            width={project.previewImage.width}
            height={project.previewImage.height}
            sizes="(min-width: 1024px) 976px, 100vw"
            priority
            className="max-h-[70vh] w-full rounded-[var(--radius-xl)] border border-line object-cover"
          />
        </figure>
      )}

      <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div className="min-w-0">
          {hasContent(project.contentHtml) && <Prose html={project.contentHtml} />}

          {updates.length > 0 && (
            <section aria-labelledby="updates-title" className={hasContent(project.contentHtml) ? "mt-14" : ""}>
              <h2 id="updates-title" className="mb-5 text-sm font-medium tracking-wider text-muted uppercase">
                Progress updates
              </h2>
              <ol className="relative border-l border-line pl-6">
                {updates.map((u) => (
                  <li key={u.url} className="relative pb-7 last:pb-0">
                    <span aria-hidden="true" className="absolute top-2 -left-[29px] size-2.5 rounded-full border-2 border-bg bg-fg" />
                    <p className="text-sm text-muted">
                      <DateText iso={u.publishedAt} style="short" /> · {u.kind === "blog" ? "Blog post" : "Article"}
                    </p>
                    <h3 className="mt-0.5 font-semibold tracking-tight">
                      <Link href={u.url} className="hover:underline">
                        {u.title}
                      </Link>
                    </h3>
                    {u.description && <p className="mt-1 line-clamp-2 text-[0.9375rem] text-muted">{u.description}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {!hasContent(project.contentHtml) && !updates.length && <p className="text-muted">More about this project soon.</p>}
        </div>

        <aside className="mt-12 space-y-4 lg:mt-0" aria-label="Project details">
          {project.stack.length > 0 && (
            <section className="card p-5" aria-labelledby="stack-title">
              <h2 id="stack-title" className="mb-3 text-sm font-medium text-muted">
                Built with
              </h2>
              <StackList stack={project.stack} />
            </section>
          )}
          {project.repoUrl && (
            <Suspense fallback={<RepoPanelSkeleton />}>
              <RepoPanel url={project.repoUrl} />
            </Suspense>
          )}
        </aside>
      </div>
    </article>
  );
}
