"use client";

import * as React from "react";
import Link from "next/link";
import { Repeat2, Search } from "lucide-react";
import type { Booking } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useFlag, useNow } from "@/lib/store/hooks";
import { FREE_SWITCH_DAYS, endMs, freeSwitchCredit, freeSwitchProblem } from "@/lib/booking";
import { subjectName } from "@/lib/data/catalog";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";

/**
 * On a completed trial, for the person who booked it: "Not the right fit?" The free tutor switch gives the trial
 * price back as Study Credits (once per account), so the next trial with another tutor is free.
 */
export function LessonFreeSwitch({ booking: b, meId, tz }: { booking: Booking; meId: string; tz: string }) {
  const on = useFlag("free_tutor_switch");
  const now = useNow();
  const bookings = useApp((s) => s.bookings);
  const disputes = useApp((s) => s.disputes);
  const claim = useApp((s) => s.claimFreeTutorSwitch);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!on || b.type !== "trial" || b.status !== "completed" || b.bookerId !== meId || !now) return null;

  const subject = subjectName(b.subject);
  const find = `/tutors?subject=${encodeURIComponent(b.subject)}`;
  const used = b.history.some((e) => e.tutorSwitch);
  const credit = freeSwitchCredit(b);
  const disputed = disputes.some((d) => d.bookingId === b.id && !["resolved", "rejected"].includes(d.status));
  const problem = freeSwitchProblem(meId, b, bookings, disputed, now);
  const until = new Date(endMs(b) + FREE_SWITCH_DAYS * 86_400_000).toISOString();
  const withinWindow = now <= endMs(b) + FREE_SWITCH_DAYS * 86_400_000;

  const body = (() => {
    if (used) {
      return {
        title: "You used your free tutor switch on this trial",
        text: `${formatMoney(credit, b.currency)} went to your Study Credits for a trial with another tutor.`,
        action: null,
      };
    }
    if (!problem) {
      return {
        title: "Not the right fit?",
        text: `Try another tutor: we'll give you back the ${formatMoney(credit, b.currency)} you paid for this trial as Study Credits, so your next trial is free. Once per account, until ${formatDate(until, tz)}.`,
        action: "claim" as const,
      };
    }
    // A free trial: nothing to give back, but trying someone else costs nothing either.
    if (credit <= 0 && withinWindow && !bookings.some((x) => x.tutorId === b.tutorId && x.type === "regular" && (x.childId ?? x.bookerId) === (b.childId ?? b.bookerId) && !x.status.startsWith("cancelled"))) {
      return { title: "Not the right fit?", text: `Trials are free: try another ${subject} tutor.`, action: null };
    }
    return null;
  })();
  if (!body) return null;

  const submit = async () => {
    setBusy(true);
    const res = await claim(b.id, reason);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${formatMoney(res.data.creditCents, res.data.currency)} added to your Study Credits`, { description: "Pick another tutor and pay for their trial with it." });
  };

  return (
    <Card data-free-switch={used ? "used" : body.action ?? "info"}>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-muted">
            <Repeat2 className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">{body.title}</p>
            <p className="mt-0.5 text-[13px] text-muted">{body.text}</p>
          </div>
        </div>
        {body.action === "claim" && (
          <Field label="What didn't work for you?" optional hint="Helps us find you a better match. Your tutor isn't told.">
            <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: explained too fast, different teaching style…" />
          </Field>
        )}
        <div className="flex flex-wrap gap-2">
          {body.action === "claim" && (
            <Button onClick={() => void submit()} loading={busy} data-free-switch-claim="">
              <Repeat2 /> Try another tutor free
            </Button>
          )}
          <Button asChild variant={body.action === "claim" ? "secondary" : "primary"}>
            <Link href={find}>
              <Search /> Find another {subject} tutor
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
