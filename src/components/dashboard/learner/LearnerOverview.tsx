"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BellRing, BookOpenCheck, CalendarClock, ChevronRight, ClipboardList, Clock3, Compass, MailWarning, MapPin, MessagesSquare,
  Monitor, NotebookPen, Search, ShieldAlert, Users, Video,
} from "lucide-react";
import type { AppNotification, Booking, Tutor, User } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/Shell";
import { Stagger, StaggerItem, motion } from "@/components/motion";
import { StatTile } from "@/components/charts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Progress } from "@/components/ui/Controls";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { BookingStatusBadge } from "@/components/domain/Badges";
import { useApp } from "@/lib/store";
import { useNow, useSession, useUnreadMessages, useViewerTimezone } from "@/lib/store/hooks";
import { isUpcoming, meetingLinkVisible, startMs, endMs } from "@/lib/booking";
import { formatDate, formatDuration, formatTime, formatWeekdayDate, pluralize, tzAbbrev } from "@/lib/format";
import { subjectName, GRADE_LABEL } from "@/lib/data/catalog";
import { zonedParts } from "@/lib/time";
import { NotificationRow } from "@/components/dashboard/shared/notificationMeta";
import { tutorFullName, useTutorMap } from "@/components/dashboard/shared/hooks";
import { useMyChildren, todayKey } from "./data";
import { RequirementStatusBadge, isVisibleApplication } from "./meta";

/* ─── Next lesson hero ──────────────────────────────────────────────────────── */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Countdown({ booking }: { booking: Booking }) {
  const now = useNow(1000);
  const start = startMs(booking);
  const end = endMs(booking);
  if (now >= start && now < end) {
    const left = Math.ceil((end - now) / 60_000);
    return (
      <div role="timer" aria-label="Lesson in progress">
        <p className="text-[12px] font-medium text-muted">In progress</p>
        <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-ink">{left} min left</p>
      </div>
    );
  }
  const diff = Math.max(0, start - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  return (
    <div role="timer" aria-label="Time until the lesson starts">
      <p className="text-[12px] font-medium text-muted">Starts in</p>
      {days >= 1 ? (
        <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-ink">
          {days}
          <span className="text-sm font-medium text-muted"> {days === 1 ? "day" : "days"} </span>
          {hours}
          <span className="text-sm font-medium text-muted"> hr</span>
        </p>
      ) : (
        <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums tracking-tight text-ink">
          {pad(hours)}:{pad(mins)}:{pad(secs)}
        </p>
      )}
    </div>
  );
}

function JoinArea({ booking, tutor }: { booking: Booking; tutor?: Tutor }) {
  const now = useNow(1000);
  const policy = useApp((s) => s.policy);
  if (booking.status === "pending") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Clock3 className="size-4 text-subtle" aria-hidden /> Waiting for {tutor?.firstName ?? "your tutor"} to confirm this request.
      </p>
    );
  }
  if (booking.mode === "in_person") {
    return (
      <p className="flex items-start gap-2 text-[13px] text-muted">
        <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> {booking.locationNote ?? "In person — agree on a meeting place in messages."}
      </p>
    );
  }
  if (booking.meetingUrl && meetingLinkVisible(booking, now, policy)) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}>
        <Button asChild>
          <a href={booking.meetingUrl} target="_blank" rel="noopener noreferrer">
            <Video /> Join lesson
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      </motion.div>
    );
  }
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted">
      <Video className="size-4 text-subtle" aria-hidden /> Join link appears {policy.meetingLinkVisibleMinutesBefore} minutes before
    </p>
  );
}

function NextLessonCard({ booking, tutor, childName, tz }: { booking: Booking | undefined; tutor?: Tutor; childName?: string; tz: string }) {
  if (!booking) {
    return (
      <Card className="flex h-full flex-col justify-center">
        <EmptyState
          compact
          icon={<CalendarClock />}
          title="No lessons scheduled"
          description="When you book a lesson, it appears here with a countdown and your join link."
          action={
            <Button asChild size="sm">
              <Link href="/tutors">
                <Search /> Find a tutor
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }
  const name = tutorFullName(tutor);
  return (
    <Card className="relative h-full overflow-hidden border-brand-soft bg-brand-soft">
      <div className="relative flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-ink">Next lesson</p>
          <BookingStatusBadge status={booking.status} />
        </div>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <Avatar name={name} tone={tutor?.tone} size="lg" verified={tutor?.verification.identity === "verified"} />
            <div className="min-w-0">
              <h2 className="font-heading text-[1.4rem] font-extrabold tracking-[-0.03em] text-ink">
                {subjectName(booking.subject)}
                {booking.type === "trial" && <span className="ml-2 align-middle text-[12px] font-medium text-muted">Trial</span>}
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                with <span className="font-medium text-ink-2">{name}</span>
                {childName && (
                  <>
                    {" "}
                    · for <span className="font-medium text-ink-2">{childName}</span>
                  </>
                )}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5 text-subtle" aria-hidden />
                  {formatDate(booking.startUtc, tz, { weekday: "short", month: "short", day: "numeric" })} · {formatTime(booking.startUtc, tz)} {tzAbbrev(tz, new Date(booking.startUtc))}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {booking.mode === "online" ? <Monitor className="size-3.5 text-subtle" aria-hidden /> : <MapPin className="size-3.5 text-subtle" aria-hidden />}
                  {booking.mode === "online" ? "Online" : "In person"} · {formatDuration(booking.durationMin)}
                </span>
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl bg-surface px-4 py-3 sm:min-w-40 sm:text-right">
            <Countdown booking={booking} />
          </div>
        </div>
        {booking.notes && <p className="mt-4 line-clamp-2 border-l-2 border-brand pl-3 text-[13px] leading-relaxed text-ink-2">{booking.notes}</p>}
        <div className="mt-auto flex flex-col gap-3 border-t border-ink/10 pt-4 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
          <JoinArea booking={booking} tutor={tutor} />
          <Button asChild variant="secondary" size="sm" className="self-start sm:self-auto">
            <Link href={`/dashboard/bookings/${booking.id}`}>
              Lesson details <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ─── Small building blocks ─────────────────────────────────────────────────── */

function TileLink({ href, children, label }: { href: string; children: React.ReactNode; label: string }) {
  return (
    <Link href={href} aria-label={label} className="group block rounded-xl [&>div]:transition-colors [&>div]:group-hover:border-ink">
      {children}
    </Link>
  );
}

function QuickActions() {
  const items = [
    { href: "/tutors", icon: Search, title: "Find tutors", body: "Filter by subject, schedule and budget" },
    { href: "/post-requirement", icon: ClipboardList, title: "Post a requirement", body: "Describe what you need and let tutors apply" },
    { href: "/concierge", icon: Compass, title: "Help me find a tutor", body: "Get a shortlist with the reasons for each match" },
  ];
  return (
    <Card className="h-full">
      <CardHeader title="Quick actions" />
      <ul className="p-2 pt-3">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-canvas">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink transition-colors group-hover:bg-brand-soft">
                <it.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{it.title}</span>
                <span className="block truncate text-[12.5px] text-muted">{it.body}</span>
              </span>
              <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function greeting(hour: number) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* ─── Overview ──────────────────────────────────────────────────────────────── */

export function LearnerOverview() {
  const me = useSession();
  if (!me) return null;
  return <Overview me={me} />;
}

function Overview({ me }: { me: User }) {
  const router = useRouter();
  const now = useNow(30_000);
  const tz = useViewerTimezone();
  const bookings = useApp((s) => s.bookings);
  const homework = useApp((s) => s.homework);
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const notifications = useApp((s) => s.notifications);
  const goals = useApp((s) => s.goals);
  const markRead = useApp((s) => s.markNotificationRead);
  const children = useMyChildren(me);
  const tutorMap = useTutorMap();
  const unreadMessages = useUnreadMessages();
  const isParent = me.role === "parent";

  const childName = React.useCallback((id?: string) => (id ? children.find((c) => c.id === id)?.firstName : undefined), [children]);

  const d = React.useMemo(() => {
    const mine = bookings.filter((b) => b.bookerId === me.id);
    const upcoming = mine.filter((b) => isUpcoming(b, now)).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
    const weekAhead = upcoming.filter((b) => startMs(b) < now + 7 * 86_400_000).length;
    const completed = mine.filter((b) => b.status === "completed").length;
    const learnerIds = new Set([me.id, ...children.map((c) => c.id)]);
    const today = todayKey(now, tz);
    const due = homework.filter((h) => learnerIds.has(h.learnerId) && (h.status === "assigned" || h.status === "overdue"));
    const overdue = due.filter((h) => h.dueDate < today).length;
    const reqs = requirements.filter((r) => r.ownerId === me.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const appStats = new Map<string, { total: number; fresh: number }>();
    for (const a of applications) {
      if (!isVisibleApplication(a.status)) continue;
      const s = appStats.get(a.requirementId) ?? { total: 0, fresh: 0 };
      s.total++;
      if (a.status === "applied") s.fresh++;
      appStats.set(a.requirementId, s);
    }
    const notes = notifications.filter((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const perChild = children.map((c) => {
      const topics = goals.filter((g) => g.learnerId === c.id).flatMap((g) => g.topics);
      const doneTopics = topics.filter((t) => t.status === "completed").length;
      return {
        child: c,
        next: upcoming.find((b) => b.childId === c.id),
        due: due.filter((h) => h.learnerId === c.id).length,
        overdue: due.filter((h) => h.learnerId === c.id && h.dueDate < today).length,
        topics: topics.length,
        doneTopics,
      };
    });
    return { upcoming, weekAhead, completed, due, overdue, reqs, appStats, notes, perChild };
  }, [bookings, me.id, now, children, tz, homework, requirements, applications, notifications, goals]);

  const next = d.upcoming[0];
  const hour = zonedParts(new Date(now), tz).hour;

  const openNotification = (n: AppNotification) => {
    markRead(n.id);
    if (n.href) router.push(n.href);
  };

  return (
    <div>
      <PageHeader
        eyebrow={<p className="eyebrow">{formatWeekdayDate(new Date(now).toISOString(), tz)}</p>}
        title={<>{greeting(hour)}, <span className="marker">{me.firstName}</span></>}
        description={isParent ? "Here's what's coming up for your family." : "Here's what's coming up in your lessons."}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/tutors">
                <Search /> Find tutors
              </Link>
            </Button>
            <Button asChild>
              <Link href="/post-requirement">
                <ClipboardList /> Post a requirement
              </Link>
            </Button>
          </>
        }
      />

      {(me.parentalConsent?.status === "pending" || !me.emailVerified) && (
        <div className="mb-6 space-y-3">
          {me.parentalConsent?.status === "pending" && (
            <InlineAlert
              tone="warning"
              title="Waiting for a parent or guardian to approve your account"
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/consent?user=${encodeURIComponent(me.id)}`}>Open approval link</Link>
                </Button>
              }
            >
              We emailed your parent or guardian at {me.parentalConsent.parentEmail}. Until they approve, you can browse tutors and save favorites, but messaging, booking and publishing requirements are paused. Preview: no email is sent — open the approval link to act as the parent.
            </InlineAlert>
          )}
          {!me.emailVerified && (
            <InlineAlert tone="info" title="Verify your email address">
              <span className="inline-flex items-center gap-1.5">
                <MailWarning className="size-3.5 shrink-0" aria-hidden /> We sent a verification link to {me.email}.
              </span>
            </InlineAlert>
          )}
        </div>
      )}

      <Stagger className="space-y-4 lg:space-y-5" stagger={0.07} amount={0.05}>
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          <StaggerItem className="lg:col-span-2">
            <NextLessonCard booking={next} tutor={next ? tutorMap.get(next.tutorId) : undefined} childName={childName(next?.childId)} tz={tz} />
          </StaggerItem>
          <StaggerItem>
            <QuickActions />
          </StaggerItem>
        </div>

        <StaggerItem>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TileLink href="/dashboard/bookings" label={`${d.upcoming.length} upcoming lessons. View bookings`}>
              <StatTile label="Upcoming lessons" value={d.upcoming.length} icon={<CalendarClock />} hint={d.weekAhead ? `${d.weekAhead} in the next 7 days` : "Nothing in the next 7 days"} />
            </TileLink>
            <TileLink href="/dashboard/progress" label={`${d.completed} lessons completed. View progress`}>
              <StatTile label="Lessons completed" value={d.completed} icon={<BookOpenCheck />} hint="All time" />
            </TileLink>
            <TileLink href="/dashboard/homework" label={`${d.due.length} homework assignments due. View homework`}>
              <StatTile
                label="Homework due"
                value={d.due.length}
                icon={<NotebookPen />}
                hint={d.overdue ? <span className="font-medium text-warning">{d.overdue} overdue</span> : "Nothing overdue"}
              />
            </TileLink>
            <TileLink href="/dashboard/messages" label={`${unreadMessages} unread messages. Open messages`}>
              <StatTile label="Unread messages" value={unreadMessages} icon={<MessagesSquare />} hint={unreadMessages ? "Waiting for your reply" : "You're all caught up"} />
            </TileLink>
          </div>
        </StaggerItem>

        {isParent && (
          <StaggerItem>
            <Card>
              <CardHeader
                title="Your children"
                description="Next lesson, homework and goal progress at a glance."
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/children">Manage</Link>
                  </Button>
                }
              />
              {d.perChild.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Users />}
                  title="Add your first child"
                  description="Child profiles let you post requirements and book lessons for each of your kids."
                  action={
                    <Button asChild size="sm">
                      <Link href="/dashboard/children">Add a child</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {d.perChild.map(({ child, next: cn_, due, overdue, topics, doneTopics }) => {
                    const pct = topics ? Math.round((doneTopics / topics) * 100) : 0;
                    return (
                      <li key={child.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] sm:items-center">
                        <div className="flex items-center gap-3">
                          <Avatar name={child.firstName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{child.firstName}</p>
                            <p className="text-[12.5px] text-muted">{GRADE_LABEL[child.grade]}</p>
                          </div>
                        </div>
                        <div className="min-w-0 text-[13px]">
                          <p className="text-[11.5px] text-muted">Next lesson</p>
                          {cn_ ? (
                            <Link href={`/dashboard/bookings/${cn_.id}`} className="block truncate font-medium text-ink-2 hover:text-ink">
                              {subjectName(cn_.subject)} · {formatDate(cn_.startUtc, tz, { weekday: "short", month: "short", day: "numeric" })}, {formatTime(cn_.startUtc, tz)}
                            </Link>
                          ) : (
                            <p className="text-muted">None booked</p>
                          )}
                        </div>
                        <div className="text-[13px]">
                          <p className="text-[11.5px] text-muted">Homework due</p>
                          <p className="font-medium tabular-nums text-ink-2">
                            {due}
                            {overdue > 0 && <span className="ml-1.5 font-normal text-warning">({overdue} overdue)</span>}
                          </p>
                        </div>
                        <div className="text-[13px]">
                          <p className="flex items-center justify-between text-[11.5px] text-muted">
                            <span>Goal progress</span>
                            {topics > 0 && <span className="tabular-nums">{pct}%</span>}
                          </p>
                          {topics > 0 ? <Progress value={pct} className="mt-1.5" label={`${child.firstName}'s goal progress`} /> : <p className="text-muted">No goals yet</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </StaggerItem>
        )}

        <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          <div className="space-y-4 lg:col-span-2 lg:space-y-5">
            <StaggerItem>
              <Card>
                <CardHeader
                  title="Upcoming lessons"
                  description={d.upcoming.length ? pluralize(d.upcoming.length, "lesson") + " scheduled" : undefined}
                  action={
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/bookings">View all</Link>
                    </Button>
                  }
                />
                {d.upcoming.length === 0 ? (
                  <EmptyState compact icon={<CalendarClock />} title="No upcoming lessons" description="Book a trial or regular lesson from any tutor's profile." action={<Button asChild size="sm" variant="secondary"><Link href="/tutors">Browse tutors</Link></Button>} />
                ) : (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {d.upcoming.slice(0, 5).map((b) => {
                      const t = tutorMap.get(b.tutorId);
                      const kid = childName(b.childId);
                      return (
                        <li key={b.id}>
                          <Link href={`/dashboard/bookings/${b.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-canvas">
                            <span className="grid w-12 shrink-0 place-items-center rounded-lg border border-line bg-canvas py-1.5 text-center">
                              <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{formatDate(b.startUtc, tz, { month: "short" })}</span>
                              <span className="text-base font-semibold leading-tight tabular-nums text-ink">{formatDate(b.startUtc, tz, { day: "numeric" })}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">
                                {subjectName(b.subject)}
                                {b.type === "trial" && <span className="font-normal text-muted"> · Trial</span>}
                              </span>
                              <span className="block truncate text-[12.5px] text-muted">
                                {formatDate(b.startUtc, tz, { weekday: "short" })} {formatTime(b.startUtc, tz)} · {tutorFullName(t)}
                                {kid && ` · for ${kid}`}
                              </span>
                            </span>
                            <BookingStatusBadge status={b.status} className="hidden sm:inline-flex" />
                            <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card>
                <CardHeader
                  title="My requirements"
                  description="Tutors apply to the requirements you publish."
                  action={
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/requirements">Manage</Link>
                    </Button>
                  }
                />
                {d.reqs.length === 0 ? (
                  <EmptyState compact icon={<ClipboardList />} title="No requirements yet" description="Describe what you're looking for and qualified tutors will apply." action={<Button asChild size="sm"><Link href="/post-requirement">Post a requirement</Link></Button>} />
                ) : (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {d.reqs.slice(0, 4).map((r) => {
                      const s = d.appStats.get(r.id) ?? { total: 0, fresh: 0 };
                      const kid = childName(r.childId);
                      return (
                        <li key={r.id}>
                          <Link href={`/dashboard/requirements/${r.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-canvas">
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-ink">{r.title || "Untitled draft"}</span>
                              </span>
                              <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                                {r.subject ? subjectName(r.subject) : "No subject yet"}
                                {kid && ` · for ${kid}`}
                              </span>
                            </span>
                            <span className="hidden shrink-0 text-right text-[12.5px] sm:block">
                              <span className="block font-medium tabular-nums text-ink-2">{pluralize(s.total, "application")}</span>
                              {s.fresh > 0 && <span className="text-ink">{s.fresh} new</span>}
                            </span>
                            <RequirementStatusBadge status={r.status} />
                            <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </StaggerItem>
          </div>

          <StaggerItem>
            <Card className="h-full">
              <CardHeader
                title="Recent activity"
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/notifications">View all</Link>
                  </Button>
                }
              />
              {d.notes.length === 0 ? (
                <EmptyState compact icon={<BellRing />} title="You're all caught up" description="Messages, booking updates and homework will show up here." />
              ) : (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {d.notes.slice(0, 6).map((n) => (
                    <li key={n.id}>
                      <NotificationRow n={n} onOpen={openNotification} compact now={now} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </StaggerItem>
        </div>
      </Stagger>

      {me.role === "student" && me.parentalConsent && me.parentalConsent.status === "granted" && (
        <p className="mt-6 flex items-center gap-2 text-[12.5px] text-muted">
          <ShieldAlert className="size-3.5" aria-hidden /> Your parent or guardian can see your lessons and conversations.
        </p>
      )}
    </div>
  );
}
