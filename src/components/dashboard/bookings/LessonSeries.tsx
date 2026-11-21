"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Repeat } from "lucide-react";
import type { Booking } from "@/lib/types";
import { seriesOf, startMs } from "@/lib/booking";
import { useApp } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { BookingStatusBadge } from "@/components/domain/Badges";

/**
 * The other lessons of a set of weekly lessons booked together (each is its own booking: moved or cancelled on its
 * own). The tutor can accept every waiting one at once.
 */
export function LessonSeriesCard({ booking: b, isTutor, tz, counterpart }: { booking: Booking; isTutor: boolean; tz: string; counterpart: string }) {
  const bookings = useApp((s) => s.bookings);
  const acceptAll = useApp((s) => s.acceptWeeklyLessons);
  const [busy, setBusy] = React.useState(false);
  const series = seriesOf(b);
  const lessons = React.useMemo(
    () => (series ? bookings.filter((x) => x.tutorId === b.tutorId && x.status !== "rescheduled" && seriesOf(x)?.id === series.id).sort((x, y) => startMs(x) - startMs(y)) : []),
    [bookings, series, b.tutorId],
  );
  if (!series || lessons.length < 2) return null;
  const waiting = lessons.filter((x) => x.status === "pending").length;

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    const res = await acceptAll(b.id);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.data.accepted > 1 ? `${res.data.accepted} weekly lessons accepted` : "Lesson accepted", { description: `${counterpart} has been notified.` });
  };

  return (
    <Card data-weekly-lessons>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Repeat className="size-4 text-muted" aria-hidden /> Weekly lessons
          </span>
        }
        description={`${series.of} lessons booked together, same time each week. Each one can be moved or cancelled on its own.`}
        action={
          isTutor && waiting > 1 ? (
            <Button size="sm" onClick={accept} loading={busy} data-accept-weekly>
              <Check /> Accept all {waiting}
            </Button>
          ) : undefined
        }
      />
      <CardContent className="pt-3">
        <ol className="divide-y divide-line rounded-lg border border-line">
          {lessons.map((x) => {
            const s = seriesOf(x);
            const current = x.id === b.id;
            return (
              <li key={x.id}>
                <Link
                  href={`/dashboard/bookings/${x.id}`}
                  aria-current={current ? "page" : undefined}
                  className={cn("flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px] transition-colors hover:bg-canvas", current && "bg-canvas")}
                >
                  <span className="min-w-0">
                    <span className="mr-2 font-mono text-[11.5px] text-muted">{s?.n ?? "·"}/{series.of}</span>
                    <span className={cn("tabular-nums text-ink", current && "font-medium")}>{formatDateTime(x.startUtc, tz)}</span>
                  </span>
                  <BookingStatusBadge status={x.status} />
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
