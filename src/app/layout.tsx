import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { SITE } from "@/lib/site";
import { HEAD_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

/** One crisp variable family for text and headlines. */
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — Find the right tutor. Learn with confidence.`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: "website", siteName: SITE.name, title: SITE.tagline, description: SITE.description, locale: "en_US" },
  twitter: { card: "summary_large_image", title: SITE.tagline, description: SITE.description },
  // No site-wide canonical here: each page declares its own, so pages never inherit "/" by mistake.
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-US" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Before first paint: mark JS as available (GSAP reveals start hidden). */}
        <script dangerouslySetInnerHTML={{ __html: HEAD_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:text-on-ink">
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
