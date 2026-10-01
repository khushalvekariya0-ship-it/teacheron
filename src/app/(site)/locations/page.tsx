import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Monitor, Users } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section } from "@/components/marketing/Section";
import { MetroMap, type MapMetro } from "@/components/marketing/MetroMap";
import { inPersonTutorsForMetro, onlineTutors } from "@/components/content/insights";
import { Button } from "@/components/ui/Button";
import { METROS } from "@/lib/data/geo";

export const metadata: Metadata = {
  title: "Tutors by city",
  description: "Find in-person tutors in New York, Boston, Chicago, Austin, Los Angeles and other U.S. cities — or learn online with tutors available anywhere in the country.",
  alternates: { canonical: "/locations" },
};

export default function LocationsPage() {
  const metros = METROS.map((m) => ({ ...m, inPerson: inPersonTutorsForMetro(m).length }));
  const byState = Object.entries(
    metros.reduce<Record<string, typeof metros>>((acc, m) => {
      (acc[m.stateName] ??= []).push(m);
      return acc;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));
  const online = onlineTutors().length;
  const mapMetros: MapMetro[] = metros.map((m) => ({ slug: m.slug, city: m.city, state: m.state, lat: m.lat, lng: m.lng, inPerson: m.inPerson }));

  return (
    <>
      <PageHero
        eyebrow="Locations"
        title="Tutors near you — and online everywhere."
        description="In-person tutors set their own service radius. Pick a city to see who covers it, or search by ZIP code for your exact neighborhood."
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/tutors?mode=in_person">
                Search by ZIP code <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/tutors?mode=online">
                <Monitor /> Online tutors
              </Link>
            </Button>
          </>
        }
      />

      <Section>
        <Reveal>
          <MetroMap metros={mapMetros} />
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-canvas p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="flex items-start gap-3 text-[15px] text-ink-2">
              <Monitor className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
              <span>
                <span className="font-semibold text-ink">Not near one of these cities?</span> {online} tutors teach online and are available anywhere in the United States, in your time zone.
              </span>
            </p>
            <ArrowLink href="/tutors?mode=online" className="shrink-0">
              Browse online tutors
            </ArrowLink>
          </div>
        </Reveal>

        <div className="mt-16 space-y-12 sm:mt-20 lg:mt-24">
          {byState.map(([stateName, list]) => (
            <section key={stateName} aria-labelledby={`state-${list[0].state}`}>
              <Reveal>
                <h2 id={`state-${list[0].state}`} className="border-b-2 border-ink pb-3 font-heading text-2xl font-bold tracking-[-0.025em] text-ink">
                  {stateName}
                </h2>
              </Reveal>
              <Stagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
                {list.map((m) => (
                  <StaggerItem key={m.slug} className="h-full">
                    <Link
                      href={`/locations/${m.slug}`}
                      data-spotlight className="group flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 transition-colors"
                    >
                      <span>
                        <span className="block text-[15px] font-bold text-ink">
                          {m.city}, {m.state}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] tabular-nums text-muted">
                          <Users className="size-3.5 text-subtle" aria-hidden />
                          {m.inPerson > 0 ? `${m.inPerson} in-person ${m.inPerson === 1 ? "tutor" : "tutors"}` : "Online tutors only"}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-ink transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          ))}
        </div>
      </Section>

      <CtaBand
        title="Search your exact neighborhood."
        description="Enter a ZIP code and choose a radius in miles. Tutors share an approximate service area — never a home address."
        primary={{ href: "/tutors?mode=in_person", label: "Search by ZIP code" }}
        secondary={{ href: "/post-requirement", label: "Post a requirement" }}
      />
    </>
  );
}
