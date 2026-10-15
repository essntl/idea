"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { useEffect, useMemo, useRef, useState } from "react";
import { schemaExtensions, TEXT_COLORS } from "@/lib/content/extensions";
import { toggleCodeBlock } from "@/lib/content/editor-commands";
import { EditorCodeBlock, EditorEmbed, EditorFigure } from "./node-views";
import { createSlashCommand, SLASH_ITEMS, type SlashActions } from "./slash-command";
import { Sheet } from "@/components/ui/sheet";
import { PlusIcon } from "@/components/ui/icons";
import { isImageFile, pickFiles, uploadImages, type MediaItem } from "./upload";
import { MediaPicker } from "../media-picker";
import { Select } from "@/components/ui/select";

type Props = {
  content: JSONContent;
  onChange: (doc: JSONContent) => void;
  placeholder?: string;
  /** Called once the editor exists, e.g. to replace content after a markdown import. */
  onReady?: (editor: Editor) => void;
};

export function RichEditor({ content, onChange, placeholder = "Write something, or type “/” for commands…", onReady }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const [initialComparable] = useState(() => comparable(content));
  const pristine = useRef<string | null>(initialComparable);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  async function insertFiles(files: File[], pos?: number) {
    const images = files.filter(isImageFile);
    const editor = editorRef.current;
    if (!images.length || !editor) return;
    setStatus(`Uploading ${images.length} image${images.length > 1 ? "s" : ""}…`);
    try {
      const { items, errors } = await uploadImages(images);
      const nodes = items.map((m) => imageNode(m));
      if (nodes.length) {
        const chain = editor.chain().focus();
        (pos !== undefined ? chain.insertContentAt(pos, nodes) : chain.insertContent(nodes)).run();
      }
      setStatus(errors.length ? errors.map((e) => `${e.filename}: ${e.error}`).join("; ") : null);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  const insertFilesRef = useRef(insertFiles);
  useEffect(() => {
    insertFilesRef.current = insertFiles;
  });

  const [actions] = useState<SlashActions>(() => ({
    pickImage: () => void pickFiles().then((f) => insertFilesRef.current(f)),
    pickFromLibrary: () => setPickerOpen(true),
  }));

  const extensions = useMemo(
    () => [
      ...schemaExtensions({ image: EditorFigure, embed: EditorEmbed, codeBlock: EditorCodeBlock }),
      Placeholder.configure({ placeholder, includeChildren: false }),
      createSlashCommand(() => actions),
    ],
    [placeholder, actions],
  );

  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "prose editor-content", "aria-label": "Content editor", role: "textbox", "aria-multiline": "true" },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || !files.some(isImageFile)) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertFilesRef.current(files, pos);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.some(isImageFile)) return false;
        event.preventDefault();
        void insertFilesRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const doc = editor.getJSON();
      // Ignore normalisation on load (e.g. the trailing paragraph added after a final image/divider).
      if (pristine.current !== null) {
        if (comparable(doc) === pristine.current) return;
        pristine.current = null;
      }
      onChangeRef.current(doc);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    if (editor) onReady?.(editor);
  }, [editor, onReady]);

  return (
    <div className="editor">
      {editor && <Toolbar editor={editor} onImage={actions.pickImage} onLibrary={() => setPickerOpen(true)} />}
      {editor && <SelectionMenu editor={editor} />}
      <EditorContent editor={editor} />
      {editor && <MobileInsert editor={editor} actions={actions} />}
      {status && (
        <p role="status" className="floating fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md animate-sheet-in px-4 py-3 text-sm sm:inset-x-auto sm:right-6">
          {status}
          <button type="button" className="ml-3 underline" onClick={() => setStatus(null)}>
            Dismiss
          </button>
        </p>
      )}
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(m) => {
          setPickerOpen(false);
          editor?.chain().focus().insertContent(imageNode(m)).run();
        }}
      />
    </div>
  );
}

/**
 * Phones have no fixed toolbar: text is formatted via the selection menu, and blocks are inserted
 * from this "+" button (same list as the "/" command).
 */
function MobileInsert({ editor, actions }: { editor: Editor; actions: SlashActions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Insert block"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setOpen(true)}
        className={`fixed right-4 z-30 ${process.env.NODE_ENV === "development" ? "bottom-20" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"} flex size-12 items-center justify-center rounded-full bg-fg text-bg shadow-[var(--shadow-float)] md:hidden`}
      >
        <PlusIcon width={22} height={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Insert">
        <ul className="-mx-2 grid grid-cols-2 gap-1">
          {SLASH_ITEMS.map((item) => (
            <li key={item.title}>
              <button
                type="button"
                className="flex w-full flex-col items-start rounded-[var(--radius-md)] px-3 py-2.5 text-left hover:bg-surface-2"
                onClick={() => {
                  setOpen(false);
                  const pos = editor.state.selection.from;
                  item.run(editor, { from: pos, to: pos }, actions);
                }}
              >
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-xs text-muted">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

/** Key-order independent JSON (Postgres JSONB reorders object keys). */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Document fingerprint that ignores key order and trailing empty paragraphs. */
function comparable(doc: JSONContent): string {
  const content = [...(doc.content ?? [])];
  while (content.length > 1 && content[content.length - 1]!.type === "paragraph" && !content[content.length - 1]!.content?.length) content.pop();
  return stable(content);
}

export function imageNode(m: MediaItem): JSONContent {
  return { type: "image", attrs: { src: m.url, alt: m.alt, width: m.width, height: m.height, size: 100, align: "center", caption: "" } };
}

/* -------------------------------- toolbar -------------------------------- */

function setLink(editor: Editor) {
  const prev = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL (leave empty to remove)", prev ?? "https://");
  if (url === null) return;
  if (!url.trim() || url.trim() === "https://") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  const href = /^(https?:|mailto:|\/|#)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

function Btn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-sm disabled:opacity-30 ${active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden="true" />;

function useMarks(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      highlight: e.isActive("highlight"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      table: e.isActive("table"),
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
}

function Toolbar({ editor, onImage, onLibrary }: { editor: Editor; onImage: () => void; onLibrary: () => void }) {
  const s = useMarks(editor);
  const c = () => editor.chain().focus();
  const block = s.h1 ? "h1" : s.h2 ? "h2" : s.h3 ? "h3" : "p";
  return (
    <div className="sticky top-[7.5rem] z-20 hidden rounded-[var(--radius-lg)] border border-line bg-bg/90 px-1.5 backdrop-blur-md md:block lg:top-[4.75rem]" role="toolbar" aria-label="Formatting">
      <div className="flex flex-wrap items-center py-1">
        <Btn label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}>↶</Btn>
        <Btn label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}>↷</Btn>
        <Sep />
        <Select
          aria-label="Block type"
          preserveFocus
          className="h-9 min-h-9 w-32 shrink-0 text-sm text-muted hover:bg-surface-2 hover:text-fg"
          value={block}
          onChange={(v) => {
            if (v === "p") c().setParagraph().run();
            else c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
          }}
          options={[
            { value: "p", label: "Paragraph" },
            { value: "h1", label: "Heading 1" },
            { value: "h2", label: "Heading 2" },
            { value: "h3", label: "Heading 3" },
          ]}
        />
        <Sep />
        <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
        <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
        <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
        <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
        <Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}><code>{"<>"}</code></Btn>
        <Btn label="Link" active={s.link} onClick={() => setLink(editor)}>🔗︎</Btn>
        <Btn label="Highlight" active={s.highlight} onClick={() => c().toggleHighlight().run()}><mark className="rounded-sm bg-surface-2 px-0.5 text-fg">H</mark></Btn>
        <Sep />
        <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>•≡</Btn>
        <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>1.</Btn>
        <Btn label="To-do list" active={s.task} onClick={() => c().toggleTaskList().run()}>☑︎</Btn>
        <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>❝</Btn>
        <Btn label="Code block" active={s.codeBlock} onClick={() => toggleCodeBlock(editor)}>{"{}"}</Btn>
        <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}>—</Btn>
        <Sep />
        <Btn label="Upload image" onClick={onImage}>▣</Btn>
        <Btn label="Image from library" onClick={onLibrary}>▤</Btn>
        <Btn label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>⊞</Btn>
        {s.table && (
          <>
            <Sep />
            <Btn label="Add row below" onClick={() => c().addRowAfter().run()}>+R</Btn>
            <Btn label="Add column right" onClick={() => c().addColumnAfter().run()}>+C</Btn>
            <Btn label="Delete row" onClick={() => c().deleteRow().run()}>−R</Btn>
            <Btn label="Delete column" onClick={() => c().deleteColumn().run()}>−C</Btn>
            <Btn label="Delete table" onClick={() => c().deleteTable().run()}>✕</Btn>
          </>
        )}
      </div>
    </div>
  );
}

function SelectionMenu({ editor }: { editor: Editor }) {
  const s = useMarks(editor);
  const c = () => editor.chain().focus();
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: e, state }) => {
        const { empty, from, to } = state.selection;
        if (empty || !e.isEditable) return false;
        if (e.isActive("image") || e.isActive("embed") || e.isActive("codeBlock")) return false;
        return state.doc.textBetween(from, to).trim().length > 0;
      }}
    >
      <div className="floating flex w-max max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center p-1 text-fg">
        <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
        <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
        <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
        <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
        <Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}><code>{"<>"}</code></Btn>
        <Btn label="Link" active={s.link} onClick={() => setLink(editor)}>🔗︎</Btn>
        <Btn label="Highlight" active={s.highlight} onClick={() => c().toggleHighlight().run()}><mark className="rounded-sm bg-surface-2 px-0.5 text-fg">H</mark></Btn>
        <Sep />
        <Btn label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>H3</Btn>
        <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>•≡</Btn>
        <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>❝</Btn>
        <Sep />
        {TEXT_COLORS.map((col) => (
          <Btn
            key={col.label}
            label={`Text color: ${col.label}`}
            active={s.color === col.value}
            onClick={() => (col.value ? c().setColor(col.value).run() : c().unsetColor().run())}
          >
            <span className="font-semibold" style={{ color: col.value ?? undefined }}>A</span>
          </Btn>
        ))}
      </div>
    </BubbleMenu>
  );
}
