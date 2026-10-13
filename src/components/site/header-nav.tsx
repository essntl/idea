"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/articles", label: "Articles" },
  { href: "/about", label: "About" },
];

export function HeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the mobile menu after navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

      <div className="flex items-center sm:hidden">
        <Link href="/search" aria-label="Search" className="tap justify-center text-muted hover:text-fg">
          <SearchIcon />
        </Link>
        <ThemeToggle />
        <button
          type="button"
          className="tap -mr-2 justify-center"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-14 animate-menu-in border-b border-line bg-bg sm:hidden">
          <nav aria-label="Mobile" className="container-wide flex flex-col py-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`flex min-h-12 items-center border-b border-line text-lg last:border-0 ${isActive(l.href) ? "font-medium" : "text-muted"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
