"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpenCheck, CalendarCheck2, Check, CircleDot, Circle, LineChart, MessageSquareText, Target, Users } from "lucide-react";
import type { Booking, LearningGoal, User } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/Shell";
import { AnimatePresence, Stagger, StaggerItem, motion } from "@/components/motion";
import { StatTile } from "@/components/charts";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Progress, Segmented } from "@/components/ui/Controls";
import { EmptyState } from "@/components/ui/States";
import { BookingStatusBadge } from "@/components/domain/Badges";
import { useApp } from "@/lib/store";
import { useSession, useViewerTimezone } from "@/lib/store/hooks";
import { formatDate, formatTime, pluralize } from "@/lib/format";
import { subjectName } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";
import { tutorFullName, useTutorMap } from "@/components/dashboard/shared/hooks";
import { formatDateKey, learnerOf, useLearners } from "./data";

const ATTENDANCE_STATUSES: Booking["status"][] = ["completed", "no_show_student", "no_show_tutor", "cancelled_by_student", "cancelled_by_tutor"];
const TOPIC_LABEL = { completed: "Completed", in_progress: "In progress", not_started: "Not started" } as const;

function TopicIcon({ status }: { status: LearningGoal["topics"][number]["status"] }) {
  if (status === "completed")
    return (
      <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-ink text-on-ink" aria-hidden>
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (status === "in_progress") return <CircleDot className="size-[18px] shrink-0 text-ink" aria-hidden />;
  return <Circle className="size-[18px] shrink-0 text-line-strong" aria-hidden />;
}

function UnderstandingDots({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= rating ? "bg-ink" : "bg-sunken")} />
        ))}
      </span>
      Understanding {rating}/5
    </span>
  );
}

export function LearnerProgress() {
  const me = useSession();
  if (!me) return null;
  return <ProgressInner me={me} />;
}

function ProgressInner({ me }: { me: User }) {
  const tz = useViewerTimezone();
  const learners = useLearners(me);
  const goals = useApp((s) => s.goals);
  const notes = useApp((s) => s.progressNotes);
  const bookings = useApp((s) => s.bookings);
  const tutorMap = useTutorMap();
  const [selected, setSelected] = React.useState<string | null>(null);
  const active = learners.find((l) => l.id === selected) ?? learners[0];
  const isParent = me.role === "parent";

  const data = React.useMemo(() => {
    if (!active) return null;
    const id = active.id;
    const myGoals = goals.filter((g) => g.learnerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const myNotes = notes.filter((n) => n.learnerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const history = bookings
      .filter((b) => b.bookerId === me.id && learnerOf(b) === id && ATTENDANCE_STATUSES.includes(b.status))
      .sort((a, b) => b.startUtc.localeCompare(a.startUtc));
    const attended = history.filter((b) => b.status === "completed").length;
    const missed = history.filter((b) => b.status === "no_show_student").length;
    const topics = myGoals.flatMap((g) => g.topics.map((t) => ({ ...t, goal: g })));
    const done = topics.filter((t) => t.status === "completed");
    return {
      goals: myGoals,
      notes: myNotes,
      history,
      attended,
      rate: attended + missed ? Math.round((attended / (attended + missed)) * 100) : null,
      topicsTotal: topics.length,
      done,
    };
  }, [active, goals, notes, bookings, me.id]);

  const header = (
    <PageHeader
      title="Learning progress"
      description={isParent ? "Goals, tutor notes and attendance for each of your children." : "Your goals, notes from your tutors and attendance in one place."}
    />
  );

  if (!active || !data) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            icon={<Users />}
            title="Add a child to track progress"
            description="Once your child has lessons, their goals, tutor notes and attendance appear here."
            action={
              <Button asChild>
                <Link href="/dashboard/children">Add a child</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const nobodyYet = !data.goals.length && !data.notes.length && !data.history.length;

  return (
    <div>
      {header}

      {learners.length > 1 && (
        <div className="-mt-2 mb-6 overflow-x-auto pb-1">
          <Segmented label="Choose a learner" value={active.id} onChange={setSelected} options={learners.map((l) => ({ value: l.id, label: l.name }))} />
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={active.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          {nobodyYet ? (
            <Card>
              <EmptyState
                icon={<LineChart />}
                title={active.kind === "child" ? `No progress for ${active.name} yet` : "No progress yet"}
                description="After the first lessons, tutors add learning goals and notes here, and attendance is tracked automatically."
                action={
                  <Button asChild>
                    <Link href="/tutors">Find a tutor</Link>
                  </Button>
                }
              />
            </Card>
          ) : (
            <Stagger className="space-y-5" stagger={0.06} amount={0.05}>
              <StaggerItem>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatTile label="Topics completed" value={`${data.done.length}/${data.topicsTotal}`} icon={<Target />} hint={data.topicsTotal ? `${Math.round((data.done.length / data.topicsTotal) * 100)}% of goal topics` : "No goals yet"} />
                  <StatTile label="Lessons attended" value={data.attended} icon={<BookOpenCheck />} hint="Completed lessons" />
                  <StatTile label="Attendance rate" value={data.rate === null ? "—" : `${data.rate}%`} icon={<CalendarCheck2 />} hint="Completed vs. missed by the student" />
                  <StatTile label="Tutor notes" value={data.notes.length} icon={<MessageSquareText />} hint={data.notes[0] ? `Latest ${formatDate(data.notes[0].createdAt, tz, { month: "short", day: "numeric" })}` : "None yet"} />
                </div>
              </StaggerItem>

              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-5">
                  {/* Goals */}
                  <StaggerItem>
                    <section aria-labelledby="goals-heading">
                      <h2 id="goals-heading" className="mb-3 text-[15px] font-semibold tracking-tight text-ink">
                        Learning goals
                      </h2>
                      {data.goals.length === 0 ? (
                        <Card>
                          <EmptyState compact icon={<Target />} title="No goals yet" description="Tutors set goals with topics after the first lessons." />
                        </Card>
                      ) : (
                        <div className="space-y-4">
                          {data.goals.map((g) => {
                            const done = g.topics.filter((t) => t.status === "completed").length;
                            const inProgress = g.topics.filter((t) => t.status === "in_progress").length;
                            const pct = g.topics.length ? Math.round((done / g.topics.length) * 100) : 0;
                            const tutor = tutorMap.get(g.tutorId);
                            return (
                              <Card key={g.id}>
                                <div className="p-5">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <h3 className="text-[15px] font-semibold tracking-tight text-ink">{g.title}</h3>
                                      <p className="mt-0.5 text-[13px] text-muted">
                                        {subjectName(g.subject)} · with {tutorFullName(tutor)}
                                        {g.targetDate && ` · target ${formatDateKey(g.targetDate, { month: "short", day: "numeric", year: "numeric" })}`}
                                      </p>
                                    </div>
                                    <p className="text-right">
                                      <span className="text-[22px] font-semibold leading-none tabular-nums tracking-tight text-ink">{pct}%</span>
                                      <span className="block text-[12px] text-muted">
                                        {done} of {g.topics.length} topics
                                      </span>
                                    </p>
                                  </div>
                                  <Progress value={pct} className="mt-4 h-2" label={`${g.title}: ${pct}% complete`} />
                                  <p className="mt-2 text-[12px] text-muted">{inProgress ? `${inProgress} in progress` : "Nothing in progress"}</p>
                                </div>
                                <ul className="grid gap-x-6 gap-y-2.5 border-t border-line px-5 py-4 sm:grid-cols-2">
                                  {g.topics.map((t, i) => (
                                    <motion.li
                                      key={t.name}
                                      initial={{ opacity: 0, x: -6 }}
                                      whileInView={{ opacity: 1, x: 0 }}
                                      viewport={{ once: true }}
                                      transition={{ duration: 0.35, delay: i * 0.04 }}
                                      className="flex items-center gap-2.5 text-[13.5px]"
                                    >
                                      <TopicIcon status={t.status} />
                                      <span className={cn("min-w-0 flex-1", t.status === "not_started" ? "text-muted" : "text-ink-2")}>{t.name}</span>
                                      <span className="sr-only">{TOPIC_LABEL[t.status]}</span>
                                      {t.status === "in_progress" && <span className="shrink-0 text-[11.5px] font-medium text-ink" aria-hidden>In progress</span>}
                                    </motion.li>
                                  ))}
                                </ul>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </StaggerItem>

                  {/* Notes timeline */}
                  <StaggerItem>
                    <section aria-labelledby="notes-heading">
                      <h2 id="notes-heading" className="mb-3 text-[15px] font-semibold tracking-tight text-ink">
                        Notes from tutors
                      </h2>
                      <Card>
                        {data.notes.length === 0 ? (
                          <EmptyState compact icon={<MessageSquareText />} title="No notes yet" description="Tutors can add a short note after each lesson." />
                        ) : (
                          <ol className="relative px-5 py-5">
                            <span className="absolute bottom-8 left-[37px] top-8 w-px bg-line" aria-hidden />
                            {data.notes.map((n) => {
                              const tutor = tutorMap.get(n.tutorId);
                              return (
                                <li key={n.id} className="relative flex gap-4 pb-6 last:pb-0">
                                  <Avatar name={tutorFullName(tutor)} tone={tutor?.tone} size="sm" className="relative z-10 ring-4 ring-surface rounded-full" />
                                  <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                                      <span className="font-medium text-ink">{tutorFullName(tutor)}</span>
                                      <time dateTime={n.createdAt} className="text-muted">
                                        {formatDate(n.createdAt, tz, { weekday: "short", month: "short", day: "numeric" })} · {formatTime(n.createdAt, tz)}
                                      </time>
                                    </p>
                                    <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{n.body}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                      {n.rating && <UnderstandingDots rating={n.rating} />}
                                      {n.bookingId && (
                                        <Link href={`/dashboard/bookings/${n.bookingId}`} className="text-[12px] font-medium text-ink hover:underline">
                                          View lesson
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </Card>
                    </section>
                  </StaggerItem>
                </div>

                <div className="space-y-5 lg:sticky lg:top-20">
                  {/* Attendance */}
                  <StaggerItem>
                    <Card>
                      <CardHeader title="Attendance" description={data.history.length ? pluralize(data.history.length, "past lesson") : undefined} />
                      <div className="px-5 pb-2 pt-4">
                        <div className="flex items-end justify-between">
                          <p className="text-[28px] font-semibold leading-none tabular-nums tracking-tight text-ink">{data.rate === null ? "—" : `${data.rate}%`}</p>
                          <p className="text-[12px] text-muted">attendance rate</p>
                        </div>
                        <Progress value={data.rate ?? 0} tone="success" className="mt-3" label="Attendance rate" />
                      </div>
                      {data.history.length === 0 ? (
                        <p className="px-5 pb-5 pt-3 text-[13px] text-muted">Past lessons will appear here.</p>
                      ) : (
                        <ul className="mt-3 divide-y divide-line border-t border-line">
                          {data.history.slice(0, 8).map((b) => (
                            <li key={b.id}>
                              <Link href={`/dashboard/bookings/${b.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas">
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13.5px] font-medium text-ink">{subjectName(b.subject)}</span>
                                  <span className="block text-[12px] text-muted">{formatDate(b.startUtc, tz, { weekday: "short", month: "short", day: "numeric" })}</span>
                                </span>
                                <BookingStatusBadge status={b.status} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </StaggerItem>

                  {/* Completed topics */}
                  <StaggerItem>
                    <Card>
                      <CardHeader title="Completed topics" description={data.done.length ? `${data.done.length} mastered so far` : undefined} />
                      {data.done.length === 0 ? (
                        <p className="px-5 pb-5 pt-2 text-[13px] text-muted">Completed topics from goals show up here.</p>
                      ) : (
                        <ul className="space-y-2.5 px-5 pb-5 pt-4">
                          {data.done.map((t) => (
                            <li key={`${t.goal.id}-${t.name}`} className="flex items-start gap-2.5 text-[13.5px]">
                              <TopicIcon status="completed" />
                              <span className="min-w-0">
                                <span className="block text-ink-2">{t.name}</span>
                                <span className="block text-[12px] text-muted">{subjectName(t.goal.subject)}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </StaggerItem>
                </div>
              </div>
            </Stagger>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
