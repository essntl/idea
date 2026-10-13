import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authOptions } from "./auth";
import { prisma } from "./db";
import { isSameOrigin } from "./request";
import { HttpError } from "./errors";

export type AdminUser = { id: string; email: string; name: string };

/** Current admin, verified against the database (a password change invalidates older sessions). */
export async function getAdmin(): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, sessionVersion: true } });
  if (!user || user.sessionVersion !== (session.user?.sv ?? 0)) return null;
  return { id: user.id, email: user.email, name: user.name };
}

/** For admin pages (server components). */
export async function requireAdminPage(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export { HttpError };

type Handler<C> = (req: Request, ctx: C & { admin: AdminUser }) => Promise<Response>;

/**
 * Wraps an admin API route: session check, same-origin check for writes, Zod/HTTP error mapping.
 */
export function adminRoute<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    if (req.method !== "GET" && req.method !== "HEAD" && !isSameOrigin(req)) {
      return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    }
    const admin = await getAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      return await handler(req, { ...(ctx as C), admin });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}
