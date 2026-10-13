import { getComments, type CommentNode } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { captchaConfig } from "@/lib/captcha";
import { COMMENT_LIMITS } from "@/lib/comments";
import { DateText } from "../date-text";
import type { CaptchaProps } from "./captcha";
import { CommentForm } from "./comment-form";
import { ReplyButton } from "./reply-button";

export async function CommentSection({ articleId }: { articleId: string }) {
  const [{ tree, count }, settings] = await Promise.all([getComments(articleId), getSettings()]);
  const captcha = captchaConfig(settings);
  return (
    <section id="comments" aria-labelledby="comments-title" className="mt-16 border-t border-line pt-10">
      <h2 id="comments-title" className="text-xl font-semibold tracking-tight">
        Comments{count > 0 && <span className="font-normal text-muted"> ({count})</span>}
      </h2>
      {tree.length > 0 ? (
        <ol className="mt-6 divide-y divide-line">
          {tree.map((c) => (
            <li key={c.id} className="py-6">
              <Comment node={c} depth={1} articleId={articleId} captcha={captcha} enabled={settings.commentsEnabled} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-muted">No comments yet.</p>
      )}
      {settings.commentsEnabled ? (
        <div className="mt-10">
          <h3 className="mb-4 font-medium">Leave a comment</h3>
          <CommentForm articleId={articleId} captcha={captcha} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">Comments are closed.</p>
      )}
    </section>
  );
}

type CommentProps = { node: CommentNode; depth: number; articleId: string; captcha: CaptchaProps; enabled: boolean };

function Comment({ node, depth, articleId, captcha, enabled }: CommentProps) {
  // Deeper replies stay at the maximum indentation level.
  const childDepth = Math.min(depth + 1, COMMENT_LIMITS.maxDepth);
  const indent = depth < COMMENT_LIMITS.maxDepth;
  return (
    <article id={`comment-${node.id}`} className="scroll-mt-20">
      {node.removed ? (
        <p className="text-sm italic text-subtle">Comment removed</p>
      ) : (
        <>
          <header className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-medium">{node.authorName}</span>
            {node.isAdminReply && (
              <span className="rounded-sm border border-fg px-1.5 text-[0.7rem] font-semibold uppercase tracking-wider">Author</span>
            )}
            <span className="text-muted" aria-hidden="true">
              ·
            </span>
            <a href={`#comment-${node.id}`} className="text-muted hover:underline">
              <DateText iso={node.createdAt} style="short" />
            </a>
          </header>
          <p className="mt-2 whitespace-pre-line break-words">{node.body}</p>
          {enabled && <ReplyButton articleId={articleId} parentId={node.id} captcha={captcha} />}
        </>
      )}
      {node.children.length > 0 && (
        <ol className={`mt-4 space-y-6 ${indent ? "border-l border-line pl-4 sm:pl-6" : ""}`}>
          {node.children.map((c) => (
            <li key={c.id}>
              <Comment node={c} depth={childDepth} articleId={articleId} captcha={captcha} enabled={enabled} />
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
