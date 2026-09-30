import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { AuthVignette } from "@/components/auth/AuthVignette";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SITE } from "@/lib/site";

/** Two-part layout: the form on white on the left, a light brand-tint product preview on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh min-w-0 flex-col bg-surface">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-5 sm:px-8 lg:border-b-0">
          <Logo />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/" className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink">
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
              Back to site
            </Link>
          </div>
        </header>
        <main id="main" className="flex flex-1 justify-center px-4 pb-12 pt-6 sm:items-center sm:px-8 sm:py-10">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>
        <footer className="flex flex-col gap-2 border-t border-line px-5 py-5 text-[12.5px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            {SITE.legalName} · <span className="text-ink-2">Preview build</span> — accounts and data stay in this browser.
          </p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="underline-offset-2 hover:text-ink hover:underline">Privacy</Link>
            <Link href="/terms" className="underline-offset-2 hover:text-ink hover:underline">Terms</Link>
            <Link href="/safety" className="underline-offset-2 hover:text-ink hover:underline">Safety</Link>
          </nav>
        </footer>
      </div>
      <aside className="relative hidden overflow-clip bg-brand-soft lg:block">
        <div className="sticky top-0 h-dvh">
          <AuthVignette />
        </div>
      </aside>
    </div>
  );
}
