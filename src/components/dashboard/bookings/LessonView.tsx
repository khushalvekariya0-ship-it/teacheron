"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarX2, Lock, MessageSquare } from "lucide-react";
import type { Booking, User } from "@/lib/types";
import { availableTransitions, STATUS_META } from "@/lib/booking";
import { actorFor, canViewBooking } from "@/lib/permissions";
import { useApp } from "@/lib/store";
import { useNow, useSession, useViewerTimezone } from "@/lib/store/hooks";
import { subjectName } from "@/lib/data/catalog";
import { formatDate, formatDateTime, formatWeekdayDate } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { BookingStatusBadge } from "@/components/domain/Badges";
import { CancelDialog, DeclineDialog, RescheduleDialog, TransitionDialog, type ConfirmableTransition } from "./BookingDialogs";
import { buildLessonActions, LessonActionsPanel, StickyActionBar, type LessonDialog } from "./LessonActions";
import { LessonDetails } from "./LessonDetails";
import { LessonLearning } from "./LessonLearning";
import { LessonWhenWhere } from "./LessonLive";
import { DisputeCard, DisputeDialog, ReportProblemCard, ReviewDisplay, ReviewForm, useLessonDispute, useLessonReview } from "./LessonPostLesson";
import { LessonTimeline } from "./LessonTimeline";
import { bookingRef, timeRange, tzShort, usePeople } from "./shared";

export function LessonView({ id }: { id: string }) {
  const me = useSession();
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  if (!me) return null;
  if (!booking) {
    return (
      <StateShell>
        <EmptyState
          icon={<CalendarX2 />}
          title="Lesson not found"
          description="This booking doesn't exist or is no longer available. Links from before a demo reset won't work anymore."
          action={<Button asChild><Link href="/dashboard/bookings">Back to bookings</Link></Button>}
        />
      </StateShell>
    );
  }
  if (!canViewBooking(me, booking)) {
    return (
      <StateShell>
        <EmptyState
          icon={<Lock />}
          title="You don't have access to this lesson"
          description="Only the student or parent who booked it and the tutor teaching it can see a lesson."
          action={<Button asChild variant="secondary"><Link href="/dashboard/bookings">Back to your bookings</Link></Button>}
        />
      </StateShell>
    );
  }
  return <Lesson booking={booking} me={me} />;
}

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader title="Lesson" back={{ href: "/dashboard/bookings", label: "All bookings" }} />
      <div className="rounded-xl border border-line bg-surface">{children}</div>
    </div>
  );
}

const CONFIRMABLE: LessonDialog[] = ["in_progress", "completed", "no_show_student", "no_show_tutor", "pending"];

function Lesson({ booking: b, me }: { booking: Booking; me: User }) {
  const router = useRouter();
  const now = useNow(15_000);
  const tz = useViewerTimezone();
  const policy = useApp((s) => s.policy);
  const bookings = useApp((s) => s.bookings);
  const users = useApp((s) => s.users);
  const conversations = useApp((s) => s.conversations);
  const transition = useApp((s) => s.transitionBooking);
  const startConversation = useApp((s) => s.startConversation);
  const peopleFor = usePeople();
  const review = useLessonReview(b);
  const dispute = useLessonDispute(b.id);
  const [dialog, setDialog] = React.useState<LessonDialog | null>(null);

  const actor = actorFor(me, b) ?? "booker";
  const isTutor = actor === "tutor";
  const people = peopleFor(b);
  const subject = subjectName(b.subject);
  const tutorFirst = people.tutor?.firstName ?? "your tutor";
  const tutorUserId = users.find((u) => u.tutorId === b.tutorId)?.id;
  const rescheduledTo = bookings.find((x) => x.rescheduledFromId === b.id);
  const rescheduledFrom = b.rescheduledFromId ? bookings.find((x) => x.id === b.rescheduledFromId) : undefined;
  const openDispute = dispute && !["resolved", "rejected"].includes(dispute.status) ? dispute : undefined;
  const canDispute = !openDispute && availableTransitions(b, actor, now, policy).includes("disputed");

  const conversation = isTutor
    ? conversations.find((c) => c.tutorId === b.tutorId && c.userId === b.bookerId && (c.childId ?? null) === (b.childId ?? null)) ?? conversations.find((c) => c.tutorId === b.tutorId && c.userId === b.bookerId)
    : conversations.find((c) => c.tutorId === b.tutorId && c.userId === me.id && (c.childId ?? null) === (b.childId ?? null)) ?? conversations.find((c) => c.tutorId === b.tutorId && c.userId === me.id);

  const accept = () => {
    const res = transition(b.id, "confirmed");
    if (!res.ok) return void toast.error(res.error);
    toast.success("Booking accepted", { description: `${people.counterpart} has been notified.` });
  };
  const goToReview = () => {
    const el = document.getElementById("review");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    el?.focus({ preventScroll: true });
  };
  const message = () => {
    const res = startConversation(b.tutorId, { childId: b.childId, subject: b.subject });
    if (!res.ok) return void toast.error(res.error);
    router.push(`/dashboard/messages?c=${res.data.id}`);
  };

  const { primary, items } = buildLessonActions(b, actor, now, policy, { onAccept: accept, onReview: goToReview });

  const statusNote = (() => {
    switch (b.status) {
      case "pending":
        return isTutor ? "Accept or decline before the lesson time." : `Waiting for ${tutorFirst} to accept.`;
      case "confirmed":
        return b.paymentStatus === "paid" ? "Confirmed and paid." : "Confirmed.";
      case "in_progress":
        return "This lesson is in progress.";
      case "completed":
        return "This lesson is complete.";
      case "rescheduled":
        return "This booking was moved to a new time.";
      case "payment_failed":
        return "The payment didn't go through.";
      case "disputed":
        return "A reported problem is being reviewed.";
      default:
        return `${STATUS_META[b.status].label}.`;
    }
  })();

  const otherTz = isTutor ? people.booker?.timezone : people.tutor?.timezone;
  const otherLabel = isTutor ? (people.booker?.role === "parent" ? "the family" : "the student") : "the tutor";
  const names = { tutor: people.tutor?.firstName ?? "the tutor", learner: people.childName ?? people.booker?.firstName ?? "the student" };
  const showReviewForm = actor === "booker" && b.status === "completed" && !b.reviewId && !review;
  const confirmTo = dialog && CONFIRMABLE.includes(dialog) ? (dialog as ConfirmableTransition) : null;

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/bookings", label: "All bookings" }}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={b.status} />
            {b.type === "trial" && <Badge tone="outline" size="sm">Trial</Badge>}
            <span className="font-mono text-[11.5px] tracking-wide text-muted">#{bookingRef(b.id)}</span>
          </div>
        }
        title={`${subject} ${b.type === "trial" ? "trial " : ""}lesson with ${people.counterpart}`}
        description={
          <>
            {formatWeekdayDate(b.startUtc, tz)} · <span className="tabular-nums">{timeRange(b, tz)}</span> {tzShort(tz, b.startUtc)}
            {people.childName && <> · for {people.childName}</>}
          </>
        }
        actions={
          conversation ? (
            <Button asChild variant="secondary">
              <Link href={`/dashboard/messages?c=${conversation.id}`}>
                <MessageSquare /> Message {isTutor ? people.booker?.firstName ?? "family" : tutorFirst}
              </Link>
            </Button>
          ) : !isTutor ? (
            <Button variant="secondary" onClick={message}>
              <MessageSquare /> Message {tutorFirst}
            </Button>
          ) : undefined
        }
      />

      {b.status === "rescheduled" && rescheduledTo && (
        <InlineAlert
          className="mb-6"
          title={`Moved to ${formatDateTime(rescheduledTo.startUtc, tz)}`}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/bookings/${rescheduledTo.id}`}>
                View new lesson <ArrowRight />
              </Link>
            </Button>
          }
        >
          This booking was rescheduled. Payment and notes moved with it.
        </InlineAlert>
      )}

      {/* Phone: live card → actions → everything else. Desktop: content column + actions/details column. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="contents lg:block lg:min-w-0 lg:space-y-6">
          <div className="order-1 min-w-0">
            <LessonWhenWhere booking={b} tz={tz} otherTz={otherTz} otherLabel={otherLabel} now={now} policy={policy} isTutor={isTutor} tutorFirstName={tutorFirst} />
          </div>

          {(showReviewForm || review || dispute || canDispute) && (
            <div className="order-3 min-w-0 space-y-6">
              {showReviewForm && <ReviewForm booking={b} tutorFirstName={tutorFirst} />}
              {review && <ReviewDisplay review={review} isTutor={isTutor} tz={tz} />}
              {dispute && <DisputeCard dispute={dispute} myId={me.id} tz={tz} />}
              {canDispute && <ReportProblemCard onReport={() => setDialog("dispute")} policy={policy} />}
            </div>
          )}

          <div className="order-3 min-w-0">
            <LessonLearning booking={b} learnerName={people.childName ?? (isTutor ? people.counterpart : "you")} isTutor={isTutor} tz={tz} now={now} />
          </div>

          <div className="order-3 min-w-0">
            <LessonTimeline booking={b} me={me} people={people} users={users} tutorUserId={tutorUserId} tz={tz} rescheduledTo={rescheduledTo} rescheduledFrom={rescheduledFrom} />
            <p className="mt-3 text-center text-[12px] text-muted">Booked {formatDate(b.createdAt, tz)} · Reference {bookingRef(b.id)}</p>
          </div>
        </div>

        <aside className="order-2 min-w-0 space-y-6" aria-label="Lesson actions and details">
          <LessonActionsPanel booking={b} primary={primary} items={items} onDialog={setDialog} policy={policy} statusNote={statusNote} />
          <LessonDetails booking={b} people={people} isTutor={isTutor} tz={tz} />
        </aside>
      </div>

      {primary && (
        <>
          <div className="h-24 lg:hidden" aria-hidden />
          <StickyActionBar
            primary={primary}
            onDialog={setDialog}
            caption={
              <>
                <span className="block truncate font-medium text-ink">{subject} · {people.counterpart}</span>
                <span className="block truncate tabular-nums">{formatDateTime(b.startUtc, tz)}</span>
              </>
            }
          />
        </>
      )}

      {/* Dialogs */}
      <CancelDialog booking={b} actor={actor} open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} counterpart={people.counterpart} now={now} />
      {isTutor && <DeclineDialog booking={b} open={dialog === "decline"} onOpenChange={(o) => setDialog(o ? "decline" : null)} counterpart={people.counterpart} />}
      {people.tutor && (
        <RescheduleDialog
          booking={b}
          actor={actor}
          tutor={people.tutor}
          open={dialog === "reschedule"}
          onOpenChange={(o) => setDialog(o ? "reschedule" : null)}
          onDone={(next) => router.push(`/dashboard/bookings/${next.id}`)}
        />
      )}
      <TransitionDialog booking={b} to={confirmTo} onOpenChange={(o) => !o && setDialog(null)} names={names} />
      <DisputeDialog booking={b} open={dialog === "dispute"} onOpenChange={(o) => setDialog(o ? "dispute" : null)} isTutor={isTutor} />
    </div>
  );
}
