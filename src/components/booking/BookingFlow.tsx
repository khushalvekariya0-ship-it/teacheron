"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import type { Booking, BookingType, PayMethod, Tutor } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useFlag, useHydrated, useSession, useViewerTimezone, useWalletBalance } from "@/lib/store/hooks";
import { policySummary } from "@/lib/booking";
import { formatCents, formatDuration } from "@/lib/format";
import { cn, idempotencyKey } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { WalletDrawer } from "@/components/wallet/WalletDrawer";
import { useIsDesktop } from "./useMediaQuery";
import { ConsentGate, FlowLoading, RoleGate, SignInGate } from "./BookingGates";
import { DetailsStep, NOTES_MAX, ReviewStep, SuccessStep, TimeStep, lessonMinutes, lessonPrice, type Draft } from "./BookingSteps";

type Step = "details" | "time" | "review" | "success";

const STEPS: { key: Exclude<Step, "success">; label: string; long: string }[] = [
  { key: "details", label: "Details", long: "Lesson details" },
  { key: "time", label: "Time", long: "Choose a time" },
  { key: "review", label: "Confirm", long: "Review and confirm" },
];

/** Errors from createBooking that mean the chosen time no longer works. */
export const SLOT_ERROR = /just booked|notice|days ahead|start times|valid time/i;

export interface BookingRequest {
  /** Increments every time a booking button is pressed, so the flow can reset or resume. */
  id: number;
  type: BookingType;
  /** A time already picked on the profile calendar: the drawer opens straight on "Confirm". */
  preset?: { startUtc: string; duration: number; subject: string };
}

function StepIndicator({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Booking steps">
      {STEPS.map((s, i) => (
        <li key={s.key} aria-current={i === idx ? "step" : undefined}>
          <div className="h-1 overflow-hidden rounded-full bg-sunken">
            <motion.div className="h-full rounded-full bg-navy" initial={false} animate={{ width: i <= idx ? "100%" : "0%" }} transition={{ duration: 0.45, ease: EASE }} />
          </div>
          <span className={cn("mt-1.5 block text-[12px] font-medium transition-colors", i <= idx ? "text-ink" : "text-muted")}>
            {i + 1}. {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

const slide = {
  enter: (d: number) => ({ x: d * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d * -28, opacity: 0 }),
};

/**
 * The checkout: a drawer that slides out from the right (a bottom sheet on phones).
 * Details → time → confirm and pay, or straight to confirm when the time was picked on the profile.
 */
export function BookingFlow({ tutor, open, onOpenChange, request }: { tutor: Tutor; open: boolean; onOpenChange: (open: boolean) => void; request: BookingRequest }) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const hydrated = useHydrated();
  const me = useSession();
  const tz = useViewerTimezone();
  const allChildren = useApp((s) => s.children);
  const bookings = useApp((s) => s.bookings);
  const policy = useApp((s) => s.policy);
  const createBooking = useApp((s) => s.createBooking);
  const validateCoupon = useApp((s) => s.validateCoupon);
  const startConversation = useApp((s) => s.startConversation);
  const balance = useWalletBalance();
  const trialFlag = useFlag("trial_lessons");
  const instantFlag = useFlag("instant_booking");
  const onlineFlag = useFlag("online_lessons");
  const couponsFlag = useFlag("coupons");

  const myChildren = React.useMemo(() => (me?.role === "parent" ? allChildren.filter((c) => c.parentId === me.id) : []), [allChildren, me]);
  const trialOffered = tutor.trial.enabled && trialFlag;
  const wantedType = (t: BookingType): BookingType => (t === "trial" && trialOffered ? "trial" : "regular");

  const freshDraft = (t: BookingType): Draft => ({
    type: wantedType(t),
    subject: tutor.subjects[0] ?? "",
    duration: tutor.rules.sessionLengths[0] ?? 60,
    mode: tutor.modes.includes("online") && onlineFlag ? "online" : tutor.modes[0],
    childId: myChildren.length === 1 ? myChildren[0].id : "",
    notes: "",
    startUtc: null,
  });

  const [step, setStep] = React.useState<Step>("details");
  const [dir, setDir] = React.useState(1);
  const [draft, setDraft] = React.useState<Draft>(() => freshDraft(request.type));
  const [coupon, setCoupon] = React.useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [agree, setAgree] = React.useState(false);
  const [agreeError, setAgreeError] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [messaging, setMessaging] = React.useState(false);
  // null = not chosen yet: Study Credits when they cover the lesson, otherwise the card.
  const [payChoice, setPayChoice] = React.useState<PayMethod | null>(null);
  const [walletOpen, setWalletOpen] = React.useState(false);
  // One idempotency key per booking attempt ("session"), created on first confirm press.
  const [session, setSession] = React.useState(0);
  const idem = React.useRef<{ session: number; key: string } | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const trialUsedBy = (learnerKey: string | undefined) =>
    !!learnerKey && bookings.some((b) => b.tutorId === tutor.id && b.type === "trial" && (b.childId ?? b.bookerId) === learnerKey && !b.status.startsWith("cancelled"));

  /** What still has to be fixed on the details step before this draft can be booked. */
  const detailsProblem = (d: Draft): string | null =>
    !tutor.subjects.includes(d.subject)
      ? "Choose a subject."
      : !tutor.modes.includes(d.mode) || (d.mode === "online" && !onlineFlag)
        ? "Choose an available format."
        : me?.role === "parent" && !myChildren.some((c) => c.id === d.childId)
          ? myChildren.length
            ? "Choose who this lesson is for."
            : "Add a child profile to continue."
          : d.type === "trial" && (!trialOffered || trialUsedBy(d.childId || me?.id))
            ? "Trial isn't available — choose a regular lesson."
            : d.notes.length > NOTES_MAX
              ? "Shorten your notes."
              : null;

  // A new press of a booking button: resume an unfinished flow of the same type, otherwise start over.
  const [prevRequest, setPrevRequest] = React.useState(request.id);
  if (prevRequest !== request.id) {
    setPrevRequest(request.id);
    const resume = step !== "success" && draft.type === wantedType(request.type) && (me?.role !== "parent" || !!draft.childId);
    const preset = request.preset;
    if (!resume) {
      setCoupon(null);
      setCouponError(null);
      setAgree(false);
      setAgreeError(false);
      setBooking(null);
      setMessaging(false);
      setPayChoice(null);
      setSession((s) => s + 1);
    }
    if (preset) {
      // The time was picked on the profile calendar: go straight to confirm unless a detail is still missing.
      const next: Draft = { ...(resume ? draft : freshDraft(request.type)), duration: preset.duration, subject: preset.subject, startUtc: preset.startUtc };
      setDraft(next);
      setDir(1);
      setStep(detailsProblem(next) ? "details" : "review");
    } else if (!resume) {
      setDraft(freshDraft(request.type));
      setStep("details");
      setDir(1);
    }
  }

  const set = React.useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), []);

  const trialUsed = trialUsedBy(draft.childId || me?.id);
  const minutes = lessonMinutes(tutor, draft);
  const subtotal = lessonPrice(tutor, draft);
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const total = subtotal - discount;
  const instant = !tutor.rules.requiresApproval && instantFlag;
  const child = myChildren.find((c) => c.id === draft.childId);
  const learnerName = me?.role === "parent" ? child?.firstName ?? "—" : me ? `You (${me.firstName})` : "—";
  const detailsError = detailsProblem(draft);
  const walletCovers = total > 0 && balance >= total;
  const payWith: PayMethod = payChoice === "wallet" ? (walletCovers ? "wallet" : "card") : (payChoice ?? (walletCovers ? "wallet" : "card"));

  const go = (next: Step, d = 1) => {
    setDir(d);
    setStep(next);
    bodyRef.current?.scrollIntoView({ block: "start" });
  };

  const revalidateCoupon = (code: string, amount: number): boolean => {
    const r = validateCoupon(code, amount);
    if (!r.ok) {
      setCoupon(null);
      setCouponError(r.error);
      return false;
    }
    setCoupon({ code: r.data.coupon.code, discount: r.data.discountCents });
    setCouponError(null);
    return true;
  };

  const toReview = () => {
    if (!draft.startUtc) return;
    if (coupon && subtotal > 0) revalidateCoupon(coupon.code, subtotal);
    else if (coupon) setCoupon(null);
    setAgreeError(false);
    go("review");
  };

  const confirm = async () => {
    if (submitting || !draft.startUtc || detailsError) return;
    if (!agree) {
      setAgreeError(true);
      return;
    }
    if (!idem.current || idem.current.session !== session) idem.current = { session, key: idempotencyKey("book") };
    const key = idem.current.key;
    setSubmitting(true);
    // Stand-in for the payment round trip (Stripe test mode in the preview build).
    await new Promise((r) => setTimeout(r, 700));
    const res = createBooking({
      tutorId: tutor.id,
      startUtc: draft.startUtc,
      durationMin: minutes,
      type: draft.type,
      mode: draft.mode,
      subject: draft.subject,
      childId: me?.role === "parent" ? draft.childId : undefined,
      notes: draft.notes.trim() || undefined,
      couponCode: coupon && discount > 0 ? coupon.code : undefined,
      payWith: total > 0 ? payWith : undefined,
      idempotencyKey: key,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      if (SLOT_ERROR.test(res.error)) {
        set({ startUtc: null });
        go("time", -1);
      } else if (/code/i.test(res.error)) {
        setCoupon(null);
        setCouponError(res.error);
      }
      return;
    }
    setBooking(res.data);
    toast.success(res.data.status === "confirmed" ? "Lesson confirmed" : "Request sent", { description: `${tutor.firstName} · ${formatDuration(res.data.durationMin)}` });
    go("success");
  };

  const message = () => {
    if (!booking) return;
    setMessaging(true);
    const r = startConversation(tutor.id, { childId: booking.childId, subject: booking.subject });
    if (!r.ok) {
      setMessaging(false);
      toast.error(r.error);
      return;
    }
    onOpenChange(false);
    router.push(`/dashboard/messages?c=${r.data.id}`);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && submitting) return; // never close mid-payment
    onOpenChange(o);
  };

  /* ── Gates ── */
  let gate: React.ReactNode = null;
  if (!hydrated) gate = <FlowLoading />;
  else if (!me) gate = <SignInGate tutor={tutor} type={request.type} />;
  else if (me.role !== "student" && me.role !== "parent") gate = <RoleGate me={me} onClose={() => onOpenChange(false)} />;
  else if (me.parentalConsent?.status === "pending") gate = <ConsentGate me={me} onClose={() => onOpenChange(false)} />;

  const title = step === "success" && !gate ? (booking?.status === "confirmed" ? "You're booked" : "Request sent") : `${draft.type === "trial" ? "Book a trial" : "Book a lesson"} with ${tutor.firstName}`;
  const stepMeta = STEPS.find((s) => s.key === step);
  const description = gate ? `${tutor.firstName} ${tutor.lastName} · ${formatCents(tutor.hourlyRateCents)}/hr` : stepMeta ? `Step ${STEPS.indexOf(stepMeta) + 1} of 3 · ${stepMeta.long}` : `${tutor.firstName} ${tutor.lastName}`;

  const body = (
    <div ref={bodyRef} className="scroll-mt-4 px-5 py-5 sm:px-6">
      {gate ?? (
        <>
          {step !== "success" && (
            <div className="mb-6">
              <StepIndicator step={step} />
            </div>
          )}
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.26, ease: EASE }}>
              {step === "details" && me && (
                <DetailsStep tutor={tutor} me={me} draft={draft} set={set} trialOffered={trialOffered} trialUsed={trialUsed} onlineAllowed={onlineFlag} learners={myChildren} />
              )}
              {step === "time" && <TimeStep tutor={tutor} draft={draft} set={set} tz={tz} />}
              {step === "review" && draft.startUtc && (
                <ReviewStep
                  tutor={tutor}
                  draft={draft}
                  tz={tz}
                  learnerName={learnerName}
                  subtotal={subtotal}
                  discount={discount}
                  couponCode={coupon?.code ?? null}
                  couponError={couponError}
                  onApplyCoupon={(code) => revalidateCoupon(code, subtotal)}
                  onRemoveCoupon={() => {
                    setCoupon(null);
                    setCouponError(null);
                  }}
                  couponsEnabled={couponsFlag}
                  instant={instant}
                  payWith={payWith}
                  onPayWith={setPayChoice}
                  walletBalance={balance}
                  onTopUp={() => setWalletOpen(true)}
                  policy={policySummary(draft.type, policy)}
                  agree={agree}
                  onAgree={(v) => {
                    setAgree(v);
                    if (v) setAgreeError(false);
                  }}
                  agreeError={agreeError}
                />
              )}
              {step === "success" && booking && (
                <SuccessStep tutor={tutor} booking={booking} tz={tz} learnerName={learnerName} meetingLinkMinutes={policy.meetingLinkVisibleMinutesBefore} onMessage={message} messaging={messaging} />
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );

  const hintId = React.useId();
  const summary = (
    <p className="min-w-0 text-[13px] leading-tight text-muted">
      <span className="block text-[15px] font-semibold tabular-nums text-ink">{subtotal === 0 ? "Free" : formatCents(subtotal, { exact: subtotal % 100 !== 0 })}</span>
      {formatDuration(minutes)} · {draft.type === "trial" ? "trial" : "lesson"}
    </p>
  );

  const footer =
    gate || step === "success" ? null : (
      <div className="flex items-center gap-3">
        {step === "details" ? (
          <div className="min-w-0 flex-1">
            {detailsError ? (
              <p id={hintId} className="text-[13px] leading-snug text-muted">
                {detailsError}
              </p>
            ) : (
              summary
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button variant="ghost" onClick={() => go(step === "review" ? "time" : "details", -1)} disabled={submitting} className="-ml-2 shrink-0">
              <ArrowLeft /> Back
            </Button>
            {step === "time" && !draft.startUtc && (
              <p id={hintId} className="hidden text-[13px] text-muted sm:block">
                Pick a time to continue.
              </p>
            )}
          </div>
        )}

        {step === "details" && (
          <Button size="lg" onClick={() => go("time")} disabled={!!detailsError} aria-describedby={detailsError ? hintId : undefined}>
            Continue <ArrowRight />
          </Button>
        )}
        {step === "time" && (
          <Button size="lg" onClick={toReview} disabled={!draft.startUtc} aria-describedby={!draft.startUtc ? hintId : undefined}>
            Continue <ArrowRight />
          </Button>
        )}
        {step === "review" && (
          <Button size="lg" variant="cta" onClick={confirm} loading={submitting} className="min-w-40">
            {!submitting && total > 0 && <Lock />}
            {submitting ? "Processing…" : total === 0 ? (instant ? "Confirm booking" : "Send request") : instant ? `Pay ${formatCents(total, { exact: total % 100 !== 0 })}${payWith === "wallet" ? " with credits" : ""}` : "Send request"}
          </Button>
        )}
      </div>
    );

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          title={title}
          description={description}
          footer={footer ?? undefined}
          className={isDesktop ? "w-[min(100vw,32rem)]" : "max-h-[92dvh]"}
          onInteractOutside={(e) => (submitting || walletOpen) && e.preventDefault()}
          data-lenis-prevent
        >
          {body}
        </SheetContent>
      </Sheet>
      <WalletDrawer open={walletOpen} onOpenChange={setWalletOpen} />
    </>
  );
}
