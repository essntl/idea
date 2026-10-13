"use client";

import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import CodeBlock from "@tiptap/extension-code-block";
import { useState } from "react";
import { Figure, Embed, IMAGE_SIZES, IMAGE_ALIGNS, youtubeId } from "@/lib/content/extensions";
import { CODE_LANGUAGES } from "@/lib/content/languages";
import { pickFiles, uploadImages } from "./upload";

function ImageView({ node, updateAttributes, selected, deleteNode }: ReactNodeViewProps) {
  const { src, alt, caption, size, align, missing } = node.attrs as {
    src: string; alt: string; caption: string; size: number; align: string; missing: boolean;
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function replace() {
    const [file] = await pickFiles(undefined, false);
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { items } = await uploadImages([file], alt);
      const m = items[0];
      if (m) updateAttributes({ src: m.url, width: m.width, height: m.height, missing: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = (active: boolean) => `min-h-9 min-w-9 rounded px-2 text-xs ${active ? "bg-fg text-bg" : "hover:bg-surface"}`;

  return (
    <NodeViewWrapper as="figure" data-size={String(size)} data-align={align} className={`editor-figure ${selected ? "is-selected" : ""}`}>
      {missing ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 border border-dashed border-line-strong p-4 text-center text-sm" contentEditable={false}>
          <p>
            Missing image: <code className="break-all">{src}</code>
          </p>
          <button type="button" className="btn btn-ghost" onClick={replace} disabled={busy}>
            {busy ? "Uploading…" : "Upload image"}
          </button>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- editor preview of arbitrary sources
        <img src={src} alt={alt} draggable data-drag-handle />
      )}
      <input
        className="mt-2 w-full bg-transparent text-center text-sm text-muted outline-none placeholder:text-subtle"
        value={caption ?? ""}
        placeholder="Add a caption…"
        onChange={(e) => updateAttributes({ caption: e.target.value })}
        aria-label="Image caption"
      />
      {selected && (
        <div contentEditable={false} className="mt-2 flex flex-wrap items-center justify-center gap-1 border border-line bg-bg p-1 text-fg">
          {IMAGE_SIZES.map((s) => (
            <button key={s} type="button" className={btn(size === s)} onClick={() => updateAttributes({ size: s })} aria-pressed={size === s}>
              {s}%
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          {IMAGE_ALIGNS.map((a) => (
            <button key={a} type="button" className={btn(align === a)} onClick={() => updateAttributes({ align: a })} aria-pressed={align === a}>
              {a[0]!.toUpperCase() + a.slice(1)}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <input
            className="min-h-9 min-w-0 flex-1 basis-40 rounded border border-line bg-transparent px-2 text-xs outline-none focus:border-fg"
            value={alt ?? ""}
            placeholder="Alt text (describe the image)"
            onChange={(e) => updateAttributes({ alt: e.target.value })}
            aria-label="Alt text"
          />
          <button type="button" className={btn(false)} onClick={replace} disabled={busy}>
            {busy ? "…" : "Replace"}
          </button>
          <button type="button" className={btn(false)} onClick={() => deleteNode()}>
            Remove
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-center text-xs font-medium">{error}</p>}
    </NodeViewWrapper>
  );
}

function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const language = (node.attrs.language as string | null) ?? "plaintext";
  const known = (CODE_LANGUAGES as readonly string[]).includes(language);
  return (
    <NodeViewWrapper className="editor-code">
      <div contentEditable={false} className="flex justify-end">
        <select
          className="min-h-8 rounded-t border border-b-0 border-line bg-surface px-2 text-xs text-muted"
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value === "plaintext" ? null : e.target.value })}
          aria-label="Code language"
        >
          {/* Keep aliases such as "ts" from markdown fences selectable. */}
          {!known && <option value={language}>{language}</option>}
          {CODE_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

function EmbedView({ node, selected, updateAttributes }: ReactNodeViewProps) {
  const url = node.attrs.url as string;
  const id = youtubeId(url);
  return (
    <NodeViewWrapper className={`my-4 border p-3 ${selected ? "border-fg" : "border-line-strong"}`} data-drag-handle>
      <div contentEditable={false} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {id && (
          // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail preview in editor only
          <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="w-full rounded-sm sm:w-40" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{id ? "YouTube video" : "Link"}</p>
          <p className="truncate text-muted">{url}</p>
          {!id && (
            <input
              className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-fg"
              value={(node.attrs.title as string) ?? ""}
              placeholder="Title (optional)"
              onChange={(e) => updateAttributes({ title: e.target.value })}
            />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const EditorFigure = Figure.extend({ addNodeView: () => ReactNodeViewRenderer(ImageView) });
export const EditorEmbed = Embed.extend({ addNodeView: () => ReactNodeViewRenderer(EmbedView) });
export const EditorCodeBlock = CodeBlock.extend({ addNodeView: () => ReactNodeViewRenderer(CodeBlockView) });
