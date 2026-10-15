import { ReadMore } from "@/components/ui/read-more";

/** Comment text: sanitized rich HTML (rendered server-side on submit) or plain text for older comments. */
export function CommentBody({ html, text, maxHeight = 300 }: { html: string | null; text: string; maxHeight?: number }) {
  return (
    <ReadMore maxHeight={maxHeight}>
      {html ? (
        // Sanitized by lib/content/comment-render.ts when the comment was saved.
        <div className="prose-comment" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="prose-comment whitespace-pre-line">{text}</p>
      )}
    </ReadMore>
  );
}

/** Initial-letter avatar (no external images, no tracking). */
export function Avatar({ name, author = false, size = 32 }: { name: string; author?: boolean; size?: number }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${author ? "bg-fg text-bg" : "bg-surface-2 text-muted"}`}
    >
      {initial}
    </span>
  );
}
