import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Globe2, MapPin, Monitor, ShieldCheck } from "lucide-react";
import { Reveal, WordReveal } from "@/components/motion";
import { CtaBand, Section, SectionHeading } from "@/components/marketing/Section";
import { NearbySearch } from "@/components/content/NearbySearch";
import { inPersonTutorsForMetro, onlineTutors } from "@/components/content/insights";
import { listedTutors } from "@/server/public";
import { Button } from "@/components/ui/Button";
import { allMetros, type Metro } from "@/lib/data/geo";
import { countryName } from "@/lib/location";

/** Figures and content come from the database; the page is rebuilt at most once a minute. */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Tutors by city",
  description: "Find in-person tutors in Ahmedabad, Mumbai, Delhi, London, Toronto, Dubai, New York and other cities around the world — or learn online with tutors available anywhere.",
  alternates: { canonical: "/locations" },
};

const LOCAL_STEPS = [
  { title: "Enter your PIN, ZIP or postal code", body: "Or just your city. We place you on the map — your address is never needed." },
  { title: "See tutors who travel to you", body: "Each tutor sets how far they travel. You see the ones whose area covers yours." },
  { title: "Meet where you agree", body: "At home, a library or another place you both choose." },
];

/** Countries shown open first; every other country follows in the city list's order, under "More countries". */
const FIRST_COUNTRIES = ["IN", "US", "GB", "CA", "AU", "AE"];

type CityRow = Metro & { inPerson: number };

/** Cities grouped by country: countries with the most in-person tutors first, then the usual order. */
function byCountry(cities: CityRow[]): { country: string; cities: CityRow[]; inPerson: number }[] {
  const groups = new Map<string, CityRow[]>();
  for (const c of cities) groups.set(c.country, [...(groups.get(c.country) ?? []), c]);
  const rank = (c: string) => (FIRST_COUNTRIES.includes(c) ? FIRST_COUNTRIES.indexOf(c) : FIRST_COUNTRIES.length);
  const order = [...groups.keys()];
  return order
    .map((country) => {
      const list = groups.get(country)!;
      // Inside a country: cities with in-person tutors first, then the list's own order (biggest cities first).
      const sorted = [...list].sort((a, b) => b.inPerson - a.inPerson || list.indexOf(a) - list.indexOf(b));
      return { country, cities: sorted, inPerson: list.reduce((n, c) => n + c.inPerson, 0) };
    })
    .sort((a, b) => b.inPerson - a.inPerson || rank(a.country) - rank(b.country) || order.indexOf(a.country) - order.indexOf(b.country));
}

function CityLinks({ cities }: { cities: CityRow[] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {cities.map((m) => (
        <li key={m.slug}>
          <Link
            href={`/locations/${m.slug}`}
            className="group flex h-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 transition-colors duration-200 hover:border-ink"
          >
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-semibold text-ink">{m.city}</span>
              <span className="block truncate text-[12.5px] tabular-nums text-muted">
                {m.inPerson > 0 ? `${m.inPerson} in person` : m.state || "Online tutors"}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function LocationsPage() {
  const tutors = await listedTutors();
  const cities: CityRow[] = allMetros(tutors).map((m) => ({ ...m, inPerson: inPersonTutorsForMetro(m, tutors).length }));
  const countries = byCountry(cities);
  const open = countries.filter((c, i) => i < FIRST_COUNTRIES.length || c.inPerson > 0);
  const more = countries.filter((c) => !open.includes(c));
  const online = onlineTutors(tutors).length;
  const facts = [
    { icon: MapPin, label: `${cities.length} cities in ${countries.length} countries` },
    { icon: Clock, label: "Times in your own time zone" },
    { icon: Monitor, label: "Online lessons everywhere" },
  ];

  return (
    <>
      {/* ── Header: promise, ZIP search, and how local search works ── */}
      <section className="relative isolate border-b border-line bg-page">
        <div className="page-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-line-grid [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black_20%,transparent_75%)]" aria-hidden />
        <div className="container-page grid grid-cols-1 items-center gap-12 pb-14 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-20">
          <div>
            <Reveal>
              <p className="kicker">
                <span className="kicker-dot" aria-hidden />
                Locations
              </p>
            </Reveal>
            <WordReveal
              text="Tutors near you — and online everywhere."
              accent={2}
              className="mt-5 font-heading text-[2.5rem] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[3.2rem] lg:text-[3.5rem]"
            />
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
                Search by your PIN, ZIP or postal code — or your city — to find tutors who travel to you, or pick a city below. Online lessons work from anywhere in the world.
              </p>
            </Reveal>
            <Reveal delay={0.3} className="mt-8 max-w-xl">
              <NearbySearch />
            </Reveal>
            <Reveal delay={0.4}>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] font-medium text-ink-2" aria-label="At a glance">
                {facts.map((f) => (
                  <li key={f.label} className="inline-flex items-center gap-2">
                    <f.icon className="size-4 text-brand" aria-hidden /> {f.label}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_60px_-36px_rgb(15_23_42/0.45)] sm:p-8">
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">How local search works</p>
              <ol className="mt-6 space-y-6">
                {LOCAL_STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-[14px] font-bold text-on-brand">{i + 1}</span>
                    <span>
                      <span className="block text-[16px] font-semibold text-ink">{s.title}</span>
                      <span className="mt-1 block text-[14.5px] leading-relaxed text-ink-2">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-7 flex items-start gap-2.5 rounded-xl bg-canvas p-4 text-[14px] leading-snug text-ink-2">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                Tutors share an approximate service area — never a home address.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Cities, by country ── */}
      <Section>
        <SectionHeading
          eyebrow="Cities"
          title="Find tutors by city"
          accent={2}
          description="Pick your city to see tutors who teach in person there, plus online tutors in your time zone. Don't see your city? Search above: it works for any place."
        />
        <div className="mt-10 space-y-10">
          {open.map((g) => (
            <Reveal key={g.country}>
              <section aria-labelledby={`country-${g.country}`}>
                <h2 id={`country-${g.country}`} className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
                  <span className="inline-flex items-center gap-2 font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">
                    <Globe2 className="size-4 text-brand" aria-hidden /> {countryName(g.country) || g.country}
                  </span>
                  <span className="text-[13px] tabular-nums text-muted">
                    {g.cities.length} {g.cities.length === 1 ? "city" : "cities"}
                    {g.inPerson > 0 && ` · ${g.inPerson} in person`}
                  </span>
                </h2>
                <CityLinks cities={g.cities} />
              </section>
            </Reveal>
          ))}
          {more.length > 0 && (
            <details className="group rounded-xl border border-line bg-canvas p-4 sm:p-5">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-start gap-2">
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-brand transition-transform duration-200 group-open:rotate-90" aria-hidden />
                  <span>
                    More countries ({more.length}): <span className="font-normal text-ink-2">{more.map((g) => countryName(g.country) || g.country).join(", ")}</span>
                  </span>
                </span>
              </summary>
              <div className="mt-6 space-y-8">
                {more.map((g) => (
                  <section key={g.country} aria-label={countryName(g.country) || g.country}>
                    <h3 className="border-b border-line pb-2 text-[16px] font-bold text-ink">{countryName(g.country) || g.country}</h3>
                    <CityLinks cities={g.cities} />
                  </section>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* ── Online everywhere ── */}
        <Reveal className="mt-14 lg:mt-16">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-brand-gradient" aria-hidden />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-on-brand">
                  <Monitor className="size-6" aria-hidden />
                </span>
                <div>
                  <h2 className="font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">Not near one of these cities?</h2>
                  <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink-2">
                    {online > 0 ? `${online} tutors teach online and` : "Online tutors"} are available anywhere in the world, with lessons scheduled in your own time zone.
                  </p>
                </div>
              </div>
              <Button asChild variant="secondary" className="shrink-0">
                <Link href="/tutors?mode=online">
                  Browse online tutors <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>

      <CtaBand
        title="Can't find a tutor nearby?"
        description="Post what you need and tutors who teach it — online or near you — can apply. It only takes a couple of minutes."
        primary={{ href: "/post-requirement", label: "Post a requirement" }}
        secondary={{ href: "/concierge", label: "Help me find a tutor" }}
      />
    </>
  );
}
