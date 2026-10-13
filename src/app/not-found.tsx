import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="container-prose flex-1 py-20">
        <p className="text-sm text-muted">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-muted">The page you are looking for doesn’t exist or has moved.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn">
            Home
          </Link>
          <Link href="/search" className="btn btn-ghost">
            Search
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
