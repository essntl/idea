"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { CloseIcon, ExternalIcon, LogOutIcon, MenuIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/site/theme-toggle";

const ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/blog", label: "Blog posts" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/comments", label: "Comments" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/taxonomy", label: "Categories & tags" },
  { href: "/admin/about", label: "About page" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ email, pendingComments }: { email: string; pendingComments: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const links = (
    <ul className="flex flex-col gap-0.5">
      {ITEMS.map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            aria-current={active(i.href, i.exact) ? "page" : undefined}
            className={`flex min-h-10 items-center justify-between rounded-[var(--radius-md)] px-3 text-[0.9375rem] ${active(i.href, i.exact) ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface hover:text-fg"}`}
          >
            {i.label}
            {i.href === "/admin/comments" && pendingComments > 0 && (
              <span className="rounded-full bg-fg px-2 text-xs font-semibold text-bg" aria-label={`${pendingComments} pending`}>
                {pendingComments}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );

  const footer = (
    <div className="mt-6 flex flex-col gap-0.5 border-t border-line pt-4 text-sm">
      <div className="flex items-center justify-between gap-2 pl-3">
        <p className="min-w-0 truncate text-muted" title={email}>
          {email}
        </p>
        <ThemeToggle />
      </div>
      <Link href="/" target="_blank" className="flex min-h-10 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-muted hover:bg-surface hover:text-fg">
        <ExternalIcon width={16} height={16} /> View site
      </Link>
      <button
        type="button"
        className="flex min-h-10 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-left whitespace-nowrap text-muted hover:bg-surface hover:text-fg"
        onClick={() => signOut({ callbackUrl: "/admin/login" })}
      >
        <LogOutIcon width={16} height={16} /> Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/admin" className="font-semibold">
          Admin
        </Link>
        <button type="button" className="tap -mr-2 justify-center" aria-expanded={open} aria-controls="admin-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>
      {open && (
        <nav id="admin-menu" aria-label="Admin" className="fixed inset-x-0 top-14 bottom-0 z-40 animate-menu-in overflow-y-auto bg-bg px-3 py-3 lg:hidden">
          {links}
          {footer}
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface/40 px-3 py-6 lg:flex">
        <Link href="/admin" className="mb-6 px-3 font-semibold">
          Admin
        </Link>
        <nav aria-label="Admin" className="flex-1">
          {links}
        </nav>
        {footer}
      </aside>
    </>
  );
}
