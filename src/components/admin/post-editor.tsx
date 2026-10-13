"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { RichEditor } from "./editor/rich-editor";
import { TagsInput } from "./tags-input";
import { MediaPicker } from "./media-picker";
import { ImageCropper } from "./image-cropper";
import { api } from "./api";
import { pickFiles, uploadImages, type MediaItem } from "./editor/upload";
import { slugify } from "@/lib/slug";
import { ArrowLeft, CloseIcon } from "@/components/ui/icons";

export type EditorKind = "blog" | "article" | "page";

export type EditorInitial = {
  id: string;
  title: string;
  description: string;
  contentJson: JSONContent;
  tags: string[];
  status: "draft" | "published" | "scheduled";
  publishedAt: string | null;
  slug: string;
  categoryId: string | null;
  previewImage: MediaItem | null;
  seoTitle: string;
  seoDescription: string;
  publicUrl: string | null;
};

type Props = {
  kind: EditorKind;
  initial: EditorInitial;
  tagSuggestions?: string[];
  categories?: { id: string; name: string }[];
};

type State = Omit<EditorInitial, "id" | "publicUrl">;

/** ISO → value for <input type="datetime-local"> in the browser's timezone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const LIST_URL: Record<EditorKind, string> = { blog: "/admin/blog", article: "/admin/articles", page: "/admin" };

export function PostEditor({ kind, initial, tagSuggestions = [], categories: initialCategories = [] }: Props) {
  const router = useRouter();
  const { id } = initial;
  const [state, setState] = useState<State>(() => ({
    title: initial.title, description: initial.description, contentJson: initial.contentJson, tags: initial.tags,
    status: initial.status, publishedAt: initial.publishedAt, slug: initial.slug, categoryId: initial.categoryId,
    previewImage: initial.previewImage, seoTitle: initial.seoTitle, seoDescription: initial.seoDescription,
  }));
  const [savedStatus, setSavedStatus] = useState(initial.status);
  const [publicUrl, setPublicUrl] = useState(initial.publicUrl);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  // The slug follows the title until edited by hand; a placeholder "untitled" slug doesn't count as an edit.
  const [slugTouched, setSlugTouched] = useState(
    initial.status !== "draft" || !(initial.slug === slugify(initial.title) || /^untitled(-\d+)?$/.test(initial.slug)),
  );
  const [slugCheck, setSlugCheck] = useState<{ ok: boolean; error?: string; suggestion?: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cropping, setCropping] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const stateRef = useRef(state);
  const version = useRef(0);
  const savedVersion = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const update = useCallback(<K extends keyof State>(key: K, value: State[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    version.current++;
    setDirty(true);
  }, []);

  // Auto-generate the article slug from the title until it's edited by hand or published.
  useEffect(() => {
    if (kind !== "article" || slugTouched) return;
    const next = slugify(state.title);
    if (next && next !== state.slug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived field that stays editable
      setState((s) => ({ ...s, slug: next }));
    }
  }, [kind, slugTouched, state.title, state.slug]);

  // Live slug validation.
  useEffect(() => {
    if (kind !== "article") return;
    const slug = state.slug;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ available: boolean; error?: string; suggestion?: string }>(`/api/admin/articles/slug?slug=${encodeURIComponent(slug)}&excludeId=${id}`);
        setSlugCheck({ ok: r.available, error: r.error, suggestion: r.suggestion });
      } catch {
        setSlugCheck(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [kind, state.slug, id]);

  const payload = useCallback(
    (s: State, status = s.status) => {
      if (kind === "page") return { title: s.title, contentJson: s.contentJson };
      if (kind === "blog") return { title: s.title, description: s.description, contentJson: s.contentJson, tags: s.tags, status, publishedAt: s.publishedAt };
      return {
        title: s.title, slug: s.slug, excerpt: s.description, contentJson: s.contentJson, tags: s.tags, status, publishedAt: s.publishedAt,
        categoryId: s.categoryId, previewImageId: s.previewImage?.id ?? null, seoTitle: s.seoTitle || null, seoDescription: s.seoDescription || null,
      };
    },
    [kind],
  );

  const save = useCallback(
    async (opts: { status?: State["status"]; auto?: boolean } = {}) => {
      const s = stateRef.current;
      const status = opts.status ?? s.status;
      const v = version.current;
      setSaving(true);
      if (!opts.auto) setMessage(null);
      try {
        const url = kind === "page" ? `/api/admin/pages/about` : `/api/admin/${kind === "blog" ? "blog" : "articles"}/${id}`;
        const res = await api<{ slug?: string; status?: State["status"]; publishedAt?: string | null }>(url, { method: "PUT", json: payload(s, status) });
        savedVersion.current = v;
        if (version.current === v) setDirty(false);
        setSavedAt(new Date());
        if (res.status) {
          setSavedStatus(res.status);
          setState((cur) => ({ ...cur, status: res.status!, publishedAt: res.publishedAt ?? null, slug: res.slug ?? cur.slug }));
          if (kind !== "page" && res.slug) setPublicUrl(`/${kind === "blog" ? "blog" : "articles"}/${res.slug}`);
        }
        if (!opts.auto) setMessage({ kind: "ok", text: status === "draft" ? "Draft saved" : status === "scheduled" ? "Scheduled" : "Published" });
        router.refresh();
        return true;
      } catch (e) {
        setMessage({ kind: "error", text: (e as Error).message });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, kind, payload, router],
  );

  // Autosave drafts (published content is only updated on an explicit save).
  useEffect(() => {
    if (!dirty || savedStatus !== "draft" || kind === "page") return;
    const t = setTimeout(() => void save({ auto: true }), 1500);
    return () => clearTimeout(t);
  }, [dirty, state, savedStatus, kind, save]);

  // Warn before leaving with unsaved changes (tab close and in-app links).
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      if (!confirm("You have unsaved changes. Leave anyway?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  async function preview() {
    if (dirty && savedStatus === "draft") await save({ auto: true });
    else if (dirty) setMessage({ kind: "ok", text: "Preview shows the last saved version." });
    window.open(kind === "page" ? "/about" : `/admin/preview/${kind}/${id}`, "_blank");
  }

  async function importMarkdown() {
    const [file] = await pickFiles(".md,.markdown,text/markdown,text/plain", false);
    if (!file) return;
    if (!confirm("Replace the current content with this markdown file?")) return;
    const form = new FormData();
    form.set("type", kind === "article" ? "article" : "blog");
    form.set("mode", "parse");
    form.append("file", file);
    try {
      const r = await api<{
        title: string; doc: JSONContent; unresolvedImages: string[]; warnings: string[]; categoryId: string | null; previewImage: MediaItem | null;
        frontMatter: { description?: string; slug?: string; tags: string[]; date?: string; category?: string };
      }>("/api/admin/import/markdown", { body: form });
      const fm = r.frontMatter;
      editorRef.current?.commands.setContent(r.doc);
      setState((s) => ({
        ...s,
        title: r.title || s.title,
        description: fm.description ?? s.description,
        contentJson: r.doc,
        tags: fm.tags.length ? fm.tags : s.tags,
        publishedAt: fm.date ?? s.publishedAt,
        slug: kind === "article" && fm.slug ? fm.slug : s.slug,
        categoryId: r.categoryId ?? s.categoryId,
        previewImage: r.previewImage ?? s.previewImage,
      }));
      if (fm.slug) setSlugTouched(true);
      if (r.categoryId && fm.category && !categories.some((c) => c.id === r.categoryId)) {
        setCategories((cs) => [...cs, { id: r.categoryId!, name: fm.category! }]);
      }
      version.current++;
      setDirty(true);
      const notes = [...r.warnings, ...(r.unresolvedImages.length ? [`${r.unresolvedImages.length} image(s) need uploading: ${r.unresolvedImages.join(", ")}`] : [])];
      setMessage({ kind: notes.length ? "error" : "ok", text: notes.length ? notes.join(" ") : "Markdown imported" });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

  async function remove() {
    if (!confirm(`Delete this ${kind === "blog" ? "post" : "article"} permanently?`)) return;
    try {
      await api(`/api/admin/${kind === "blog" ? "blog" : "articles"}/${id}`, { method: "DELETE" });
      setDirty(false);
      router.push(LIST_URL[kind]);
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

  async function newCategory() {
    const name = prompt("New category name")?.trim();
    if (!name) return;
    try {
      const { item } = await api<{ item: { id: string; name: string } }>("/api/admin/taxonomy", { json: { kind: "category", name } });
      setCategories((cs) => (cs.some((c) => c.id === item.id) ? cs : [...cs, item].sort((a, b) => a.name.localeCompare(b.name))));
      update("categoryId", item.id);
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

  async function uploadPreview() {
    const [file] = await pickFiles(undefined, false);
    if (!file) return;
    try {
      const { items } = await uploadImages([file], state.title);
      if (items[0]) update("previewImage", items[0]);
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

  const onReady = useCallback((e: Editor) => {
    editorRef.current = e;
  }, []);

  const onContentChange = useCallback((doc: JSONContent) => update("contentJson", doc), [update]);

  const isLive = savedStatus !== "draft";
  const saveLabel = kind === "page" ? "Save" : state.status === "draft" ? (isLive ? "Unpublish" : "Save draft") : isLive ? "Update" : state.status === "scheduled" ? "Schedule" : "Publish";
  const statusText = saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : isLive ? "Published" : "Draft";

  const label = "mb-1 block text-sm font-medium";
  const sidebar = (
    <div className="space-y-6">
      {kind !== "page" && (
        <>
          <div>
            <label htmlFor="status" className={label}>Status</label>
            <select id="status" className="field" value={state.status} onChange={(e) => update("status", e.target.value as State["status"])}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              {kind === "article" && <option value="scheduled">Scheduled</option>}
            </select>
          </div>
          <div>
            <label htmlFor="publishedAt" className={label}>{state.status === "scheduled" ? "Publish at" : "Publish date"}</label>
            <input id="publishedAt" type="datetime-local" className="field" value={toLocalInput(state.publishedAt)} onChange={(e) => update("publishedAt", fromLocalInput(e.target.value))} />
            <p className="mt-1 text-xs text-muted">{state.status === "scheduled" ? "Goes live automatically at this time." : "Leave empty to use the time of publishing. Can be backdated."}</p>
          </div>
        </>
      )}
      {kind !== "page" && (
        <div>
          <label htmlFor="description" className={label}>{kind === "blog" ? "Description" : "Excerpt"}</label>
          <textarea id="description" className="field min-h-24" maxLength={kind === "blog" ? 500 : 1000} value={state.description} onChange={(e) => update("description", e.target.value)} />
        </div>
      )}
      {kind === "article" && (
        <div>
          <label htmlFor="slug" className={label}>Slug</label>
          <div className="flex items-center">
            <span className="mr-1 text-sm text-muted">/articles/</span>
            <input
              id="slug"
              className="field"
              value={state.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              }}
              aria-invalid={slugCheck ? !slugCheck.ok : undefined}
              aria-describedby="slug-help"
            />
          </div>
          <p id="slug-help" className="mt-1 text-xs" role="status">
            {slugCheck?.ok === false ? (
              <span className="font-medium">
                {slugCheck.error}
                {slugCheck.suggestion && (
                  <>
                    {" "}
                    <button type="button" className="underline" onClick={() => update("slug", slugCheck.suggestion!)}>
                      Use “{slugCheck.suggestion}”
                    </button>
                  </>
                )}
              </span>
            ) : (
              <span className="text-muted">{slugCheck?.ok ? "Available" : "Lowercase letters, numbers and dashes."}</span>
            )}
          </p>
        </div>
      )}
      {kind !== "page" && (
        <div>
          <span className={label}>Tags</span>
          <TagsInput value={state.tags} onChange={(v) => update("tags", v)} suggestions={tagSuggestions} />
        </div>
      )}
      {kind === "article" && (
        <>
          <div>
            <label htmlFor="category" className={label}>Category</label>
            <div className="flex gap-2">
              <select id="category" className="field" value={state.categoryId ?? ""} onChange={(e) => update("categoryId", e.target.value || null)}>
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost" onClick={newCategory} aria-label="New category">New</button>
            </div>
          </div>
          <div>
            <span className={label}>Preview image</span>
            {state.previewImage ? (
              <div>
                <div className="relative aspect-[16/9] overflow-hidden border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                  <img src={`${state.previewImage.url}?w=640`} alt={state.previewImage.alt} className="size-full object-cover" />
                </div>
                <p className="mt-1 text-xs text-muted">Shown cropped to 16:9 in article lists.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => setCropping(true)}>Crop</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setPickerOpen(true)}>Change</button>
                  <button type="button" className="btn btn-ghost" onClick={() => update("previewImage", null)}>Remove</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost" onClick={uploadPreview}>Upload</button>
                <button type="button" className="btn btn-ghost" onClick={() => setPickerOpen(true)}>Media library</button>
              </div>
            )}
          </div>
          <details className="border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-medium">SEO</summary>
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="seoTitle" className={label}>SEO title</label>
                <input id="seoTitle" className="field" maxLength={200} value={state.seoTitle} placeholder={state.title} onChange={(e) => update("seoTitle", e.target.value)} />
                <p className="mt-1 text-xs text-muted">{(state.seoTitle || state.title).length}/60 recommended</p>
              </div>
              <div>
                <label htmlFor="seoDescription" className={label}>SEO description</label>
                <textarea id="seoDescription" className="field min-h-20" maxLength={400} value={state.seoDescription} placeholder={state.description} onChange={(e) => update("seoDescription", e.target.value)} />
                <p className="mt-1 text-xs text-muted">{(state.seoDescription || state.description).length}/160 recommended</p>
              </div>
            </div>
          </details>
        </>
      )}
      {kind !== "page" && (
        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={importMarkdown}>Import .md</button>
            <a className="btn btn-ghost" href={`/api/admin/export/markdown?type=${kind}&id=${id}`} download>Export .md</a>
          </div>
          <button type="button" className="btn btn-ghost w-full" onClick={remove}>Delete {kind === "blog" ? "post" : "article"}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={LIST_URL[kind]} className="tap justify-center text-muted hover:text-fg" aria-label="Back">
            <ArrowLeft />
          </Link>
          <span className="text-sm text-muted" role="status" aria-live="polite">{statusText}</span>
          {publicUrl && isLive && (
            <a href={publicUrl} target="_blank" className="hidden text-sm underline sm:inline" rel="noreferrer">View ↗</a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={preview}>Preview</button>
          {kind !== "page" && (
            <button type="button" className="btn btn-ghost lg:hidden" onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen} aria-controls="post-settings">Settings</button>
          )}
          <button type="button" className="btn" onClick={() => void save()} disabled={saving || (kind === "article" && slugCheck?.ok === false)}>
            {saveLabel}
          </button>
        </div>
      </div>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`mb-4 rounded border px-3 py-2 text-sm ${message.kind === "error" ? "border-fg font-medium" : "border-line text-muted"}`}>
          {message.text}
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
        <div className="min-w-0">
          <label htmlFor="title" className="sr-only">Title</label>
          <textarea
            id="title"
            rows={1}
            className="mb-4 field-sizing-content w-full resize-none overflow-hidden bg-transparent text-3xl leading-tight font-semibold tracking-tight outline-none placeholder:text-subtle sm:text-4xl"
            placeholder="Untitled"
            value={state.title}
            maxLength={200}
            onChange={(e) => update("title", e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editorRef.current?.commands.focus("start");
              }
            }}
          />
          <RichEditor content={initial.contentJson} onChange={onContentChange} onReady={onReady} />
        </div>

        {kind !== "page" && (
          <>
            <aside className="hidden lg:block" aria-label="Post settings">
              <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto pb-6">{sidebar}</div>
            </aside>
            {sheetOpen && (
              <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Post settings" id="post-settings">
                <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close settings" onClick={() => setSheetOpen(false)} />
                <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] animate-menu-in overflow-y-auto rounded-t-lg border-t border-line-strong bg-bg px-4 pt-2 pb-8">
                  <div className="sticky top-0 -mx-4 mb-4 flex items-center justify-between border-b border-line bg-bg px-4 py-2">
                    <h2 className="font-semibold">Settings</h2>
                    <button type="button" className="tap justify-center" onClick={() => setSheetOpen(false)} aria-label="Close">
                      <CloseIcon />
                    </button>
                  </div>
                  {sidebar}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <MediaPicker
        open={pickerOpen}
        title="Choose a preview image"
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => {
          setPickerOpen(false);
          update("previewImage", m);
        }}
      />
      {cropping && state.previewImage && (
        <ImageCropper
          image={state.previewImage}
          onCancel={() => setCropping(false)}
          onDone={(m) => {
            setCropping(false);
            update("previewImage", m);
          }}
        />
      )}
    </div>
  );
}
