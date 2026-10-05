"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Heart, MessageSquare, ShieldCheck, Wallet, Zap } from "lucide-react";
import type { BookingType, Tutor } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { subjectName } from "@/lib/data/catalog";
import { formatCents, formatDuration, formatTime, formatWeekdayDate, tzAbbrev } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { Select } from "@/components/ui/Input";
import { StarRating } from "@/components/ui/StarRating";
import { BookingCalendar } from "@/components/domain/BookingCalendar";
import { useTutorActions } from "@/components/domain/useTutorActions";
import { WalletDrawer, formatCredits } from "@/components/wallet/WalletDrawer";

/** What the learner has chosen in the booking panel so far. */
export interface BookingSelection {
  type: BookingType;
  /** Minutes of a regular lesson (a trial has its own fixed length). */
  duration: number;
  subject: string;
  startUtc: string | null;
}

export function trialText(tutor: Tutor): string {
  return `${tutor.trial.priceCents === 0 ? "Free" : formatCents(tutor.trial.priceCents)} ${tutor.trial.durationMin}-min trial`;
}

const money = (cents: number) => (cents === 0 ? "Free" : formatCents(cents, { exact: cents % 100 !== 0 }));

/**
 * Booking, right on the profile: pick a lesson length, a day and a start time, and the total is
 * always in view. From here it is one tap with Study Credits, or one step to the checkout drawer.
 */
export function BookingPanel({
  tutor,
  instant,
  trialAvailable,
  type,
  minutes,
  total,
  selection,
  onSelect,
  oneTap,
  canUseWallet,
  balance,
  booking,
  onQuickBook,
  onCheckout,
}: {
  tutor: Tutor;
  instant: boolean;
  trialAvailable: boolean;
  /** The lesson type in effect (a trial falls back to a regular lesson when it isn't available). */
  type: BookingType;
  minutes: number;
  total: number;
  selection: BookingSelection;
  onSelect: (patch: Partial<BookingSelection>) => void;
  /** Signed in, nothing left to ask, and enough Study Credits for this lesson. */
  oneTap: boolean;
  /** A signed-in student or parent: show the wallet hint. */
  canUseWallet: boolean;
  balance: number;
  booking: boolean;
  onQuickBook: () => void;
  onCheckout: () => void;
}) {
  const actions = useTutorActions(tutor);
  const tz = useViewerTimezone();
  const policy = useApp((s) => s.policy);
  const [walletOpen, setWalletOpen] = React.useState(false);
  const onTime = React.useCallback((startUtc: string | null) => onSelect({ startUtc }), [onSelect]);
  const lengths = tutor.rules.sessionLengths;
  const start = selection.startUtc;
  const end = start ? new Date(new Date(start).getTime() + minutes * 60_000).toISOString() : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
      data-lenis-prevent
      className="glass-card scrollbar-none rounded-3xl p-5 sm:p-6 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink">
          <span className="font-heading text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums">{formatCents(tutor.hourlyRateCents)}</span>
          <span className="text-sm text-muted"> / hour</span>
        </p>
        <StarRating rating={tutor.rating} count={tutor.reviewCount} showStars={false} className="mt-1.5 shrink-0" />
      </div>

      <div className="mt-5 space-y-4">
        {trialAvailable && (
          <Segmented<BookingType>
            label="Lesson type"
            className="flex h-11 w-full items-center [&>button]:flex-1 [&>button]:justify-center"
            value={type}
            onChange={(v) => onSelect({ type: v, startUtc: null })}
            options={[
              { value: "trial", label: trialText(tutor) },
              { value: "regular", label: "Lesson" },
            ]}
          />
        )}

        {(type === "regular" && lengths.length > 1) || tutor.subjects.length > 1 ? (
          <div className="grid grid-cols-2 gap-3">
            {type === "regular" && lengths.length > 1 && (
              <div className={cn(tutor.subjects.length > 1 ? "col-span-2 sm:col-span-1 lg:col-span-2" : "col-span-2")}>
                <p className="mb-1.5 text-[13px] font-medium text-ink">Length</p>
                <Segmented
                  label="Lesson length"
                  className="flex h-10 w-full items-center [&>button]:flex-1 [&>button]:justify-center"
                  value={String(selection.duration)}
                  onChange={(v) => onSelect({ duration: Number(v), startUtc: null })}
                  options={lengths.map((m) => ({ value: String(m), label: `${m} min` }))}
                />
              </div>
            )}
            {tutor.subjects.length > 1 && (
              <label className={cn("block", type === "regular" && lengths.length > 1 ? "col-span-2 sm:col-span-1 lg:col-span-2" : "col-span-2")}>
                <span className="mb-1.5 block text-[13px] font-medium text-ink">Subject</span>
                <Select value={selection.subject} onChange={(e) => onSelect({ subject: e.target.value })} options={tutor.subjects.map((s) => ({ value: s, label: subjectName(s) }))} />
              </label>
            )}
          </div>
        ) : null}
      </div>

      <BookingCalendar tutor={tutor} durationMin={minutes} value={start} onChange={onTime} className="mt-5 border-t border-line pt-5" />

      {/* The total is always visible; it follows the lesson type and length straight away. */}
      <div className="mt-5 rounded-2xl border border-line bg-canvas/70 p-4" aria-live="polite">
        {start && end ? (
          <p className="text-[13.5px] leading-snug text-ink-2">
            <span className="block font-semibold text-ink">{formatWeekdayDate(start, tz)}</span>
            <span className="tabular-nums">
              {formatTime(start, tz)} – {formatTime(end, tz)} {tzAbbrev(tz, new Date(start))}
            </span>
          </p>
        ) : (
          <p className="text-[13.5px] leading-snug text-muted">Pick a day and a start time. No charge until you confirm.</p>
        )}
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
          <span className="text-[13.5px] text-muted">{type === "trial" ? `Trial lesson · ${formatDuration(minutes)}` : `${formatDuration(minutes)} at ${formatCents(tutor.hourlyRateCents)}/hr`}</span>
          <span className="font-heading text-[1.7rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">{money(total)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {oneTap ? (
          <>
            <Button size="lg" variant="cta" className="w-full" onClick={onQuickBook} loading={booking}>
              {booking ? (
                "Booking…"
              ) : (
                <>
                  <Zap className="fill-current" /> Book in one tap · {money(total)}
                </>
              )}
            </Button>
            <p className="text-center text-[12.5px] leading-snug text-muted">
              Paid from your Study Credits ({formatCredits(balance)}). By booking you agree to the cancellation policy and{" "}
              <Link href="/terms" target="_blank" className="font-medium text-ink underline underline-offset-2">
                Terms
              </Link>
              .
            </p>
            <Button variant="ghost" className="w-full" onClick={onCheckout} disabled={booking}>
              Other ways to pay
            </Button>
          </>
        ) : (
          <Button size="lg" variant="cta" className="w-full" onClick={onCheckout} disabled={!start}>
            {start ? (
              <>
                {total === 0 ? "Continue" : "Continue to checkout"} <ArrowRight />
              </>
            ) : (
              "Pick a date and time"
            )}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={actions.contact}>
            <MessageSquare /> Message
          </Button>
          <Button variant="ghost" onClick={actions.toggleSave} aria-pressed={actions.saved}>
            <Heart className={cn(actions.saved && "fill-ink text-ink")} /> {actions.saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5 border-t border-line pt-4 text-[13px] leading-snug text-ink-2">
        <li className="flex items-start gap-2.5">
          {instant ? <Zap className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> : <Clock3 className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />}
          {instant
            ? "Instant booking — confirmed immediately"
            : tutor.responseTimeHours != null
              ? `${tutor.firstName} confirms requests, usually within ${tutor.responseTimeHours} ${tutor.responseTimeHours === 1 ? "hour" : "hours"}`
              : `${tutor.firstName} confirms each request before it's booked`}
        </li>
        <li className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
          Free cancellation up to {policy.freeCancellationHours} hours before a lesson
        </li>
        {canUseWallet && !oneTap && (
          <li className="flex items-start gap-2.5">
            <Wallet className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
            <span>
              {formatCredits(balance)} in Study Credits.{" "}
              <button type="button" onClick={() => setWalletOpen(true)} className="font-medium text-brand underline-offset-2 hover:underline">
                Add credits to book in one tap
              </button>
            </span>
          </li>
        )}
      </ul>
      {canUseWallet && <WalletDrawer open={walletOpen} onOpenChange={setWalletOpen} />}
    </motion.div>
  );
}

/** Sticky total + primary action for phones. The calendar itself sits inline above the sections. */
export function MobileBookingBar({ tutor, type, total, hasTime, onPickTime, onCheckout }: { tutor: Tutor; type: BookingType; total: number; hasTime: boolean; onPickTime: () => void; onCheckout: () => void }) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
      data-fixed-bottom
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
      role="region"
      aria-label={`Book ${tutor.firstName}`}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight tracking-tight tabular-nums text-ink">
            {hasTime ? money(total) : formatCents(tutor.hourlyRateCents)}
            {!hasTime && <span className="text-sm font-normal text-muted">/hr</span>}
          </p>
          <p className="truncate text-[12.5px] text-muted">{hasTime ? (type === "trial" ? "Trial lesson · time chosen" : "Lesson · time chosen") : `${tutor.firstName} ${tutor.lastName}`}</p>
        </div>
        <Button size="lg" variant="cta" onClick={hasTime ? onCheckout : onPickTime} className="shrink-0">
          {hasTime ? "Checkout" : "Pick a time"}
        </Button>
      </div>
    </motion.div>
  );
}
