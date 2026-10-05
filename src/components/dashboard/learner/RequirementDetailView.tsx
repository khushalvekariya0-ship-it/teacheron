"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, ChevronDown, CircleSlash, ClipboardList, GitCompareArrows, Minus, MoreHorizontal, MessageSquare, Pause, Paperclip, Pencil, Play,
  Send, Star, ThumbsDown, Trash2, UserCheck, X, CalendarPlus, Inbox,
} from "lucide-react";
import type { Application, ApplicationStatus, Requirement, Tutor, User } from "@/lib/types";
import { PageHeader, RoleGate } from "@/components/dashboard/Shell";
import { AnimatePresence, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, DetailRow, Separator } from "@/components/ui/Card";
import { Checkbox, Segmented } from "@/components/ui/Controls";
import { Select } from "@/components/ui/Input";
import { ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import { StarRating } from "@/components/ui/StarRating";
import { toast } from "@/components/ui/Toast";
import { VerifiedBadge } from "@/components/domain/Badges";
import { useApp, type Result } from "@/lib/store";
import { useNow, useSession } from "@/lib/store/hooks";
import { scoreTutor, type FactorResult, type MatchCriteria } from "@/lib/matching";
import { subjectName, GRADE_LABEL, MODE_LABEL, TIMES_OF_DAY, WEEKDAYS } from "@/lib/data/catalog";
import { formatCents, formatDate, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tutorFullName, useTutorMap } from "@/components/dashboard/shared/hooks";
import { useMyChildren } from "./data";
import { APPLICATION_STATUS_META, ApplicationStatusBadge, REQUIREMENT_STATUS_META, RequirementStatusBadge, isVisibleApplication } from "./meta";

const ACTIVE: ApplicationStatus[] = ["applied", "viewed", "shortlisted", "contacted", "trial_requested"];

type Filter = "all" | "active" | "shortlisted" | "contacted" | "trial_requested" | "hired" | "declined";
const FILTERS: { value: Filter; label: string; match: (s: ApplicationStatus) => boolean }[] = [
  { value: "all", label: "All applications", match: () => true },
  { value: "active", label: "New & viewed", match: (s) => s === "applied" || s === "viewed" },
  { value: "shortlisted", label: "Shortlisted", match: (s) => s === "shortlisted" },
  { value: "contacted", label: "Contacted", match: (s) => s === "contacted" },
  { value: "trial_requested", label: "Trial requested", match: (s) => s === "trial_requested" },
  { value: "hired", label: "Hired", match: (s) => s === "hired" },
  { value: "declined", label: "Declined & closed", match: (s) => s === "rejected" || s === "closed" },
];

type SortKey = "match" | "newest" | "rate";

function criteriaFor(r: Requirement): MatchCriteria {
  return {
    subject: r.subject || undefined,
    grade: r.grade,
    modes: r.modes.length ? r.modes : undefined,
    location: r.zip || r.city || undefined,
    budgetMaxCents: r.budgetMaxCents || undefined,
    days: r.days.length ? r.days : undefined,
    timesOfDay: r.timesOfDay.length ? r.timesOfDay : undefined,
    minExperienceYears: r.minExperienceYears || undefined,
    language: r.languages.find((l) => l !== "English"),
    learningSupport: r.learningSupport?.length ? r.learningSupport : undefined,
  };
}

export function RequirementDetailView({ id }: { id: string }) {
  return (
    <RoleGate roles={["student", "parent"]}>
      <Detail id={id} />
    </RoleGate>
  );
}

type Dialog =
  | { kind: "hire"; app: Application; name: string }
  | { kind: "reject"; app: Application; name: string }
  | { kind: "close-after-hire"; name: string }
  | { kind: "close" }
  | { kind: "delete" }
  | null;

function Detail({ id }: { id: string }) {
  const me = useSession() as User;
  const router = useRouter();
  const now = useNow(60_000);
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const compare = useApp((s) => s.compare);
  const setApplicationStatus = useApp((s) => s.setApplicationStatus);
  const setRequirementStatus = useApp((s) => s.setRequirementStatus);
  const publishRequirement = useApp((s) => s.publishRequirement);
  const deleteRequirement = useApp((s) => s.deleteRequirement);
  const startConversation = useApp((s) => s.startConversation);
  const toggleCompare = useApp((s) => s.toggleCompare);
  const clearCompare = useApp((s) => s.clearCompare);
  const tutorMap = useTutorMap();
  const children = useMyChildren(me);

  const req = requirements.find((r) => r.id === id);
  const owned = !!req && req.ownerId === me.id;
  const apps = React.useMemo(() => (owned ? applications.filter((a) => a.requirementId === id && isVisibleApplication(a.status)) : []), [applications, id, owned]);

  // Remember which applications were unseen when the page opened, so they stay marked "New" during this visit.
  const [freshIds] = React.useState(() => new Set(apps.filter((a) => a.status === "applied").map((a) => a.id)));
  const [filter, setFilter] = React.useState<Filter>("all");
  const [sort, setSort] = React.useState<SortKey>("match");
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Opening the requirement counts as viewing its new applications. Store actions are safe to call from effects.
  const unseen = apps.filter((a) => a.status === "applied").map((a) => a.id).join(",");
  React.useEffect(() => {
    if (!unseen) return;
    for (const appId of unseen.split(",")) setApplicationStatus(appId, "viewed");
  }, [unseen, setApplicationStatus]);

  const criteria = React.useMemo(() => (req ? criteriaFor(req) : {}), [req]);
  const scored = React.useMemo(
    () =>
      apps.map((a) => {
        const tutor = tutorMap.get(a.tutorId);
        return { app: a, tutor, match: tutor ? scoreTutor(tutor, criteria) : null };
      }),
    [apps, tutorMap, criteria],
  );

  if (!req || !owned) {
    return (
      <Card>
        <EmptyState
          icon={<ClipboardList />}
          title="Requirement not found"
          description="It may have been deleted, or it belongs to a different account."
          action={
            <Button asChild variant="secondary">
              <Link href="/dashboard/requirements">
                <ArrowLeft /> Back to my requirements
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, apps.filter((a) => f.match(a.status)).length])) as Record<Filter, number>;
  const visible = scored
    .filter((s) => FILTERS.find((f) => f.value === filter)!.match(s.app.status))
    .sort((a, b) =>
      sort === "newest"
        ? b.app.createdAt.localeCompare(a.app.createdAt)
        : sort === "rate"
          ? a.app.proposedRateCents - b.app.proposedRateCents
          : (b.match?.percent ?? 0) - (a.match?.percent ?? 0),
    );
  const childName = req.childId ? children.find((c) => c.id === req.childId)?.firstName : undefined;
  const closed = req.status === "closed";
  const compareFromHere = compare.filter((t) => apps.some((a) => a.tutorId === t)).length;

  const report = (res: Result<unknown>, success?: string) => {
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    if (success) toast.success(success);
    return true;
  };

  const message = (a: Application, tutor?: Tutor) => {
    setBusyId(a.id);
    const conv = startConversation(a.tutorId, { childId: req.childId, subject: req.subject || undefined });
    if (!report(conv)) return setBusyId(null);
    if (["applied", "viewed", "shortlisted"].includes(a.status)) setApplicationStatus(a.id, "contacted");
    if (conv.ok) {
      toast.success(`Opening your conversation with ${tutor?.firstName ?? "the tutor"}`);
      router.push(`/dashboard/messages?c=${conv.data.id}`);
    }
  };

  const requestTrial = (a: Application, tutor: Tutor) => {
    setBusyId(a.id);
    if (!report(setApplicationStatus(a.id, "trial_requested"))) return setBusyId(null);
    router.push(`/tutors/${tutor.slug}?book=trial`);
  };

  const confirmDialog = () => {
    if (!dialog) return;
    if (dialog.kind === "hire") {
      const ok = report(setApplicationStatus(dialog.app.id, "hired"), `You hired ${dialog.name}`);
      setDialog(ok && req.status !== "closed" ? { kind: "close-after-hire", name: dialog.name } : null);
      return;
    }
    if (dialog.kind === "reject") report(setApplicationStatus(dialog.app.id, "rejected"), `Declined ${dialog.name}'s application`);
    if (dialog.kind === "close" || dialog.kind === "close-after-hire") report(setRequirementStatus(req.id, "closed"), "Requirement closed");
    if (dialog.kind === "delete") {
      if (report(deleteRequirement(req.id), "Requirement deleted")) router.push("/dashboard/requirements");
    }
    setDialog(null);
  };

  const summaryRows: [string, React.ReactNode][] = [
    ["Subject", req.subject ? subjectName(req.subject) : "—"],
    ["Grade", GRADE_LABEL[req.grade]],
    ...(childName ? ([["For", childName]] as [string, React.ReactNode][]) : []),
    ["Lesson format", req.modes.map((m) => MODE_LABEL[m]).join(" or ") || "—"],
    ["Location", [req.city, req.state].filter(Boolean).join(", ") + (req.zip ? ` ${req.zip}` : "") || "—"],
    ["Days", req.days.length ? WEEKDAYS.filter((d) => req.days.includes(d)).join(", ") : "Flexible"],
    ["Times", req.timesOfDay.length ? TIMES_OF_DAY.filter((t) => req.timesOfDay.includes(t.value)).map((t) => t.label).join(", ") : "Flexible"],
    ["Sessions", `${req.sessionsPerWeek} per week`],
    ["Budget", `${formatCents(req.budgetMinCents)}–${formatCents(req.budgetMaxCents)}/hr`],
    ...(req.minExperienceYears ? ([["Experience", `${req.minExperienceYears}+ years`]] as [string, React.ReactNode][]) : []),
    ["Languages", req.languages.join(", ") || "English"],
    ...(req.learningSupport?.length ? ([["Learning support", req.learningSupport.join(", ")]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/requirements", label: "My requirements" }}
        eyebrow={<RequirementStatusBadge status={req.status} size="md" />}
        title={req.title || "Untitled draft"}
        description={
          <>
            {req.subject ? subjectName(req.subject) : "No subject"} · {GRADE_LABEL[req.grade]}
            {childName && ` · for ${childName}`} · {req.publishedAt ? `Published ${formatDate(req.publishedAt)}` : `Created ${formatDate(req.createdAt)}`}
          </>
        }
        actions={
          <>
            {!closed && (
              <Button asChild variant="secondary">
                <Link href={`/post-requirement?id=${encodeURIComponent(req.id)}`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {req.status === "draft" && (
              <Button onClick={() => report(publishRequirement(req.id), "Requirement published — tutors can now apply")}>
                <Send /> Publish
              </Button>
            )}
            {req.status === "published" && (
              <Button variant="secondary" onClick={() => report(setRequirementStatus(req.id, "paused"), "Requirement paused")}>
                <Pause /> Pause
              </Button>
            )}
            {req.status === "paused" && (
              <Button onClick={() => report(setRequirementStatus(req.id, "published"), "Requirement resumed")}>
                <Play /> Resume
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More requirement actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(req.status === "published" || req.status === "paused") && (
                  <DropdownMenuItem onSelect={() => setDialog({ kind: "close" })}>
                    <CircleSlash /> Close requirement
                  </DropdownMenuItem>
                )}
                {(req.status === "published" || req.status === "paused") && <DropdownMenuSeparator />}
                <DropdownMenuItem tone="danger" onSelect={() => setDialog({ kind: "delete" })}>
                  <Trash2 /> Delete requirement
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Summary */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:order-last">
          <Card>
            <CardHeader title="Requirement" description={REQUIREMENT_STATUS_META[req.status].description} />
            <CardContent className="pt-3">
              <dl className="divide-y divide-line">
                {summaryRows.map(([k, v]) => (
                  <DetailRow key={k} label={k}>
                    {v}
                  </DetailRow>
                ))}
              </dl>
              {(req.objectives || req.details || req.preferences) && <Separator className="my-4" />}
              {req.objectives && (
                <div>
                  <p className="text-[12px] font-medium text-muted">Learning objectives</p>
                  <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{req.objectives}</p>
                </div>
              )}
              {req.details && (
                <div className="mt-4">
                  <p className="text-[12px] font-medium text-muted">Details</p>
                  <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{req.details}</p>
                </div>
              )}
              {req.preferences && (
                <div className="mt-4">
                  <p className="text-[12px] font-medium text-muted">Tutor preferences</p>
                  <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{req.preferences}</p>
                </div>
              )}
              {!!req.attachments?.length && (
                <ul className="mt-4 space-y-1.5">
                  {req.attachments.map((f) => (
                    <li key={f.name} className="flex items-center gap-2 text-[13px] text-ink-2">
                      <Paperclip className="size-3.5 text-subtle" aria-hidden /> {f.name} <span className="text-muted">· {f.sizeKb} KB</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Applications */}
        <section aria-labelledby="apps-heading" className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="apps-heading" className="text-[17px] font-semibold tracking-tight text-ink">
                Applications <span className="font-normal tabular-nums text-muted">({apps.length})</span>
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">Match scores use the same transparent factors as tutor search.</p>
            </div>
            {apps.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Filter applications by status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as Filter)}
                  options={FILTERS.map((f) => ({ value: f.value, label: `${f.label} (${counts[f.value]})` }))}
                  className="w-52"
                />
                <Segmented
                  label="Sort applications"
                  size="sm"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "match", label: "Best match" },
                    { value: "newest", label: "Newest" },
                    { value: "rate", label: "Rate" },
                  ]}
                />
              </div>
            )}
          </div>

          {apps.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Inbox />}
                title={req.status === "draft" ? "Publish to receive applications" : "No applications yet"}
                description={
                  req.status === "draft"
                    ? "Tutors can only apply once your requirement is published."
                    : req.status === "paused"
                      ? "This requirement is paused. Resume it so tutors can apply."
                      : "Tutors who teach this subject are notified when a matching requirement is published. You can also search and contact tutors directly."
                }
                action={
                  req.status === "draft" ? (
                    <Button size="sm" onClick={() => report(publishRequirement(req.id), "Requirement published — tutors can now apply")}>
                      <Send /> Publish now
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/tutors?${new URLSearchParams({ ...(req.subject ? { subject: req.subject } : {}), grade: req.grade }).toString()}`}>Search tutors</Link>
                    </Button>
                  )
                }
              />
            </Card>
          ) : visible.length === 0 ? (
            <Card>
              <EmptyState compact icon={<Inbox />} title="No applications with this status" action={<Button size="sm" variant="secondary" onClick={() => setFilter("all")}>Show all applications</Button>} />
            </Card>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map(({ app, tutor, match }, i) => (
                  <motion.li
                    key={app.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 6) * 0.05 } }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                  >
                    <ApplicationCard
                      app={app}
                      tutor={tutor}
                      percent={match?.percent ?? null}
                      factors={match?.factors ?? []}
                      budgetMaxCents={req.budgetMaxCents}
                      fresh={freshIds.has(app.id)}
                      now={now}
                      closed={closed}
                      busy={busyId === app.id}
                      comparing={compare.includes(app.tutorId)}
                      compareFull={compare.length >= 3 && !compare.includes(app.tutorId)}
                      onCompare={() => report(toggleCompare(app.tutorId))}
                      onShortlist={() => report(setApplicationStatus(app.id, "shortlisted"), `${tutor?.firstName ?? "Tutor"} added to your shortlist`)}
                      onMessage={() => message(app, tutor)}
                      onTrial={() => tutor && requestTrial(app, tutor)}
                      onHire={() => setDialog({ kind: "hire", app, name: tutorFullName(tutor) })}
                      onReject={() => setDialog({ kind: "reject", app, name: tutorFullName(tutor) })}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          <AnimatePresence>
            {compare.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="sticky bottom-4 z-10 mt-4"
              >
                <div data-spotlight className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3 shadow-lg">
                  <p className="flex items-center gap-2 text-[13.5px] text-ink-2">
                    <GitCompareArrows className="size-4 text-ink" aria-hidden />
                    <span>
                      <span className="font-medium text-ink">{pluralize(compare.length, "tutor")}</span> selected to compare
                      {compareFromHere !== compare.length && <span className="text-muted"> ({compareFromHere} from this requirement)</span>}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={clearCompare}>
                      Clear
                    </Button>
                    <Button asChild size="sm" disabled={compare.length < 2}>
                      <Link href="/compare" aria-disabled={compare.length < 2} onClick={(e) => compare.length < 2 && e.preventDefault()}>
                        {compare.length < 2 ? "Select one more" : `Compare ${compare.length}`}
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <ConfirmDialog
        open={dialog?.kind === "hire"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.kind === "hire" ? `Hire ${dialog.name}?` : "Hire tutor?"}
        description="They'll be notified that you've chosen them. Book lessons from their profile or the conversation."
        confirmLabel="Hire tutor"
        onConfirm={confirmDialog}
      />
      <ConfirmDialog
        open={dialog?.kind === "close-after-hire"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Close this requirement too?"
        description={`You've hired ${dialog?.kind === "close-after-hire" ? dialog.name : "a tutor"}. Closing stops new applications and marks the remaining ones as closed.`}
        confirmLabel="Close requirement"
        onConfirm={confirmDialog}
      />
      <ConfirmDialog
        open={dialog?.kind === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.kind === "reject" ? `Decline ${dialog.name}'s application?` : "Decline application?"}
        description="The tutor will be notified. You can't undo this."
        confirmLabel="Decline"
        tone="danger"
        onConfirm={confirmDialog}
      />
      <ConfirmDialog
        open={dialog?.kind === "close"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Close this requirement?"
        description="Tutors will no longer be able to apply, and open applications will be marked closed. This can't be undone."
        confirmLabel="Close requirement"
        onConfirm={confirmDialog}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Delete this requirement?"
        description="The requirement and its applications will be permanently removed."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDialog}
      />
    </div>
  );
}

/* ─── Application card ──────────────────────────────────────────────────────── */

function FactorIcon({ status }: { status: FactorResult["status"] }) {
  if (status === "match")
    return (
      <span className="grid size-4 place-items-center rounded-full bg-ink text-on-ink" aria-hidden>
        <Check className="size-2.5" strokeWidth={3} />
      </span>
    );
  if (status === "partial")
    return (
      <span className="grid size-4 place-items-center rounded-full bg-yellow-soft text-ink" aria-hidden>
        <Minus className="size-2.5" strokeWidth={3} />
      </span>
    );
  if (status === "miss")
    return (
      <span className="grid size-4 place-items-center rounded-full bg-sunken text-muted" aria-hidden>
        <X className="size-2.5" strokeWidth={3} />
      </span>
    );
  return <span className="grid size-4 place-items-center rounded-full border border-dashed border-line-strong" aria-hidden />;
}

const FACTOR_STATUS_LABEL: Record<FactorResult["status"], string> = { match: "Match", partial: "Partial match", miss: "Not a match", neutral: "Not scored" };

function ApplicationCard({
  app,
  tutor,
  percent,
  factors,
  budgetMaxCents,
  fresh,
  now,
  closed,
  busy,
  comparing,
  compareFull,
  onCompare,
  onShortlist,
  onMessage,
  onTrial,
  onHire,
  onReject,
}: {
  app: Application;
  tutor?: Tutor;
  percent: number | null;
  factors: FactorResult[];
  budgetMaxCents: number;
  fresh: boolean;
  now: number;
  closed: boolean;
  busy: boolean;
  comparing: boolean;
  compareFull: boolean;
  onCompare: () => void;
  onShortlist: () => void;
  onMessage: () => void;
  onTrial: () => void;
  onHire: () => void;
  onReject: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const name = tutorFullName(tutor);
  const active = ACTIVE.includes(app.status) && !closed;
  const canShortlist = !closed && (app.status === "applied" || app.status === "viewed");
  const canMessage = app.status !== "rejected";
  const canTrial = active && app.status !== "trial_requested" && !!tutor?.trial.enabled;
  const overBudget = app.proposedRateCents > budgetMaxCents;
  const scored = factors.filter((f) => f.status !== "neutral");

  return (
    <Card className={cn("overflow-hidden transition-[border-color,box-shadow]", app.status === "hired" && "border-success-200", comparing && "border-ink ring-1 ring-ink")}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <Avatar name={name} src={tutor?.photoUrl} tone={tutor?.tone} size="lg" verified={tutor?.verification.identity === "verified"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                {tutor ? (
                  <Link href={`/tutors/${tutor.slug}`} className="hover:text-ink">
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </h3>
              {tutor && <VerifiedBadge tutor={tutor} size="sm" />}
              {fresh && (app.status === "applied" || app.status === "viewed") && (
                <Badge tone="solid" size="sm">
                  New
                </Badge>
              )}
            </div>
            {tutor && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{tutor.headline}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
              {tutor ? <StarRating rating={tutor.rating} count={tutor.reviewCount} showStars={false} /> : <span>Profile unavailable</span>}
              {tutor && <span>{tutor.experienceYears} yrs experience</span>}
              {tutor && (
                <span>
                  {tutor.city}, {tutor.state}
                </span>
              )}
            </div>
          </div>
          {percent !== null && (
            <div className="shrink-0 text-right">
              <p className="text-[22px] font-semibold leading-none tabular-nums tracking-tight text-ink">{percent}%</p>
              <p className="mt-1 text-[11.5px] text-muted">match</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          <ApplicationStatusBadge status={app.status} />
          <span>Applied {formatRelative(app.createdAt, now)}</span>
        </div>

        <blockquote className="mt-3 rounded-xl bg-canvas px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">{app.message}</blockquote>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
          <span>
            <span className="text-muted">Proposed rate </span>
            <span className="font-semibold tabular-nums text-ink">{formatCents(app.proposedRateCents)}/hr</span>
          </span>
          <span className={cn("text-[12.5px]", overBudget ? "text-warning" : "text-muted")}>
            {overBudget ? `${formatCents(app.proposedRateCents - budgetMaxCents)} above your budget` : "Within your budget"}
          </span>
          {tutor && tutor.hourlyRateCents !== app.proposedRateCents && (
            <span className="text-[12.5px] text-muted">Profile rate {formatCents(tutor.hourlyRateCents)}/hr</span>
          )}
        </div>

        {scored.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={panelId}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 -mx-2 text-[13px] font-semibold text-ink hover:bg-canvas"
            >
              Why {percent}%?
              <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <ul className="mt-2 grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-2">
                    {factors.map((f) => (
                      <li key={f.key} className="flex items-start gap-2.5 text-[12.5px]">
                        <span className="mt-0.5">
                          <FactorIcon status={f.status} />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-medium text-ink">
                            {f.label}
                            <span className="font-normal text-subtle">· weight {f.weight}</span>
                          </span>
                          <span className="block text-muted">
                            <span className="sr-only">{FACTOR_STATUS_LABEL[f.status]}: </span>
                            {f.detail}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <Checkbox
          checked={comparing}
          disabled={compareFull || !tutor}
          onCheckedChange={onCompare}
          label={<span className="text-[13px] text-ink-2">{compareFull ? "Compare (3 selected)" : "Compare"}</span>}
        />
        <div className="flex flex-wrap items-center gap-2">
          {canShortlist && (
            <Button variant="ghost" size="sm" onClick={onShortlist}>
              <Star /> Shortlist
            </Button>
          )}
          {canMessage && (
            <Button variant="secondary" size="sm" onClick={onMessage} loading={busy}>
              <MessageSquare /> Message
            </Button>
          )}
          {canTrial && (
            <Button variant="secondary" size="sm" onClick={onTrial}>
              <CalendarPlus /> Request trial
            </Button>
          )}
          {active && (
            <Button size="sm" onClick={onHire}>
              <UserCheck /> Hire
            </Button>
          )}
          {active && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {tutor && (
                  <DropdownMenuItem asChild>
                    <Link href={`/tutors/${tutor.slug}`}>View full profile</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem tone="danger" onSelect={onReject}>
                  <ThumbsDown /> Decline application
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!active && app.status !== "hired" && <span className="text-[12.5px] text-muted">{APPLICATION_STATUS_META[app.status].label}</span>}
        </div>
      </div>
    </Card>
  );
}
