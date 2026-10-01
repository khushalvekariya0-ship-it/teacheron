import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
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
    <Link href={href} className="text-[14px] text-white/60 transition-colors hover:text-white">
      {children}
    </Link>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">{children}</h2>;
}

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-night text-white" role="contentinfo">
      <div className="absolute inset-x-0 top-0 h-px bg-brand-gradient opacity-60" aria-hidden />
      <div className="container-page">
        {/* Brand row */}
        <div className="flex flex-col gap-8 border-b border-white/10 py-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-md">
            <Link href="/" className="inline-flex items-center gap-2" aria-label={`${SITE.name} home`}>
              <LogoMark className="[&_rect]:fill-white [&_path]:stroke-night" />
              <span className="font-heading text-[22px] font-bold tracking-[-0.03em]">{SITE.name}</span>
            </Link>
            <p className="mt-4 text-[15px] leading-relaxed text-white/60">
              A marketplace connecting students and families across the United States with qualified tutors, online and in person.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tutors" className="inline-flex h-11 items-center rounded-lg bg-brand-gradient px-5 text-[15px] font-semibold text-white transition-[filter] hover:brightness-110">
              Find a tutor
            </Link>
            <Link href="/contact" className="inline-flex h-11 items-center rounded-lg border border-white/20 px-5 text-[15px] font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/5">
              Contact support
            </Link>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-b border-white/10 py-12 sm:grid-cols-3 lg:grid-cols-6">
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
        <div className="flex flex-col gap-4 py-6 text-[13px] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.legalName} · United States
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link></li>
            <li><Link href="/terms" className="transition-colors hover:text-white">Terms</Link></li>
            <li><Link href="/safety" className="transition-colors hover:text-white">Safety</Link></li>
            <li><Link href="/trust-safety" className="transition-colors hover:text-white">Trust & safety</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
