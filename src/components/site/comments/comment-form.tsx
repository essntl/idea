"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Captcha, type CaptchaHandle, type CaptchaProps } from "./captcha";
import type { CommentEditorHandle } from "./comment-editor";

// The editor (TipTap) and captcha load only once someone starts writing.
const CommentEditor = dynamic(() => import("./comment-editor"), {
  ssr: false,
  loading: () => <div className="h-[132px] rounded-[var(--radius-md)] border border-line-strong" aria-hidden="true" />,
});

type Props = {
  targetType: "article" | "blog";
  targetId: string;
  parentId?: string;
  captcha: CaptchaProps;
  onDone?: () => void;
  autoFocus?: boolean;
};

const STORE_KEY = "comment-author";

export function CommentForm({ targetType, targetId, parentId, captcha, onDone, autoFocus }: Props) {
  const router = useRouter();
  const id = useId();
  const captchaRef = useRef<CaptchaHandle>(null);
  const editorRef = useRef<CommentEditorHandle>(null);
  const [expanded, setExpanded] = useState(!!parentId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hasText, setHasText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Restore the visitor's name/email from a previous comment (browser-only, after hydration).
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as { name?: string; email?: string } | null;
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setName(saved.name ?? "");
        setEmail(saved.email ?? "");
      }
    } catch {}
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const captchaToken = (await captchaRef.current?.getToken()) ?? "";
      if (!captchaToken) {
        setMessage({ kind: "error", text: "Please complete the captcha." });
        return;
      }
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          parentId: parentId ?? null,
          authorName: name,
          authorEmail: email,
          bodyJson: editorRef.current?.getJSON(),
          captchaToken,
          website: form.get("website") ?? "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok) {
        setMessage({ kind: "error", text: data.error ?? "Something went wrong." });
        setFieldErrors(data.fieldErrors ?? {});
        captchaRef.current?.reset();
        return;
      }
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ name, email }));
      } catch {}
      editorRef.current?.clear();
      setHasText(false);
      captchaRef.current?.reset();
      if (data.status === "pending") {
        setMessage({ kind: "ok", text: "Thanks! Your comment will appear after moderation." });
      } else {
        setMessage({ kind: "ok", text: "Comment posted." });
        router.refresh();
        onDone?.();
      }
    } catch {
      setMessage({ kind: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex min-h-14 w-full items-center rounded-[var(--radius-lg)] border border-line-strong px-4 text-left text-subtle transition-colors hover:border-fg hover:text-muted"
      >
        Write a comment…
      </button>
    );
  }

  const fieldError = (k: string) =>
    fieldErrors[k] ? (
      <p id={`${id}-${k}-err`} className="mt-1 text-sm font-medium">
        {fieldErrors[k]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} className="space-y-4 animate-menu-in" noValidate>
      <div>
        <span id={`${id}-body-label`} className="sr-only">
          {parentId ? "Reply" : "Comment"}
        </span>
        <CommentEditor
          handleRef={editorRef}
          aria-labelledby={`${id}-body-label`}
          placeholder={parentId ? "Write a reply…" : "Write a comment…"}
          autoFocus={autoFocus ?? true}
          onChange={(t) => setHasText(t.trim().length >= 2)}
          invalid={!!fieldErrors.body}
        />
        {fieldError("body")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id={`${id}-name`}
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
            autoComplete="name"
            aria-invalid={!!fieldErrors.authorName}
            aria-describedby={fieldErrors.authorName ? `${id}-authorName-err` : undefined}
          />
          {fieldError("authorName")}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="mb-1 block text-sm font-medium">
            Email <span className="font-normal text-subtle">· optional, never shown</span>
          </label>
          <input
            id={`${id}-email`}
            type="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            autoComplete="email"
            aria-invalid={!!fieldErrors.authorEmail}
            aria-describedby={fieldErrors.authorEmail ? `${id}-authorEmail-err` : undefined}
          />
          {fieldError("authorEmail")}
        </div>
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Captcha ref={captchaRef} {...captcha} />
        <div className="flex gap-2 sm:shrink-0">
          {onDone && (
            <button type="button" className="btn btn-ghost flex-1 sm:flex-none" onClick={onDone}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn flex-1 sm:flex-none" disabled={busy || !name.trim() || !hasText}>
            {busy ? "Sending…" : parentId ? "Post reply" : "Post comment"}
          </button>
        </div>
      </div>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm font-medium" : "text-sm text-muted"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
