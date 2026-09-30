"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ExternalLink, Lock, LogIn, ShieldAlert, Sparkles, UserPlus } from "lucide-react";
import type { Tutor, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useHydrated, useSession, useTutors } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Controls";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { EASE } from "@/components/motion";
import { setSaveExitHandler } from "./saveExit";
import {
  STEPS, TOTAL_STEPS, initialData, toStoreData, validSteps, type AvailabilityValues, type CredentialsValues, type ExperienceValues, type ModesValues,
  type OnboardingData, type PersonalValues, type PricingValues, type ProfileValues, type SubjectsValues, type VerificationValues,
} from "./schema";
import {
  AvailabilityStep, CredentialsStep, ExperienceStep, ModesStep, PersonalStep, PricingStep, ProfileStep, ReviewStep, SubjectsStep, VerificationStep,
  type PhotoPreview,
} from "./steps";

/* ─── Entry: gates ──────────────────────────────────────────────────────────── */

export function TutorOnboarding() {
  const hydrated = useHydrated();
  const me = useSession();
  const tutors = useTutors();
  const [published, setPublished] = React.useState<{ tutor: Tutor; idSubmitted: boolean } | null>(null);

  if (!hydrated) return <OnboardingSkeleton />;
  if (published) return <SuccessScreen tutor={published.tutor} idSubmitted={published.idSubmitted} />;
  if (!me) return <SignedOutGate />;
  if (me.role !== "tutor") return <WrongRoleGate me={me} />;
  const existing = me.tutorId ? tutors.find((t) => t.id === me.tutorId) : undefined;
  if (existing) return <AlreadyLive tutor={existing} />;
  return <Wizard me={me} onPublished={(tutor, idSubmitted) => setPublished({ tutor, idSubmitted })} />;
}

function GateCard({ icon, title, children, actions }: { icon: React.ReactNode; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm sm:p-10"
      >
        <div className="mx-auto grid size-12 place-items-center rounded-xl border border-line bg-canvas text-navy [&_svg]:size-5">{icon}</div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-ink">{title}</h1>
        <div className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{children}</div>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">{actions}</div>
      </motion.div>
    </div>
  );
}

function SignedOutGate() {
  return (
    <GateCard
      icon={<Lock />}
      title="Create your tutor account"
      actions={
        <>
          <Button asChild size="lg">
            <Link href="/register?role=tutor">
              <UserPlus /> Create a tutor account
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/login?next=${encodeURIComponent("/onboarding/tutor")}`}>
              <LogIn /> Sign in
            </Link>
          </Button>
        </>
      }
    >
      Setting up your profile takes about 10 minutes. Your progress saves as you go, so you can finish any time.
    </GateCard>
  );
}

function WrongRoleGate({ me }: { me: User }) {
  const logout = useApp((s) => s.logout);
  const router = useRouter();
  return (
    <GateCard
      icon={<ShieldAlert />}
      title="Onboarding is for tutor accounts"
      actions={
        <>
          <Button asChild size="lg">
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              logout();
              router.push("/register?role=tutor");
            }}
          >
            Sign out &amp; create tutor account
          </Button>
        </>
      }
    >
      You&apos;re signed in with a {ROLE_LABEL[me.role].toLowerCase()} account. To teach on TutorLink, sign out and create a separate tutor account with a different email address.
    </GateCard>
  );
}

function AlreadyLive({ tutor }: { tutor: Tutor }) {
  return (
    <GateCard
      icon={<BadgeCheck />}
      title="Your profile is live"
      actions={
        <>
          <Button asChild size="lg">
            <Link href="/dashboard/profile">Edit your profile</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/tutors/${tutor.slug}`}>
              View public profile <ExternalLink />
            </Link>
          </Button>
        </>
      }
    >
      You&apos;ve already completed onboarding, {tutor.firstName}. Update your subjects, rates and availability from your dashboard at any time.
    </GateCard>
  );
}

function OnboardingSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[16rem_1fr] lg:py-14" role="status" aria-label="Loading">
      <div className="hidden space-y-3 lg:block">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-1.5 w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="mt-4 h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/* ─── Success ───────────────────────────────────────────────────────────────── */

function SuccessScreen({ tutor, idSubmitted }: { tutor: Tutor; idSubmitted: boolean }) {
  const router = useRouter();
  React.useEffect(() => {
    const t = setTimeout(() => router.push("/dashboard"), 4000);
    return () => clearTimeout(t);
  }, [router]);
  const next = [
    { done: true, text: "Profile published — families can find you in search" },
    { done: idSubmitted, text: idSubmitted ? "Identity check submitted for review" : "Upload a photo ID to start your identity check" },
    { done: false, text: "Add diplomas and certificates in Verification" },
    { done: false, text: "Fine-tune booking rules and block dates you're away" },
  ];
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 text-center sm:py-24" role="status" aria-live="polite">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.35, duration: 0.7 }}
        className="relative mx-auto grid size-20 place-items-center rounded-full bg-success-50"
      >
        <motion.span
          className="absolute inset-0 rounded-full border border-success-200"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.4 }}
          aria-hidden
        />
        <svg viewBox="0 0 24 24" className="size-9 text-success" aria-hidden>
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.25 }}
          />
        </svg>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-ink">Your profile is live</h1>
        <p className="mt-2 text-[15px] text-muted">Welcome to TutorLink, {tutor.firstName}. Taking you to your dashboard…</p>
      </motion.div>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.6 } } }}
        className="mt-8 space-y-2 rounded-xl border border-line bg-surface p-4 text-left shadow-xs"
      >
        {next.map((n) => (
          <motion.li key={n.text} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} className="flex items-start gap-2.5 text-sm">
            <span className={cn("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full", n.done ? "bg-success text-white" : "border border-line-strong")} aria-hidden>
              {n.done && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className={n.done ? "text-ink" : "text-ink-2"}>
              <span className="sr-only">{n.done ? "Done: " : "Next: "}</span>
              {n.text}
            </span>
          </motion.li>
        ))}
      </motion.ul>
      <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/dashboard">
            Go to dashboard <ArrowRight />
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href={`/tutors/${tutor.slug}`}>View public profile</Link>
        </Button>
      </div>
    </div>
  );
}

/* ─── Wizard ────────────────────────────────────────────────────────────────── */

const clampStep = (n: number) => Math.min(TOTAL_STEPS, Math.max(1, Math.round(n) || 1));

/** Direction-aware slide: forward enters from the right, back enters from the left. */
const STEP_MOTION = {
  enter: (d: number) => ({ opacity: 0, x: d * 16 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -12 }),
};

function Wizard({ me, onPublished }: { me: User; onPublished: (tutor: Tutor, idSubmitted: boolean) => void }) {
  const router = useRouter();
  const draft = useApp((s) => s.onboarding[me.id]);
  const saveOnboarding = useApp((s) => s.saveOnboarding);
  const submitOnboarding = useApp((s) => s.submitOnboarding);
  const updateMe = useApp((s) => s.updateMe);

  const [data, setData] = React.useState<OnboardingData>(() => initialData(draft?.data, me));
  const [step, setStep] = React.useState(() => clampStep(draft?.step ?? 1));
  const [furthest, setFurthest] = React.useState(() => clampStep(draft?.step ?? 1));
  const [dir, setDir] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [photo, setPhoto] = React.useState<PhotoPreview | null>(null);
  const getter = React.useRef<() => Record<string, unknown>>(() => ({}));
  const navigated = React.useRef(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const bindValues = React.useCallback((g: () => Record<string, unknown>) => {
    getter.current = g;
  }, []);

  // Free the in-memory photo preview when it's replaced or the wizard unmounts.
  React.useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const meta = STEPS[step - 1];
  const formId = `onboarding-step-${step}`;
  const valid = React.useMemo(() => new Set(validSteps(data)), [data]);
  const completed = STEPS.filter((s) => s.schema && s.n < furthest && valid.has(s.n)).length;
  const percent = Math.round((completed / (TOTAL_STEPS - 1)) * 100);

  const persist = React.useCallback(
    (atStep: number, values: Record<string, unknown>) => {
      const res = saveOnboarding(atStep, toStoreData(values as OnboardingData));
      if (!res.ok) toast.error(res.error);
      return res.ok;
    },
    [saveOnboarding],
  );

  const go = (target: number) => {
    const values = getter.current();
    const merged = { ...data, ...values } as OnboardingData;
    setData(merged);
    if (step !== TOTAL_STEPS) persist(step, values);
    getter.current = () => ({});
    setDir(target > step ? 1 : -1);
    setSubmitError(null);
    navigated.current = true;
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const advance = (values: OnboardingData) => {
    const merged = { ...data, ...values };
    setData(merged);
    if (step === 1) {
      const r = updateMe({ phone: values.phone, city: values.city, state: values.state, zip: values.zip });
      if (!r.ok) toast.error(r.error);
    }
    const next = step + 1;
    persist(next, values as Record<string, unknown>);
    getter.current = () => ({});
    setFurthest((f) => Math.max(f, next));
    setDir(1);
    navigated.current = true;
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () => {
    const firstInvalid = STEPS.find((s) => s.schema && !s.schema.safeParse(data).success);
    if (firstInvalid) {
      toast.error(`“${firstInvalid.title}” needs attention before you can submit.`);
      go(firstInvalid.n);
      return;
    }
    setSubmitting(true);
    if (!persist(TOTAL_STEPS, data as Record<string, unknown>)) {
      setSubmitting(false);
      return;
    }
    const res = submitOnboarding();
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(res.error);
      toast.error(res.error);
      return;
    }
    onPublished(res.data, !!data.idDocument);
  };

  // "Save & exit" in the layout header.
  React.useEffect(() => {
    setSaveExitHandler(() => {
      const values = getter.current();
      if (persist(step, values)) {
        toast.success("Progress saved", { description: "Pick up where you left off any time from your dashboard." });
        router.push("/dashboard");
      }
    });
    return () => setSaveExitHandler(null);
  }, [persist, router, step]);

  const common = { formId, bindValues };
  const content = (() => {
    switch (step) {
      case 1:
        return <PersonalStep {...common} me={me} defaults={data as PersonalValues} onValid={advance} />;
      case 2:
        return <SubjectsStep {...common} defaults={data as SubjectsValues} onValid={advance} />;
      case 3:
        return <ExperienceStep {...common} defaults={data as ExperienceValues} onValid={advance} />;
      case 4:
        return <CredentialsStep {...common} defaults={data as CredentialsValues} onValid={advance} />;
      case 5:
        return <ModesStep {...common} defaults={data as ModesValues} onValid={advance} />;
      case 6:
        return <PricingStep {...common} defaults={data as PricingValues} onValid={advance} />;
      case 7:
        return <AvailabilityStep {...common} defaults={data as AvailabilityValues} onValid={advance} timezone={me.timezone} />;
      case 8:
        return <ProfileStep {...common} me={me} photo={photo} onPhoto={setPhoto} defaults={data as ProfileValues} onValid={advance} />;
      case 9:
        return <VerificationStep {...common} defaults={data as VerificationValues} onValid={advance} />;
      default:
        return <ReviewStep formId={formId} bindValues={bindValues} data={data} me={me} onEdit={go} onValid={submit} error={submitError} />;
    }
  })();

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12 lg:pb-16 lg:pt-14">
      {/* Desktop stepper */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <p className="text-[13px] font-medium text-ink">Tutor onboarding</p>
          <div className="mt-2 flex items-center gap-3">
            <Progress value={percent} label="Profile completion" className="flex-1" />
            <span className="text-[12.5px] font-medium tabular-nums text-muted">{percent}%</span>
          </div>
          <nav aria-label="Onboarding steps" className="mt-6">
            <ol className="relative space-y-0.5">
              <span className="absolute bottom-4 left-[15px] top-4 w-px bg-line" aria-hidden />
              {STEPS.map((s) => {
                const current = s.n === step;
                const reachable = s.n <= furthest;
                const done = s.n < furthest && (s.schema ? valid.has(s.n) : false);
                return (
                  <li key={s.n} className="relative">
                    <button
                      type="button"
                      disabled={!reachable || current}
                      onClick={() => go(s.n)}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors disabled:cursor-default",
                        reachable && !current && "hover:bg-sunken",
                      )}
                    >
                      {current && <motion.span layoutId="onboarding-step" className="absolute inset-0 rounded-lg bg-surface shadow-xs ring-1 ring-line" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                      <span
                        className={cn(
                          "relative grid size-[21px] shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                          done ? "bg-navy text-on-ink" : current ? "border-2 border-navy bg-surface text-navy" : "border border-line-strong bg-canvas text-muted",
                        )}
                      >
                        {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : s.n}
                      </span>
                      <span className={cn("relative text-[13.5px]", current ? "font-semibold text-ink" : reachable ? "font-medium text-ink-2" : "text-muted")}>
                        {s.title}
                        {done && <span className="sr-only"> (complete)</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <p className="mt-6 flex gap-2 text-[12.5px] leading-snug text-muted">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-navy" aria-hidden /> Progress saves each time you move between steps.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile progress */}
        <div className="mb-6 lg:hidden">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-medium text-ink">
              Step {step} of {TOTAL_STEPS}
              <span className="text-muted"> · {meta.short}</span>
            </span>
            <span className="tabular-nums text-muted">{percent}% complete</span>
          </div>
          <div className="mt-2 grid grid-cols-10 gap-1" aria-hidden>
            {STEPS.map((s) => (
              <span key={s.n} className={cn("h-1 rounded-full transition-colors duration-300", s.n < step ? "bg-navy" : s.n === step ? "bg-navy/60" : "bg-sunken")} />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={STEP_MOTION}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: EASE }}
            onAnimationComplete={(definition) => {
              // Move focus to the new step's heading once it has finished entering.
              if (definition === "center" && navigated.current) {
                navigated.current = false;
                headingRef.current?.focus({ preventScroll: true });
              }
            }}
          >
            <p className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Step {step} of {TOTAL_STEPS}
            </p>
            <h1 ref={headingRef} tabIndex={-1} className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-ink outline-none sm:text-[28px]">
              {meta.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{meta.description}</p>
            <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-7">{content}</div>
          </motion.div>
        </AnimatePresence>

        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 1} className={cn(step === 1 && "invisible")}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1.5 text-[12.5px] text-muted sm:inline-flex">
                <Check className="size-3.5" aria-hidden /> Saved between steps
              </span>
              <Button type="submit" form={formId} loading={submitting} size="lg">
                {step === TOTAL_STEPS ? "Publish profile" : "Continue"} {step !== TOTAL_STEPS && <ArrowRight />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
