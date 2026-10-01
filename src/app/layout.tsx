import type { Metadata, Viewport } from "next";
import { Caveat, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { SITE } from "@/lib/site";
import { HEAD_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

/** One clean geometric family for text and headlines. */
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
/** Handwritten note on the homepage hero. */
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600"], display: "swap" });
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
    <html lang="en-US" className={`${jakarta.variable} ${geistMono.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        {/* Before first paint: mark JS as available (GSAP reveals start hidden) and apply the saved light/dark theme. */}
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
