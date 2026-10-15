"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { isDarkTheme } from "@/components/site/theme-toggle";

export type CaptchaProps = { provider: "turnstile" | "recaptcha"; siteKey: string };
export type CaptchaHandle = { getToken: () => Promise<string>; reset: () => void };

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
type Grecaptcha = { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> };
declare global {
  interface Window {
    turnstile?: Turnstile;
    grecaptcha?: Grecaptcha;
  }
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  let p = scripts.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scripts.delete(src);
        reject(new Error("Failed to load captcha"));
      };
      document.head.appendChild(s);
    });
    scripts.set(src, p);
  }
  return p;
}

/** Turnstile (visible, compact on narrow screens) or reCAPTCHA v3 (invisible). Loads its script on mount only. */
export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha({ provider, siteKey }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    const fail = () => setError("Captcha failed to load. Please check your connection and refresh.");
    if (provider === "turnstile") {
      loadScript("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit")
        .then(() => {
          if (cancelled || !box.current || !window.turnstile) return;
          const narrow = box.current.clientWidth < 300;
          widgetId.current = window.turnstile.render(box.current, {
            sitekey: siteKey,
            theme: isDarkTheme() ? "dark" : "light",
            size: narrow ? "compact" : "normal",
            "refresh-expired": "auto",
            callback: (t: string) => (token.current = t),
            "expired-callback": () => (token.current = ""),
            "error-callback": fail,
          });
        })
        .catch(fail);
    } else {
      loadScript(`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`).catch(fail);
    }
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [provider, siteKey]);

  useImperativeHandle(ref, () => ({
    async getToken() {
      if (provider === "turnstile") return token.current;
      const g = window.grecaptcha;
      if (!g) return "";
      await new Promise<void>((r) => g.ready(r));
      return g.execute(siteKey, { action: "comment" });
    },
    reset() {
      token.current = "";
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  if (!siteKey) return <p className="text-sm text-muted">Comments are unavailable: captcha is not configured.</p>;
  return (
    <div>
      {provider === "turnstile" ? (
        <div ref={box} className="min-h-[65px] max-w-full overflow-hidden" />
      ) : (
        <p className="text-xs text-subtle">
          Protected by reCAPTCHA. Google{" "}
          <a href="https://policies.google.com/privacy" className="underline">
            Privacy
          </a>{" "}
          and{" "}
          <a href="https://policies.google.com/terms" className="underline">
            Terms
          </a>{" "}
          apply.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm">
          {error}
        </p>
      )}
    </div>
  );
});
