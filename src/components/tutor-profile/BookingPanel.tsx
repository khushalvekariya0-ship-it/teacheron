"use client";

import * as React from "react";
import { CalendarClock, Clock3, Heart, Lock, MessageSquare, ShieldCheck, Zap } from "lucide-react";
import type { BookingType, Tutor } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { formatCents, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StarRating } from "@/components/ui/StarRating";
import { useTutorActions } from "@/components/domain/useTutorActions";
import { useNextOpening } from "./useOpening";

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 text-subtle [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

export function trialText(tutor: Tutor): string {
  return `${tutor.trial.priceCents === 0 ? "Free" : formatCents(tutor.trial.priceCents)} ${tutor.trial.durationMin}-min trial`;
}

export function BookingPanel({ tutor, instant, trialOffered, onBook }: { tutor: Tutor; instant: boolean; trialOffered: boolean; onBook: (t: BookingType) => void }) {
  const actions = useTutorActions(tutor);
  const opening = useNextOpening(tutor);
  const tz = useViewerTimezone();
  const policy = useApp((s) => s.policy);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink">
          <span className="font-heading text-[2rem] font-extrabold tracking-[-0.04em] tabular-nums">{formatCents(tutor.hourlyRateCents)}</span>
          <span className="text-sm text-muted"> / hour</span>
        </p>
        <StarRating rating={tutor.rating} count={tutor.reviewCount} showStars={false} className="mt-2 shrink-0" />
      </div>

      {trialOffered && (
        <div className="mt-4 rounded-xl bg-brand-soft px-3.5 py-3">
          <p className="text-sm font-bold text-ink">{trialText(tutor)}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">Meet {tutor.firstName} and agree on a plan before booking regular lessons.</p>
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {trialOffered && (
          <Button size="lg" variant="brand" className="w-full" onClick={() => onBook("trial")}>
            Book trial lesson
          </Button>
        )}
        <Button size="lg" variant={trialOffered ? "secondary" : "primary"} className="w-full" onClick={() => onBook("regular")}>
          Book a lesson
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={actions.contact}>
            <MessageSquare /> Message
          </Button>
          <Button variant="ghost" onClick={actions.toggleSave} aria-pressed={actions.saved}>
            <Heart className={cn(actions.saved && "fill-ink text-ink")} /> {actions.saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <ul className="mt-5 space-y-3 border-t border-line pt-5 text-[13px] leading-snug text-ink-2">
        <Row icon={<CalendarClock />}>
          {opening === undefined ? (
            <Skeleton className="h-4 w-40" />
          ) : opening ? (
            <>
              Next opening <span className="font-medium text-ink">{formatDateTime(opening.startUtc, tz)}</span>
            </>
          ) : (
            "No openings in the next two weeks — message to ask about times"
          )}
        </Row>
        <Row icon={instant ? <Zap /> : <Clock3 />}>
          {instant
            ? "Instant booking — confirmed immediately"
            : tutor.responseTimeHours != null
              ? `Tutor confirms requests, usually within ${tutor.responseTimeHours} ${tutor.responseTimeHours === 1 ? "hour" : "hours"}`
              : `${tutor.firstName} confirms each request before it's booked`}
        </Row>
        <Row icon={<ShieldCheck />}>Free cancellation up to {policy.freeCancellationHours} hours before a lesson</Row>
        <Row icon={<Lock />}>Secure checkout with Stripe. You&rsquo;re not charged until you confirm.</Row>
      </ul>
    </motion.div>
  );
}

/** Sticky price + primary action for phones. The full panel sits inline above the sections. */
export function MobileBookingBar({ tutor, trialOffered, onBook }: { tutor: Tutor; trialOffered: boolean; onBook: (t: BookingType) => void }) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
      data-fixed-bottom className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
      role="region"
      aria-label={`Book ${tutor.firstName}`}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight tracking-tight text-ink">
            {formatCents(tutor.hourlyRateCents)}
            <span className="text-sm font-normal text-muted">/hr</span>
          </p>
          <p className="truncate text-[12.5px] text-muted">{trialOffered ? trialText(tutor) : `${tutor.firstName} ${tutor.lastName}`}</p>
        </div>
        <Button size="lg" variant={trialOffered ? "brand" : "primary"} onClick={() => onBook(trialOffered ? "trial" : "regular")} className="shrink-0">
          {trialOffered ? "Book trial lesson" : "Book a lesson"}
        </Button>
      </div>
    </motion.div>
  );
}
