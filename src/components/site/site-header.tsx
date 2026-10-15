import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { HeaderNav, type HeaderLink } from "./header-nav";
import { LogoMark } from "./logo-mark";

export async function SiteHeader() {
  const settings = await getSettings();
  const extraLinks = [
    settings.portfolioUrl && { href: settings.portfolioUrl, label: settings.portfolioUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") },
    settings.githubUrl && { href: settings.githubUrl, label: "GitHub" },
    settings.contactEmail && { href: `mailto:${settings.contactEmail}`, label: "Email" },
  ].filter(Boolean) as HeaderLink[];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <div className="container-wide flex h-14 items-center justify-between gap-4">
        <Link href="/" className="tap -ml-1 gap-2.5 px-1 font-semibold tracking-tight">
          <LogoMark size={26} className="shrink-0" />
          {settings.siteTitle}
        </Link>
        <HeaderNav extraLinks={extraLinks} />
      </div>
    </header>
  );
}
