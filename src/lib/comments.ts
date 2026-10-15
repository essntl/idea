import { z } from "zod";
import type { Db } from "./db";
import type { CaptchaProvider } from "./captcha";
import type { JSONContent } from "@tiptap/core";
import { renderComment } from "./content/comment-render";
import { COMMENT_DOC_MAX_BYTES } from "./content/comment-schema";

export const COMMENT_LIMITS = {
  nameMax: 60,
  bodyMax: 5000,
  maxLinks: 2,
  /** Per IP hash. */
  perWindow: 5,
  windowSec: 10 * 60,
  maxDepth: 3,
};

export const COMMENT_TARGETS = ["article", "blog"] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

export const commentDocSchema = z
  .custom<JSONContent>((v) => typeof v === "object" && v !== null && (v as JSONContent).type === "doc", "Invalid comment")
  .refine((v) => JSON.stringify(v).length <= COMMENT_DOC_MAX_BYTES, "Comment is too long");

export const commentInputSchema = z.object({
  /** What is being commented on: an article or a blog post. */
  targetType: z.enum(COMMENT_TARGETS),
  targetId: z.string().min(1).max(40),
  parentId: z.string().min(1).max(40).nullable().optional(),
  authorName: z.string().trim().min(1, "Name is required").max(COMMENT_LIMITS.nameMax),
  authorEmail: z.string().trim().toLowerCase().max(200).email("Invalid email").or(z.literal("")).optional(),
  /** Plain text (older clients, tests). Ignored when `bodyJson` is present. */
  body: z.string().max(COMMENT_LIMITS.bodyMax * 2).optional(),
  /** Rich text from the comment editor. */
  bodyJson: commentDocSchema.optional(),
  captchaToken: z.string().max(4096).default(""),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(500).optional(),
});

export type CommentInput = z.input<typeof commentInputSchema>;

export function countLinks(text: string): number {
  return (text.match(/(https?:\/\/|www\.)\S+/gi) ?? []).length;
}

/** Normalises user text: strips control characters (no HTML is ever rendered from comments; React escapes output). */
export function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export type CommentDeps = {
  db: Pick<Db, "comment" | "article" | "blogPost">;
  verifyCaptcha: (provider: CaptchaProvider, token: string, ip?: string) => Promise<boolean>;
  rateLimit: (key: string, limit: number, windowSec: number) => Promise<{ ok: boolean; retryAfterSec: number }>;
  settings: { captchaProvider: CaptchaProvider; requireApproval: boolean; enabled: boolean };
};

export type CommentBody = { body: string; bodyHtml: string | null; links: number };

/**
 * Turns submitted content into what is stored: rich text is rendered + sanitized (`bodyHtml`) and
 * `body` becomes its plain text. Length and link limits are checked by the caller on these values.
 */
export async function prepareCommentBody(input: { body?: string; bodyJson?: JSONContent }): Promise<CommentBody> {
  if (input.bodyJson) {
    const r = await renderComment(input.bodyJson);
    return { body: cleanText(r.text).trim(), bodyHtml: r.html, links: r.links };
  }
  const body = cleanText(input.body ?? "").trim();
  return { body, bodyHtml: null, links: countLinks(body) };
}

export function checkCommentBody(b: CommentBody): string | null {
  if (b.body.length < 2) return "Comment is too short";
  if (b.body.length > COMMENT_LIMITS.bodyMax) return "Comment is too long";
  if (b.links > COMMENT_LIMITS.maxLinks) return `Please include at most ${COMMENT_LIMITS.maxLinks} links`;
  return null;
}

export type CommentResult =
  | { ok: true; status: "visible" | "pending"; id: string }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

/**
 * Validates and stores a visitor comment. Order: schema → honeypot → content rules → rate limit → captcha → DB.
 */
export async function createComment(input: unknown, ctx: { ip: string; ipHash: string }, deps: CommentDeps): Promise<CommentResult> {
  if (!deps.settings.enabled) return { ok: false, status: 403, error: "Comments are disabled" };
  const parsed = commentInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, status: 400, error: "Please check the form", fieldErrors };
  }
  const data = parsed.data;
  if (data.website) {
    // Pretend success to bots without storing anything.
    return { ok: true, status: "pending", id: "discarded" };
  }
  const content = await prepareCommentBody(data);
  const bodyError = checkCommentBody(content);
  if (bodyError) return { ok: false, status: 400, error: bodyError, fieldErrors: { body: bodyError } };

  const limit = await deps.rateLimit(`comment:${ctx.ipHash}`, COMMENT_LIMITS.perWindow, COMMENT_LIMITS.windowSec);
  if (!limit.ok) return { ok: false, status: 429, error: `Too many comments. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.` };

  const human = await deps.verifyCaptcha(deps.settings.captchaProvider, data.captchaToken, ctx.ip);
  if (!human) return { ok: false, status: 400, error: "Captcha verification failed. Please try again." };

  const visible = { id: data.targetId, status: { in: ["published" as const, "scheduled" as const] }, publishedAt: { lte: new Date() } };
  const target =
    data.targetType === "article"
      ? await deps.db.article.findFirst({ where: visible, select: { id: true } })
      : await deps.db.blogPost.findFirst({ where: visible, select: { id: true } });
  if (!target) return { ok: false, status: 404, error: "Post not found" };
  const targetWhere = data.targetType === "article" ? { articleId: target.id } : { blogPostId: target.id };

  if (data.parentId) {
    const parent = await deps.db.comment.findFirst({ where: { id: data.parentId, ...targetWhere }, select: { id: true, status: true } });
    if (!parent || parent.status === "pending") return { ok: false, status: 400, error: "You can't reply to this comment" };
  }

  const status = deps.settings.requireApproval ? "pending" : "visible";
  const created = await deps.db.comment.create({
    data: {
      ...targetWhere,
      parentId: data.parentId ?? null,
      authorName: cleanText(data.authorName).replace(/\n/g, " "),
      authorEmail: data.authorEmail || null,
      body: content.body,
      bodyHtml: content.bodyHtml,
      status,
      ipHash: ctx.ipHash,
    },
    select: { id: true },
  });
  return { ok: true, status, id: created.id };
}
