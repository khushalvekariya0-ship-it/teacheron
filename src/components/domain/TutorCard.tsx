"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, CalendarClock, Check, GitCompareArrows, GraduationCap, Heart, MapPin, MessageSquare, Monitor, Star, Users as UsersIcon, Zap } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Overlay";
import { VerifiedBadge } from "./Badges";
import { useTutorActions } from "./useTutorActions";
import { subjectName, LEVEL_LABEL } from "@/lib/data/catalog";
import { formatCents, formatDateTime } from "@/lib/format";
import { useApp } from "@/lib/store";
import { useHydrated, useViewerTimezone } from "@/lib/store/hooks";
import { nextOpening } from "@/lib/time";

function useNextOpening(tutor: Tutor) {
  const hydrated = useHydrated();
  const bookings = useApp((s) => s.bookings);
  const tz = useViewerTimezone();
  return React.useMemo(() => (hydrated ? nextOpening(tutor, bookings, tz) : undefined), [hydrated, tutor, bookings, tz]);
}

function ModeLine({ tutor }: { tutor: Tutor }) {
  const online = tutor.modes.includes("online");
  const inPerson = tutor.modes.includes("in_person");
  return (
    <span className="inline-flex items-center gap-1.5">
      {online && !inPerson && <Monitor className="size-3.5" aria-hidden />}
      {online && inPerson ? "Online & in person" : online ? "Online only" : "In person only"}
    </span>
  );
}

export interface TutorCardProps {
  tutor: Tutor;
  layout?: "grid" | "row";
  /** Optional distance from the searched location, in miles. */
  distance?: number | null;
  /** Optional match content (concierge). */
  footer?: React.ReactNode;
  className?: string;
}

export function TutorCard({ tutor, layout = "grid", distance, footer, className }: TutorCardProps) {
  const actions = useTutorActions(tutor);
  const opening = useNextOpening(tutor);
  const tz = useViewerTimezone();
  const name = `${tutor.firstName} ${tutor.lastName}`;
  const instant = !tutor.rules.requiresApproval;

  const saveBtn = (
    <Tooltip content={actions.saved ? "Remove from favorites" : "Save to favorites"}>
      <button
        type="button"
        onClick={actions.toggleSave}
        aria-pressed={actions.saved}
        aria-label={actions.saved ? `Remove ${name} from favorites` : `Save ${name}`}
        className="grid size-10 place-items-center rounded-lg text-ink transition-colors hover:bg-canvas"
      >
        <motion.span key={String(actions.saved)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}>
          <Heart className={cn("size-5", actions.saved && "fill-brand text-brand")} strokeWidth={2.2} />
        </motion.span>
      </button>
    </Tooltip>
  );

  const compareBtn = (
    <button
      type="button"
      onClick={actions.toggleCompare}
      aria-pressed={actions.comparing}
      disabled={actions.compareFull}
      title={actions.compareFull ? "You can compare up to 3 tutors" : undefined}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        actions.comparing ? "bg-ink text-on-ink" : "text-ink hover:bg-canvas",
      )}
    >
      {actions.comparing ? <Check className="size-4" /> : <GitCompareArrows className="size-4" />}
      {actions.comparing ? "Comparing" : "Compare"}
    </button>
  );

  const availability = (
    <span className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-2">
      <CalendarClock className="size-4" aria-hidden />
      {opening === undefined ? <span className="skeleton inline-block h-3 w-28" /> : opening ? <>Next opening <span className="font-semibold text-ink">{formatDateTime(opening.startUtc, tz)}</span></> : "No openings in the next 2 weeks"}
    </span>
  );

  const reviews = `${tutor.reviewCount} ${tutor.reviewCount === 1 ? "review" : "reviews"}`;
  const rating = (
    <span className="inline-flex items-center gap-1 text-ink">
      <Star className="size-4 fill-star text-star" aria-hidden />
      {tutor.rating !== null ? (
        <>
          <span className="font-heading text-[19px] font-bold">{tutor.rating.toFixed(1)}</span>
          <span className="sr-only">out of 5</span>
        </>
      ) : (
        <span className="text-[14px] font-semibold">New</span>
      )}
    </span>
  );
  const price = (
    <>
      <p className="font-heading text-[19px] font-bold text-ink">{formatCents(tutor.hourlyRateCents)}</p>
      <p className="text-[12.5px] text-muted">per hour</p>
    </>
  );
  const bookBtn = (className?: string) =>
    tutor.trial.enabled ? (
      <Button variant="brand" onClick={actions.bookTrial} className={className}>
        Book trial lesson
      </Button>
    ) : (
      <Button variant="brand" onClick={actions.book} className={className}>
        Book lesson
      </Button>
    );

  if (layout === "row") {
    return (
      <article data-spotlight className={cn("group relative rounded-2xl border border-line bg-surface p-4 transition-colors duration-200 sm:p-5", className)}>
        <div className="flex gap-4 sm:gap-6">
          <Link href={`/tutors/${tutor.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
            <Avatar name={name} tone={tutor.tone} size="xl" square className="sm:hidden" />
            <Avatar name={name} tone={tutor.tone} size="3xl" square className="hidden sm:inline-flex" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-heading text-[20px] font-bold tracking-[-0.02em] text-ink sm:text-[22px]">
                <Link href={`/tutors/${tutor.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                  {name}
                </Link>
              </h3>
              {tutor.verification.identity === "verified" && <BadgeCheck className="size-5 fill-brand text-surface" aria-label="Identity verified" />}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <VerifiedBadge tutor={tutor} size="sm" />
              {instant && (
                <Badge tone="neutral" size="sm">
                  <Zap /> Instant booking
                </Badge>
              )}
            </div>
            <p className="mt-2.5 flex items-center gap-2 text-[15px] font-medium text-ink">
              <GraduationCap className="size-[18px] shrink-0" aria-hidden />
              <span className="line-clamp-1">{tutor.headline}</span>
            </p>
            <ul className="mt-1.5 space-y-1 text-[14px] text-ink-2">
              <li className="flex items-center gap-2">
                <UsersIcon className="size-4 shrink-0" aria-hidden /> {tutor.lessonsCompleted} lessons · {tutor.experienceYears} yrs experience
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span>
                  {tutor.city}, {tutor.state} · <ModeLine tutor={tutor} />
                  {distance != null && tutor.modes.includes("in_person") && <span className="text-muted"> · {distance < 1 ? "<1" : Math.round(distance)} mi</span>}
                </span>
              </li>
            </ul>
            <p className="mt-3 hidden text-[14.5px] leading-relaxed text-ink-2 sm:line-clamp-2">{tutor.bio}</p>
            <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
              {tutor.subjects.slice(0, 4).map((s) => (
                <Badge key={s} tone="neutral" size="sm">
                  {subjectName(s)}
                </Badge>
              ))}
              {tutor.levels.slice(0, 3).map((l) => (
                <Badge key={l} tone="outline" size="sm">
                  {LEVEL_LABEL[l]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Desktop: rating, price and actions in a right-hand column */}
          <div className="relative z-10 hidden w-56 shrink-0 flex-col lg:flex">
            <div className="flex items-start justify-between">
              <div>
                {rating}
                <p className="text-[12.5px] text-muted">{reviews}</p>
              </div>
              <div className="text-right">{price}</div>
            </div>
            <div className="mt-auto space-y-2 pt-4">
              {bookBtn("w-full")}
              <Button variant="secondary" onClick={actions.contact} className="w-full">
                <MessageSquare /> Send message
              </Button>
            </div>
          </div>
        </div>

        {/* Phones and tablets: rating/price row, then full-width actions */}
        <div className="relative z-10 mt-4 flex items-center justify-between gap-3 lg:hidden">
          <div className="flex items-center gap-5">
            <div>
              {rating}
              <p className="text-[12px] text-muted">{reviews}</p>
            </div>
            <div>{price}</div>
          </div>
          {saveBtn}
        </div>
        <div className="relative z-10 mt-3 grid gap-2 sm:grid-cols-2 lg:hidden">
          {bookBtn("h-12")}
          <Button variant="secondary" onClick={actions.contact} className="h-12">
            <MessageSquare /> Send message
          </Button>
        </div>

        <div className="relative z-10 mt-4 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex flex-col gap-0.5">
            {availability}
            {tutor.trial.enabled && (
              <span className="text-[13px] text-muted">
                {tutor.trial.priceCents === 0 ? "Free" : formatCents(tutor.trial.priceCents)} {tutor.trial.durationMin}-min trial
              </span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <span className="hidden lg:inline-flex">{saveBtn}</span>
            {compareBtn}
          </div>
        </div>
        {footer && <div className="relative z-10 mt-4">{footer}</div>}
      </article>
    );
  }

  return (
    <article data-spotlight className={cn("group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-colors duration-200", className)}>
      <div className="relative">
        <div className="aspect-[4/3] overflow-hidden rounded-xl">
          <Avatar name={name} tone={tutor.tone} size="3xl" square className="size-full [&>span]:!size-full [&>span]:!rounded-none" />
        </div>
        <div className="absolute right-1.5 top-1.5 z-10 rounded-lg bg-surface/90">{saveBtn}</div>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        <h3 className="font-heading text-[18px] font-bold tracking-[-0.02em] text-ink">
          <Link href={`/tutors/${tutor.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {name}
          </Link>
        </h3>
        {tutor.verification.identity === "verified" && <BadgeCheck className="size-[18px] fill-brand text-surface" aria-label="Identity verified" />}
      </div>
      <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-ink-2">{tutor.headline}</p>
      <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
        <MapPin className="size-3.5" aria-hidden /> {tutor.city}, {tutor.state} · <ModeLine tutor={tutor} />
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tutor.subjects.slice(0, 3).map((s) => (
          <Badge key={s} tone="neutral" size="sm">
            {subjectName(s)}
          </Badge>
        ))}
      </div>
      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between border-t border-line pt-3">
          <div className="flex items-center gap-5">
            <div>
              {rating}
              <p className="text-[12px] text-muted">{reviews}</p>
            </div>
            <div>{price}</div>
          </div>
          <div className="relative z-10">{compareBtn}</div>
        </div>
        {footer && <div className="relative z-10 mt-4">{footer}</div>}
      </div>
    </article>
  );
}
