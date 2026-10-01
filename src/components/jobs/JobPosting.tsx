"use client";

import * as React from "react";
import { CalendarDays, Clock3, GraduationCap, Languages, MapPin, Monitor, Paperclip, ShieldCheck, Users, Wallet } from "lucide-react";
import type { Requirement, Role } from "@/lib/types";
import { GRADE_LABEL, TIMES_OF_DAY, subjectName } from "@/lib/data/catalog";
import { formatDate, pluralize } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { DAY_LONG, DAY_ORDER, budgetRange, locationLabel, modesLabel, postedAgo, postedByLabel, scheduleSummary } from "./jobUtils";

export type JobPostingData = Pick<
  Requirement,
  | "title" | "subject" | "grade" | "objectives" | "modes" | "city" | "state" | "zip" | "days" | "timesOfDay" | "sessionsPerWeek"
  | "budgetMinCents" | "budgetMaxCents" | "minExperienceYears" | "languages" | "preferences" | "details" | "attachments" | "learningSupport"
> & { publishedAt?: string; createdAt?: string };

/** Week strip: selected days are filled, others dashed — shape and text carry meaning, not just color. */
export function WeekStrip({ days, className }: { days: readonly string[]; className?: string }) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      <span className="sr-only">Preferred days: {days.length ? DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_LONG[d]).join(", ") : "flexible"}</span>
      {DAY_ORDER.map((d) => {
        const on = days.includes(d);
        return (
          <span
            key={d}
            aria-hidden
            className={cn(
              "grid h-9 min-w-0 flex-1 place-items-center rounded-md text-[12.5px] font-medium sm:h-10",
              on ? "bg-ink font-semibold text-on-ink" : "border border-dashed border-line-strong text-subtle",
            )}
          >
            {d}
          </span>
        );
      })}
    </div>
  );
}

function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <dt className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.06em] text-muted [&_svg]:size-3.5 [&_svg]:text-subtle">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 text-[16px] font-bold tracking-tight text-ink">{value}</dd>
      {sub && <dd className="mt-0.5 text-[13px] text-muted">{sub}</dd>}
    </div>
  );
}

/**
 * A requirement exactly as tutors see it. Used on the job page and as the wizard's preview step,
 * so families review the real thing before publishing.
 */
export function JobPosting({
  job,
  ownerRole,
  applicants,
  now,
  preview,
  headingLevel = "h1",
  statusBadge,
}: {
  job: JobPostingData;
  ownerRole?: Role;
  applicants?: number;
  now: number;
  preview?: boolean;
  headingLevel?: "h1" | "h2";
  statusBadge?: React.ReactNode;
}) {
  const Title = headingLevel;
  const Section = headingLevel === "h1" ? "h2" : "h3";
  const posted = job.publishedAt ?? job.createdAt;
  const support = job.learningSupport ?? [];
  const attachments = job.attachments ?? [];
  const inPerson = job.modes.includes("in_person");
  const nonEnglish = job.languages.filter((l) => l !== "English");

  return (
    <article>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{job.subject ? subjectName(job.subject) : "Subject"}</Badge>
          <Badge tone="neutral">{GRADE_LABEL[job.grade]}</Badge>
          {statusBadge}
        </div>
        <Title className={cn("mt-4 font-heading font-bold tracking-[-0.025em] text-ink", headingLevel === "h1" ? "text-[2rem] leading-[1.05] sm:text-[2.75rem]" : "text-2xl sm:text-3xl")}>
          {job.title || "Untitled requirement"}
        </Title>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>{postedByLabel(ownerRole)}</span>
          <span aria-hidden className="text-subtle">·</span>
          <span>{preview ? "Posted when you publish" : posted ? <time dateTime={posted} title={formatDate(posted)}>Posted {postedAgo(posted, now)}</time> : "Not yet posted"}</span>
          {applicants !== undefined && (
            <>
              <span aria-hidden className="text-subtle">·</span>
              <span className="tabular-nums">{applicants === 0 ? "No applicants yet" : pluralize(applicants, "applicant")}</span>
            </>
          )}
        </p>
      </header>

      <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        <Fact icon={<Wallet />} label="Budget" value={<span className="tabular-nums">{budgetRange(job)}</span>} />
        <Fact icon={job.modes.length === 1 && inPerson ? <Users /> : <Monitor />} label="Format" value={modesLabel(job.modes)} />
        <Fact icon={<MapPin />} label="Location" value={locationLabel(job)} sub={inPerson && job.zip ? `ZIP ${job.zip}` : undefined} />
        <Fact icon={<CalendarDays />} label="Frequency" value={`${job.sessionsPerWeek}× per week`} />
      </dl>

      <div className="mt-10 space-y-10">
        <section>
          <Section className="font-heading text-lg font-bold tracking-[-0.02em] text-ink">Learning objectives</Section>
          <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{job.objectives || "No objectives written yet."}</p>
          {support.length > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-medium text-muted">Learning support</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {support.map((s) => (
                  <li key={s}>
                    <Badge tone="outline">{s}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <Section className="font-heading text-lg font-bold tracking-[-0.02em] text-ink">Schedule</Section>
          <p className="mt-1 text-sm text-muted">{scheduleSummary(job)} · {pluralize(job.sessionsPerWeek, "session")} per week</p>
          <WeekStrip days={job.days} className="mt-4 max-w-md" />
          <ul className="mt-3 flex flex-wrap gap-2">
            {TIMES_OF_DAY.map((t) => {
              const on = job.timesOfDay.includes(t.value);
              return (
                <li key={t.value} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px]", on ? "border border-brand bg-brand-soft text-ink" : "border border-dashed border-line-strong text-subtle line-through decoration-subtle/60")}>
                  <Clock3 className="size-3.5" aria-hidden />
                  <span className="font-medium">{t.label}</span>
                  <span className={on ? "text-ink-2" : ""}>{t.range}</span>
                  <span className="sr-only">{on ? "(preferred)" : "(not preferred)"}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[13px] text-muted">Times are in the family&apos;s local time zone.</p>
        </section>

        <section>
          <Section className="font-heading text-lg font-bold tracking-[-0.02em] text-ink">Tutor preferences</Section>
          <dl className="mt-3 divide-y divide-line rounded-2xl border border-line">
            <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <dt className="flex items-center gap-2 text-muted"><GraduationCap className="size-4 text-subtle" aria-hidden /> Minimum experience</dt>
              <dd className="text-right font-medium text-ink">{job.minExperienceYears ? `${job.minExperienceYears}+ years` : "No minimum"}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <dt className="flex items-center gap-2 text-muted"><Languages className="size-4 text-subtle" aria-hidden /> Lesson language</dt>
              <dd className="text-right font-medium text-ink">{job.languages.length ? job.languages.join(", ") : "English"}</dd>
            </div>
            {job.preferences.trim() && (
              <div className="px-4 py-3 text-sm">
                <dt className="text-muted">Other preferences</dt>
                <dd className="mt-1 whitespace-pre-line leading-relaxed text-ink-2">{job.preferences}</dd>
              </div>
            )}
          </dl>
          {nonEnglish.length > 0 && <p className="mt-2 text-[13px] text-muted">Tutors who list {nonEnglish.join(" or ")} score higher for this job.</p>}
        </section>

        {(job.details.trim() || attachments.length > 0) && (
          <section>
            <Section className="font-heading text-lg font-bold tracking-[-0.02em] text-ink">Additional details</Section>
            {job.details.trim() && <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{job.details}</p>}
            {attachments.length > 0 && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-2">
                <Paperclip className="size-3.5 text-muted" aria-hidden />
                {pluralize(attachments.length, "file")} attached
              </p>
            )}
          </section>
        )}

        <p className="flex items-start gap-2.5 rounded-xl bg-canvas px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
          For privacy, tutors see only the city{inPerson ? " and ZIP code" : ""} — never the family&apos;s name, email, phone number or street address.
        </p>
      </div>
    </article>
  );
}
