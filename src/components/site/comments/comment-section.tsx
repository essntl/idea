import { getComments, type CommentNode } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { captchaConfig } from "@/lib/captcha";
import { COMMENT_LIMITS } from "@/lib/comments";
import { DateText } from "../date-text";
import type { CaptchaProps } from "./captcha";
import { CommentForm } from "./comment-form";
import { ReplyButton } from "./reply-button";
import { Avatar, CommentBody } from "./comment-body";

export type CommentTargetProps = { targetType: "article" | "blog"; targetId: string };

export async function CommentSection({ targetType, targetId }: CommentTargetProps) {
  const [{ tree, count }, settings] = await Promise.all([getComments(targetType, targetId), getSettings()]);
  const target = { targetType, targetId };
  const captcha = captchaConfig(settings);
  return (
    <section id="comments" aria-labelledby="comments-title" className="mt-16 border-t border-line pt-10">
      <h2 id="comments-title" className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
        Comments
        {count > 0 && <span className="rounded-full bg-surface-2 px-2 py-px text-sm font-medium text-muted">{count}</span>}
      </h2>

      <div className="mt-6">
        {settings.commentsEnabled ? <CommentForm {...target} captcha={captcha} /> : <p className="text-sm text-muted">Comments are closed.</p>}
      </div>

      {tree.length > 0 ? (
        <ol className="mt-10 space-y-8">
          {tree.map((c) => (
            <li key={c.id}>
              <Comment node={c} depth={1} target={target} captcha={captcha} enabled={settings.commentsEnabled} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-8 text-center text-sm text-muted">No comments yet. Be the first.</p>
      )}
    </section>
  );
}

type CommentProps = { node: CommentNode; depth: number; target: CommentTargetProps; captcha: CaptchaProps; enabled: boolean };

function Comment({ node, depth, target, captcha, enabled }: CommentProps) {
  // Deeper replies stay at the maximum indentation level.
  const childDepth = Math.min(depth + 1, COMMENT_LIMITS.maxDepth);
  const indent = depth < COMMENT_LIMITS.maxDepth;
  return (
    <article id={`comment-${node.id}`} className="scroll-mt-20">
      {node.removed ? (
        <p className="flex items-center gap-3 text-sm text-subtle italic">
          <span className="size-8 shrink-0 rounded-full border border-dashed border-line-strong" aria-hidden="true" />
          Comment removed
        </p>
      ) : (
        <div className="flex gap-3">
          <Avatar name={node.authorName} author={node.isAdminReply} />
          <div className="min-w-0 flex-1">
            <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span className="font-semibold">{node.authorName}</span>
              {node.isAdminReply && <span className="rounded-full bg-fg px-2 py-px text-[0.7rem] font-semibold text-bg">Author</span>}
              <a href={`#comment-${node.id}`} className="text-subtle hover:text-muted hover:underline">
                <DateText iso={node.createdAt} style="short" />
              </a>
            </header>
            <div className="mt-1.5">
              <CommentBody html={node.bodyHtml} text={node.body} />
            </div>
            {enabled && <ReplyButton {...target} parentId={node.id} captcha={captcha} />}
          </div>
        </div>
      )}
      {node.children.length > 0 && (
        <ol className={`mt-5 space-y-5 ${indent ? "ml-4 border-l-2 border-line pl-4 sm:pl-5" : ""}`}>
          {node.children.map((c) => (
            <li key={c.id}>
              <Comment node={c} depth={childDepth} target={target} captcha={captcha} enabled={enabled} />
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
