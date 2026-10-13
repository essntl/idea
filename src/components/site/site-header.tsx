import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { HeaderNav } from "./header-nav";

export async function SiteHeader() {
  const settings = await getSettings();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <div className="container-wide flex h-14 items-center justify-between gap-4">
        <Link href="/" className="tap -ml-1 px-1 font-semibold tracking-tight">
          {settings.siteTitle}
        </Link>
        <HeaderNav />
      </div>
    </header>
  );
}
