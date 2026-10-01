import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, MapPin, Monitor, ShieldCheck, Users } from "lucide-react";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { ArrowLink, CtaBand, Section, SectionHeading } from "@/components/marketing/Section";
import { inPersonTutorsForMetro, neutralOrder, onlineTutors, rateRange } from "@/components/content/insights";
import { TutorCard } from "@/components/domain/TutorCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { subjectName, US_TIMEZONES } from "@/lib/data/catalog";
import { METROS, METRO_BY_SLUG, distanceMiles } from "@/lib/data/geo";
import { formatCents } from "@/lib/format";
import { SITE } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return METROS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const metro = METRO_BY_SLUG[slug];
  if (!metro) return { title: "Location not found", robots: { index: false } };
  const count = inPersonTutorsForMetro(metro).length;
  const place = `${metro.city}, ${metro.state}`;
  return {
    title: `Tutors in ${place}`,
    description:
      count > 0
        ? `${count} ${count === 1 ? "tutor offers" : "tutors offer"} in-person lessons in ${place}, plus online tutors available anywhere in the U.S. Compare rates, trials and verified credentials.`
        : `Online tutors for students in ${place}. Compare rates, trials and verified credentials, or post a requirement for in-person help.`,
    alternates: { canonical: `/locations/${slug}` },
    // Thin-content guard: only cities with in-person supply are indexed.
    robots: count === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function LocationPage({ params }: Props) {
  const { slug } = await params;
  const metro = METRO_BY_SLUG[slug];
  if (!metro) notFound();

  const place = `${metro.city}, ${metro.state}`;
  const nearby = inPersonTutorsForMetro(metro);
  const nearbyIds = new Set(nearby.map((n) => n.tutor.id));
  const tzLabel = US_TIMEZONES.find((z) => z.value === metro.timezone)?.label ?? metro.timezone;
  const online = onlineTutors().filter((t) => !nearbyIds.has(t.id));
  const sameZone = neutralOrder(online.filter((t) => t.timezone === metro.timezone));
  const onlineShown = [...sameZone, ...neutralOrder(online.filter((t) => t.timezone !== metro.timezone))].slice(0, 4);
  const localSubjects = Array.from(new Set(nearby.flatMap((n) => n.tutor.subjects))).slice(0, 12);
  const range = rateRange(nearby.map((n) => n.tutor));
  const otherMetros = METROS.filter((m) => m.slug !== slug)
    .map((m) => ({ m, d: distanceMiles(metro, m), n: inPersonTutorsForMetro(m).length }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);
  const inPersonHref = `/tutors?location=${metro.zip}&mode=in_person`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Locations", item: `${SITE.url}/locations` },
      { "@type": "ListItem", position: 2, name: place, item: `${SITE.url}/locations/${slug}` },
    ],
  };

  const stats = [
    { k: "In-person tutors", v: String(nearby.length) },
    { k: "In-person rates", v: range ? (range.min === range.max ? `${formatCents(range.min)}/hr` : `${formatCents(range.min)}–${formatCents(range.max)}`) : "—" },
    { k: "Online tutors", v: String(onlineTutors().length) },
    { k: "Local time zone", v: tzLabel.replace(/ \(.+\)$/, "") },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="bg-brand-soft">
        <div className="container-page pb-16 pt-10 sm:pb-20 sm:pt-12 lg:pb-24 lg:pt-14">
          <Reveal>
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink/70">
                <li><Link href="/locations" className="underline-offset-4 hover:text-ink hover:underline">Locations</Link></li>
                <li aria-hidden>/</li>
                <li>{metro.stateName}</li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="font-semibold text-ink">{metro.city}</li>
              </ol>
            </nav>
          </Reveal>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:gap-14">
            <div>
              <WordReveal
                text={`Tutors in ${place}`}
                className="font-heading text-[2.75rem] font-bold leading-[0.98] tracking-[-0.03em] text-ink sm:text-6xl lg:text-[4.4rem]"
              />
              <Reveal delay={0.2}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/80 sm:text-xl">
                  {nearby.length > 0
                    ? `${nearby.length} ${nearby.length === 1 ? "tutor offers" : "tutors offer"} in-person lessons in the ${metro.city} area. Every online tutor on ${SITE.name} can teach you from anywhere, too.`
                    : `No tutors currently offer in-person lessons in ${metro.city}, but every online tutor on ${SITE.name} can teach you from anywhere.`}
                </p>
              </Reveal>
              <Reveal delay={0.3} className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={inPersonHref}>
                    <MapPin /> In-person tutors near {metro.zip}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/tutors?mode=online">
                    <Monitor /> Online tutors
                  </Link>
                </Button>
              </Reveal>
            </div>
            <Reveal delay={0.25}>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line">
                {stats.map((s) => (
                  <div key={s.k} className="bg-surface p-5 sm:p-6">
                    <dt className="text-[13px] text-muted">{s.k}</dt>
                    <dd className="mt-1.5 font-heading text-2xl font-bold tracking-[-0.03em] tabular-nums text-ink">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      <Section>
        {nearby.length > 0 ? (
          <>
            <SectionHeading
              eyebrow="In person"
              title={`Tutors who come to ${metro.city}`}
              description={`Each tutor's own service radius covers central ${metro.city}. Distances are approximate and measured to the tutor's service area — never a home address.`}
            />
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1" stagger={0.07}>
              {nearby.map(({ tutor, distance }) => (
                <StaggerItem key={tutor.id} className="h-full">
                  {/* Row cards need width for their actions; smaller screens get the compact card. */}
                  <div className="h-full lg:hidden">
                    <TutorCard
                      tutor={tutor}
                      footer={
                        <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                          <MapPin className="size-3.5 text-subtle" aria-hidden /> ~{distance < 1 ? "<1" : Math.round(distance)} mi from central {metro.city} · serves within {tutor.serviceRadiusMiles} mi
                        </p>
                      }
                    />
                  </div>
                  <div className="hidden lg:block">
                    <TutorCard tutor={tutor} layout="row" distance={distance} />
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            {localSubjects.length > 0 && (
              <Reveal className="mt-10">
                <h3 className="text-[15px] font-semibold text-ink">Taught in person in {metro.city}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {localSubjects.map((s) => (
                    <li key={s}>
                      <Link
                        href={`/tutors?subject=${s}&location=${metro.zip}&mode=in_person`}
                        className="inline-flex rounded-lg border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:border-ink hover:text-ink"
                      >
                        {subjectName(s)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </>
        ) : (
          <div data-spotlight className="rounded-2xl border border-line bg-canvas">
            <EmptyState
              icon={<Users />}
              title={`No in-person tutors in ${metro.city} yet`}
              description="Post a requirement and tutors who can travel to you will be able to apply. In the meantime, online tutors are available now."
              action={
                <>
                  <Button asChild>
                    <Link href="/post-requirement">
                      <FileText /> Post a requirement
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/tutors?mode=online">Browse online tutors</Link>
                  </Button>
                </>
              }
            />
          </div>
        )}
      </Section>

      {onlineShown.length > 0 && (
        <Section tone="canvas">
          <SectionHeading
            eyebrow="Online"
            title={sameZone.length > 0 ? `Online tutors in ${tzLabel.replace(/ \(.+\)$/, "")}` : "Online tutors, anywhere"}
            description={
              sameZone.length > 0
                ? `Tutors based in your time zone, so lesson times line up with the ${metro.city} school day. Every online tutor can teach you, wherever they live.`
                : `Every online tutor can teach students in ${metro.city}. Times are always shown in your time zone.`
            }
            action={<ArrowLink href="/tutors?mode=online">All online tutors</ArrowLink>}
          />
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.07}>
            {onlineShown.map((t) => (
              <StaggerItem key={t.id} className="h-full">
                <TutorCard tutor={t} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <Reveal>
            <div className="rounded-2xl bg-canvas p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-teal-soft text-ink" aria-hidden>
                <ShieldCheck className="size-5" />
              </span>
              <h2 className="mt-4 font-heading text-xl font-bold tracking-[-0.03em] text-ink">Meeting in person, safely</h2>
              <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-2">
                <li>Tutors share an approximate service area, not an address.</li>
                <li>Agree on a meeting place in messages — a library or your home, your choice.</li>
                <li>For students under 18, a parent or guardian should be nearby.</li>
              </ul>
              <ArrowLink href="/safety" className="mt-5">Safety guidelines</ArrowLink>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-heading text-xl font-bold tracking-[-0.03em] text-ink">Nearby cities</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {otherMetros.map(({ m, d, n }) => (
                <li key={m.slug}>
                  <Link href={`/locations/${m.slug}`} data-spotlight className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 transition-colors">
                    <span>
                      <span className="block text-[15px] font-bold text-ink">
                        {m.city}, {m.state}
                      </span>
                      <span className="text-[13px] tabular-nums text-muted">
                        ~{Math.round(d)} mi · {n > 0 ? `${n} in person` : "online only"}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-ink transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      <CtaBand
        title={`Search tutors near ${metro.city}.`}
        description="Filter by subject, grade, schedule and budget, and set your own radius in miles."
        primary={{ href: inPersonHref, label: "Search in-person tutors" }}
        secondary={{ href: "/concierge", label: "Help me find a tutor" }}
      />
    </>
  );
}
