"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, CalendarDays, Check, MapPin, Monitor, Repeat, Users } from "lucide-react";
import type { ApplicationStatus, Requirement, Role } from "@/lib/types";
import { GRADE_LABEL, subjectName } from "@/lib/data/catalog";
import { formatDate, pluralize } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Overlay";
import { motion } from "@/components/motion";
import { MatchBar } from "@/components/concierge/MatchVisuals";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUS_META, budgetRange, locationLabel, modesLabel, postedAgo, postedByLabel, scheduleSummary } from "./jobUtils";

export interface JobCardProps {
  job: Requirement;
  ownerRole?: Role;
  applicants: number;
  now: number;
  applied?: ApplicationStatus;
  saved: boolean;
  onToggleSave: () => void;
  match?: number | null;
  distance?: number | null;
}

export function JobCard({ job, ownerRole, applicants, now, applied, saved, onToggleSave, match, distance }: JobCardProps) {
  const posted = job.publishedAt ?? job.createdAt;
  const inPersonOnly = job.modes.length === 1 && job.modes[0] === "in_person";
  return (
    <article data-spotlight className="group relative rounded-2xl border border-line bg-surface p-5 transition-colors duration-200 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
            <span className="font-semibold text-ink">{subjectName(job.subject)}</span>
            <span className="text-subtle" aria-hidden>·</span>
            <span className="text-muted">{GRADE_LABEL[job.grade]}</span>
            {applied && (
              <Badge tone={APPLICATION_STATUS_META[applied].tone === "neutral" ? "neutral" : "accent"} size="sm" className="ml-1">
                <Check aria-hidden /> {applied === "applied" ? "Applied" : `Applied · ${APPLICATION_STATUS_META[applied].label}`}
              </Badge>
            )}
            {saved && (
              <Badge tone="neutral" size="sm">
                <Bookmark aria-hidden /> Saved
              </Badge>
            )}
          </div>
          <h3 className="mt-1.5 font-heading text-[19px] font-extrabold leading-snug tracking-[-0.02em] text-ink">
            <Link href={`/tutor-jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none group-focus-within:underline group-focus-within:decoration-2 group-focus-within:underline-offset-4">
              {job.title}
            </Link>
          </h3>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-3">
          {match != null && (
            <div className="hidden w-20 text-right sm:block">
              <p className="text-[13px] font-bold tabular-nums text-ink">
                {match}% <span className="font-normal text-muted">match</span>
              </p>
              <MatchBar value={match} className="mt-1" />
            </div>
          )}
          <Tooltip content={saved ? "Remove from saved jobs" : "Save job"}>
            <button
              type="button"
              onClick={onToggleSave}
              aria-pressed={saved}
              aria-label={saved ? `Remove “${job.title}” from saved jobs` : `Save “${job.title}”`}
              className="-mr-1.5 -mt-1 grid size-10 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <motion.span key={String(saved)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}>
                <Bookmark className={cn("size-[18px]", saved && "fill-brand text-brand")} />
              </motion.span>
            </button>
          </Tooltip>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{job.objectives}</p>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink-2">
        <li className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5 text-subtle" aria-hidden />
          {locationLabel(job)}
          {distance != null && <span className="text-muted">· {distance < 1 ? "<1" : Math.round(distance)} mi</span>}
        </li>
        <li className="inline-flex items-center gap-1.5">
          {inPersonOnly ? <Users className="size-3.5 text-subtle" aria-hidden /> : <Monitor className="size-3.5 text-subtle" aria-hidden />}
          {modesLabel(job.modes)}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5 text-subtle" aria-hidden />
          {scheduleSummary(job)}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Repeat className="size-3.5 text-subtle" aria-hidden />
          {pluralize(job.sessionsPerWeek, "session")}/week
        </li>
      </ul>

      <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[16px] font-bold tabular-nums tracking-tight text-ink">
          {budgetRange(job)}
          {match != null && <span className="ml-2 text-[13px] font-normal text-muted sm:hidden">· {match}% match</span>}
        </p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
          <span>{postedByLabel(ownerRole)}</span>
          <span aria-hidden>·</span>
          <time dateTime={posted} title={formatDate(posted)}>{postedAgo(posted, now)}</time>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{applicants === 0 ? "No applicants yet" : pluralize(applicants, "applicant")}</span>
        </p>
      </div>
    </article>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-hidden>
      <div className="skeleton h-3.5 w-40" />
      <div className="skeleton mt-3 h-5 w-3/4" />
      <div className="skeleton mt-4 h-3.5 w-full" />
      <div className="skeleton mt-2 h-3.5 w-2/3" />
      <div className="mt-5 flex gap-3">
        <div className="skeleton h-3.5 w-24" />
        <div className="skeleton h-3.5 w-28" />
        <div className="skeleton h-3.5 w-32" />
      </div>
      <div className="mt-5 flex justify-between border-t border-line pt-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-3.5 w-44" />
      </div>
    </div>
  );
}
