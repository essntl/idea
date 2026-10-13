import { describe, it, expect, vi, beforeEach } from "vitest";
import { createComment, type CommentDeps } from "@/lib/comments";

/** Captcha verification is mocked: only "valid-token" passes. */
function setup(overrides: Partial<CommentDeps["settings"]> = {}) {
  const create = vi.fn(async () => ({ id: "c-new" }));
  const deps: CommentDeps = {
    db: {
      article: { findFirst: vi.fn(async () => ({ id: "art1" })) },
      comment: {
        create,
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === "pending" ? { id: "pending", status: "pending" } : { id: where.id, status: "visible" },
        ),
      },
    } as unknown as CommentDeps["db"],
    verifyCaptcha: vi.fn(async (_p, token: string) => token === "valid-token"),
    rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
    settings: { captchaProvider: "turnstile", requireApproval: false, enabled: true, ...overrides },
  };
  return { deps, create };
}

const ctx = { ip: "1.2.3.4", ipHash: "hash" };
const valid = { articleId: "art1", authorName: "Ann", authorEmail: "ann@example.com", body: "Nice post!", captchaToken: "valid-token" };
const createdData = (create: ReturnType<typeof vi.fn>, i = 0) => (create.mock.calls[i] as unknown as [{ data: Record<string, unknown> }])[0].data;

describe("createComment", () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it("stores a comment when the captcha passes", async () => {
    const r = await createComment(valid, ctx, s.deps);
    expect(r).toEqual({ ok: true, status: "visible", id: "c-new" });
    expect(s.deps.verifyCaptcha).toHaveBeenCalledWith("turnstile", "valid-token", "1.2.3.4");
    expect(s.create).toHaveBeenCalledOnce();
    expect(createdData(s.create)).toMatchObject({
      articleId: "art1", authorName: "Ann", body: "Nice post!", status: "visible", ipHash: "hash", parentId: null,
    });
  });

  it("rejects when the captcha fails and stores nothing", async () => {
    const r = await createComment({ ...valid, captchaToken: "forged" }, ctx, s.deps);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(s.create).not.toHaveBeenCalled();
  });

  it("rejects a missing captcha token", async () => {
    const r = await createComment({ ...valid, captchaToken: "" }, ctx, s.deps);
    expect(r.ok).toBe(false);
    expect(s.create).not.toHaveBeenCalled();
  });

  it("requires the captcha for replies too", async () => {
    expect((await createComment({ ...valid, parentId: "parent1", captchaToken: "nope" }, ctx, s.deps)).ok).toBe(false);
    const ok = await createComment({ ...valid, parentId: "parent1" }, ctx, s.deps);
    expect(ok.ok).toBe(true);
    expect(createdData(s.create).parentId).toBe("parent1");
  });

  it("silently drops honeypot submissions", async () => {
    const r = await createComment({ ...valid, website: "http://spam.example" }, ctx, s.deps);
    expect(r.ok).toBe(true);
    expect(s.create).not.toHaveBeenCalled();
    expect(s.deps.verifyCaptcha).not.toHaveBeenCalled();
  });

  it("enforces the rate limit before calling the captcha API", async () => {
    s.deps.rateLimit = vi.fn(async () => ({ ok: false, retryAfterSec: 300 }));
    const r = await createComment(valid, ctx, s.deps);
    expect(r).toMatchObject({ ok: false, status: 429 });
    expect(s.deps.verifyCaptcha).not.toHaveBeenCalled();
  });

  it("limits links, length and requires a name", async () => {
    expect((await createComment({ ...valid, body: "http://a.com https://b.com www.c.com" }, ctx, s.deps)).ok).toBe(false);
    expect((await createComment({ ...valid, body: "x".repeat(5001) }, ctx, s.deps)).ok).toBe(false);
    expect((await createComment({ ...valid, authorName: "" }, ctx, s.deps)).ok).toBe(false);
  });

  it("holds comments for approval when the setting is on", async () => {
    const t = setup({ requireApproval: true });
    expect(await createComment(valid, ctx, t.deps)).toMatchObject({ ok: true, status: "pending" });
  });

  it("does not allow replies to pending comments", async () => {
    expect((await createComment({ ...valid, parentId: "pending" }, ctx, s.deps)).ok).toBe(false);
  });

  it("stores text as plain text (HTML is never interpreted)", async () => {
    await createComment({ ...valid, body: "<script>alert(1)</script>\u0000hi" }, ctx, s.deps);
    expect(createdData(s.create).body).toBe("<script>alert(1)</script>hi");
  });

  it("refuses when comments are disabled", async () => {
    expect((await createComment(valid, ctx, setup({ enabled: false }).deps)).ok).toBe(false);
  });
});
