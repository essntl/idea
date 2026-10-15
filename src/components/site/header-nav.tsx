"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CloseIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/blog", label: "Blog", hint: "Diary notes, newest first" },
  { href: "/articles", label: "Articles", hint: "Long-form writing" },
  { href: "/about", label: "About", hint: "Who's writing this" },
];

export type HeaderLink = { href: string; label: string };

export function HeaderNav({ extraLinks = [] }: { extraLinks?: HeaderLink[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the mobile menu after navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // While open: Esc closes, the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={`tap justify-center px-3 text-[0.9375rem] hover:text-fg ${isActive(l.href) ? "text-fg underline underline-offset-[6px]" : "text-muted"}`}
          >
            {l.label}
          </Link>
        ))}
        <Link href="/search" aria-label="Search" className="tap justify-center text-muted hover:text-fg">
          <SearchIcon />
        </Link>
        <ThemeToggle />
      </nav>

      <button
        type="button"
        className="-mr-2 flex size-11 items-center justify-center rounded-full hover:bg-surface sm:hidden"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative size-5">
          <MenuIcon className={`absolute inset-0 transition-all duration-200 ${open ? "scale-75 rotate-90 opacity-0" : ""}`} />
          <CloseIcon className={`absolute inset-0 transition-all duration-200 ${open ? "" : "scale-75 -rotate-90 opacity-0"}`} />
        </span>
      </button>

      {/* Portal: the header's backdrop-filter would otherwise trap these fixed layers inside the header box. */}
      {open &&
        createPortal(
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-x-0 top-14 bottom-0 z-30 animate-fade-in bg-black/40 backdrop-blur-[2px] sm:hidden" />
          <div id="mobile-menu" className="fixed inset-x-0 top-14 z-40 max-h-[calc(100dvh-3.5rem)] animate-menu-in overflow-y-auto rounded-b-[var(--radius-xl)] border-b border-line bg-bg sm:hidden">
            <div className="container-wide pt-4 pb-5">
              <form
                role="search"
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
                  router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
                }}
              >
                <SearchIcon width={17} height={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle" />
                <label htmlFor="menu-search" className="sr-only">
                  Search
                </label>
                <input id="menu-search" name="q" type="search" enterKeyHint="search" placeholder="Search articles and posts" className="field rounded-full bg-surface pl-10" />
              </form>

              <nav aria-label="Mobile" className="mt-4">
                <ul className="space-y-1">
                  {LINKS.map((l) => {
                    const active = isActive(l.href);
                    return (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          aria-current={active ? "page" : undefined}
                          className={`group flex min-h-16 items-center gap-3 rounded-[var(--radius-lg)] px-3 transition-colors ${active ? "bg-surface" : "hover:bg-surface"}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className={`flex items-center gap-2 text-xl font-semibold tracking-tight ${active ? "text-fg" : "text-fg/85"}`}>
                              {l.label}
                              {active && <span className="size-1.5 rounded-full bg-fg" aria-hidden="true" />}
                            </span>
                            <span className="block text-sm text-muted">{l.hint}</span>
                          </span>
                          <ArrowRight width={18} height={18} className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {extraLinks.map((l) => (
                    <li key={l.href}>
                      <a href={l.href} className="inline-flex min-h-10 items-center hover:text-fg" {...(l.href.startsWith("http") ? { rel: "me noopener" } : {})}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="flex shrink-0 items-center gap-1 text-sm text-muted">
                  <span>Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </>,
          document.body,
        )}
    </>
  );
}
