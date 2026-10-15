"use client";

import { useState } from "react";
import type { CaptchaProps } from "./captcha";
import { CommentForm } from "./comment-form";
import { ReplyIcon } from "@/components/ui/icons";

type Props = { targetType: "article" | "blog"; targetId: string; parentId: string; captcha: CaptchaProps };

export function ReplyButton({ targetType, targetId, parentId, captcha }: Props) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="-ml-2 mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-sm text-muted hover:bg-surface hover:text-fg" onClick={() => setOpen(true)}>
        <ReplyIcon width={15} height={15} /> Reply
      </button>
    );
  }
  return (
    <div className="mt-3">
      <CommentForm targetType={targetType} targetId={targetId} parentId={parentId} captcha={captcha} onDone={() => setOpen(false)} autoFocus />
    </div>
  );
}
