import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { SITE } from "@/lib/site";
import { HEAD_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

/*
 * Three faces, each with one job: Instrument Serif for headlines (regular and italic — never bold),
 * Instrument Sans for everything you read, IBM Plex Mono for labels, numbers and small print.
 */
const sans = Instrument_Sans({ variable: "--font-sans-face", subsets: ["latin"], weight: "variable", display: "swap" });
const serif = Instrument_Serif({ variable: "--font-serif-face", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-mono-face", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

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
  themeColor: "#15140f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-US" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Before first paint: mark JS as available (GSAP reveals start hidden) and apply the saved theme. */}
        <script dangerouslySetInnerHTML={{ __html: HEAD_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:text-on-ink">
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
