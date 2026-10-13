import { env } from "./env";
import type { Settings } from "./settings";

export type CaptchaProvider = "turnstile" | "recaptcha";
export type CaptchaConfig = { provider: CaptchaProvider; siteKey: string };

export function captchaConfig(settings: Pick<Settings, "captchaProvider">): CaptchaConfig {
  const e = env();
  const provider = settings.captchaProvider ?? e.CAPTCHA_PROVIDER;
  return { provider, siteKey: provider === "turnstile" ? e.TURNSTILE_SITE_KEY : e.RECAPTCHA_SITE_KEY };
}

export const RECAPTCHA_ACTION = "comment";
export const RECAPTCHA_MIN_SCORE = 0.5;

/** Server-side verification. Returns false on any failure (including network errors). */
export async function verifyCaptcha(provider: CaptchaProvider, token: string, ip?: string): Promise<boolean> {
  if (!token || token.length > 4096) return false;
  const e = env();
  const secret = provider === "turnstile" ? e.TURNSTILE_SECRET_KEY : e.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.error(`[captcha] ${provider} secret key is not configured`);
    return false;
  }
  const url =
    provider === "turnstile"
      ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
      : "https://www.google.com/recaptcha/api/siteverify";
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean; score?: number; action?: string };
    if (!data.success) return false;
    if (provider === "recaptcha") {
      return (data.score ?? 0) >= RECAPTCHA_MIN_SCORE && data.action === RECAPTCHA_ACTION;
    }
    return true;
  } catch (err) {
    console.error("[captcha] verification request failed", err);
    return false;
  }
}
