"use client";

import { useState } from "react";
import type { CaptchaProps } from "./captcha";
import { CommentForm } from "./comment-form";

export function ReplyButton({ articleId, parentId, captcha }: { articleId: string; parentId: string; captcha: CaptchaProps }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="tap -ml-1 px-1 text-sm text-muted hover:text-fg hover:underline" onClick={() => setOpen(true)}>
        Reply
      </button>
    );
  }
  return (
    <div className="mt-3 animate-menu-in border-l border-line pl-4">
      <CommentForm articleId={articleId} parentId={parentId} captcha={captcha} onDone={() => setOpen(false)} autoFocus />
    </div>
  );
}
