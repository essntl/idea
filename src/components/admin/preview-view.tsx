"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { TocItem } from "@/lib/content/pipeline";
import { previewChannel, readPreviewDraft, type PreviewDraft } from "@/lib/admin/preview-draft";
import { slugify } from "@/lib/slug";
import { Prose } from "@/components/site/prose";
import { TableOfContents } from "@/components/site/toc";
import { TagList } from "@/components/site/tag-list";
import { DateText } from "@/components/site/date-text";

export type PreviewData = {
  kind: "blog" | "article" | "page";
  id: string;
  title: string;
  description: string;
  html: string;
  toc: TocItem[];
  readingTime: number;
  tags: string[];
  publishedAt: string | null;
  categoryId: string | null;
  previewImage: { url: string; width: number; height: number; alt: string } | null;
};

type Rendered = { html: string; toc: TocItem[]; readingTime: number };

/**
 * Shows the editor's current state when the editor handed one over (Preview button), otherwise the saved version.
 * Updates live while the editor stays open; content is rendered by the same sanitizing pipeline as a real save.
 */
export function PreviewView({ saved, categories }: { saved: PreviewData; categories: Record<string, string> }) {
  const [draft, setDraft] = useState<PreviewDraft | null>(null);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date().toISOString());
  const lastDoc = useRef<string>("");

  // Pick up the draft written by the editor, then listen for live updates.
  useEffect(() => {
    const live = new URLSearchParams(window.location.search).has("live");
    if (live) {
      const d = readPreviewDraft(saved.kind, saved.id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read after hydration
      if (d) setDraft(d);
    }
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(previewChannel(saved.kind, saved.id));
      ch.onmessage = (e: MessageEvent<PreviewDraft>) => setDraft(e.data);
    } catch {
      // live updates unavailable; the snapshot from storage is still shown
    }
    return () => ch?.close();
  }, [saved.kind, saved.id]);

  // Render the draft's content on the server (debounced, skipped when the document didn't change).
  useEffect(() => {
    if (!draft) return;
    const doc = JSON.stringify(draft.contentJson);
    if (doc === lastDoc.current) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentJson: draft.contentJson }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Preview failed (${res.status})`);
        lastDoc.current = doc;
        setRendered((await res.json()) as Rendered);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [draft]);

  const usingDraft = !!draft && !!rendered;
  const d = usingDraft
    ? {
        ...saved,
        title: draft.title,
        description: draft.description,
        tags: draft.tags,
        publishedAt: draft.publishedAt,
        categoryId: draft.categoryId,
        previewImage: draft.previewImage,
        html: rendered.html,
        toc: rendered.toc,
        readingTime: rendered.readingTime,
      }
    : saved;
  const tags = d.tags.map((name) => ({ name, slug: slugify(name) || name }));
  const date = d.publishedAt ?? now;
  const category = d.categoryId ? categories[d.categoryId] : null;

  const banner = (
    <div className="container-wide mb-8" role="status">
      <p className="flex flex-wrap items-center justify-center gap-x-2 rounded-full bg-fg px-4 py-2 text-center text-sm text-bg">
        <span className="font-medium">Preview</span>
        <span className="opacity-70">·</span>
        <span className="opacity-80">
          {draft && !rendered ? "Loading your latest changes…" : usingDraft ? "Showing your unsaved changes — updates as you type" : "Showing the saved version"}
        </span>
      </p>
      {error && <p className="mt-2 text-center text-sm font-medium">{error}</p>}
    </div>
  );

  if (d.kind === "page") {
    return (
      <>
        {banner}
        <article className="container-prose">
          <h1 className="mb-8 text-3xl font-semibold tracking-tight">{d.title || "About"}</h1>
          <Prose html={d.html} />
        </article>
      </>
    );
  }

  if (d.kind === "blog") {
    return (
      <>
        {banner}
        <article className="container-prose">
          <header className="mb-10">
            <DateText iso={date} className="text-sm text-muted" />
            <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{d.title || "Untitled"}</h1>
            {d.description && <p className="mt-3 text-lg text-muted">{d.description}</p>}
          </header>
          <Prose html={d.html} />
          {tags.length > 0 && (
            <div className="mt-12 -ml-1.5 border-t border-line pt-6">
              <TagList tags={tags} base="/blog/tag" />
            </div>
          )}
        </article>
      </>
    );
  }

  return (
    <>
      {banner}
      <article>
        <header className="container-prose">
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
            {category && (
              <>
                <span>{category}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <DateText iso={date} />
            <span aria-hidden="true">·</span>
            <span>{d.readingTime} min read</span>
          </div>
          <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight sm:text-[2.5rem]">{d.title || "Untitled"}</h1>
          {d.description && <p className="mt-4 text-lg text-muted">{d.description}</p>}
        </header>
        {d.previewImage && (
          <figure className="container-wide mt-8 sm:mt-10" data-zoomable>
            <Image
              src={d.previewImage.url}
              alt={d.previewImage.alt}
              width={d.previewImage.width}
              height={d.previewImage.height}
              sizes="(min-width: 1024px) 976px, 100vw"
              priority
              className="mx-auto max-h-[70vh] w-full rounded-[var(--radius-xl)] object-cover"
            />
          </figure>
        )}
        <div className="container-prose mt-10">
          <TableOfContents items={d.toc} />
          <Prose html={d.html} />
          {tags.length > 0 && (
            <div className="mt-12 -ml-1.5">
              <TagList tags={tags} base="/articles/tag" />
            </div>
          )}
        </div>
      </article>
    </>
  );
}
