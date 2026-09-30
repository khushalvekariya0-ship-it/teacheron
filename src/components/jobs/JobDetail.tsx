"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Link2, SearchX } from "lucide-react";
import { useApp } from "@/lib/store";
import { useHydrated, useNow, useSession, useTutor } from "@/lib/store/hooks";
import { scoreTutor } from "@/lib/matching";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { motion, AnimatePresence, EASE } from "@/components/motion";
import { FactorList, MatchRing } from "@/components/concierge/MatchVisuals";
import { cn } from "@/lib/utils";
import { JobPosting } from "./JobPosting";
import { ApplyGate, ApplyPanel } from "./ApplyPanel";
import { budgetRange, criteriaFromRequirement } from "./jobUtils";

function DetailSkeleton() {
  return (
    <div className="container-page pb-24 pt-6 sm:pt-8" role="status" aria-label="Loading job">
      <Skeleton className="h-4 w-24" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <Skeleton className="mt-5 h-10 w-4/5" />
          <Skeleton className="mt-3 h-4 w-64" />
          <Skeleton className="mt-8 h-24 rounded-xl" />
          <Skeleton className="mt-10 h-4 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function JobDetail({ id }: { id: string }) {
  const hydrated = useHydrated();
  const me = useSession();
  const router = useRouter();
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const users = useApp((s) => s.users);
  const savedJobsMap = useApp((s) => s.savedJobs);
  const toggleSavedJob = useApp((s) => s.toggleSavedJob);
  const tutor = useTutor(me?.role === "tutor" ? me.tutorId : undefined);
  const now = useNow(60_000);

  const job = React.useMemo(() => requirements.find((r) => r.id === id), [requirements, id]);
  const ownerRole = React.useMemo(() => (job ? users.find((u) => u.id === job.ownerId)?.role : undefined), [users, job]);
  const applicants = React.useMemo(() => applications.filter((a) => a.requirementId === id && a.status !== "withdrawn").length, [applications, id]);
  const existing = React.useMemo(
    () => (tutor ? applications.find((a) => a.requirementId === id && a.tutorId === tutor.id && a.status !== "withdrawn") : undefined),
    [applications, id, tutor],
  );
  const match = React.useMemo(() => (tutor && job ? scoreTutor(tutor, criteriaFromRequirement(job)) : null), [tutor, job]);

  if (!hydrated) return <DetailSkeleton />;

  const isOwner = !!job && me?.id === job.ownerId;
  if (!job || (job.status === "draft" && !isOwner)) {
    return (
      <div className="container-page py-16 sm:py-24">
        <EmptyState
          icon={<SearchX />}
          title="We couldn't find this job"
          description="It may have been removed by the family, or the link is incomplete. Browse the open jobs instead."
          action={
            <Button asChild>
              <Link href="/tutor-jobs">Browse open jobs</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const saved = !!me && (savedJobsMap[me.id] ?? []).includes(job.id);
  const isTutor = me?.role === "tutor";
  const family = me?.role === "student" || me?.role === "parent";
  const gateKind = !me ? "guest" : isOwner ? "owner" : family ? "family" : isTutor ? (tutor ? null : "no-profile") : "staff";
  const showMobileBar = job.status === "published" && !isOwner && !existing && (!me || (isTutor && !!tutor));

  const onSave = () => {
    if (!me) {
      toast("Sign in to save jobs", { description: "Saving jobs is available to tutor accounts.", action: { label: "Sign in", onClick: () => router.push(`/login?next=${encodeURIComponent(`/tutor-jobs/${job.id}`)}`) } });
      return;
    }
    if (!isTutor) {
      toast.error("Only tutor accounts can save jobs.");
      return;
    }
    const r = toggleSavedJob(job.id);
    if (!r.ok) toast.error(r.error);
    else toast.success(r.data ? "Job saved" : "Removed from saved jobs");
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/tutor-jobs/${job.id}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link. Copy it from the address bar instead.");
    }
  };

  const statusBadge =
    job.status === "published" ? (
      <Badge tone="success" dot>Accepting applications</Badge>
    ) : job.status === "paused" ? (
      <Badge tone="warning" dot>Paused</Badge>
    ) : job.status === "closed" ? (
      <Badge tone="neutral" dot>Closed</Badge>
    ) : (
      <Badge tone="outline" dot>Draft</Badge>
    );

  const scrollToApply = () => {
    const el = document.getElementById("apply");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("apply-message")?.focus({ preventScroll: true }), 450);
  };

  return (
    <div className={cn("container-page pt-6 sm:pt-8", showMobileBar ? "pb-32 lg:pb-24" : "pb-24")}>
      <div className="flex items-center justify-between gap-3">
        <Link href="/tutor-jobs" className="group inline-flex h-9 items-center gap-1.5 text-sm font-semibold text-ink underline-offset-4 hover:underline">
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden /> All jobs
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Link2 /> <span className="hidden sm:inline">Copy link</span><span className="sr-only sm:hidden">Copy link</span>
          </Button>
          {!isOwner && (
            <Button variant="ghost" size="sm" onClick={onSave} aria-pressed={saved}>
              <Bookmark className={cn(saved && "fill-brand text-brand")} /> {saved ? "Saved" : "Save"}
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {job.status !== "published" && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            {job.status === "paused" && (
              <InlineAlert tone="warning" title="This job is paused">
                The family isn&apos;t accepting applications right now. Existing applications are kept.
              </InlineAlert>
            )}
            {job.status === "closed" && (
              <InlineAlert tone="info" title="This job is closed">
                The family is no longer accepting applications.{" "}
                <Link href="/tutor-jobs" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">Browse open jobs</Link>
              </InlineAlert>
            )}
            {job.status === "draft" && (
              <InlineAlert
                tone="info"
                title="Draft — only you can see this"
                action={
                  <Button asChild size="sm">
                    <Link href={`/post-requirement?id=${job.id}`}>Continue editing</Link>
                  </Button>
                }
              >
                Publish it to show it to tutors on the jobs board.
              </InlineAlert>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="min-w-0">
          <JobPosting job={job} ownerRole={ownerRole} applicants={applicants} now={now} statusBadge={statusBadge} />
        </motion.div>

        <motion.aside
          id="apply"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="scroll-mt-24 space-y-5 self-start lg:sticky lg:top-24"
          aria-label="Apply"
        >
          {gateKind ? (
            <ApplyGate kind={gateKind} jobId={job.id} applicants={applicants} />
          ) : tutor ? (
            <ApplyPanel job={job} tutor={tutor} existing={existing} now={now} />
          ) : null}

          {match && (
            <section className="rounded-2xl border border-line bg-surface" aria-labelledby="match-title">
              <div className="flex items-center gap-4 px-5 pt-5 sm:px-6">
                <MatchRing value={match.percent} size={60} label={`Your match: ${match.percent}%`} />
                <div className="min-w-0">
                  <h2 id="match-title" className="text-[16px] font-bold text-ink">Your match</h2>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">How your profile lines up with what this family asked for.</p>
                </div>
              </div>
              {match.disqualified && (
                <InlineAlert tone="warning" className="mx-5 mt-4 sm:mx-6">
                  Your profile doesn&apos;t list something this job requires (subject or lesson format). Update your profile if that&apos;s out of date.
                </InlineAlert>
              )}
              <div className="mt-3 border-t border-line px-5 sm:px-6">
                <FactorList factors={match.factors} dense />
              </div>
              <p className="border-t border-line px-5 py-3.5 text-[12.5px] leading-relaxed text-muted sm:px-6">
                Rules-based and transparent. Featured placement and subscription plans never change a score.
              </p>
            </section>
          )}
        </motion.aside>
      </div>

      {showMobileBar && (
        <div data-fixed-bottom className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-bold tabular-nums text-ink">{budgetRange(job)}</p>
              <p className="truncate text-[12.5px] text-muted">{match ? `${match.percent}% match · ` : ""}{applicants === 0 ? "Be the first to apply" : `${applicants} applied`}</p>
            </div>
            {me ? (
              <Button onClick={scrollToApply} className="shrink-0">
                Apply now
              </Button>
            ) : (
              <Button asChild className="shrink-0">
                <Link href={`/login?next=${encodeURIComponent(`/tutor-jobs/${job.id}`)}`}>Sign in to apply</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
