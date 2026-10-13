import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }));

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

const { adminRoute, getAdmin } = await import("@/lib/guard");

const USER = { id: "u1", email: "a@b.c", name: "A", sessionVersion: 0 };

function req(method: string, origin?: string) {
  const headers = new Headers({ host: "example.com" });
  if (origin) headers.set("origin", origin);
  return new Request("http://example.com/api/admin/x", { method, headers });
}

describe("admin auth guard", () => {
  const handler = adminRoute(async (_req, { admin }) => Response.json({ ok: true, admin: admin.id }));

  beforeEach(() => {
    getServerSession.mockReset();
    findUnique.mockReset();
  });

  it("rejects requests without a session (401)", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await handler(req("GET"), {});
    expect(res.status).toBe(401);
  });

  it("rejects cross-origin writes before touching the session (403)", async () => {
    const res = await handler(req("POST", "https://evil.example"), {});
    expect(res.status).toBe(403);
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it("rejects writes with no Origin/Referer header", async () => {
    const res = await handler(req("DELETE"), {});
    expect(res.status).toBe(403);
  });

  it("allows same-origin requests with a valid session", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", sv: 0 } });
    findUnique.mockResolvedValue(USER);
    const res = await handler(req("POST", "http://example.com"), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, admin: "u1" });
  });

  it("invalidates sessions issued before a password change", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", sv: 0 } });
    findUnique.mockResolvedValue({ ...USER, sessionVersion: 1 });
    expect(await getAdmin()).toBeNull();
    const res = await handler(req("GET"), {});
    expect(res.status).toBe(401);
  });

  it("rejects sessions for deleted users", async () => {
    getServerSession.mockResolvedValue({ user: { id: "gone", sv: 0 } });
    findUnique.mockResolvedValue(null);
    expect(await getAdmin()).toBeNull();
  });

  it("maps validation errors to 400", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", sv: 0 } });
    findUnique.mockResolvedValue(USER);
    const { z } = await import("zod");
    const failing = adminRoute(async () => {
      z.object({ a: z.string() }).parse({});
      return new Response("unreachable");
    });
    const res = await failing(req("GET"), {});
    expect(res.status).toBe(400);
  });
});
