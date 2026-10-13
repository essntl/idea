import { createHash } from "node:crypto";

type HeaderSource = Headers | Record<string, string | string[] | undefined>;

function get(h: HeaderSource, name: string): string | undefined {
  if (h instanceof Headers) return h.get(name) ?? undefined;
  const v = h[name] ?? h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

/** Best-effort client IP behind Cloudflare / reverse proxies. */
export function clientIp(h: HeaderSource): string {
  return (
    get(h, "cf-connecting-ip") ||
    get(h, "x-forwarded-for")?.split(",")[0]?.trim() ||
    get(h, "x-real-ip") ||
    "unknown"
  );
}

/** Salted hash so raw IPs are never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.NEXTAUTH_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * CSRF defence for state-changing requests: the Origin (or Referer) must match the host the request was sent to.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
