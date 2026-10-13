import { z } from "zod";
import type { Db } from "./db";
import type { CaptchaProvider } from "./captcha";

export const COMMENT_LIMITS = {
  nameMax: 60,
  bodyMax: 5000,
  maxLinks: 2,
  /** Per IP hash. */
  perWindow: 5,
  windowSec: 10 * 60,
  maxDepth: 3,
};

export const commentInputSchema = z.object({
  articleId: z.string().min(1).max(40),
  parentId: z.string().min(1).max(40).nullable().optional(),
  authorName: z.string().trim().min(1, "Name is required").max(COMMENT_LIMITS.nameMax),
  authorEmail: z.string().trim().toLowerCase().max(200).email("Invalid email").or(z.literal("")).optional(),
  body: z.string().trim().min(2, "Comment is too short").max(COMMENT_LIMITS.bodyMax, "Comment is too long"),
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
  db: Pick<Db, "comment" | "article">;
  verifyCaptcha: (provider: CaptchaProvider, token: string, ip?: string) => Promise<boolean>;
  rateLimit: (key: string, limit: number, windowSec: number) => Promise<{ ok: boolean; retryAfterSec: number }>;
  settings: { captchaProvider: CaptchaProvider; requireApproval: boolean; enabled: boolean };
};

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
  const body = cleanText(data.body);
  if (countLinks(body) > COMMENT_LIMITS.maxLinks) {
    return { ok: false, status: 400, error: `Please include at most ${COMMENT_LIMITS.maxLinks} links`, fieldErrors: { body: "Too many links" } };
  }

  const limit = await deps.rateLimit(`comment:${ctx.ipHash}`, COMMENT_LIMITS.perWindow, COMMENT_LIMITS.windowSec);
  if (!limit.ok) return { ok: false, status: 429, error: `Too many comments. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.` };

  const human = await deps.verifyCaptcha(deps.settings.captchaProvider, data.captchaToken, ctx.ip);
  if (!human) return { ok: false, status: 400, error: "Captcha verification failed. Please try again." };

  const article = await deps.db.article.findFirst({
    where: { id: data.articleId, status: { in: ["published", "scheduled"] }, publishedAt: { lte: new Date() } },
    select: { id: true },
  });
  if (!article) return { ok: false, status: 404, error: "Article not found" };

  if (data.parentId) {
    const parent = await deps.db.comment.findFirst({ where: { id: data.parentId, articleId: article.id }, select: { id: true, status: true } });
    if (!parent || parent.status === "pending") return { ok: false, status: 400, error: "You can't reply to this comment" };
  }

  const status = deps.settings.requireApproval ? "pending" : "visible";
  const created = await deps.db.comment.create({
    data: {
      articleId: article.id,
      parentId: data.parentId ?? null,
      authorName: cleanText(data.authorName).replace(/\n/g, " "),
      authorEmail: data.authorEmail || null,
      body,
      status,
      ipHash: ctx.ipHash,
    },
    select: { id: true },
  });
  return { ok: true, status, id: created.id };
}
