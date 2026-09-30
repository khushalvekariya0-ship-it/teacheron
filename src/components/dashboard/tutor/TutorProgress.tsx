"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck2, CalendarClock, CalendarX2, Goal, LineChart, NotebookPen, Plus, UserX } from "lucide-react";
import type { LearningGoal, ProgressNote } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { endMs } from "@/lib/booking";
import { subjectName, SUBJECTS } from "@/lib/data/catalog";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Progress, Segmented } from "@/components/ui/Controls";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { NeedsTutorProfile, TagInput } from "./shared";
import { formatDateKey, todayKey, useMyStudents, useMyTutor, type Learner } from "./hooks";

type TopicStatus = LearningGoal["topics"][number]["status"];
const TOPIC_OPTIONS: { value: TopicStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Done" },
];

export function TutorProgress() {
  const { tutor } = useMyTutor();
  const students = useMyStudents(tutor?.id);
  const [selected, setSelected] = React.useState<string | null>(null);
  const current = students.find((s) => s.id === selected) ?? students[0];

  if (!tutor) return <NeedsTutorProfile what="student progress" />;

  return (
    <div>
      <PageHeader title="Students & progress" description="Goals, topic progress and notes for each student you teach. Parents see notes for their children." />
      {students.length === 0 ? (
        <div data-spotlight className="rounded-xl border border-line bg-surface">
          <EmptyState icon={<LineChart />} title="No students yet" description="Students appear here after their first confirmed lesson with you. Then you can set goals and share progress notes." action={<Button asChild variant="secondary"><Link href="/dashboard/jobs">Find students</Link></Button>} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div>
            <Select
              aria-label="Choose a student"
              className="lg:hidden"
              value={current.id}
              onChange={(e) => setSelected(e.target.value)}
              options={students.map((s) => ({ value: s.id, label: `${s.name}${s.guardian ? ` (parent: ${s.guardian})` : ""}` }))}
            />
            <nav aria-label="Students" className="hidden lg:block">
              <ul className="space-y-1">
                {students.map((s) => {
                  const active = s.id === current.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(s.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors", active ? "text-ink" : "text-ink-2 hover:bg-canvas")}
                      >
                        {active && <motion.span layoutId="progress-student" className="absolute inset-0 rounded-lg bg-brand-soft" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                        <Avatar name={s.name} size="sm" className="relative" />
                        <span className="relative min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.name}</span>
                          <span className="block truncate text-[12px] text-muted">{s.subjects.map(subjectName).join(", ")}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-w-0">
              <StudentPanel student={current} tutorId={tutor.id} tutorSubjects={tutor.subjects} />
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function StudentPanel({ student, tutorId, tutorSubjects }: { student: Learner; tutorId: string; tutorSubjects: string[] }) {
  const now = useNow(60_000);
  const tz = useViewerTimezone();
  const allGoals = useApp((s) => s.goals);
  const allNotes = useApp((s) => s.progressNotes);
  const setTopicStatus = useApp((s) => s.setTopicStatus);
  const [addingGoal, setAddingGoal] = React.useState(false);

  const goals = React.useMemo(() => allGoals.filter((g) => g.learnerId === student.id && g.tutorId === tutorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allGoals, student.id, tutorId]);
  const notes = React.useMemo(() => allNotes.filter((n) => n.learnerId === student.id && n.tutorId === tutorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allNotes, student.id, tutorId]);

  const b = student.bookings;
  const completed = b.filter((x) => x.status === "completed").length;
  const upcoming = b.filter((x) => (x.status === "confirmed" || x.status === "pending") && endMs(x) > now);
  const noShows = b.filter((x) => x.status === "no_show_student").length;
  const cancelled = b.filter((x) => x.status.startsWith("cancelled")).length;
  const attended = completed + noShows ? Math.round((completed / (completed + noShows)) * 100) : null;
  const nextLesson = [...upcoming].sort((x, y) => x.startUtc.localeCompare(y.startUtc))[0];

  const stats = [
    { icon: CalendarCheck2, label: "Completed", value: completed },
    { icon: CalendarClock, label: "Upcoming", value: upcoming.length },
    { icon: UserX, label: "No-shows", value: noShows },
    { icon: CalendarX2, label: "Cancelled", value: cancelled },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={student.name} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-ink">{student.name}</h2>
              <p className="text-[13px] text-muted">
                {student.guardian ? `Booked by parent ${student.guardian}` : student.accountRole === "parent" ? "Parent account" : "Student account"}
                {nextLesson ? ` · next lesson ${formatDateTime(nextLesson.startUtc, tz)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {student.subjects.map((s) => (
                <Badge key={s} tone="accent" size="sm">
                  {subjectName(s)}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12.5px] font-medium text-muted">
              Attendance{attended !== null ? ` · ${attended}% of held lessons attended` : ""}
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-line bg-canvas px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                    <s.icon className="size-3.5" aria-hidden /> {s.label}
                  </dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Learning goals"
          description="Track topics as you cover them. Families see the same progress."
          action={
            <Button variant="secondary" size="sm" onClick={() => setAddingGoal(true)}>
              <Plus /> Add goal
            </Button>
          }
        />
        <CardContent className="pt-4">
          {goals.length === 0 ? (
            <EmptyState compact icon={<Goal />} title="No goals yet" description={`Set a goal with a few topics so ${student.name} and their family can see progress over time.`} />
          ) : (
            <ul className="space-y-4">
              {goals.map((g) => {
                const done = g.topics.filter((t) => t.status === "completed").length;
                const pct = g.topics.length ? Math.round((done / g.topics.length) * 100) : 0;
                return (
                  <li key={g.id} data-spotlight className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">{g.title}</p>
                        <p className="text-[12.5px] text-muted">
                          {subjectName(g.subject)}
                          {g.targetDate ? ` · target ${formatDateKey(g.targetDate, { month: "short", day: "numeric", year: "numeric" })}` : ""}
                        </p>
                      </div>
                      <span className="text-[13px] font-medium tabular-nums text-ink-2">
                        {done}/{g.topics.length} topics
                      </span>
                    </div>
                    <Progress value={pct} className="mt-3" label={`${g.title} progress`} tone={pct === 100 ? "success" : "navy"} />
                    <ul className="mt-3 divide-y divide-line">
                      {g.topics.map((t) => (
                        <li key={t.name} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <span className={cn("text-sm", t.status === "completed" ? "text-muted line-through decoration-line-strong" : "text-ink")}>{t.name}</span>
                          <Segmented
                            size="sm"
                            label={`Status for ${t.name}`}
                            value={t.status}
                            onChange={(v) => {
                              const res = setTopicStatus(g.id, t.name, v);
                              if (!res.ok) toast.error(res.error);
                            }}
                            options={TOPIC_OPTIONS}
                          />
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <NotesCard student={student} notes={notes} now={now} tz={tz} />

      <GoalDialog open={addingGoal} onOpenChange={setAddingGoal} student={student} tutorSubjects={tutorSubjects} />
    </div>
  );
}

const UNDERSTANDING = ["", "Struggling", "Developing", "Getting there", "Confident", "Mastered"];

function NotesCard({ student, notes, now, tz }: { student: Learner; notes: ProgressNote[]; now: number; tz: string }) {
  const addNote = useApp((s) => s.addProgressNote);
  const [body, setBody] = React.useState("");
  const [rating, setRating] = React.useState<"" | "1" | "2" | "3" | "4" | "5">("");
  const [lesson, setLesson] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lessons = student.bookings.filter((b) => b.status === "completed");
  const bodyError = body.trim().length < 10 ? "Write a short note (10+ characters)." : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (bodyError) return;
    const res = addNote(student.id, body, rating ? (Number(rating) as ProgressNote["rating"]) : undefined, lesson || undefined);
    if (!res.ok) return setError(res.error);
    setBody("");
    setRating("");
    setLesson("");
    setTouched(false);
    setError(null);
    toast.success("Progress note shared", { description: student.guardian ? `${student.guardian} can see it now.` : `${student.name} can see it now.` });
  };

  return (
    <Card>
      <CardHeader title="Progress notes" description={student.guardian ? `Shared with ${student.guardian}.` : `Shared with ${student.name}.`} />
      <CardContent className="space-y-5 pt-4">
        <form noValidate onSubmit={submit} data-spotlight className="space-y-4 rounded-xl border border-line bg-canvas p-4">
          <Field label="New note" required error={touched ? bodyError ?? undefined : undefined}>
            <Textarea rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => setTouched(true)} placeholder="What you covered, what went well and what to practice next." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Understanding" optional>
              <Select value={rating} onChange={(e) => setRating(e.target.value as typeof rating)} placeholder="Not rated" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} · ${UNDERSTANDING[n]}` }))} />
            </Field>
            <Field label="Related lesson" optional>
              <Select value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="None" options={lessons.map((b) => ({ value: b.id, label: `${subjectName(b.subject)} · ${formatDate(b.startUtc, tz, { month: "short", day: "numeric" })}` }))} />
            </Field>
          </div>
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          <div className="flex justify-end">
            <Button type="submit">
              <NotebookPen /> Share note
            </Button>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className="text-center text-sm text-muted">No notes yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-line pl-5">
            <AnimatePresence initial={false}>
              {notes.map((n) => {
                const lessonB = n.bookingId ? student.bookings.find((b) => b.id === n.bookingId) : undefined;
                return (
                  <motion.li key={n.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-ink" aria-hidden />
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                      <time dateTime={n.createdAt}>{formatRelative(n.createdAt, now)}</time>
                      {lessonB && <span>· {subjectName(lessonB.subject)} lesson, {formatDate(lessonB.startUtc, tz, { month: "short", day: "numeric" })}</span>}
                      {n.rating && (
                        <Badge tone="neutral" size="sm">
                          Understanding {n.rating}/5 · {UNDERSTANDING[n.rating]}
                        </Badge>
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">{n.body}</p>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function GoalDialog({ open, onOpenChange, student, tutorSubjects }: { open: boolean; onOpenChange: (o: boolean) => void; student: Learner; tutorSubjects: string[] }) {
  const addGoal = useApp((s) => s.addGoal);
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const subjectSlugs = Array.from(new Set([...student.subjects, ...tutorSubjects]));
  const [subject, setSubject] = React.useState(student.subjects[0] ?? "");
  const [title, setTitle] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [topics, setTopics] = React.useState<string[]>([]);
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setSubject(student.subjects[0] ?? "");
      setTitle("");
      setTarget("");
      setTopics([]);
      setTouched(false);
      setError(null);
    }
  }
  const today = todayKey(now, tz);
  const errs = {
    subject: subject ? null : "Choose a subject.",
    title: title.trim().length < 3 ? "Give the goal a short title." : null,
    target: target && target < today ? "Choose a future date." : null,
    topics: topics.length ? null : "Add at least one topic.",
  };
  const invalid = Object.values(errs).some(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    const res = addGoal({ learnerId: student.id, subject, title: title.trim(), topics: topics.map((name) => ({ name, status: "not_started" as const })), ...(target ? { targetDate: target } : {}) });
    if (!res.ok) return setError(res.error);
    toast.success("Goal added");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`New goal for ${student.name}`} description="Break the goal into topics you can mark as you go." size="md">
        <form noValidate onSubmit={submit}>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Subject" required error={touched ? errs.subject ?? undefined : undefined}>
                <Select value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Choose" options={SUBJECTS.filter((s) => subjectSlugs.includes(s.slug)).map((s) => ({ value: s.slug, label: s.name }))} />
              </Field>
              <Field label="Target date" optional error={touched ? errs.target ?? undefined : undefined}>
                <Input type="date" min={today} value={target} onChange={(e) => setTarget(e.target.value)} />
              </Field>
            </div>
            <Field label="Goal" required error={touched ? errs.title ?? undefined : undefined}>
              <Input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AP Calculus BC — Units 9 & 10" />
            </Field>
            <Field label="Topics" required hint="Press Enter after each topic, up to 12." error={touched ? errs.topics ?? undefined : undefined}>
              <TagInput value={topics} onChange={setTopics} max={12} maxLength={60} placeholder="e.g. Parametric equations" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add goal</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
