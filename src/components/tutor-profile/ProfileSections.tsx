"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Check, GraduationCap, HeartHandshake, ScrollText, Sparkles } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { LEVELS, SUBJECT_BY_SLUG, SUBJECT_CATEGORIES, subjectName, TUTOR_CATEGORY_LABEL } from "@/lib/data/catalog";
import { formatCents, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";

export function ProfileSection({ id, title, description, children, className }: { id: string; title: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-32 border-b border-line py-10 last:border-b-0 sm:py-12", className)}>
      <Reveal y={12} amount={0.1}>
        <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-[-0.02em] text-ink sm:text-[22px]">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </Reveal>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ─── About ─────────────────────────────────────────────────────────────────── */

export function AboutSection({ tutor }: { tutor: Tutor }) {
  return (
    <ProfileSection id="about" title={`About ${tutor.firstName}`}>
      <Reveal y={10} amount={0.1}>
        <p className="max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-2 sm:text-base">{tutor.bio}</p>
      </Reveal>
      <Reveal y={10} delay={0.05} amount={0.1}>
        <div data-spotlight className="mt-8 rounded-xl border border-line bg-canvas p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Sparkles className="size-4 text-navy" aria-hidden /> Teaching approach
          </h3>
          <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{tutor.approach}</p>
        </div>
      </Reveal>
      {tutor.specialties.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-ink">Specialties</h3>
          <Stagger as="ul" className="mt-3 grid gap-2.5 sm:grid-cols-2" stagger={0.05}>
            {tutor.specialties.map((s) => (
              <StaggerItem as="li" key={s} className="flex items-start gap-2.5 text-[15px] text-ink-2">
                <span className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-navy-50 text-navy">
                  <Check className="size-2.5" strokeWidth={3} aria-hidden />
                </span>
                {s}
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      )}
      {tutor.trial.enabled && (
        <Reveal y={10} amount={0.1}>
          <div data-spotlight className="mt-8 flex items-start gap-3 rounded-xl border border-line px-5 py-4">
            <HeartHandshake className="mt-0.5 size-[18px] shrink-0 text-navy" aria-hidden />
            <div className="text-sm">
              <p className="font-medium text-ink">
                {tutor.trial.priceCents === 0 ? "Free" : formatCents(tutor.trial.priceCents)} {tutor.trial.durationMin}-minute trial lesson
              </p>
              <p className="mt-0.5 leading-relaxed text-muted">{tutor.trial.notes ?? `A short first lesson to meet ${tutor.firstName} and agree on goals before committing.`}</p>
            </div>
          </div>
        </Reveal>
      )}
    </ProfileSection>
  );
}

/* ─── Subjects & levels ─────────────────────────────────────────────────────── */

export function SubjectsSection({ tutor }: { tutor: Tutor }) {
  const byCategory = SUBJECT_CATEGORIES.map((c) => ({ category: c, subjects: tutor.subjects.filter((s) => SUBJECT_BY_SLUG[s]?.category === c.slug) })).filter((g) => g.subjects.length);
  const unknown = tutor.subjects.filter((s) => !SUBJECT_BY_SLUG[s]);
  const levels = LEVELS.filter((l) => tutor.levels.includes(l.value));
  return (
    <ProfileSection id="subjects" title="Subjects & levels">
      <Stagger className="grid gap-3 sm:grid-cols-2" stagger={0.05}>
        {byCategory.flatMap((g) =>
          g.subjects.map((s) => (
            <StaggerItem key={s}>
              <Link
                href={`/subjects/${s}`}
                data-spotlight className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-sm"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{subjectName(s)}</span>
                  <span className="block text-[13px] text-muted">{g.category.name}</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-subtle transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-navy" aria-hidden />
              </Link>
            </StaggerItem>
          )),
        )}
        {unknown.map((s) => (
          <StaggerItem key={s}>
            <div data-spotlight className="rounded-xl border border-line px-4 py-3.5 text-[15px] font-medium text-ink">{s}</div>
          </StaggerItem>
        ))}
      </Stagger>

      <dl className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-ink">Levels taught</dt>
          <dd className="mt-2.5 flex flex-wrap gap-1.5">
            {levels.map((l) => (
              <Badge key={l.value} tone="neutral">
                {l.label}
              </Badge>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-ink">Tutor category</dt>
          <dd className="mt-2.5">
            <Badge tone="outline">{TUTOR_CATEGORY_LABEL[tutor.category]}</Badge>
          </dd>
        </div>
        {tutor.learningSupport.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-sm font-semibold text-ink">Experience supporting</dt>
            <dd className="mt-2.5 flex flex-wrap gap-1.5">
              {tutor.learningSupport.map((s) => (
                <Badge key={s} tone="neutral">
                  {s}
                </Badge>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </ProfileSection>
  );
}

/* ─── Experience, education & certifications ────────────────────────────────── */

function VerifiedMark() {
  return (
    <Badge tone="success" size="sm" className="shrink-0">
      <BadgeCheck /> Verified
    </Badge>
  );
}

function SelfReported() {
  return <span className="shrink-0 text-[12px] text-muted">Self-reported</span>;
}

export function ExperienceSection({ tutor }: { tutor: Tutor }) {
  const educationVerified = tutor.verification.education === "verified";
  const certificationVerified = tutor.verification.certification === "verified";
  const stats = [
    { label: "Years teaching", value: String(tutor.experienceYears) },
    ...(tutor.lessonsCompleted > 0 ? [{ label: "Lessons completed", value: tutor.lessonsCompleted.toLocaleString("en-US") }] : []),
    { label: "On TutorLink since", value: formatDate(tutor.joinedAt, "UTC", { month: "short", year: "numeric" }) },
  ];

  return (
    <ProfileSection id="experience" title="Experience & credentials" description="A “Verified” mark means our team reviewed the documents for that item.">
      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3" stagger={0.06}>
        {stats.map((s) => (
          <StaggerItem key={s.label} className="rounded-xl border border-line bg-canvas px-4 py-3.5">
            <p className="text-[22px] font-semibold tracking-tight tabular-nums text-ink">{s.value}</p>
            <p className="text-[13px] text-muted">{s.label}</p>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <GraduationCap className="size-4 text-navy" aria-hidden /> Education
          </h3>
          {tutor.education.length ? (
            <ul className="mt-3 space-y-2.5">
              {tutor.education.map((e) => (
                <li key={`${e.degree}-${e.institution}-${e.year}`} data-spotlight className="flex items-start justify-between gap-3 rounded-xl border border-line px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">
                      {e.degree} in {e.field}
                    </p>
                    <p className="text-[13px] text-muted">
                      {e.institution} · {e.year}
                    </p>
                  </div>
                  {e.verified && educationVerified ? <VerifiedMark /> : <SelfReported />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No education listed yet.</p>
          )}
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ScrollText className="size-4 text-navy" aria-hidden /> Certifications
          </h3>
          {tutor.certifications.length ? (
            <ul className="mt-3 space-y-2.5">
              {tutor.certifications.map((c) => (
                <li key={`${c.name}-${c.year}`} data-spotlight className="flex items-start justify-between gap-3 rounded-xl border border-line px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">{c.name}</p>
                    <p className="text-[13px] text-muted">
                      {c.issuer} · {c.year}
                    </p>
                  </div>
                  {c.verified && certificationVerified ? <VerifiedMark /> : <SelfReported />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No teaching certifications listed.</p>
          )}
        </div>
      </div>
    </ProfileSection>
  );
}
