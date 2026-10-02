import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Monitor, ShieldCheck } from "lucide-react";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { CtaBand, Section, SectionHeading } from "@/components/marketing/Section";
import { MetroMap, type MapMetro } from "@/components/marketing/MetroMap";
import { ZipSearch } from "@/components/content/ZipSearch";
import { inPersonTutorsForMetro, onlineTutors } from "@/components/content/insights";
import { Button } from "@/components/ui/Button";
import { METROS } from "@/lib/data/geo";

export const metadata: Metadata = {
  title: "Tutors by city",
  description: "Find in-person tutors in New York, Boston, Chicago, Austin, Los Angeles and other U.S. cities — or learn online with tutors available anywhere in the country.",
  alternates: { canonical: "/locations" },
};

/** Cities grouped by time zone — the zone your lessons are scheduled in. Phoenix keeps Mountain time. */
const ZONES: { label: string; tzs: string[] }[] = [
  { label: "Eastern time", tzs: ["America/New_York"] },
  { label: "Central time", tzs: ["America/Chicago"] },
  { label: "Mountain time", tzs: ["America/Denver", "America/Phoenix"] },
  { label: "Pacific time", tzs: ["America/Los_Angeles"] },
];

const LOCAL_STEPS = [
  { title: "Enter your ZIP code", body: "We place you on the map — your address is never needed." },
  { title: "Choose a distance", body: "See tutors within 5, 10 or 25 miles of you." },
  { title: "Meet where you agree", body: "At home, a library or another place you both choose." },
];

export default function LocationsPage() {
  const metros = METROS.map((m) => ({ ...m, inPerson: inPersonTutorsForMetro(m).length }));
  const online = onlineTutors().length;
  const mapMetros: MapMetro[] = metros.map((m) => ({ slug: m.slug, city: m.city, state: m.state, lat: m.lat, lng: m.lng, inPerson: m.inPerson }));
  const facts = [
    { icon: MapPin, label: `${METROS.length} city pages` },
    { icon: Clock, label: `${ZONES.length} U.S. time zones` },
    { icon: Monitor, label: "Online everywhere in the U.S." },
  ];

  return (
    <>
      {/* ── Header: promise, ZIP search, and how local search works ── */}
      <section className="relative bg-gradient-to-b from-brand-50 to-page">
        <div className="container-page grid items-center gap-12 pb-14 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-20">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand">
                <span className="h-px w-6 bg-brand-gradient" aria-hidden />
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
                Search by ZIP code to find tutors who travel to your neighborhood, or pick a city below. Online lessons work from anywhere in the U.S.
              </p>
            </Reveal>
            <Reveal delay={0.3} className="mt-8 max-w-xl">
              <ZipSearch />
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
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-[14px] font-bold text-white">{i + 1}</span>
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

      {/* ── Map ── */}
      <Section>
        <SectionHeading eyebrow="Cities" title="Where our tutors teach in person" accent={2} description="Every dot is a city page. Hover or tap one to see how many tutors offer in-person lessons there." />
        <Reveal>
          <MetroMap metros={mapMetros} />
        </Reveal>

        {/* ── Cities, grouped by time zone ── */}
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-6">
          {ZONES.map((z) => {
            const list = metros.filter((m) => z.tzs.includes(m.timezone));
            return (
              <section key={z.label} aria-labelledby={`zone-${z.label}`}>
                <Reveal>
                  <h2 id={`zone-${z.label}`} className="flex items-center justify-between border-b border-line pb-3">
                    <span className="inline-flex items-center gap-2 font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">
                      <Clock className="size-4 text-brand" aria-hidden /> {z.label}
                    </span>
                    <span className="text-[13px] tabular-nums text-muted">{list.length} cities</span>
                  </h2>
                </Reveal>
                <Stagger className="mt-3 space-y-2" stagger={0.04}>
                  {list.map((m) => (
                    <StaggerItem key={m.slug}>
                      <Link
                        href={`/locations/${m.slug}`}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-[border-color,box-shadow] duration-300 hover:border-brand/40 hover:shadow-[0_12px_28px_-20px_rgb(15_23_42/0.45)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-ink">
                            {m.city}, {m.state}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] tabular-nums text-muted">
                            {m.inPerson > 0 ? `${m.inPerson} in-person ${m.inPerson === 1 ? "tutor" : "tutors"}` : "See tutors for this city"}
                          </span>
                        </span>
                        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors duration-300 group-hover:border-transparent group-hover:bg-brand-gradient group-hover:text-white">
                          <ArrowRight className="size-4" aria-hidden />
                        </span>
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            );
          })}
        </div>

        {/* ── Online everywhere ── */}
        <Reveal className="mt-14 lg:mt-16">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-brand-gradient" aria-hidden />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white">
                  <Monitor className="size-6" aria-hidden />
                </span>
                <div>
                  <h2 className="font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">Not near one of these cities?</h2>
                  <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink-2">
                    {online > 0 ? `${online} tutors teach online and` : "Online tutors"} are available anywhere in the United States, with lessons scheduled in your own time zone.
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
