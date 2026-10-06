import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { SITE } from "@/lib/site";
import { SUBJECTS } from "@/lib/data/catalog";
import { METROS } from "@/lib/data/geo";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "For students",
    links: [
      { label: "Search tutors", href: "/tutors" },
      { label: "Help me find a tutor", href: "/concierge" },
      { label: "Browse subjects", href: "/subjects" },
      { label: "Online tutoring", href: "/tutors?mode=online" },
      { label: "Compare tutors", href: "/compare" },
      { label: "For students", href: "/for-students" },
    ],
  },
  {
    heading: "For families",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "For parents", href: "/for-parents" },
      { label: "Post a requirement", href: "/post-requirement" },
      { label: "Pricing", href: "/pricing" },
      { label: "Safety guidelines", href: "/safety" },
    ],
  },
  {
    heading: "For tutors",
    links: [
      { label: "Become a tutor", href: "/become-a-tutor" },
      { label: "Find student jobs", href: "/tutor-jobs" },
      { label: "Plans & credits", href: "/pricing#tutors" },
      { label: "Verification", href: "/trust-safety#verification" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Blog & resources", href: "/blog" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact us", href: "/contact" },
      { label: "Trust & safety", href: "/trust-safety" },
    ],
  },
];

const POPULAR_SUBJECTS = SUBJECTS.filter((s) => s.popular).slice(0, 10);
const CITIES = METROS.slice(0, 10);

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[14px] text-muted transition-colors hover:text-ink">
      {children}
    </Link>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mono-label border-b border-line pb-2.5">{children}</h3>;
}

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-canvas" role="contentinfo">
      <div className="container-page">
        {/* Brand row */}
        <div className="flex flex-col gap-8 border-b border-line py-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-md">
            <Logo />
            <p className="mt-5 font-heading text-[1.9rem] leading-tight text-ink">
              The right tutor, <em>one lesson at a time.</em>
            </p>
            <p className="mono-label mt-3">Online &amp; in person · No subscription · Pay per lesson</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tutors" className="group inline-flex h-11 items-center gap-2 bg-ink px-5 text-[15px] font-medium text-on-ink transition-colors hover:bg-navy-hover">
              Find a tutor <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="/contact" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-5 text-[15px] font-medium text-ink shadow-xs transition-colors hover:border-subtle">
              Contact support
            </Link>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-b border-line py-12 sm:grid-cols-3 lg:grid-cols-6">
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <ColumnHeading>{col.heading}</ColumnHeading>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <FooterLink href={l.href}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav aria-label="Popular subjects">
            <ColumnHeading>Popular subjects</ColumnHeading>
            <ul className="mt-4 space-y-2.5">
              {POPULAR_SUBJECTS.slice(0, 6).map((s) => (
                <li key={s.slug}>
                  <FooterLink href={`/subjects/${s.slug}`}>{s.name}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Tutors near you">
            <ColumnHeading>Tutors near you</ColumnHeading>
            <ul className="mt-4 space-y-2.5">
              {CITIES.slice(0, 6).map((m) => (
                <li key={m.slug}>
                  <FooterLink href={`/locations/${m.slug}`}>
                    {m.city}, {m.state}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Legal row */}
        <div className="flex flex-col gap-4 py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.legalName} · United States
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/privacy" className="transition-colors hover:text-ink">Privacy</Link></li>
            <li><Link href="/terms" className="transition-colors hover:text-ink">Terms</Link></li>
            <li><Link href="/safety" className="transition-colors hover:text-ink">Safety</Link></li>
            <li><Link href="/trust-safety" className="transition-colors hover:text-ink">Trust & safety</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
