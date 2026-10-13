import Link from "next/link";
import { getSettings } from "@/lib/settings";

export async function SiteFooter() {
  const s = await getSettings();
  const links = [
    s.portfolioUrl && { href: s.portfolioUrl, label: s.portfolioUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") },
    s.contactEmail && { href: `mailto:${s.contactEmail}`, label: s.contactEmail },
    s.githubUrl && { href: s.githubUrl, label: "GitHub" },
    ...s.socialLinks.map((l) => ({ href: l.url, label: l.label })),
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <footer className="border-t border-line">
      <div className="container-wide flex flex-col gap-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {s.authorName}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="tap hover:text-fg" {...(l.href.startsWith("http") ? { rel: "me noopener" } : {})}>
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <Link href="/rss.xml" className="tap hover:text-fg" prefetch={false}>
              RSS
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
