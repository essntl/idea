import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const interCyrillic = localFont({
  src: "./fonts/inter-cyrillic.woff2",
  variable: "--font-inter-cyrillic",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: s.siteTitle, template: `%s — ${s.siteTitle}` },
    description: s.siteDescription,
    applicationName: s.siteTitle,
    authors: [{ name: s.authorName, url: s.portfolioUrl || undefined }],
    alternates: { types: { "application/rss+xml": [{ url: "/rss.xml", title: s.siteTitle }] } },
    openGraph: { type: "website", siteName: s.siteTitle, title: s.siteTitle, description: s.siteDescription },
    twitter: { card: "summary" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${interCyrillic.variable}`}>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
