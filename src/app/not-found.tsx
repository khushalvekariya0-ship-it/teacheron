import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Reveal } from "@/components/motion";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
  alternates: { canonical: null },
};

const LINKS = [
  { href: "/tutors", label: "Search tutors", hint: "Filter by subject, grade and schedule" },
  { href: "/subjects", label: "Browse subjects", hint: "Math, science, test prep and more" },
  { href: "/how-it-works", label: "How it works", hint: "Search, trials, booking and safety" },
  { href: "/contact", label: "Contact support", hint: "We read every message" },
];

/** Branded 404. Rendered inside the root layout only (no site navbar), so it's a complete page. */
export default function NotFound() {
  return (
    <main id="main" className="relative flex min-h-dvh flex-col overflow-hidden bg-page">
      <div className="pointer-events-none absolute inset-0 bg-line-grid mask-radial opacity-80" aria-hidden />
      <header className="container-page relative flex h-16 items-center">
        <Logo />
      </header>
      <div className="container-page relative flex flex-1 flex-col items-center justify-center py-16 text-center">
        <Reveal>
          <p className="font-mono text-sm font-medium tracking-[0.2em] text-muted">404</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.025em] text-ink sm:text-5xl">We couldn&rsquo;t find that page.</h1>
          <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-muted">The link may be broken, or the page may have moved. Try a search, or pick up from one of these.</p>
        </Reveal>

        <Reveal delay={0.1} className="mt-10 w-full max-w-lg">
          <form action="/tutors" method="get" role="search" className="flex gap-2 rounded-xl border border-line bg-surface p-1.5 shadow-sm focus-within:border-navy focus-within:ring-[3px] focus-within:ring-navy/10">
            <label htmlFor="nf-q" className="sr-only">
              Search tutors by subject or name
            </label>
            <span className="grid w-8 shrink-0 place-items-center text-muted" aria-hidden>
              <Search className="size-4" />
            </span>
            <input
              id="nf-q"
              name="q"
              type="search"
              placeholder="Try “algebra” or “SAT”"
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle"
            />
            <button type="submit" className="h-10 shrink-0 rounded-lg bg-navy px-4 text-sm font-medium text-on-ink transition-colors hover:bg-navy-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
              Search
            </button>
          </form>
        </Reveal>

        <Reveal delay={0.2} className="mt-10 w-full max-w-2xl">
          <ul className="grid gap-3 text-left sm:grid-cols-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-md">
                  <span>
                    <span className="block text-[15px] font-medium text-ink">{l.label}</span>
                    <span className="block text-[13px] text-muted">{l.hint}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-subtle transition-all group-hover:translate-x-0.5 group-hover:text-navy" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-sm text-muted">
            Or head back to the{" "}
            <Link href="/" className="font-medium text-navy underline-offset-4 hover:underline">
              {SITE.name} homepage
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </main>
  );
}
