"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, BadgeCheck, CalendarClock, CalendarDays, Check, Coins, Inbox, MapPin, Monitor, Star, UserRoundCheck, Video, Wallet,
} from "lucide-react";
import type { Booking, BookingStatus, Requirement, VerificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useCreditBalance, useFlag, useNow, useViewerTimezone } from "@/lib/store/hooks";
import { canTransition, endMs, meetingLinkVisible, startMs } from "@/lib/booking";
import { formatCents, formatDateTime, formatDuration, formatRelative, formatTime, formatWeekdayDate } from "@/lib/format";
import { GRADE_LABEL, MODE_LABEL, subjectName } from "@/lib/data/catalog";
import { scoreTutor } from "@/lib/matching";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Controls";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { ColumnChart, StatTile } from "@/components/charts";
import { Stagger, StaggerItem } from "@/components/motion";
import { VERIFICATION_LABEL, VerificationStatusBadge } from "@/components/domain/Badges";
import { MatchRing, NeedsTutorProfile } from "./shared";
import {
  completionPercent, isEarned, isSameMonth, netCents, profileChecklist, sumCents, useLearnerName, useMyBookings, useMyTutor, weeklyNet, learnerIdOf,
} from "./hooks";
import { APPLICATION_STATUS_META, requirementCriteria } from "./jobs-shared";

function greeting(now: number, tz: string): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date(now)));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function countdown(ms: number): string {
  if (ms <= 0) return "now";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h} hr ${m % 60 ? `${m % 60} min` : ""}`.trim();
  const d = Math.floor(h / 24);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

export function TutorOverview() {
  const { me, tutor } = useMyTutor();
  const now = useNow(15_000);
  const tz = useViewerTimezone();
  const policy = useApp((s) => s.policy);
  const bookings = useMyBookings(tutor?.id);
  const credits = useCreditBalance(tutor?.id);
  const creditsOn = useFlag("lead_credits");
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const transition = useApp((s) => s.transitionBooking);
  const nameOf = useLearnerName();
  const [decline, setDecline] = React.useState<Booking | null>(null);

  const upcoming = React.useMemo(
    () => bookings.filter((b) => (b.status === "confirmed" || b.status === "in_progress") && endMs(b) > now).sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    [bookings, now],
  );
  const pending = React.useMemo(() => bookings.filter((b) => b.status === "pending" && startMs(b) > now).sort((a, b) => a.startUtc.localeCompare(b.startUtc)), [bookings, now]);
  const attention = React.useMemo(
    () => bookings.filter((b) => (b.status === "confirmed" || b.status === "in_progress") && startMs(b) <= now).sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    [bookings, now],
  );
  const monthNet = React.useMemo(() => sumCents(bookings.filter((b) => isEarned(b) && isSameMonth(b.startUtc, now, tz)).map(netCents)), [bookings, now, tz]);
  const monthLessons = bookings.filter((b) => isEarned(b) && isSameMonth(b.startUtc, now, tz)).length;
  const weekly = React.useMemo(() => weeklyNet(bookings, now, tz, 8), [bookings, now, tz]);
  // A lesson that is live right now takes priority; otherwise the soonest upcoming one.
  const next = upcoming[0];

  const myApps = React.useMemo(() => (tutor ? applications.filter((a) => a.tutorId === tutor.id) : []), [applications, tutor]);
  const recommended = React.useMemo(() => {
    if (!tutor) return [];
    const applied = new Set(myApps.filter((a) => a.status !== "withdrawn").map((a) => a.requirementId));
    return requirements
      .filter((r) => r.status === "published" && !applied.has(r.id))
      .map((r) => ({ req: r, match: scoreTutor(tutor, requirementCriteria(r)) }))
      .filter((x) => !x.match.disqualified)
      .sort((a, b) => b.match.percent - a.match.percent || (b.req.publishedAt ?? "").localeCompare(a.req.publishedAt ?? ""))
      .slice(0, 3);
  }, [requirements, tutor, myApps]);

  if (!me || !tutor) return <NeedsTutorProfile what="your dashboard" />;

  const checklist = profileChecklist(tutor);
  const completion = completionPercent(checklist);
  const act = (b: Booking, to: BookingStatus, success: string) => {
    const res = transition(b.id, to);
    if (!res.ok) toast.error(res.error);
    else toast.success(success);
  };

  const appCounts = myApps.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});
  const activeApps = myApps.filter((a) => ["applied", "viewed", "shortlisted", "contacted", "trial_requested"].includes(a.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{greeting(now, tz)}, <span className="marker">{me.firstName}</span></>}
        description={
          upcoming.length || pending.length
            ? `You have ${upcoming.length} upcoming ${upcoming.length === 1 ? "lesson" : "lessons"} and ${pending.length} ${pending.length === 1 ? "request" : "requests"} waiting for you.`
            : "Here's what's happening with your tutoring business."
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/tutors/${tutor.slug}`}>View public profile</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/availability">
                <CalendarDays /> Availability
              </Link>
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6 [&>div>div]:h-full [&>div]:h-full" stagger={0.05}>
        <StaggerItem>
          <StatTile label="Upcoming" value={<span className="tabular-nums">{upcoming.length}</span>} icon={<CalendarClock />} hint={next ? `Next ${formatRelative(next.startUtc, now)}` : "None scheduled"} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Requests" value={<span className="tabular-nums">{pending.length}</span>} icon={<Inbox />} hint={pending.length ? "Awaiting your reply" : "All caught up"} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Net this month" value={<span className="tabular-nums">{formatCents(monthNet)}</span>} icon={<Wallet />} hint={`${monthLessons} paid ${monthLessons === 1 ? "lesson" : "lessons"}`} />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Rating"
            value={tutor.rating !== null ? <span className="tabular-nums">{tutor.rating.toFixed(1)}</span> : <span className="text-lg text-muted">New</span>}
            icon={<Star />}
            hint={`${tutor.reviewCount} ${tutor.reviewCount === 1 ? "review" : "reviews"}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Credits" value={<span className="tabular-nums">{creditsOn ? credits : "—"}</span>} icon={<Coins />} hint={creditsOn ? <Link href="/dashboard/credits" className="font-medium text-ink hover:underline">Buy credits</Link> : "Applying is free right now"} />
        </StaggerItem>
        <StaggerItem>
          <div data-spotlight className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-muted">Profile</p>
              <UserRoundCheck className="size-4 text-subtle" aria-hidden />
            </div>
            <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-ink">{completion}%</p>
            <Progress value={completion} label="Profile completion" className="mt-3" tone={completion === 100 ? "success" : "navy"} />
          </div>
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* Next lesson */}
          <NextLesson booking={next} now={now} tz={tz} learner={next ? nameOf(learnerIdOf(next)) : ""} joinable={next ? meetingLinkVisible(next, now, policy) : false} linkMinutes={policy.meetingLinkVisibleMinutesBefore} />

          {/* Needs attention */}
          <AnimatePresence initial={false}>
            {attention.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                <Card className="border-warning-200">
                  <CardHeader
                    title={
                      <span className="inline-flex items-center gap-2">
                        <AlertTriangle className="size-4 text-warning" aria-hidden /> Needs attention
                      </span>
                    }
                    description="These lessons have started or ended. Confirm what happened so payment can be released."
                  />
                  <CardContent className="pt-4">
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {attention.map((b) => {
                        const noShow = canTransition(b, "no_show_student", "tutor", now, policy);
                        const complete = canTransition(b, "completed", "tutor", now, policy);
                        return (
                          <li key={b.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-ink">
                                {subjectName(b.subject)} with {nameOf(learnerIdOf(b))}
                              </p>
                              <p className="text-[13px] text-muted">
                                {formatDateTime(b.startUtc, tz)} · {formatDuration(b.durationMin)} · {endMs(b) <= now ? `ended ${formatRelative(new Date(endMs(b)).toISOString(), now)}` : "in progress"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" disabled={!complete.ok} onClick={() => act(b, "completed", "Lesson marked as completed")}>
                                <Check /> Mark completed
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!noShow.ok}
                                title={noShow.ok ? undefined : noShow.reason}
                                onClick={() => act(b, "no_show_student", "Student no-show reported")}
                              >
                                Report no-show
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pending requests */}
          <Card>
            <CardHeader
              title="Booking requests"
              description={pending.length ? "Accept to confirm the lesson and capture payment. Declining releases the family's authorization." : undefined}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/bookings">
                    All bookings <ArrowRight />
                  </Link>
                </Button>
              }
            />
            <CardContent className="pt-4">
              {pending.length === 0 ? (
                <EmptyState compact icon={<Inbox />} title="No pending requests" description="New booking requests will appear here. Keep your availability current so families can book you." />
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  <AnimatePresence initial={false}>
                    {pending.map((b) => (
                      <motion.li key={b.id} layout exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
                        <Avatar name={nameOf(learnerIdOf(b))} size="md" className="hidden sm:inline-flex" />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                            {nameOf(learnerIdOf(b))} · {subjectName(b.subject)}
                            {b.type === "trial" && (
                              <Badge tone="accent" size="sm">
                                Trial
                              </Badge>
                            )}
                          </p>
                          <p className="text-[13px] text-muted">
                            {formatDateTime(b.startUtc, tz)} · {formatDuration(b.durationMin)} · {MODE_LABEL[b.mode]} · {b.priceCents - b.discountCents > 0 ? formatCents(b.priceCents - b.discountCents) : "Free"}
                          </p>
                          {b.notes && <p className="mt-1 line-clamp-1 text-[13px] text-ink-2">“{b.notes}”</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => act(b, "confirmed", "Booking accepted")}>
                            Accept
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setDecline(b)}>
                            Decline
                          </Button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Earnings */}
          <Card>
            <CardHeader
              title="Net earnings by week"
              description="Completed lessons after the platform fee, last 8 weeks."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/earnings">
                    Earnings <ArrowRight />
                  </Link>
                </Button>
              }
            />
            <CardContent>
              {weekly.some((w) => w.value > 0) ? (
                <ColumnChart data={weekly} caption="Net earnings per week, last 8 weeks" format={(n) => formatCents(Math.round(n))} highlightLast={false} />
              ) : (
                <EmptyState compact icon={<Wallet />} title="No earnings yet" description="Your weekly earnings appear here after your first completed lesson." />
              )}
            </CardContent>
          </Card>

          {/* Recommended jobs */}
          <Card>
            <CardHeader
              title="Recommended jobs"
              description="Published requests scored against your subjects, levels, schedule, rate and location."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/jobs">
                    Find jobs <ArrowRight />
                  </Link>
                </Button>
              }
            />
            <CardContent className="pt-4">
              {recommended.length === 0 ? (
                <EmptyState compact icon={<Inbox />} title="No new matches" description="We'll show jobs here when families post requests that match your subjects." />
              ) : (
                <ul className="grid gap-3 md:grid-cols-3">
                  {recommended.map(({ req, match }) => (
                    <li key={req.id}>
                      <RecommendedJob req={req} percent={match.percent} reason={match.factors.find((f) => f.key === "subject")?.detail ?? ""} now={now} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Profile checklist" description={`${checklist.filter((c) => c.done).length} of ${checklist.length} complete`} />
            <CardContent className="pt-4">
              <ul className="space-y-1">
                {checklist.map((c) => (
                  <li key={c.key}>
                    <Link href={c.href} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13.5px] transition-colors hover:bg-sunken">
                      <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-full", c.done ? "bg-success text-white" : "border border-line-strong")} aria-hidden>
                        {c.done && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className={cn("flex-1", c.done ? "text-muted" : "font-medium text-ink")}>
                        {c.label}
                        <span className="sr-only">{c.done ? " (done)" : " (to do)"}</span>
                      </span>
                      {!c.done && <ArrowRight className="size-3.5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Verification"
              description="Badges show on your profile only after a check is verified."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/verification">Manage</Link>
                </Button>
              }
            />
            <CardContent className="pt-4">
              <ul className="space-y-2.5">
                {(Object.keys(VERIFICATION_LABEL) as VerificationKind[]).map((k) => (
                  <li key={k} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-ink-2">
                      <BadgeCheck className={cn("size-4", tutor.verification[k] === "verified" ? "text-ink" : "text-subtle")} aria-hidden />
                      {VERIFICATION_LABEL[k]}
                    </span>
                    <VerificationStatusBadge status={tutor.verification[k]} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Applications"
              description={`${activeApps} active of ${myApps.length} total`}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/applications">View all</Link>
                </Button>
              }
            />
            <CardContent className="pt-4">
              {myApps.length === 0 ? (
                <p className="text-sm text-muted">You haven&apos;t applied to any jobs yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(APPLICATION_STATUS_META)
                    .filter(([k]) => appCounts[k])
                    .map(([k, meta]) => (
                      <li key={k} className="flex items-center justify-between gap-3 text-sm">
                        <Badge tone={meta.tone} size="sm" dot>
                          {meta.label}
                        </Badge>
                        <span className="font-medium tabular-nums text-ink">{appCounts[k]}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!decline}
        onOpenChange={(o) => !o && setDecline(null)}
        title="Decline this request?"
        description={decline ? `${subjectName(decline.subject)} with ${nameOf(learnerIdOf(decline))} on ${formatDateTime(decline.startUtc, tz)}. The family is notified and any payment authorization is released in full.` : undefined}
        confirmLabel="Decline request"
        tone="danger"
        onConfirm={() => {
          if (decline) act(decline, "cancelled_by_tutor", "Request declined");
          setDecline(null);
        }}
      />
    </div>
  );
}

function NextLesson({ booking, now, tz, learner, joinable, linkMinutes }: { booking?: Booking; now: number; tz: string; learner: string; joinable: boolean; linkMinutes: number }) {
  if (!booking) {
    return (
      <Card>
        <EmptyState compact icon={<CalendarClock />} title="No upcoming lessons" description="Confirmed lessons appear here with a countdown and a join link." action={<Button asChild variant="secondary" size="sm"><Link href="/dashboard/availability">Review availability</Link></Button>} />
      </Card>
    );
  }
  const until = startMs(booking) - now;
  const live = until <= 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex w-full shrink-0 flex-row items-center gap-4 rounded-xl bg-ink px-4 py-3.5 text-on-ink sm:w-36 sm:flex-col sm:items-start sm:gap-1">
          <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-on-ink/70">{live ? "Live now" : "Starts"}</span>
          <span className="text-xl font-semibold tabular-nums tracking-tight">{live ? formatTime(booking.startUtc, tz) : countdown(until)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-muted">Next lesson</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">
            {subjectName(booking.subject)} with {learner}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
            <span>{formatWeekdayDate(booking.startUtc, tz)} · {formatTime(booking.startUtc, tz)}</span>
            <span>{formatDuration(booking.durationMin)}</span>
            <span className="inline-flex items-center gap-1">
              {booking.mode === "online" ? <Monitor className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />} {MODE_LABEL[booking.mode]}
            </span>
          </p>
          {booking.notes && <p className="mt-2 line-clamp-2 text-[13.5px] text-ink-2">“{booking.notes}”</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {booking.mode === "online" &&
            (joinable && booking.meetingUrl ? (
              <Button asChild>
                <a href={booking.meetingUrl} target="_blank" rel="noopener noreferrer">
                  <Video /> Join lesson
                </a>
              </Button>
            ) : (
              <Button disabled title={`The join link appears ${linkMinutes} minutes before the start time.`}>
                <Video /> Join lesson
              </Button>
            ))}
          <Button asChild variant="ghost" size="sm">
            <Link href={`/dashboard/bookings/${booking.id}`}>Lesson details</Link>
          </Button>
          {booking.mode === "online" && !joinable && <span className="text-[12px] text-muted">Link opens {linkMinutes} min before</span>}
        </div>
      </div>
    </Card>
  );
}

function RecommendedJob({ req, percent, reason, now }: { req: Requirement; percent: number; reason: string; now: number }) {
  return (
    <Link href={`/tutor-jobs/${req.id}`} data-spotlight className="group flex h-full flex-col rounded-xl border border-line p-4 transition-colors hover:border-ink">
      <div className="flex items-start justify-between gap-3">
        <Badge tone="accent" size="sm">
          {subjectName(req.subject)}
        </Badge>
        <MatchRing percent={percent} size={40} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-ink group-hover:text-ink">{req.title}</p>
      <p className="mt-1 text-[12.5px] text-muted">
        {GRADE_LABEL[req.grade]} · {req.modes.map((m) => MODE_LABEL[m]).join(" or ")}
      </p>
      <p className="mt-auto pt-3 text-[12.5px] text-muted">
        {formatCents(req.budgetMinCents)}–{formatCents(req.budgetMaxCents)}/hr · {formatRelative(req.publishedAt ?? req.createdAt, now)}
      </p>
      {reason && <span className="sr-only">{reason}</span>}
    </Link>
  );
}
