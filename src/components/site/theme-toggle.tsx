"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

/**
 * The explicit choice lives in a cookie so the server renders `html.dark` / `html.light` itself (see app/layout.tsx):
 * React then owns the class and no re-render can drop it. Without a choice, CSS follows the system setting.
 */
const COOKIE = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isDarkTheme(): boolean {
  const c = document.documentElement.classList;
  if (c.contains("dark")) return true;
  if (c.contains("light")) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

function setTheme(theme: "dark" | "light") {
  const c = document.documentElement.classList;
  c.toggle("dark", theme === "dark");
  c.toggle("light", theme === "light");
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    mq.removeEventListener("change", cb);
    obs.disconnect();
  };
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDarkTheme, () => false);

  // One-time move of a choice saved by older versions (localStorage) into the cookie.
  useEffect(() => {
    try {
      const legacy = localStorage.getItem(COOKIE);
      if (legacy === "dark" || legacy === "light") {
        if (!document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`))) setTheme(legacy);
        localStorage.removeItem(COOKIE);
      }
    } catch {
      // storage blocked: nothing to migrate
    }
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(isDarkTheme() ? "light" : "dark")}
      className="tap justify-center text-muted hover:text-fg"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
