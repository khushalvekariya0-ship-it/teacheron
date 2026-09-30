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
    <Link href={href} className="text-[14.5px] text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline">
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="bg-night text-white" role="contentinfo">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2" aria-label={`${SITE.name} home`}>
              <LogoMark className="[&_rect]:fill-white [&_path]:stroke-night" />
              <span className="font-heading text-[22px] font-extrabold tracking-[-0.04em]">{SITE.name}</span>
            </Link>
            <p className="mt-5 text-[15px] leading-relaxed text-white/70">
              A marketplace connecting students and families across the United States with qualified tutors, online and in person.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/tutors" className="inline-flex h-11 items-center rounded-lg border-2 border-brand bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:border-brand-hover hover:bg-brand-hover">
                Find a tutor
              </Link>
              <Link href="/contact" className="inline-flex h-11 items-center rounded-lg border-2 border-white/30 px-5 text-[15px] font-semibold text-white transition-colors hover:border-white">
                Contact support
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h2 className="font-heading text-[15px] font-bold text-white">{col.heading}</h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <FooterLink href={l.href}>{l.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-10 border-t border-white/15 pt-10 sm:grid-cols-2">
          <nav aria-label="Popular subjects">
            <h2 className="font-heading text-[15px] font-bold text-white">Popular subjects</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {POPULAR_SUBJECTS.map((s) => (
                <li key={s.slug}>
                  <FooterLink href={`/subjects/${s.slug}`}>{s.name} tutors</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Tutors near you">
            <h2 className="font-heading text-[15px] font-bold text-white">Tutors near you</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {CITIES.map((m) => (
                <li key={m.slug}>
                  <FooterLink href={`/locations/${m.slug}`}>Tutors in {m.city}, {m.state}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-page flex flex-col gap-4 py-6 text-[13.5px] text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.legalName} · United States</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/privacy" className="hover:text-white hover:underline">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-white hover:underline">Terms</Link></li>
            <li><Link href="/safety" className="hover:text-white hover:underline">Safety</Link></li>
            <li><Link href="/trust-safety" className="hover:text-white hover:underline">Trust & safety</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
