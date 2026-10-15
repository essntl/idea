"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { useImperativeHandle } from "react";
import { commentExtensions } from "@/lib/content/comment-schema";
import { toggleCodeBlock } from "@/lib/content/editor-commands";

export type CommentEditorHandle = { getJSON: () => JSONContent; getText: () => string; clear: () => void; focus: () => void };

type Props = { handleRef: React.Ref<CommentEditorHandle>; placeholder?: string; autoFocus?: boolean; onChange?: (text: string) => void; "aria-labelledby"?: string; invalid?: boolean };

function Tool({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-sm ${active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      quote: e.isActive("blockquote"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      codeBlock: e.isActive("codeBlock"),
    }),
  });
  const c = () => editor.chain().focus();
  function link() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (empty to remove)", prev ?? "https://");
    if (url === null) return;
    const v = url.trim();
    if (!v || v === "https://") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: /^(https?:|mailto:)/i.test(v) ? v : `https://${v}` }).run();
  }
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-t border-line px-1.5 py-1" role="toolbar" aria-label="Formatting">
      <Tool label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
        <b>B</b>
      </Tool>
      <Tool label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
        <i className="font-serif">I</i>
      </Tool>
      <Tool label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}>
        <code className="text-xs">{"<>"}</code>
      </Tool>
      <Tool label="Link" active={s.link} onClick={link}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      </Tool>
      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />
      <Tool label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
        ❝
      </Tool>
      <Tool label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11" />
          <circle cx="4.5" cy="6" r="1" fill="currentColor" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" />
          <circle cx="4.5" cy="18" r="1" fill="currentColor" />
        </svg>
      </Tool>
      <Tool label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
        <span className="text-xs font-medium">1.</span>
      </Tool>
      <Tool label="Code block" active={s.codeBlock} onClick={() => toggleCodeBlock(editor)}>
        <span className="font-mono text-xs">{"{}"}</span>
      </Tool>
    </div>
  );
}

/** Rich-text comment field (bold, italic, code, links, quotes, lists, code blocks). Markdown shortcuts work too. */
export default function CommentEditor({ handleRef, placeholder = "Write a comment…", autoFocus, onChange, invalid, ...aria }: Props) {
  const editor = useEditor({
    extensions: [...commentExtensions(), Placeholder.configure({ placeholder })],
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "prose-comment",
        role: "textbox",
        "aria-multiline": "true",
        ...(aria["aria-labelledby"] ? { "aria-labelledby": aria["aria-labelledby"] } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getText()),
  });

  useImperativeHandle(handleRef, () => ({
    getJSON: () => editor?.getJSON() ?? { type: "doc", content: [] },
    getText: () => editor?.getText() ?? "",
    clear: () => editor?.commands.clearContent(true),
    focus: () => editor?.commands.focus("end"),
  }));

  return (
    <div className={`comment-editor overflow-hidden rounded-[var(--radius-md)] border bg-bg focus-within:border-fg focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--fg)_12%,transparent)] ${invalid ? "border-fg" : "border-line-strong"}`}>
      <EditorContent editor={editor} />
      {editor ? <Toolbar editor={editor} /> : <div className="h-[41px] border-t border-line" />}
    </div>
  );
}
