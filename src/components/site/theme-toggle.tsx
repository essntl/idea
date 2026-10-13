"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {}
    if (!stored) document.documentElement.classList.toggle("dark", mq.matches);
    cb();
  };
  mq.addEventListener("change", onSystem);
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => {
    mq.removeEventListener("change", onSystem);
    obs.disconnect();
  };
}

const getDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getDark, () => false);

  function toggle() {
    const next = !getDark();
    document.documentElement.classList.toggle("dark", next);
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    try {
      // Going back to the system preference clears the explicit choice.
      if (next === systemDark) localStorage.removeItem("theme");
      else localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button type="button" onClick={toggle} className="tap justify-center text-muted hover:text-fg" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
