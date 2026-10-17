"use client";

import { Extension, type JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { diffForPreview, markdownToPlain, type DiffSegment } from "@/lib/content/word-diff";
import { plainOf, protect, restore, withLabels, type Protected } from "@/lib/content/ai-protect";
import { ArrowRight, SparkleIcon } from "@/components/ui/icons";

/* ------------------------------------------------------------------------------------------------
 * Live preview layer. The document itself is never touched while the AI writes: the original text is
 * hidden with decorations and a widget shows a word-level diff (removed words struck out, new words
 * highlighted) that updates as the answer streams in. Accepting applies the final content in one step.
 * ---------------------------------------------------------------------------------------------- */

type PreviewState = {
  from: number;
  to: number;
  inline: boolean;
  mode: "target" | "preview";
  /** "Continue writing": where the new text goes (no original text is replaced). */
  continueAt: number | null;
  segments: DiffSegment[];
  streaming: boolean;
  version: number;
} | null;

const aiPreviewKey = new PluginKey<PreviewState>("aiPreview");

function caret() {
  const c = document.createElement("span");
  c.className = "ai-caret";
  return c;
}

function renderSegments(segments: DiffSegment[], block: boolean, streaming: boolean) {
  const el = document.createElement(block ? "div" : "span");
  el.className = block ? "ai-diff ai-diff-block" : "ai-diff";
  el.contentEditable = "false";
  // The caret sits where the AI is writing: before the original text it hasn't reached yet.
  let caretAt = segments.length;
  while (caretAt > 0 && segments[caretAt - 1]!.type === "pending") caretAt--;
  segments.forEach((seg, i) => {
    if (streaming && i === caretAt) el.append(caret());
    if (seg.type === "same") {
      el.append(seg.text);
      return;
    }
    const span = document.createElement("span");
    span.className = seg.type === "add" ? "ai-ins" : seg.type === "del" ? "ai-del" : "ai-pending";
    span.textContent = seg.text;
    el.append(span);
  });
  if (streaming && caretAt === segments.length) el.append(caret());
  return el;
}

/** Start of the top-level block containing `pos` (a valid place for a block widget). */
function blockStart(doc: PMNode, pos: number) {
  const $pos = doc.resolve(pos);
  return $pos.depth === 0 ? pos : $pos.before(1);
}

function buildDecorations(doc: PMNode, s: NonNullable<PreviewState>): Decoration[] {
  if (s.mode === "target") return s.to > s.from ? [Decoration.inline(s.from, s.to, { class: "ai-target" })] : [];
  const key = `ai-${s.version}`;
  if (s.continueAt !== null) {
    return [Decoration.widget(s.continueAt, () => renderSegments(s.segments, true, s.streaming), { side: 1, key })];
  }
  const out: Decoration[] = [];
  doc.nodesBetween(s.from, s.to, (node, pos) => {
    const end = pos + node.nodeSize;
    if (node.isBlock && pos >= s.from && end <= s.to) {
      out.push(Decoration.node(pos, end, { class: "ai-hidden" }));
      return false;
    }
    if (node.isTextblock) {
      const a = Math.max(s.from, pos + 1);
      const b = Math.min(s.to, end - 1);
      if (b > a) out.push(Decoration.inline(a, b, { class: "ai-hidden" }));
      return false;
    }
    return true;
  });
  const at = s.inline ? s.from : blockStart(doc, s.from);
  out.push(Decoration.widget(at, () => renderSegments(s.segments, !s.inline, s.streaming), { side: -1, key }));
  return out;
}

export const AiPreview = Extension.create({
  name: "aiPreview",
  addProseMirrorPlugins() {
    return [
      new Plugin<PreviewState>({
        key: aiPreviewKey,
        state: {
          init: () => null,
          apply(tr, prev) {
            const meta = tr.getMeta(aiPreviewKey) as PreviewState | undefined;
            if (meta !== undefined) return meta;
            if (!prev || !tr.docChanged) return prev;
            return { ...prev, from: tr.mapping.map(prev.from), to: tr.mapping.map(prev.to) };
          },
        },
        props: {
          decorations(state) {
            const s = aiPreviewKey.getState(state);
            return s ? DecorationSet.create(state.doc, buildDecorations(state.doc, s)) : null;
          },
        },
      }),
    ];
  },
});

function setPreview(editor: Editor, value: PreviewState) {
  editor.view.dispatch(editor.state.tr.setMeta(aiPreviewKey, value).setMeta("addToHistory", false));
}

/* ------------------------------------------------------------------------------------------------
 * Target capture and request payloads
 * ---------------------------------------------------------------------------------------------- */

/**
 * What the AI works on, captured when the bar opens (focus moves into the bar afterwards).
 * With nothing selected that's the paragraph at the cursor; in an empty paragraph the AI writes new text there.
 */
export type AiTarget = { from: number; to: number; inline: boolean; empty: boolean; scope: string; initial?: AiRequest };

/** A request made straight from the selection menu: the bar opens already working on it. */
export type AiRequest = { action: Action; instruction?: string };

export function captureAiTarget(editor: Editor): AiTarget {
  const sel = editor.state.selection;
  const { $from, $to } = sel;
  if (!sel.empty) {
    const inline = $from.parent === $to.parent && $from.parent.isTextblock;
    return { from: sel.from, to: sel.to, inline, empty: false, scope: inline ? "the selected text" : "the selection" };
  }
  if ($from.parent.isTextblock && $from.depth > 0) {
    if ($from.parent.content.size === 0) return { from: $from.before(), to: $from.after(), inline: false, empty: true, scope: "" };
    return { from: $from.start(), to: $from.end(), inline: true, empty: false, scope: "this paragraph" };
  }
  return { from: sel.from, to: sel.to, inline: false, empty: true, scope: "" };
}

export type Action = "improve" | "fix" | "shorter" | "longer" | "simplify" | "continue" | "custom" | "write";
/** replace: the target is rewritten. continue: new text goes below it. */
type Mode = "replace" | "continue";

export const QUICK_ACTIONS: { action: "improve" | "fix" | "shorter" | "longer" | "simplify" | "continue"; label: string }[] = [
  { action: "improve", label: "Improve writing" },
  { action: "fix", label: "Fix spelling & grammar" },
  { action: "shorter", label: "Make shorter" },
  { action: "longer", label: "Make longer" },
  { action: "simplify", label: "Simplify" },
  { action: "continue", label: "Continue writing" },
];

/** Position right after the top-level block that contains `pos`. */
function afterBlock(doc: PMNode, pos: number) {
  const $pos = doc.resolve(Math.min(pos, doc.content.size));
  return $pos.depth > 0 ? $pos.after(1) : doc.content.size;
}

/* ------------------------------------------------------------------------------------------------
 * The bar
 * ---------------------------------------------------------------------------------------------- */

type Phase = "idle" | "streaming" | "done" | "error";
type Run = { action: Action; instruction?: string; passage: JSONContent };

/**
 * Inline AI bar under the text it works on: pick an action or type an instruction, watch the edit stream into
 * the document as a live diff, ask for changes, then accept, insert it below, try again or discard.
 */
export function AiInline({ editor, target, title, onClose }: { editor: Editor; target: AiTarget | null; title: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [instruction, setInstruction] = useState("");
  const [refinement, setRefinement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("replace");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** The current suggestion, still with markers (refinements are sent like this). */
  const contentRef = useRef<JSONContent | null>(null);
  const keptRef = useRef<Protected>({ nodes: [], labels: [] });
  const originalRef = useRef("");
  const lastRunRef = useRef<Run | null>(null);
  const modeRef = useRef<Mode>("replace");
  const version = useRef(0);

  const preview = useCallback(
    (next: Omit<NonNullable<PreviewState>, "version"> | null) => {
      setPreview(editor, next ? { ...next, version: ++version.current } : null);
    },
    [editor],
  );

  const showTarget = useCallback(() => {
    if (target) preview({ from: target.from, to: target.to, inline: target.inline, mode: "target", continueAt: null, segments: [], streaming: false });
  }, [target, preview]);

  const startInitial = useEffectEvent((request: AiRequest) => start(request.action, request.instruction));

  // Open: highlight the target and freeze the document so positions stay valid. Close: undo both.
  useEffect(() => {
    if (!target) return;
    editor.setEditable(false, false);
    showTarget();
    const t = target.initial ? setTimeout(() => startInitial(target.initial!), 0) : undefined;
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
      preview(null);
      editor.setEditable(true, false);
    };
  }, [editor, target, preview, showTarget]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setError(null);
    setInstruction("");
    setRefinement("");
    contentRef.current = null;
    onClose();
  }, [onClose]);

  // Place the bar under the preview (or the target), across the text column.
  const place = useCallback(() => {
    if (!target) return;
    const view = editor.view;
    const widget = view.dom.querySelector(".ai-diff");
    let bottom: number;
    if (widget) bottom = widget.getBoundingClientRect().bottom;
    else {
      try {
        bottom = view.coordsAtPos(target.to).bottom;
      } catch {
        bottom = view.dom.getBoundingClientRect().bottom;
      }
    }
    const box = view.dom.getBoundingClientRect();
    setPos({ top: bottom + window.scrollY + 10, left: box.left + window.scrollX, width: box.width });
  }, [editor, target]);

  useLayoutEffect(() => {
    if (!target) return;
    // Fires once right away, then whenever the content (and so the preview) changes size.
    const ro = new ResizeObserver(place);
    ro.observe(editor.view.dom);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [target, place, editor]);

  // Esc discards; a click outside discards only before anything was generated.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (phase === "idle" && barRef.current && !barRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [target, phase, close]);

  /** Starts a fresh request from the target. */
  function start(action: Action, text?: string) {
    if (!target) return;
    const doc = editor.state.doc;
    const kept: Protected = { nodes: [], labels: [] };
    const nextMode: Mode = action === "continue" ? "continue" : "replace";
    let passage: JSONContent;
    if (action === "continue") {
      passage = { type: "doc", content: (doc.slice(0, target.to).content.toJSON() as JSONContent[] | null) ?? [] };
      originalRef.current = "";
    } else if (target.empty) {
      passage = { type: "doc", content: [] };
      originalRef.current = "";
    } else {
      const content = (doc.slice(target.from, target.to).content.toJSON() as JSONContent[] | null) ?? [];
      const blocks = target.inline ? [{ type: "paragraph", content }] : protect(content, kept);
      passage = { type: "doc", content: blocks };
      originalRef.current = target.inline ? doc.textBetween(target.from, target.to, " ", " ") : plainOf(blocks, kept);
    }
    keptRef.current = kept;
    modeRef.current = nextMode;
    setMode(nextMode);
    void stream({ action, instruction: text, passage });
  }

  /** Asks for changes to the current suggestion; the diff stays against the original. */
  function refine() {
    const content = contentRef.current;
    if (!content || !refinement.trim()) return;
    void stream({ action: "custom", instruction: refinement.trim(), passage: content });
    setRefinement("");
  }

  async function stream(run: Run) {
    if (!target) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    lastRunRef.current = run;
    setPhase("streaming");
    setError(null);
    const previous = contentRef.current;
    contentRef.current = null;

    const continuing = modeRef.current === "continue";
    const continueAt = continuing ? afterBlock(editor.state.doc, target.to) : null;
    const base = { from: target.from, to: target.to, inline: !continuing && target.inline, mode: "preview" as const, continueAt };
    let text = "";
    let frame = 0;
    const draw = (streaming: boolean) => {
      const plain = withLabels(markdownToPlain(text), keptRef.current);
      preview({ ...base, streaming, segments: continuing ? (plain ? [{ type: "add", text: plain }] : []) : diffForPreview(originalRef.current, plain, streaming) });
      requestAnimationFrame(place);
    };
    draw(true);

    try {
      const res = await fetch("/api/admin/ai/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: run.action, instruction: run.instruction, title, passage: run.passage, document: editor.getJSON() }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { t: "d"; v: string } | { t: "done"; content: JSONContent } | { t: "error"; v: string };
          if (ev.t === "d") {
            text += ev.v;
            // Redraw at most once per frame.
            if (!frame) frame = requestAnimationFrame(() => ((frame = 0), draw(true)));
          } else if (ev.t === "done") contentRef.current = ev.content;
          else throw new Error(ev.v);
        }
      }
      cancelAnimationFrame(frame);
      if (!contentRef.current) throw new Error("The answer was cut off. Try again.");
      draw(false);
      setPhase("done");
    } catch (e) {
      cancelAnimationFrame(frame);
      if (ctrl.signal.aborted) return;
      setError((e as Error).message);
      // A failed refinement keeps the previous suggestion; a failed first run goes back to the start.
      if (previous) {
        contentRef.current = previous;
        text = "";
        setPhase("done");
      } else {
        setPhase("error");
        showTarget();
      }
    }
  }

  function stop() {
    abortRef.current?.abort();
    contentRef.current = null;
    setPhase("idle");
    showTarget();
  }

  function apply(how: "replace" | "below") {
    const content = contentRef.current;
    if (!target || !content) return;
    const blocks = restore(content.content ?? [], keptRef.current);
    // Restore the document first so the insert is one normal, undoable step.
    preview(null);
    editor.setEditable(true, false);
    const chain = editor.chain().focus();
    if (how === "below" || modeRef.current === "continue") {
      chain.insertContentAt(afterBlock(editor.state.doc, target.to), blocks).run();
    } else if (target.inline && blocks.length === 1 && blocks[0]!.type === "paragraph") {
      // Text inside one paragraph: replace just the text, not the paragraph.
      chain.insertContentAt({ from: target.from, to: target.to }, blocks[0]!.content ?? []).run();
    } else {
      chain.insertContentAt({ from: target.from, to: target.to }, blocks).run();
    }
    close();
  }

  // Keep the bar in view while the text grows.
  useEffect(() => {
    if (phase !== "streaming" && phase !== "done") return;
    const r = barRef.current?.getBoundingClientRect();
    if (r && r.bottom > window.innerHeight - 16) window.scrollBy({ top: r.bottom - window.innerHeight + 24 });
  }, [pos, phase]);

  if (!target || !pos) return null;
  const continuing = mode === "continue";
  const prompt = target.empty ? "Ask AI to write something…" : `Ask AI to edit ${target.scope}…`;

  return createPortal(
    <div
      ref={barRef}
      role="dialog"
      aria-label="AI assistant"
      className="floating absolute z-20 overflow-hidden text-fg"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {phase === "streaming" ? (
        <div className="flex min-h-12 items-center gap-2 px-3" role="status">
          <SparkleIcon width={17} height={17} className="ai-sparkle shrink-0" />
          <span className="flex-1 text-sm text-muted">{continuing || target.empty ? "Writing…" : "Editing…"}</span>
          <button type="button" className="btn-quiet" onClick={stop}>
            Stop
          </button>
        </div>
      ) : phase === "done" ? (
        <>
          <form
            className="flex items-center gap-2 px-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              refine();
            }}
          >
            <SparkleIcon width={17} height={17} className="ml-1 shrink-0 text-muted" />
            <label htmlFor="ai-refine" className="sr-only">
              Ask for changes
            </label>
            <input
              id="ai-refine"
              className="min-h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
              placeholder="Tell AI what to change, e.g. “more casual” or “drop the last sentence”…"
              value={refinement}
              maxLength={1000}
              onChange={(e) => setRefinement(e.target.value)}
            />
            <button type="submit" className="btn-quiet" disabled={!refinement.trim()} aria-label="Ask for changes">
              <ArrowRight width={16} height={16} />
            </button>
          </form>
          {error && (
            <p role="alert" className="px-4 pt-1 text-sm font-medium">
              {error}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line bg-surface/60 px-2 py-2">
            <button type="button" className="btn-quiet" onClick={close}>
              Discard
            </button>
            <button type="button" className="btn-quiet" onClick={() => lastRunRef.current && void stream(lastRunRef.current)}>
              Try again
            </button>
            <span className="flex-1" />
            {!continuing && !target.empty && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => apply("below")}>
                Insert below
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={() => apply("replace")}>
              {continuing || target.empty ? "Insert" : "Accept"}
            </button>
          </div>
        </>
      ) : (
        <>
          <form
            className="flex items-center gap-2 px-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (instruction.trim()) start(target.empty ? "write" : "custom", instruction.trim());
            }}
          >
            <SparkleIcon width={17} height={17} className="ml-1 shrink-0 text-muted" />
            <label htmlFor="ai-instruction" className="sr-only">
              Instruction for the AI
            </label>
            <input
              id="ai-instruction"
              autoFocus
              className="min-h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
              placeholder={prompt}
              value={instruction}
              maxLength={1000}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <button type="submit" className="btn-quiet" disabled={!instruction.trim()} aria-label="Run">
              <ArrowRight width={16} height={16} />
            </button>
          </form>
          {phase === "error" && error && (
            <p role="alert" className="px-4 pt-1 text-sm font-medium">
              {error}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1 border-t border-line px-2 py-2">
            {QUICK_ACTIONS.filter((q) => !target.empty || q.action === "continue").map((q) => (
              <button key={q.action} type="button" className="chip min-h-8 px-3 text-[0.8125rem]" onClick={() => start(q.action)}>
                {q.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
