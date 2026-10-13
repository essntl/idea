import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";

/** Routes that exist at the root; anything else with a single segment may be a legacy Ghost URL. */
const APP_PREFIXES = ["/admin", "/api", "/blog", "/articles", "/about", "/search", "/media", "/_next"];

let redirectCache: { at: number; map: Map<string, { to: string; status: number }> } | null = null;
const REDIRECT_TTL_MS = 60_000;

async function redirectMap() {
  if (redirectCache && Date.now() - redirectCache.at < REDIRECT_TTL_MS) return redirectCache.map;
  try {
    const rows = await prisma.redirect.findMany({ select: { fromPath: true, toPath: true, statusCode: true } });
    redirectCache = { at: Date.now(), map: new Map(rows.map((r) => [r.fromPath, { to: r.toPath, status: r.statusCode }])) };
  } catch (err) {
    console.error("[proxy] failed to load redirects", err);
    redirectCache = { at: Date.now() - REDIRECT_TTL_MS + 5_000, map: redirectCache?.map ?? new Map() };
  }
  return redirectCache.map;
}

function csp(nonce: string, isDev: boolean, https: boolean) {
  const captcha = "https://challenges.cloudflare.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${captcha}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `frame-src ${captcha} https://www.youtube-nocookie.com`,
    `connect-src 'self' ${captcha}${isDev ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Legacy URLs (e.g. /how-does-a-pc-work/) and stored redirects → one permanent hop.
  if (!APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && pathname !== "/") {
    const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const map = await redirectMap();
    const hit = map.get(normalized) ?? map.get(`${normalized}/`);
    if (hit) return NextResponse.redirect(new URL(hit.to, req.url), hit.status);
  }
  if (pathname.length > 1 && pathname.endsWith("/") && !pathname.startsWith("/api/")) {
    // A plain URL: NextURL would re-append the trailing slash.
    return NextResponse.redirect(new URL(pathname.replace(/\/+$/, "") + req.nextUrl.search, req.url), 301);
  }

  // Admin gate (every route/handler still verifies the session server-side).
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin");
  if (isAdminPage || isAdminApi) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      if (isAdminApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = pathname === "/admin" ? "" : `?callbackUrl=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const https = (process.env.SITE_URL ?? process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const policy = csp(nonce, isDev, https);

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  headers.set("x-pathname", pathname);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", policy);
  if (isAdminPage || isAdminApi || pathname === "/admin/login") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media/|favicon.ico|icon.svg|apple-icon.png|fonts/).*)"],
};
