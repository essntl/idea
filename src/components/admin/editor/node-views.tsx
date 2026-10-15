"use client";

import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import CodeBlock from "@tiptap/extension-code-block";
import { useState } from "react";
import { Figure, Embed, IMAGE_SIZES, youtubeId, type ImageAlign } from "@/lib/content/extensions";
import { CODE_LANGUAGES } from "@/lib/content/languages";
import { pickFiles, uploadImages } from "./upload";
import { Select } from "@/components/ui/select";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, GripIcon, ReplaceIcon, TrashIcon } from "@/components/ui/icons";

const ALIGN_ICONS: { value: ImageAlign; label: string; Icon: typeof AlignLeftIcon }[] = [
  { value: "left", label: "Align left", Icon: AlignLeftIcon },
  { value: "center", label: "Align center", Icon: AlignCenterIcon },
  { value: "right", label: "Align right", Icon: AlignRightIcon },
];

/** Keeps the node selected while toolbar buttons are clicked. */
const keepSelection = (e: React.MouseEvent) => e.preventDefault();

function ImageView({ node, updateAttributes, selected, deleteNode }: ReactNodeViewProps) {
  const { src, alt, caption, size, align, missing } = node.attrs as {
    src: string; alt: string; caption: string; size: number; align: ImageAlign; missing: boolean;
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [altOpen, setAltOpen] = useState(false);

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

  const sep = <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />;

  return (
    <NodeViewWrapper as="figure" data-size={String(size)} data-align={align} className={`editor-figure group ${selected ? "is-selected" : ""}`}>
      <div className="relative">
        {missing ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface p-5 text-center text-sm" contentEditable={false}>
            <p className="text-muted">
              Missing image <code className="block break-all text-xs">{src}</code>
            </p>
            <button type="button" className="btn btn-ghost" onClick={replace} disabled={busy}>
              {busy ? "Uploading…" : "Upload image"}
            </button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- editor preview of arbitrary sources
          <img src={src} alt={alt} draggable data-drag-handle />
        )}

        {/* Drag handle: visible on hover/selection so it's clear where to grab to move the image. */}
        <div
          contentEditable={false}
          draggable
          data-drag-handle
          title="Drag to move"
          aria-label="Drag to move image"
          className={`absolute top-2 left-2 flex size-8 cursor-grab items-center justify-center rounded-[var(--radius-sm)] bg-bg/90 text-muted shadow-[var(--shadow-float)] backdrop-blur transition-opacity active:cursor-grabbing ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <GripIcon width={16} height={16} />
        </div>

        {selected && (
          <div contentEditable={false} className="absolute top-2 left-1/2 z-10 w-max max-w-[calc(100%-1rem)] -translate-x-1/2 animate-menu-in">
            <div className="floating flex items-center gap-0.5 overflow-x-auto p-1 [scrollbar-width:none]" role="toolbar" aria-label="Image options">
              {IMAGE_SIZES.map((s) => (
                <button key={s} type="button" className="btn-quiet min-w-10 px-2 text-xs" onMouseDown={keepSelection} onClick={() => updateAttributes({ size: s })} aria-pressed={size === s} title={`Width ${s}%`}>
                  {s === 100 ? "Full" : `${s}%`}
                </button>
              ))}
              {sep}
              {ALIGN_ICONS.map(({ value, label, Icon }) => (
                <button key={value} type="button" className="btn-quiet px-0" onMouseDown={keepSelection} onClick={() => updateAttributes({ align: value })} aria-pressed={align === value} aria-label={label} title={label}>
                  <Icon width={16} height={16} />
                </button>
              ))}
              {sep}
              <button type="button" className="btn-quiet px-2 text-xs" onMouseDown={keepSelection} onClick={() => setAltOpen((v) => !v)} aria-pressed={altOpen} title="Alt text">
                Alt{!alt && <span className="size-1.5 rounded-full bg-current opacity-60" aria-label="missing" />}
              </button>
              <button type="button" className="btn-quiet px-0" onMouseDown={keepSelection} onClick={replace} disabled={busy} aria-label="Replace image" title="Replace image">
                <ReplaceIcon width={16} height={16} />
              </button>
              <button type="button" className="btn-quiet px-0" onMouseDown={keepSelection} onClick={() => deleteNode()} aria-label="Remove image" title="Remove image">
                <TrashIcon width={16} height={16} />
              </button>
            </div>
            {altOpen && (
              <div className="floating mt-1.5 flex animate-menu-in items-center gap-2 p-1.5 pl-3">
                <label htmlFor={`alt-${node.attrs.src}`} className="text-xs text-muted">
                  Alt
                </label>
                <input
                  id={`alt-${node.attrs.src}`}
                  autoFocus
                  className="min-h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] bg-surface px-2 text-sm outline-none placeholder:text-subtle focus:bg-surface-2"
                  value={alt ?? ""}
                  placeholder="Describe the image"
                  onChange={(e) => updateAttributes({ alt: e.target.value })}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && setAltOpen(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <input
        className="mt-2 w-full bg-transparent text-center text-sm text-muted outline-none placeholder:text-subtle"
        value={caption ?? ""}
        placeholder={selected ? "Add a caption…" : ""}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
        aria-label="Image caption"
      />
      {error && <p className="mt-1 text-center text-xs font-medium">{error}</p>}
    </NodeViewWrapper>
  );
}

function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const language = (node.attrs.language as string | null) ?? "plaintext";
  const known = (CODE_LANGUAGES as readonly string[]).includes(language);
  return (
    <NodeViewWrapper className="editor-code group relative">
      <div contentEditable={false} className="absolute top-2 right-2 z-10 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Select
          size="sm"
          preserveFocus
          aria-label="Code language"
          className="bg-surface-2 text-muted hover:text-fg"
          value={language}
          onChange={(v) => updateAttributes({ language: v === "plaintext" ? null : v })}
          // Keep aliases such as "ts" from markdown fences selectable.
          options={[...(known ? [] : [language]), ...CODE_LANGUAGES].map((l) => ({ value: l, label: l }))}
        />
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
    <NodeViewWrapper
      className={`my-4 cursor-grab rounded-[var(--radius-lg)] border bg-surface p-3 transition-colors ${selected ? "border-fg" : "border-transparent hover:border-line-strong"}`}
      data-drag-handle
    >
      <div contentEditable={false} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {id && (
          // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail preview in editor only
          <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="w-full rounded-[var(--radius-md)] sm:w-40" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{id ? "YouTube video" : "Link"}</p>
          <p className="truncate text-muted">{url}</p>
          {!id && (
            <input
              className="mt-2 w-full rounded-[var(--radius-sm)] bg-bg px-2 py-1.5 text-sm outline-none placeholder:text-subtle"
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
