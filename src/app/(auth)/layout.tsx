import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { SITE } from "@/lib/site";

/** Simple, centred sign-in / sign-up layout: a slim header, the form in one column, a legal footer. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="border-b border-line">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-1.5">
            <Link href="/" className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink">
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
              Back to site
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="flex flex-1 justify-center px-4 pb-14 pt-10 sm:px-6 sm:pt-14">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-[12.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.legalName} · <span className="text-ink-2">Preview build</span> — accounts and data stay in this browser.
          </p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="underline-offset-2 hover:text-ink hover:underline">Privacy</Link>
            <Link href="/terms" className="underline-offset-2 hover:text-ink hover:underline">Terms</Link>
            <Link href="/safety" className="underline-offset-2 hover:text-ink hover:underline">Safety</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
