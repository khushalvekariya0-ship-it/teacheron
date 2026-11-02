"use client";

import Image from "next/image";
import { BookOpen, LayoutGrid, Monitor } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Section } from "@/components/marketing/Section";
import { SubjectTile } from "@/components/content/SubjectTile";
import { AreaNav } from "@/components/content/AreaNav";
import { CategoryIcon } from "@/components/content/icons";
import { useCatalog, useListedTutors } from "@/lib/store/hooks";
import type { SubjectCategory } from "@/lib/types";

/*
 * The live parts of /subjects: counts, the photo mosaic, the area bar and every area with its subjects.
 * They read the catalog edited in Admin → Catalog, so new, renamed and hidden subjects show correctly.
 */

/** Areas that have a photo; the others get a tinted panel with their icon. */
const AREA_PHOTOS = new Set(["math", "science", "english", "test-prep", "languages", "computer-science", "social-studies", "arts", "learning-support"]);
/** Preferred areas for the hero mosaic; any shown area with a photo fills a gap. */
const MOSAIC = ["math", "science", "test-prep", "languages"];

export function CatalogFacts() {
  const { subjects, categories } = useCatalog();
  if (subjects.length === 0) return null;
  const facts = [
    { icon: BookOpen, label: `${subjects.length} ${subjects.length === 1 ? "subject" : "subjects"}` },
    { icon: LayoutGrid, label: `${categories.length} ${categories.length === 1 ? "area" : "areas"}` },
    { icon: Monitor, label: "Online & in person" },
  ];
  return (
    <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] font-medium text-ink-2" aria-label="At a glance">
      {facts.map((f) => (
        <li key={f.label} className="inline-flex items-center gap-2">
          <f.icon className="size-4 text-brand" aria-hidden /> {f.label}
        </li>
      ))}
    </ul>
  );
}

export function AreaMosaic() {
  const catalog = useCatalog();
  const withPhotos = catalog.categories.filter((c) => AREA_PHOTOS.has(c.slug));
  const picks = [...MOSAIC.map((slug) => withPhotos.find((c) => c.slug === slug)).filter((c): c is SubjectCategory => !!c), ...withPhotos.filter((c) => !MOSAIC.includes(c.slug))].slice(0, 4);
  if (picks.length < 2) return null;
  return (
    <ul className="grid grid-cols-2 gap-3" aria-label="Popular areas">
      {picks.map((c, i) => (
        <li key={c.slug} className={i % 2 ? "translate-y-6" : ""}>
          <a href={`#${c.slug}`} className="group relative block aspect-[4/3.4] overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_18px_40px_-28px_rgb(15_23_42/0.5)]">
            <Image src={`/images/subject-areas/${c.slug}.jpg`} alt="" fill preload={i < 2} sizes="(min-width: 1024px) 280px, 45vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/80 to-transparent p-4 pt-12">
              <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-white">
                <CategoryIcon slug={c.slug} className="size-4" /> {c.name}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-white/75">{catalog.subjects.filter((s) => s.category === c.slug).length} subjects</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function SubjectAreas() {
  const catalog = useCatalog();
  const tutors = useListedTutors();
  if (catalog.categories.length === 0)
    return (
      <Section>
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-heading text-[24px] font-bold tracking-[-0.02em] text-ink">Subjects are coming soon</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted">
            We&rsquo;re adding the subjects our tutors teach. Meanwhile, post what you need and tutors can apply.
          </p>
        </div>
      </Section>
    );
  return (
    <>
      <AreaNav areas={catalog.categories.map((c) => ({ slug: c.slug, name: c.name }))} />

      <Section>
        <div className="space-y-16 lg:space-y-20">
          {catalog.categories.map((c, i) => {
            const subjects = catalog.subjects.filter((s) => s.category === c.slug);
            const slugs = new Set(subjects.map((s) => s.slug));
            const tutorCount = tutors.filter((t) => t.subjects.some((s) => slugs.has(s))).length;
            return (
              <section key={c.slug} id={c.slug} aria-labelledby={`${c.slug}-title`} className="grid scroll-mt-40 gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10">
                {/* Area card */}
                <Reveal className="self-start lg:sticky lg:top-40">
                  <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <div className="relative aspect-[16/9] bg-canvas">
                      {AREA_PHOTOS.has(c.slug) ? (
                        <Image src={`/images/subject-areas/${c.slug}.jpg`} alt="" fill sizes="(min-width: 1024px) 340px, 100vw" className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center bg-brand-soft">
                          <CategoryIcon slug={c.slug} className="size-14 text-brand" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-md bg-surface/95 px-2 py-1 font-heading text-[12px] font-bold tabular-nums text-ink shadow-sm">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-on-brand">
                          <CategoryIcon slug={c.slug} className="size-5" />
                        </span>
                        <h2 id={`${c.slug}-title`} className="font-heading text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
                          {c.name}
                        </h2>
                      </div>
                      {c.description && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{c.description}</p>}
                      <p className="mt-4 border-t border-line pt-4 text-[13.5px] tabular-nums text-muted">
                        <span className="font-semibold text-ink">{subjects.length}</span> subjects
                        {tutorCount > 0 && (
                          <>
                            {" · "}
                            <span className="font-semibold text-ink">{tutorCount}</span> {tutorCount === 1 ? "tutor" : "tutors"}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </Reveal>

                {/* Subjects in this area */}
                {subjects.length > 0 ? (
                  <Stagger className="grid content-start gap-3 sm:grid-cols-2" stagger={0.04}>
                    {subjects.map((s) => (
                      <StaggerItem key={s.slug} className="h-full">
                        <SubjectTile subject={s} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                ) : (
                  <p className="self-start rounded-xl border border-dashed border-line-strong p-6 text-[14.5px] text-muted">Subjects for this area are coming soon.</p>
                )}
              </section>
            );
          })}
        </div>
      </Section>
    </>
  );
}

/** A hand-picked set of subject tiles (e.g. the student page's list), skipping any an admin has hidden or removed. */
export function SubjectTileGrid({ slugs, className }: { slugs: string[]; className?: string }) {
  const catalog = useCatalog();
  const picked = slugs.map((slug) => catalog.subjects.find((s) => s.slug === slug)).filter((s) => !!s);
  // None of the hand-picked subjects exist (e.g. the owner built their own list): show the first few instead.
  const shown = picked.length ? picked : catalog.subjects.slice(0, 8);
  if (shown.length === 0) return <p className="text-[15px] text-muted">Subjects are being added. You can already browse tutors and post what you need.</p>;
  return (
    <Stagger className={className} stagger={0.04}>
      {shown.map((s) => (
        <StaggerItem key={s.slug} className="h-full">
          <SubjectTile subject={s} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** Live count of shown subjects or areas, for figures on server-rendered pages. */
export function CatalogCount({ of }: { of: "subjects" | "areas" }) {
  const { subjects, categories } = useCatalog();
  return <>{of === "subjects" ? subjects.length : categories.length}</>;
}
