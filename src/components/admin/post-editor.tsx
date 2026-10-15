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
import { Select } from "@/components/ui/select";
import { pickFiles, uploadImages, type MediaItem } from "./editor/upload";
import { slugify } from "@/lib/slug";
import { publishPreviewDraft, type PreviewDraft } from "@/lib/admin/preview-draft";
import { ArrowLeft, EyeIcon, SlidersIcon } from "@/components/ui/icons";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { PHASE_META, PHASE_ORDER, type ProjectPhase } from "@/lib/projects";

export type EditorKind = "blog" | "article" | "project" | "page";

export type EditorInitial = {
  id: string;
  title: string;
  /** Blog description, article excerpt or project summary. */
  description: string;
  contentJson: JSONContent;
  tags: string[];
  status: "draft" | "published" | "scheduled";
  publishedAt: string | null;
  slug: string;
  categoryId: string | null;
  /** Article preview image or project cover. */
  previewImage: MediaItem | null;
  seoTitle: string;
  seoDescription: string;
  /** Blog posts and articles: the project they're a progress update for. */
  projectId: string | null;
  phase: ProjectPhase;
  repoUrl: string;
  siteUrl: string;
  packageUrl: string;
  stack: string[];
  featured: boolean;
  publicUrl: string | null;
  /** When the live post has autosaved, unpublished changes: when they were last saved. */
  pendingDraftAt: string | null;
};

type Props = {
  kind: EditorKind;
  initial: EditorInitial;
  tagSuggestions?: string[];
  categories?: { id: string; name: string }[];
  /** Projects a blog post or article can belong to. */
  projects?: { id: string; title: string }[];
};

type State = Omit<EditorInitial, "id" | "publicUrl" | "pendingDraftAt">;

const NOUN: Record<EditorKind, string> = { blog: "post", article: "article", project: "project", page: "page" };
const API_BASE: Record<Exclude<EditorKind, "page">, string> = { blog: "/api/admin/blog", article: "/api/admin/articles", project: "/api/admin/projects" };
const PUBLIC_BASE: Record<Exclude<EditorKind, "page">, string> = { blog: "/blog", article: "/articles", project: "/projects" };

/** ISO → value for <input type="datetime-local"> in the browser's timezone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const LIST_URL: Record<EditorKind, string> = { blog: "/admin/blog", article: "/admin/articles", project: "/admin/projects", page: "/admin" };

export function PostEditor({ kind, initial, tagSuggestions = [], categories: initialCategories = [], projects = [] }: Props) {
  const router = useRouter();
  const { id } = initial;
  const [state, setState] = useState<State>(() => {
    const { id: _id, publicUrl: _url, pendingDraftAt: _at, ...fields } = initial;
    void [_id, _url, _at];
    return fields;
  });
  // Articles and projects have an editable URL slug.
  const hasSlug = kind === "article" || kind === "project";
  const [savedStatus, setSavedStatus] = useState(initial.status);
  const [pendingAt, setPendingAt] = useState<string | null>(initial.pendingDraftAt);
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

  // Auto-generate the slug from the title until it's edited by hand or published.
  useEffect(() => {
    if (!hasSlug || slugTouched) return;
    const next = slugify(state.title);
    if (next && next !== state.slug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived field that stays editable
      setState((s) => ({ ...s, slug: next }));
    }
  }, [hasSlug, slugTouched, state.title, state.slug]);

  // Live slug validation.
  useEffect(() => {
    if (kind !== "article" && kind !== "project") return;
    const slug = state.slug;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ available: boolean; error?: string; suggestion?: string }>(`${API_BASE[kind]}/slug?slug=${encodeURIComponent(slug)}&excludeId=${id}`);
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
      if (kind === "blog") {
        return { title: s.title, description: s.description, contentJson: s.contentJson, tags: s.tags, status, publishedAt: s.publishedAt, projectId: s.projectId };
      }
      if (kind === "project") {
        return {
          title: s.title, slug: s.slug, summary: s.description, contentJson: s.contentJson, status, publishedAt: s.publishedAt, phase: s.phase,
          repoUrl: s.repoUrl, siteUrl: s.siteUrl, packageUrl: s.packageUrl, stack: s.stack, featured: s.featured, previewImageId: s.previewImage?.id ?? null,
        };
      }
      return {
        title: s.title, slug: s.slug, excerpt: s.description, contentJson: s.contentJson, tags: s.tags, status, publishedAt: s.publishedAt,
        categoryId: s.categoryId, previewImageId: s.previewImage?.id ?? null, seoTitle: s.seoTitle || null, seoDescription: s.seoDescription || null,
        projectId: s.projectId,
      };
    },
    [kind],
  );

  // Live content (published/scheduled posts, the About page) autosaves into a pending draft;
  // visitors keep seeing the published version until "Publish changes".
  const isLive = kind === "page" || savedStatus !== "draft";
  const draftId = kind === "page" ? "about" : id;

  const saveDraft = useCallback(
    async (opts: { auto?: boolean } = {}) => {
      const s = stateRef.current;
      const v = version.current;
      setSaving(true);
      if (!opts.auto) setMessage(null);
      try {
        const { status: _omit, ...fields } = payload(s) as Record<string, unknown>;
        void _omit;
        const res = await api<{ draftUpdatedAt: string }>(`/api/admin/drafts/${kind}/${draftId}`, { method: "PUT", json: fields });
        if (version.current === v) setDirty(false);
        setSavedAt(new Date());
        setPendingAt(res.draftUpdatedAt);
        if (!opts.auto) setMessage({ kind: "ok", text: "Changes saved. They go live when you publish them." });
        return true;
      } catch (e) {
        setMessage({ kind: "error", text: `Autosave failed: ${(e as Error).message}` });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [kind, draftId, payload],
  );

  const save = useCallback(
    async (opts: { status?: State["status"]; auto?: boolean } = {}) => {
      const s = stateRef.current;
      const status = opts.status ?? s.status;
      const v = version.current;
      setSaving(true);
      if (!opts.auto) setMessage(null);
      try {
        const url = kind === "page" ? `/api/admin/pages/about` : `${API_BASE[kind]}/${id}`;
        const res = await api<{ slug?: string; status?: State["status"]; publishedAt?: string | null }>(url, { method: "PUT", json: payload(s, status) });
        savedVersion.current = v;
        if (version.current === v) setDirty(false);
        setSavedAt(new Date());
        setPendingAt(null); // a full save publishes (or keeps as draft) everything, so nothing is pending
        if (res.status) {
          setSavedStatus(res.status);
          setState((cur) => ({ ...cur, status: res.status!, publishedAt: res.publishedAt ?? null, slug: res.slug ?? cur.slug }));
          if (kind !== "page" && res.slug) setPublicUrl(`${PUBLIC_BASE[kind]}/${res.slug}`);
        }
        if (!opts.auto) {
          const text = kind === "page" ? "Published" : status === "draft" ? (isLive ? "Unpublished — now a draft" : "Draft saved") : status === "scheduled" ? "Scheduled" : isLive ? "Changes published" : "Published";
          setMessage({ kind: "ok", text });
        }
        router.refresh();
        return true;
      } catch (e) {
        setMessage({ kind: "error", text: (e as Error).message });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, kind, payload, router, isLive],
  );

  /** Save without publishing: drafts save in place, live content saves its pending changes. */
  const saveQuietly = useCallback((auto: boolean) => (isLive ? saveDraft({ auto }) : save({ auto })), [isLive, save, saveDraft]);

  // Autosave everything shortly after you stop typing.
  useEffect(() => {
    if (!dirty || saving) return;
    const t = setTimeout(() => void saveQuietly(true), 1200);
    return () => clearTimeout(t);
  }, [dirty, state, saving, saveQuietly]);

  async function discardChanges() {
    if (!confirm("Discard your unpublished changes and go back to the published version?")) return;
    try {
      await api(`/api/admin/drafts/${kind}/${draftId}`, { method: "DELETE" });
      setDirty(false);
      // Reload so the editor starts again from the published version.
      window.location.reload();
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    }
  }

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
        void saveQuietly(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveQuietly]);

  // Preview shows the editor's current state (saved or not); see components/admin/preview-view.tsx.
  const [previewing, setPreviewing] = useState(false);
  const previewId = kind === "page" ? "about" : id;

  const draftForPreview = useCallback(
    (s: State): PreviewDraft => ({
      title: s.title,
      description: s.description,
      contentJson: s.contentJson,
      tags: s.tags,
      publishedAt: s.publishedAt,
      categoryId: s.categoryId,
      previewImage: s.previewImage ? { url: s.previewImage.url, width: s.previewImage.width, height: s.previewImage.height, alt: s.previewImage.alt } : null,
      project: { phase: s.phase, repoUrl: s.repoUrl, siteUrl: s.siteUrl, packageUrl: s.packageUrl, stack: s.stack },
      at: Date.now(),
    }),
    [],
  );

  function preview() {
    publishPreviewDraft(kind, previewId, draftForPreview(stateRef.current));
    setPreviewing(true);
    window.open(`/admin/preview/${kind}/${previewId}?live=1`, `preview-${kind}-${previewId}`);
  }

  // Keep an open preview in sync while editing.
  useEffect(() => {
    if (!previewing) return;
    const t = setTimeout(() => publishPreviewDraft(kind, previewId, draftForPreview(state)), 300);
    return () => clearTimeout(t);
  }, [previewing, state, kind, previewId, draftForPreview]);

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
    if (kind === "page") return;
    if (!confirm(`Delete this ${NOUN[kind]} permanently?`)) return;
    try {
      await api(`${API_BASE[kind]}/${id}`, { method: "DELETE" });
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

  const hasChanges = dirty || !!pendingAt;
  const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const lastSaved = savedAt ?? (pendingAt ? new Date(pendingAt) : null);
  // Primary action: publish for drafts, "Publish changes" for live content with pending edits.
  const primary =
    kind !== "page" && state.status === "draft"
      ? { label: isLive ? "Unpublish" : "Save draft", disabled: false }
      : !isLive
        ? { label: state.status === "scheduled" ? "Schedule" : "Publish", disabled: false }
        : hasChanges || state.status !== savedStatus
          ? { label: state.status === "scheduled" && savedStatus !== "scheduled" ? "Schedule" : "Publish changes", disabled: false }
          : { label: "Published", disabled: true };
  // Phones only have room for a word or two.
  const shortStatus = saving ? "Saving…" : dirty ? "Editing…" : isLive ? (pendingAt ? "Unpublished edits" : "Live") : "Draft";
  const statusText = saving
    ? "Saving…"
    : dirty
      ? "Editing…"
      : isLive
        ? pendingAt
          ? `Unpublished changes · saved ${lastSaved ? time(lastSaved) : ""}`
          : "Published · up to date"
        : `Draft${lastSaved ? ` · saved ${time(lastSaved)}` : ""}`;

  const label = "mb-1 block text-sm font-medium";
  const imageField = (
    <div>
      <span className={label}>{kind === "project" ? "Cover image" : "Preview image"}</span>
      {state.previewImage ? (
        <div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-lg)] bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
            <img src={`${state.previewImage.url}?w=640`} alt={state.previewImage.alt} className="size-full object-cover" />
          </div>
          <p className="mt-1 text-xs text-muted">Shown cropped to 16:9 in {kind === "project" ? "project cards" : "article lists"}.</p>
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
  );
  const sidebar = (
    <div className="space-y-6">
      {kind !== "page" && (
        <>
          <div>
            <label htmlFor="status" className={label}>Status</label>
            <Select
              id="status"
              className="field"
              value={state.status}
              onChange={(v) => update("status", v as State["status"])}
              options={[
                { value: "draft", label: "Draft", hint: "Only visible to you" },
                { value: "published", label: "Published", hint: "Live on the site" },
                ...(kind === "article" ? [{ value: "scheduled", label: "Scheduled", hint: "Goes live at the publish date" }] : []),
              ]}
            />
          </div>
          {kind === "project" ? (
            <div>
              <label htmlFor="phase" className={label}>Project status</label>
              <Select
                id="phase"
                className="field"
                value={state.phase}
                onChange={(v) => update("phase", v as ProjectPhase)}
                options={PHASE_ORDER.map((p) => ({ value: p, label: PHASE_META[p].label, hint: PHASE_META[p].hint }))}
              />
            </div>
          ) : (
            <div>
              <label htmlFor="publishedAt" className={label}>{state.status === "scheduled" ? "Publish at" : "Publish date"}</label>
              <input id="publishedAt" type="datetime-local" className="field" value={toLocalInput(state.publishedAt)} onChange={(e) => update("publishedAt", fromLocalInput(e.target.value))} />
              <p className="mt-1 text-xs text-muted">{state.status === "scheduled" ? "Goes live automatically at this time." : "Leave empty to use the time of publishing. Can be backdated."}</p>
            </div>
          )}
        </>
      )}
      {kind !== "page" && (
        <div>
          <label htmlFor="description" className={label}>{kind === "blog" ? "Description" : kind === "project" ? "Summary" : "Excerpt"}</label>
          <textarea id="description" className="field min-h-24" maxLength={kind === "article" ? 1000 : 500} value={state.description} onChange={(e) => update("description", e.target.value)} />
          {kind === "project" && <p className="mt-1 text-xs text-muted">One or two sentences, shown on project cards.</p>}
        </div>
      )}
      {kind === "project" && (
        <fieldset className="space-y-3">
          <legend className={label}>Links</legend>
          {(
            [
              ["repoUrl", "Repository", "https://github.com/you/project"],
              ["siteUrl", "Website", "https://project.example"],
              ["packageUrl", "Package", "npm, GHCR, PyPI, app store…"],
            ] as const
          ).map(([key, name, placeholder]) => (
            <div key={key}>
              <label htmlFor={key} className="mb-1 block text-xs text-muted">{name}</label>
              <input id={key} type="url" inputMode="url" className="field" placeholder={placeholder} value={state[key]} maxLength={500} onChange={(e) => update(key, e.target.value)} />
            </div>
          ))}
          <p className="text-xs text-muted">GitHub repositories also show stars, latest release and recent commits.</p>
        </fieldset>
      )}
      {kind === "project" && (
        <>
          <div>
            <span className={label}>Stack</span>
            <TagsInput value={state.stack} onChange={(v) => update("stack", v)} suggestions={tagSuggestions} placeholder="Add a technology and press Enter" />
          </div>
          <Switch label="Featured" description="Shown first, and on the home page." checked={state.featured} onChange={(v) => update("featured", v)} />
        </>
      )}
      {hasSlug && (
        <div>
          <label htmlFor="slug" className={label}>Slug</label>
          <div className="flex items-center">
            <span className="mr-1 text-sm text-muted">{kind === "project" ? "/projects/" : "/articles/"}</span>
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
      {(kind === "blog" || kind === "article") && (
        <div>
          <span className={label}>Tags</span>
          <TagsInput value={state.tags} onChange={(v) => update("tags", v)} suggestions={tagSuggestions} />
        </div>
      )}
      {(kind === "blog" || kind === "article") && projects.length > 0 && (
        <div>
          <label htmlFor="project" className={label}>Project</label>
          <Select
            id="project"
            className="field"
            value={state.projectId ?? ""}
            onChange={(v) => update("projectId", v || null)}
            options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.title || "Untitled project" }))]}
          />
          <p className="mt-1 text-xs text-muted">Listed as a progress update on the project page.</p>
        </div>
      )}
      {kind === "project" && imageField}
      {kind === "article" && (
        <>
          <div>
            <label htmlFor="category" className={label}>Category</label>
            <div className="flex gap-2">
              <Select
                id="category"
                className="field min-w-0 flex-1"
                value={state.categoryId ?? ""}
                onChange={(v) => update("categoryId", v || null)}
                options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <button type="button" className="btn btn-ghost" onClick={newCategory} aria-label="New category">New</button>
            </div>
          </div>
          {imageField}
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
    </div>
  );

  const menuItems: MenuItem[] = [
    ...(isLive && pendingAt ? [{ label: "Discard unpublished changes", onSelect: discardChanges } as MenuItem, "separator" as const] : []),
    ...(publicUrl && isLive ? [{ label: "View on site", href: publicUrl, newTab: true } as MenuItem] : []),
    { label: "Undo", onSelect: () => editorRef.current?.chain().focus().undo().run() },
    { label: "Redo", onSelect: () => editorRef.current?.chain().focus().redo().run() },
    ...(kind === "blog" || kind === "article"
      ? ([
          "separator",
          { label: "Import markdown…", onSelect: importMarkdown },
          { label: "Export as markdown", href: `/api/admin/export/markdown?type=${kind}&id=${id}` },
        ] as MenuItem[])
      : []),
    ...(kind !== "page" ? (["separator", { label: `Delete ${NOUN[kind]}`, destructive: true, onSelect: remove }] as MenuItem[]) : []),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Top bar: back + status on the left, one joined control group on the right. */}
      <div className="sticky top-14 z-30 -mx-4 mb-5 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur-md sm:mx-0 sm:rounded-[var(--radius-lg)] sm:border sm:px-2 lg:top-3">
        <Link href={LIST_URL[kind]} className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-fg" aria-label="Back">
          <ArrowLeft width={18} height={18} />
        </Link>
        <span className="min-w-0 flex-1 truncate text-sm text-muted" role="status" aria-live="polite" title={statusText}>
          <span className="sm:hidden">{shortStatus}</span>
          <span className="hidden sm:inline">{statusText}</span>
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={preview} title="Preview" aria-label="Preview" className="flex size-10 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-fg">
            <EyeIcon width={19} height={19} />
          </button>
          {kind !== "page" && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
              title="Settings"
              aria-label="Settings"
              className="flex size-10 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
            >
              <SlidersIcon width={19} height={19} />
            </button>
          )}
          <Menu items={menuItems} label="More editor actions" />
          <button
            type="button"
            className="btn btn-sm ml-1.5 min-h-10 px-4"
            onClick={() => void save()}
            disabled={saving || primary.disabled || (hasSlug && slugCheck?.ok === false)}
          >
            {primary.label}
          </button>
        </div>
      </div>
      {isLive && pendingAt && (
        <p className="mb-4 text-sm text-muted" role="note">
          Editing unpublished changes. Visitors see the published version until you publish.
        </p>
      )}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`mb-4 rounded-[var(--radius-md)] border px-3 py-2 text-sm ${message.kind === "error" ? "border-fg font-medium" : "border-line text-muted"}`}>
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
            <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={kind === "blog" ? "Post settings" : kind === "project" ? "Project settings" : "Article settings"}>
              <div className="pt-1">{sidebar}</div>
            </Sheet>
          </>
        )}
      </div>

      <MediaPicker
        open={pickerOpen}
        title={kind === "project" ? "Choose a cover image" : "Choose a preview image"}
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
