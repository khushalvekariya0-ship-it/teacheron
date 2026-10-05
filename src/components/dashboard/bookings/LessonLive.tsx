"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Clock, Globe, Hourglass, Link2, MapPin, PenLine, ShieldCheck, Timer, Video } from "lucide-react";
import type { Booking } from "@/lib/types";
import { endMs, meetingLinkVisible, startMs } from "@/lib/booking";
import type { BookingPolicy } from "@/lib/data/platform";
import { useNow } from "@/lib/store/hooks";
import { formatDuration, formatRelative, formatTime, formatWeekdayDate } from "@/lib/format";
import { tzOffsetMinutes } from "@/lib/time";
import { MODE_LABEL } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { timeRange, tzShort } from "./shared";

const DAY = 86_400_000;

export function LessonWhenWhere({
  booking: b,
  tz,
  otherTz,
  otherLabel,
  now,
  policy,
  isTutor,
  tutorFirstName,
}: {
  booking: Booking;
  tz: string;
  otherTz?: string;
  otherLabel: string;
  now: number;
  policy: BookingPolicy;
  isTutor: boolean;
  tutorFirstName: string;
}) {
  const start = new Date(b.startUtc);
  const showOther = otherTz && tzOffsetMinutes(otherTz, start) !== tzOffsetMinutes(tz, start);
  const live = ["confirmed", "in_progress"].includes(b.status) && endMs(b) > now;
  const soon = live && startMs(b) - now < DAY;

  return (
    <Card className="overflow-hidden">
      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
        <Item icon={CalendarDays} label="Date">
          {formatWeekdayDate(b.startUtc, tz)}
        </Item>
        <Item icon={Clock} label="Time">
          <span className="tabular-nums">{timeRange(b, tz)}</span> <span className="font-normal text-muted">{tzShort(tz, b.startUtc)}</span>
          {showOther && otherTz && (
            <span className="mt-0.5 flex items-center gap-1 text-[12.5px] font-normal text-muted">
              <Globe className="size-3" aria-hidden />
              <span className="tabular-nums">{timeRange(b, otherTz)}</span> {tzShort(otherTz, b.startUtc)} for {otherLabel}
            </span>
          )}
        </Item>
        <Item icon={Hourglass} label="Duration">
          {formatDuration(b.durationMin)}
        </Item>
        <Item icon={b.mode === "online" ? Video : MapPin} label="Format">
          {MODE_LABEL[b.mode]}
          {b.mode === "online" && <span className="font-normal text-muted"> · TutorLink classroom</span>}
        </Item>
      </dl>

      {b.mode === "in_person" && (
        <div className="border-t border-line bg-canvas px-5 py-4">
          <p className="flex items-start gap-2 text-sm text-ink">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <span>
              <span className="font-medium">Meeting area</span>
              <span className="block text-muted">{b.locationNote ?? "The meeting place is agreed in messages."}</span>
            </span>
          </p>
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] leading-snug text-ink-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
            <span>
              <span className="font-medium text-ink">Safety tip:</span> meet somewhere public, like a library study room, for early sessions. Keep payments on TutorLink, and make sure a parent or guardian knows the plan when the learner is under 18.
            </span>
          </p>
        </div>
      )}

      {b.mode === "online" && <OnlineStrip booking={b} now={now} policy={policy} tz={tz} soon={soon} live={live} isTutor={isTutor} tutorFirstName={tutorFirstName} />}
      {b.mode === "in_person" && live && (
        <div className="border-t border-line px-5 py-4">{soon ? <Countdown booking={b} /> : <p className="text-sm text-muted">Starts {formatRelative(b.startUtc, now)}.</p>}</div>
      )}
    </Card>
  );
}

function Item({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
      </div>
    </div>
  );
}

function OnlineStrip({ booking: b, now, policy, tz, soon, live, isTutor, tutorFirstName }: { booking: Booking; now: number; policy: BookingPolicy; tz: string; soon: boolean; live: boolean; isTutor: boolean; tutorFirstName: string }) {
  const linkAt = new Date(startMs(b) - policy.meetingLinkVisibleMinutesBefore * 60_000).toISOString();
  let body: React.ReactNode = null;
  if (live && soon) body = <LiveJoin booking={b} policy={policy} tz={tz} />;
  else if (live) {
    body = (
      <Explainer icon={Link2}>
        Starts {formatRelative(b.startUtc, now)}. The Join button appears here on {formatWeekdayDate(linkAt, tz)} at {formatTime(linkAt, tz)} — {policy.meetingLinkVisibleMinutesBefore} minutes before the start. <EarlyAccess id={b.id} />
      </Explainer>
    );
  } else if (b.status === "pending" && endMs(b) > now) {
    body = (
      <Explainer icon={Link2}>
        {isTutor ? "Accept this request to confirm it." : `The lesson is confirmed once ${tutorFirstName} accepts.`} The Join button for the classroom then appears here {policy.meetingLinkVisibleMinutesBefore} minutes before the start time.
      </Explainer>
    );
  } else if (b.status === "payment_failed") {
    body = <Explainer icon={Link2}>The classroom opens once the booking is confirmed and paid.</Explainer>;
  } else if ((b.status === "confirmed" || b.status === "in_progress") && endMs(b) <= now) {
    body = <Explainer icon={Link2}>This lesson has ended, so the classroom is closed.</Explainer>;
  }
  if (!body) return null;
  return <div className="border-t border-line px-5 py-4">{body}</div>;
}

function Explainer({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-muted">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** The classroom can be opened ahead of time to check the camera and prepare the board. */
function EarlyAccess({ id }: { id: string }) {
  return (
    <Link href={`/classroom/${id}`} className="font-medium text-ink underline underline-offset-4 hover:text-brand">
      Open the classroom early to check your camera
    </Link>
  );
}

/** Ticks every second — only mounted within 24 hours of the lesson. */
function LiveJoin({ booking: b, policy, tz }: { booking: Booking; policy: BookingPolicy; tz: string }) {
  const now = useNow(1000);
  const visible = meetingLinkVisible(b, now, policy);
  const linkAt = new Date(startMs(b) - policy.meetingLinkVisibleMinutesBefore * 60_000).toISOString();
  return (
    <div className="space-y-4">
      <Countdown booking={b} now={now} />
      <AnimatePresence mode="wait" initial={false}>
        {visible ? (
          <motion.div key="join" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="cta" className="sm:w-auto">
              <Link href={`/classroom/${b.id}`}>
                <Video /> Join lesson
              </Link>
            </Button>
            <p className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px] leading-snug text-muted">
              <PenLine className="size-4 shrink-0" aria-hidden /> Opens the TutorLink classroom: video, whiteboard and chat. Nothing to install.
            </p>
          </motion.div>
        ) : (
          <motion.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-muted">
            <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              The Join button appears here at <span className="font-medium text-ink">{formatTime(linkAt, tz)}</span>, {policy.meetingLinkVisibleMinutesBefore} minutes before the start. <EarlyAccess id={b.id} />
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Countdown({ booking: b, now: nowProp }: { booking: Booking; now?: number }) {
  const ticking = useNow(1000);
  const now = nowProp ?? ticking;
  const s = startMs(b);
  const e = endMs(b);
  const started = now >= s;
  const ms = Math.max(0, started ? e - now : s - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const parts = [
    ...(h > 0 ? [{ v: h, l: "hr" }] : []),
    { v: m, l: "min" },
    { v: sec, l: "sec" },
  ];
  const spoken = `${started ? "Ends in" : "Starts in"} ${h ? `${h} hours ` : ""}${m} minutes`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className={cn("relative grid size-9 place-items-center rounded-lg", started ? "bg-ink text-on-ink" : "border border-line bg-canvas text-ink")}>
          <Timer className="size-4" aria-hidden />
          {started && <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse-dot rounded-full bg-success ring-2 ring-surface" aria-hidden />}
        </span>
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{started ? "Started · ends in" : "Starts in"}</p>
          <p role="timer" aria-label={spoken} className="flex items-baseline gap-2 text-ink">
            {parts.map((p) => (
              <span key={p.l} className="flex items-baseline gap-0.5">
                <span className="text-xl font-semibold tabular-nums tracking-tight">{String(p.v).padStart(2, "0")}</span>
                <span className="text-[12px] text-muted">{p.l}</span>
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
