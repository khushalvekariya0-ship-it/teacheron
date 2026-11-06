"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Copy, Users } from "lucide-react";
import type { Booking } from "@/lib/types";
import { subjectName } from "@/lib/data/catalog";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useApp } from "@/lib/store";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent, CardHeader, DetailRow, Separator } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { PaymentStatusBadge } from "@/components/domain/Badges";
import { bookingRef, shortName, type BookingPeople } from "./shared";

export function LessonDetails({ booking: b, people, isTutor, tz }: { booking: Booking; people: BookingPeople; isTutor: boolean; tz: string }) {
  const total = b.priceCents - b.discountCents;
  const net = total - b.platformFeeCents;
  const money = (minor: number) => formatMoney(minor, b.currency, { exact: true });
  // How the lesson was paid ("Visa •••• 4242", "UPI", "Study Credits"), from its latest payment that went through.
  const paidWith = useApp((s) =>
    s.payments.filter((p) => p.bookingId === b.id && p.amountCents > 0 && p.status !== "failed" && p.method).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]?.method,
  );
  const ref = bookingRef(b.id);
  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(ref);
      toast.success("Booking reference copied");
    } catch {
      toast.error("Couldn't copy the reference.");
    }
  };

  return (
    <Card>
      <CardHeader title="Lesson details" />
      <CardContent className="pt-3">
        <dl className="divide-y divide-line">
          <DetailRow label="Learner">
            <span className="block">{people.learnerName}</span>
            {b.childId && (
              <span className="mt-0.5 flex items-center justify-end gap-1 text-[12px] font-normal text-muted">
                <Users className="size-3" aria-hidden />
                {isTutor && people.booker ? `Booked by parent ${shortName(people.booker)} · ` : ""}Parent account can see this lesson
              </span>
            )}
          </DetailRow>
          <DetailRow label="Tutor">
            {isTutor ? (
              "You"
            ) : people.tutor ? (
              <Link href={`/tutors/${people.tutor.slug}`} className="inline-flex items-center gap-1.5 text-ink hover:underline">
                <Avatar name={`${people.tutor.firstName} ${people.tutor.lastName}`} src={people.tutor.photoUrl} tone={people.tutor.tone} size="xs" />
                {people.counterpart}
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            ) : (
              people.counterpart
            )}
          </DetailRow>
          <DetailRow label="Subject">{subjectName(b.subject)}</DetailRow>
          <DetailRow label="Type">{b.type === "trial" ? "Trial lesson" : "Regular lesson"}</DetailRow>
        </dl>

        <div className="mt-3">
          <p className="text-[13px] text-muted">Lesson notes</p>
          {b.notes ? (
            <p className="mt-1.5 rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13.5px] leading-relaxed text-ink-2">{b.notes}</p>
          ) : (
            <p className="mt-1 text-[13px] text-subtle">No notes were added when this lesson was booked.</p>
          )}
        </div>

        <Separator className="my-4" />

        <dl className="text-sm" aria-label="Price breakdown">
          <PriceRow label={b.type === "trial" ? "Trial price" : `Lesson (${b.durationMin} min)`} value={b.priceCents === 0 ? "Free" : money(b.priceCents)} />
          {b.discountCents > 0 && <PriceRow label="Discount" value={`−${money(b.discountCents)}`} />}
          <PriceRow label={isTutor ? "Family pays" : "Total"} value={money(total)} strong={!isTutor} />
          {isTutor && (
            <>
              <PriceRow label="Platform fee" value={b.platformFeeCents ? `−${money(b.platformFeeCents)}` : money(0)} />
              <PriceRow label="Your earnings" value={money(net)} strong />
            </>
          )}
          <div className="flex items-center justify-between gap-3 pt-2.5">
            <dt className="text-muted">Payment</dt>
            <dd>
              <PaymentStatusBadge status={b.paymentStatus} />
            </dd>
          </div>
          {paidWith && (
            <div className="flex items-center justify-between gap-3 pt-1.5 text-ink-2">
              <dt className="text-muted">Paid with</dt>
              <dd className="text-right">{paidWith}</dd>
            </div>
          )}
        </dl>

        <Separator className="my-4" />

        <dl className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Booking reference</dt>
            <dd className="flex items-center gap-1">
              <span className="font-mono text-[12.5px] tracking-wide text-ink">{ref}</span>
              <button type="button" onClick={copyRef} className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" aria-label="Copy booking reference">
                <Copy className="size-3.5" />
              </button>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Booked on</dt>
            <dd className="text-ink">{formatDate(b.createdAt, tz)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between gap-3 border-t border-line pt-2.5 mt-1.5 font-semibold text-ink" : "flex items-center justify-between gap-3 py-1 text-ink-2"}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
