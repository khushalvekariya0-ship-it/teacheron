"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { UserRoundX } from "lucide-react";
import type { Booking, BookingType, Tutor } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useFlag, useHydrated, useSession, useTutor, useWalletBalance } from "@/lib/store/hooks";
import { idempotencyKey } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { BookingFlow, SLOT_ERROR, type BookingRequest } from "@/components/booking/BookingFlow";
import { BookingSuccessSheet } from "@/components/booking/BookingSuccessSheet";
import { lessonMinutes, lessonPrice } from "@/components/booking/BookingSteps";
import { ProfileHeader } from "./ProfileHeader";
import { SectionNav } from "./SectionNav";
import { AboutSection, ExperienceSection, SubjectsSection } from "./ProfileSections";
import { AvailabilitySection } from "./AvailabilitySection";
import { ReviewsSection } from "./ReviewsSection";
import { TrustSection } from "./TrustSection";
import { BookingPanel, MobileBookingBar, type BookingSelection } from "./BookingPanel";

/**
 * Opens the booking flow when the URL carries ?book=trial|regular (e.g. from a tutor card or after
 * signing in), then removes the parameter so a refresh or "back" doesn't reopen it.
 * Lives in its own Suspense boundary so the rest of the profile can be prerendered.
 */
function BookingUrlTrigger({ onTrigger }: { onTrigger: (t: BookingType) => void }) {
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const book = searchParams.get("book");
  React.useEffect(() => {
    if (!hydrated || (book !== "trial" && book !== "regular")) return;
    onTrigger(book);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const url = new URL(window.location.href);
    url.searchParams.delete("book");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [hydrated, book, onTrigger]);
  return null;
}

function ProfileSkeleton() {
  return (
    <div className="container-page pb-24 pt-8 lg:pt-12" role="status" aria-label="Loading tutor profile">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_384px] lg:gap-12">
        <div>
          <Skeleton className="mb-6 h-4 w-40" />
          <div className="flex flex-col gap-6 sm:flex-row">
            <Skeleton className="size-24 rounded-full sm:size-28" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-5 w-96 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </div>
          <Skeleton className="mt-10 h-12 w-full" />
          <div className="mt-8 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

function TutorNotFound() {
  return (
    <div className="container-page py-16 sm:py-24">
      <div data-spotlight className="mx-auto max-w-lg rounded-2xl border border-line bg-canvas/50">
        <EmptyState
          icon={<UserRoundX />}
          title="We couldn't find this tutor"
          description="The profile may have been removed, or the link is mistyped. Browse tutors to find someone who fits."
          action={
            <>
              <Button asChild>
                <Link href="/tutors">Browse tutors</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/concierge">Help me find a tutor</Link>
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}

function Profile({ tutor }: { tutor: Tutor }) {
  const hydrated = useHydrated();
  const me = useSession();
  const balance = useWalletBalance();
  const bookings = useApp((s) => s.bookings);
  const allChildren = useApp((s) => s.children);
  const createBooking = useApp((s) => s.createBooking);
  const instantFlag = useFlag("instant_booking");
  const trialFlag = useFlag("trial_lessons");
  const onlineFlag = useFlag("online_lessons");
  const instant = !tutor.rules.requiresApproval && instantFlag;
  const trialOffered = tutor.trial.enabled && trialFlag;

  // What the learner has picked in the booking panel: lesson type, length, subject and start time.
  const [selection, setSelection] = React.useState<BookingSelection>(() => ({
    type: tutor.trial.enabled ? "trial" : "regular",
    duration: tutor.rules.sessionLengths[0] ?? 60,
    subject: tutor.subjects[0] ?? "",
    startUtc: null,
  }));
  const select = React.useCallback((patch: Partial<BookingSelection>) => setSelection((s) => ({ ...s, ...patch })), []);

  const isLearner = me?.role === "student" || me?.role === "parent";
  const myChildren = React.useMemo(() => (me?.role === "parent" ? allChildren.filter((c) => c.parentId === me.id) : []), [allChildren, me]);
  // A student's one trial with this tutor is already used. (For parents it depends on the child, which the checkout asks.)
  const trialUsed = React.useMemo(
    () => me?.role === "student" && bookings.some((b) => b.tutorId === tutor.id && b.type === "trial" && b.bookerId === me.id && !b.childId && !b.status.startsWith("cancelled")),
    [bookings, tutor.id, me],
  );
  const trialAvailable = trialOffered && !trialUsed;
  const type: BookingType = selection.type === "trial" && trialAvailable ? "trial" : "regular";
  const minutes = lessonMinutes(tutor, { type, duration: selection.duration });
  const total = lessonPrice(tutor, { type, duration: selection.duration });
  const mode = tutor.modes.includes("online") && onlineFlag ? "online" : tutor.modes[0];
  // One tap: signed in, nobody left to choose (a parent with one child), and the wallet covers the lesson.
  const oneTap =
    hydrated && !!selection.startUtc && total > 0 && balance >= total && me?.parentalConsent?.status !== "pending" && (me?.role === "student" || (me?.role === "parent" && myChildren.length === 1));

  const [flowOpen, setFlowOpen] = React.useState(false);
  const [request, setRequest] = React.useState<BookingRequest>({ id: 0, type: "regular" });
  const openFlow = React.useCallback((t: BookingType) => {
    setRequest((r) => ({ id: r.id + 1, type: t }));
    setFlowOpen(true);
  }, []);
  /** The checkout drawer, opened on "Confirm" with the time picked in the panel. */
  const openCheckout = () => {
    if (!selection.startUtc) return;
    const preset = { startUtc: selection.startUtc, duration: selection.duration, subject: selection.subject };
    setRequest((r) => ({ id: r.id + 1, type, preset }));
    setFlowOpen(true);
  };
  const scrollToCalendar = () => document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [booking, setBooking] = React.useState(false);
  const [booked, setBooked] = React.useState<Booking | null>(null);
  const attempt = React.useRef<string | null>(null);
  const quickBook = async () => {
    if (booking || !selection.startUtc || !me) return;
    attempt.current ??= idempotencyKey("book");
    setBooking(true);
    // Stand-in for the payment round trip (the wallet is debited by the store, as the API would).
    await new Promise((r) => setTimeout(r, 600));
    const res = createBooking({
      tutorId: tutor.id,
      startUtc: selection.startUtc,
      durationMin: minutes,
      type,
      mode,
      subject: selection.subject,
      childId: me.role === "parent" ? myChildren[0]?.id : undefined,
      payWith: "wallet",
      idempotencyKey: attempt.current,
    });
    setBooking(false);
    attempt.current = null;
    if (!res.ok) {
      toast.error(res.error);
      if (SLOT_ERROR.test(res.error)) select({ startUtc: null });
      return;
    }
    select({ startUtc: null });
    setBooked(res.data);
    toast.success(res.data.status === "confirmed" ? "Lesson confirmed" : "Request sent", { description: "Paid with Study Credits" });
  };

  return (
    <>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-line-grid opacity-50 mask-fade-b" aria-hidden />
        <div className="container-page relative grid gap-x-12 gap-y-8 pb-32 pt-8 lg:grid-cols-[minmax(0,1fr)_384px] lg:pb-24 lg:pt-12">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <ProfileHeader tutor={tutor} instant={instant} />
          </div>

          <aside id="book" aria-label={`Book ${tutor.firstName}`} className="scroll-mt-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="lg:sticky lg:top-24">
              <BookingPanel
                tutor={tutor}
                instant={instant}
                trialAvailable={trialAvailable}
                type={type}
                minutes={minutes}
                total={total}
                selection={selection}
                onSelect={select}
                oneTap={oneTap}
                canUseWallet={hydrated && isLearner}
                balance={balance}
                booking={booking}
                onQuickBook={quickBook}
                onCheckout={openCheckout}
              />
            </div>
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <SectionNav reviewCount={tutor.reviewCount} />
            <AboutSection tutor={tutor} />
            <SubjectsSection tutor={tutor} />
            <ExperienceSection tutor={tutor} />
            <AvailabilitySection tutor={tutor} onBook={scrollToCalendar} />
            <ReviewsSection tutor={tutor} />
            <TrustSection tutor={tutor} />
          </div>
        </div>
      </div>

      <MobileBookingBar tutor={tutor} type={type} total={total} hasTime={!!selection.startUtc} onPickTime={scrollToCalendar} onCheckout={oneTap ? quickBook : openCheckout} />
      <BookingFlow tutor={tutor} open={flowOpen} onOpenChange={setFlowOpen} request={request} />
      <BookingSuccessSheet tutor={tutor} booking={booked} onClose={() => setBooked(null)} />
      <React.Suspense fallback={null}>
        <BookingUrlTrigger onTrigger={openFlow} />
      </React.Suspense>
    </>
  );
}

export function TutorProfileView({ slug }: { slug: string }) {
  const tutor = useTutor(slug);
  const hydrated = useHydrated();
  if (!tutor) return hydrated ? <TutorNotFound /> : <ProfileSkeleton />;
  return <Profile tutor={tutor} />;
}
