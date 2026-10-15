import { packageLabel } from "@/lib/projects";
import { GlobeIcon, PackageIcon, RepoIcon } from "@/components/ui/icons";

type Links = { repoUrl: string | null; siteUrl: string | null; packageUrl: string | null };

function items({ repoUrl, siteUrl, packageUrl }: Links) {
  return [
    siteUrl && { key: "site", href: siteUrl, icon: GlobeIcon, label: "Visit site" },
    repoUrl && { key: "repo", href: repoUrl, icon: RepoIcon, label: "Source code" },
    packageUrl && { key: "package", href: packageUrl, icon: PackageIcon, label: packageLabel(packageUrl) },
  ].filter(Boolean) as { key: string; href: string; icon: typeof GlobeIcon; label: string }[];
}

/** Icon-only links for cards (sit above the card's full-size link). */
export function ProjectLinkIcons({ links, title }: { links: Links; title: string }) {
  const list = items(links);
  if (!list.length) return null;
  return (
    <ul className="relative z-10 -mr-2 flex shrink-0 items-center">
      {list.map((l) => (
        <li key={l.key}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`${title}: ${l.label}`}
            aria-label={`${title}: ${l.label}`}
            className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <l.icon width={17} height={17} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Labelled buttons for the project page; the live site (or else the source) is the primary action. */
export function ProjectLinkButtons({ links }: { links: Links }) {
  const list = items(links);
  if (!list.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {list.map((l, i) => (
        <li key={l.key}>
          <a href={l.href} target="_blank" rel="noopener noreferrer" className={`btn ${i === 0 ? "" : "btn-ghost"}`}>
            <l.icon width={17} height={17} />
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
