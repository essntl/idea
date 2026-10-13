"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type SlashActions = {
  pickImage: () => void;
  pickFromLibrary: () => void;
};

type Item = { title: string; hint: string; keywords: string; run: (editor: Editor, range: Range, actions: SlashActions) => void };

function promptUrl(message: string): string | null {
  const url = window.prompt(message)?.trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const SLASH_ITEMS: Item[] = [
  { title: "Text", hint: "Plain paragraph", keywords: "paragraph p", run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: "Heading 1", hint: "Large section heading", keywords: "h1 title", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { title: "Heading 2", hint: "Medium section heading", keywords: "h2 subtitle", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: "Heading 3", hint: "Small section heading", keywords: "h3", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { title: "Bulleted list", hint: "Simple list", keywords: "ul unordered bullet", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: "Numbered list", hint: "List with numbers", keywords: "ol ordered number", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: "To-do list", hint: "Checklist", keywords: "todo task check", run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: "Quote", hint: "Block quotation", keywords: "blockquote citation", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: "Code block", hint: "Code with highlighting", keywords: "pre snippet", run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: "Divider", hint: "Horizontal line", keywords: "hr rule separator line", run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  {
    title: "Image",
    hint: "Upload from your device",
    keywords: "picture photo upload img",
    run: (e, r, a) => {
      e.chain().focus().deleteRange(r).run();
      a.pickImage();
    },
  },
  {
    title: "Image from library",
    hint: "Pick an uploaded image",
    keywords: "media picture library",
    run: (e, r, a) => {
      e.chain().focus().deleteRange(r).run();
      a.pickFromLibrary();
    },
  },
  {
    title: "Table",
    hint: "3 × 3 table",
    keywords: "grid rows columns",
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Callout",
    hint: "Highlighted note",
    keywords: "note info aside box",
    run: (e, r) =>
      e.chain().focus().deleteRange(r).insertContent({ type: "callout", attrs: { emoji: "" }, content: [{ type: "paragraph" }] }).run(),
  },
  {
    title: "YouTube",
    hint: "Embed a video",
    keywords: "video embed youtube",
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      const url = promptUrl("YouTube URL");
      if (url) e.chain().focus().insertContent({ type: "embed", attrs: { url } }).run();
    },
  },
  {
    title: "Link card",
    hint: "Bookmark to a page",
    keywords: "embed bookmark link url",
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      const url = promptUrl("Link URL");
      if (url) e.chain().focus().insertContent({ type: "embed", attrs: { url, title: "" } }).run();
    },
  },
];

export function filterItems(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.includes(q));
}

type MenuHandle = { onKeyDown: (p: SuggestionKeyDownProps) => boolean };

const SlashMenu = forwardRef<MenuHandle, SuggestionProps<Item, Item>>(function SlashMenu({ items, command }, ref) {
  const [index, setIndex] = useState(0);
  const [lastItems, setLastItems] = useState(items);
  const listRef = useRef<HTMLDivElement>(null);
  if (lastItems !== items) {
    setLastItems(items);
    setIndex(0);
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[index];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  return (
    <div ref={listRef} role="listbox" aria-label="Insert block" className="max-h-80 w-64 animate-menu-in overflow-y-auto rounded border border-line-strong bg-bg py-1 text-fg">
      {items.length ? (
        items.map((item, i) => (
          <button
            key={item.title}
            type="button"
            role="option"
            aria-selected={i === index}
            data-index={i}
            onMouseEnter={() => setIndex(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(item)}
            className={`flex w-full flex-col items-start px-3 py-2 text-left ${i === index ? "bg-surface" : ""}`}
          >
            <span className="text-sm font-medium">{item.title}</span>
            <span className="text-xs text-muted">{item.hint}</span>
          </button>
        ))
      ) : (
        <p className="px-3 py-2 text-sm text-muted">No matches</p>
      )}
    </div>
  );
});

/** "/" command menu. `getActions` is read lazily so React state setters can be used from inside ProseMirror. */
export function createSlashCommand(getActions: () => SlashActions) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<Item, Item>({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          allowSpaces: false,
          items: ({ query }) => filterItems(query),
          command: ({ editor, range, props }) => props.run(editor, range, getActions()),
          allow: ({ state, range }) => {
            const $from = state.doc.resolve(range.from);
            return $from.parent.type.name !== "codeBlock";
          },
          render: () => {
            let renderer: ReactRenderer<MenuHandle, SuggestionProps<Item, Item>> | null = null;
            const place = (props: SuggestionProps<Item, Item>) => {
              const rect = props.clientRect?.();
              const el = renderer?.element as HTMLElement | undefined;
              if (!rect || !el) return;
              computePosition({ getBoundingClientRect: () => rect }, el, {
                placement: "bottom-start",
                strategy: "fixed",
                middleware: [offset(6), flip(), shift({ padding: 8 })],
              }).then(({ x, y }) => Object.assign(el.style, { left: `${x}px`, top: `${y}px` }));
            };
            return {
              onStart: (props) => {
                renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
                const el = renderer.element as HTMLElement;
                Object.assign(el.style, { position: "fixed", zIndex: "60", left: "0px", top: "0px" });
                document.body.appendChild(el);
                place(props);
              },
              onUpdate: (props) => {
                renderer?.updateProps(props);
                place(props);
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  renderer?.destroy();
                  renderer?.element.remove();
                  renderer = null;
                  return true;
                }
                return renderer?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                renderer?.destroy();
                renderer?.element.remove();
                renderer = null;
              },
            };
          },
        }),
      ];
    },
  });
}
