import { CalendarX2, Check, Link2, Timer, Zap } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { policySummary } from "@/lib/booking";
import { DEFAULT_POLICY, type BookingPolicy } from "@/lib/data/platform";

/** The live booking policy, rendered from DEFAULT_POLICY so copy never drifts from the rules. */
export function PolicyCards({ policy = DEFAULT_POLICY }: { policy?: BookingPolicy }) {
  const cards = [
    { title: "Regular lessons", lines: policySummary("regular", policy) },
    { title: "Trial lessons", lines: policySummary("trial", policy) },
  ];
  return (
    <Stagger className="grid gap-4 md:grid-cols-2" stagger={0.1}>
      {cards.map((c) => (
        <StaggerItem key={c.title} className="h-full">
          <div className="h-full rounded-2xl border border-line bg-surface p-6">
            <h3 className="font-heading text-xl font-bold tracking-[-0.03em] text-ink">{c.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {c.lines.map((l) => (
                <li key={l} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-2">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function PolicyDetails({ policy = DEFAULT_POLICY }: { policy?: BookingPolicy }) {
  const items = [
    { icon: Zap, title: "Requests and instant booking", body: "Some tutors confirm each request; others accept bookings instantly. For requests, your card is authorized when you book and charged when the tutor confirms." },
    { icon: Timer, title: "No-shows", body: `A no-show can be reported ${policy.noShowGraceMinutes} minutes after the start time. A confirmed tutor no-show is refunded in full; ${policy.studentNoShowRefundPercent === 0 ? "a student no-show is not refunded" : `a student no-show is refunded at ${policy.studentNoShowRefundPercent}%`}.` },
    { icon: Link2, title: "Meeting links", body: `For online lessons, the meeting link appears on the lesson page ${policy.meetingLinkVisibleMinutesBefore} minutes before the start time — it is never posted publicly.` },
    { icon: CalendarX2, title: "Problems and disputes", body: `If something goes wrong, open a dispute from the lesson page within ${policy.disputeWindowDays} days. Our team reviews both sides before deciding on a refund.` },
  ];
  return (
    <Stagger className="grid gap-x-8 gap-y-7 sm:grid-cols-2" stagger={0.08}>
      {items.map((it) => (
        <StaggerItem key={it.title} className="flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface text-ink">
            <it.icon className="size-5" />
          </span>
          <div>
            <h3 className="text-[16px] font-bold text-ink">{it.title}</h3>
            <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{it.body}</p>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
