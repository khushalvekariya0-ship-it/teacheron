"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clock, Video } from "lucide-react";
import { meetingLinkVisible, STATUS_META } from "@/lib/booking";
import { useApp } from "@/lib/store";
import { subjectName, MODE_LABEL } from "@/lib/data/catalog";
import { formatDuration, formatWeekdayDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Overlay";
import { BookingStatusBadge } from "@/components/domain/Badges";
import { ModeIcon, timeRange, tzShort, type BookingPeople } from "@/components/dashboard/bookings/shared";
import type { CalEvent } from "./model";

export function eventLabel(ev: CalEvent, people: BookingPeople, tz: string): string {
  const b = ev.booking;
  return `${subjectName(b.subject)}${b.type === "trial" ? " trial" : ""}, ${formatWeekdayDate(b.startUtc, tz)} ${timeRange(b, tz)}, ${STATUS_META[b.status].label}, with ${people.counterpart}${people.childName ? ` for ${people.childName}` : ""}`;
}

export function EventPopover({ ev, people, tz, now, children }: { ev: CalEvent; people: BookingPeople; tz: string; now: number; children: React.ReactElement }) {
  const policy = useApp((s) => s.policy);
  const b = ev.booking;
  const joinable = meetingLinkVisible(b, now, policy) && !!b.meetingUrl;
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-[min(90vw,18.5rem)] p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-semibold leading-snug tracking-tight text-ink">
            {subjectName(b.subject)}
            {b.type === "trial" && <Badge tone="outline" size="sm" className="ml-1.5 align-middle">Trial</Badge>}
          </p>
          <BookingStatusBadge status={b.status} className="shrink-0" />
        </div>
        <dl className="mt-2.5 space-y-1.5 text-[13px] text-ink-2">
          <div className="flex items-start gap-2">
            <dt className="sr-only">When</dt>
            <Clock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
            <dd>
              {formatWeekdayDate(b.startUtc, tz)}
              <span className="block tabular-nums text-muted">
                {timeRange(b, tz)} {tzShort(tz, b.startUtc)} · {formatDuration(b.durationMin)}
              </span>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Format</dt>
            <ModeIcon mode={b.mode} className="text-muted" />
            <dd aria-hidden>{MODE_LABEL[b.mode]}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">With</dt>
            <span className="grid size-3.5 place-items-center" aria-hidden>
              <span className="size-1.5 rounded-full bg-subtle" />
            </span>
            <dd>
              with <span className="font-medium text-ink">{people.counterpart}</span>
              {people.childName && <span className="text-muted"> · for {people.childName}</span>}
            </dd>
          </div>
        </dl>
        <div className="mt-3.5 flex gap-2">
          {joinable && (
            <Button asChild size="sm">
              <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer">
                <Video /> Join
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant={joinable ? "secondary" : "primary"} className="flex-1">
            <Link href={`/dashboard/bookings/${b.id}`}>
              Open lesson <ArrowRight />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
