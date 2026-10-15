import { SiteHeader } from "@/components/site/site-header";
import { PageTransition } from "@/components/ui/page-transition";
import { SiteFooter } from "@/components/site/site-footer";
import { ImageLightbox } from "@/components/site/image-lightbox";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-bg focus:px-3 focus:py-2">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1 pb-16 pt-8 sm:pt-12">
        {/* Cross-fades page content on client navigations (see ::view-transition rules in globals.css). */}
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
      <ImageLightbox />
    </div>
  );
}
