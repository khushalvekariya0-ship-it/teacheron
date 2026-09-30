"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, NotebookPen, Plus, ChartLine } from "lucide-react";
import type { Booking, Homework, ProgressNote } from "@/lib/types";
import { useApp } from "@/lib/store";
import { subjectName } from "@/lib/data/catalog";
import { formatRelative } from "@/lib/format";
import { dateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Controls";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { labelForKey } from "./shared";

const HW_META: Record<Homework["status"], { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  assigned: { label: "Assigned", tone: "accent" },
  submitted: { label: "Submitted", tone: "warning" },
  reviewed: { label: "Reviewed", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
};

export function LessonLearning({ booking: b, learnerName, isTutor, tz, now }: { booking: Booking; learnerName: string; isTutor: boolean; tz: string; now: number }) {
  const allNotes = useApp((s) => s.progressNotes);
  const allHomework = useApp((s) => s.homework);
  const bookings = useApp((s) => s.bookings);
  const learnerId = b.childId ?? b.bookerId;
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [hwOpen, setHwOpen] = React.useState(false);

  const notes = React.useMemo(
    () => allNotes.filter((n) => n.learnerId === learnerId && n.tutorId === b.tutorId).sort((x, y) => Number(y.bookingId === b.id) - Number(x.bookingId === b.id) || y.createdAt.localeCompare(x.createdAt)),
    [allNotes, learnerId, b.tutorId, b.id],
  );
  const homework = React.useMemo(() => allHomework.filter((h) => h.learnerId === learnerId && h.tutorId === b.tutorId).sort((x, y) => y.createdAt.localeCompare(x.createdAt)), [allHomework, learnerId, b.tutorId]);
  // Mirrors the store rule: tutors can only write for learners they actually teach.
  const teaches = React.useMemo(
    () => bookings.some((x) => x.tutorId === b.tutorId && (x.childId ? x.childId === learnerId : x.bookerId === learnerId) && ["confirmed", "in_progress", "completed"].includes(x.status)),
    [bookings, b.tutorId, learnerId],
  );
  const canWrite = isTutor && teaches;
  const thisLesson = notes.filter((n) => n.bookingId === b.id).length;

  return (
    <Card>
      <CardHeader
        title="Learning"
        description={isTutor ? `Notes and homework you've shared with ${learnerName}${b.childId ? "'s family" : ""}.` : `Progress notes and homework from this tutor${b.childId ? ` for ${learnerName}` : ""}.`}
        action={
          canWrite ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setNoteOpen(true)}>
                <Plus /> Note
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setHwOpen(true)}>
                <Plus /> Homework
              </Button>
            </div>
          ) : undefined
        }
      />
      <CardContent className="grid gap-6 pt-4 md:grid-cols-2">
        <section aria-labelledby="notes-h">
          <div className="flex items-center justify-between gap-2">
            <h3 id="notes-h" className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <ChartLine className="size-4 text-muted" aria-hidden /> Progress notes
              {thisLesson > 0 && <Badge tone="accent" size="sm">{thisLesson} from this lesson</Badge>}
            </h3>
            <Link href="/dashboard/progress" className="text-[12.5px] font-medium text-ink hover:underline">All</Link>
          </div>
          {notes.length ? (
            <ul className="mt-3 space-y-2.5">
              <AnimatePresence initial={false}>
                {notes.slice(0, 3).map((n) => (
                  <motion.li key={n.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                    <NoteItem note={n} current={n.bookingId === b.id} now={now} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-[13px] text-muted">
              {canWrite ? "No notes yet. Add one after the lesson so the family can follow along." : "No progress notes yet. Your tutor adds them after lessons."}
            </p>
          )}
        </section>
        <section aria-labelledby="hw-h">
          <div className="flex items-center justify-between gap-2">
            <h3 id="hw-h" className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <NotebookPen className="size-4 text-muted" aria-hidden /> Homework
            </h3>
            <Link href="/dashboard/homework" className="text-[12.5px] font-medium text-ink hover:underline">All</Link>
          </div>
          {homework.length ? (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
              <AnimatePresence initial={false}>
                {homework.slice(0, 3).map((h) => (
                  <motion.li key={h.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{h.title}</p>
                      <p className="text-[12.5px] text-muted">Due {labelForKey(h.dueDate, { month: "short", day: "numeric" })}</p>
                    </div>
                    <Badge tone={HW_META[h.status].tone} size="sm">{HW_META[h.status].label}</Badge>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-[13px] text-muted">
              {canWrite ? "Nothing assigned. Practice between lessons helps it stick." : "No homework from this tutor yet."}
            </p>
          )}
          {homework.length > 0 && !isTutor && (
            <Link href="/dashboard/homework" className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink hover:underline">
              Submit homework <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </section>
      </CardContent>
      {canWrite && (
        <>
          <AddNoteDialog open={noteOpen} onOpenChange={setNoteOpen} learnerId={learnerId} learnerName={learnerName} bookingId={b.id} />
          <AssignHomeworkDialog open={hwOpen} onOpenChange={setHwOpen} learnerId={learnerId} learnerName={learnerName} subject={b.subject} tz={tz} now={now} />
        </>
      )}
    </Card>
  );
}

function NoteItem({ note, current, now }: { note: ProgressNote; current: boolean; now: number }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", current ? "border-brand bg-brand-50" : "border-line")}>
      <p className="text-[13.5px] leading-relaxed text-ink-2">{note.body}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
        <span>{formatRelative(note.createdAt, now)}</span>
        {note.rating && (
          <span className="inline-flex items-center gap-1.5" aria-label={`Understanding ${note.rating} out of 5`}>
            Understanding
            <span className="flex gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= note.rating! ? "bg-ink" : "bg-line")} />
              ))}
            </span>
            <span className="tabular-nums" aria-hidden>{note.rating}/5</span>
          </span>
        )}
        {current && <span className="font-medium text-ink">This lesson</span>}
      </div>
    </div>
  );
}

function AddNoteDialog({ open, onOpenChange, learnerId, learnerName, bookingId }: { open: boolean; onOpenChange: (o: boolean) => void; learnerId: string; learnerName: string; bookingId: string }) {
  const addNote = useApp((s) => s.addProgressNote);
  const [body, setBody] = React.useState("");
  const [rating, setRating] = React.useState<"0" | "1" | "2" | "3" | "4" | "5">("0");
  const [error, setError] = React.useState<string>();
  const validate = (v: string) => (v.trim().length < 10 ? "Write at least 10 characters." : undefined);
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setBody("");
      setRating("0");
      setError(undefined);
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(body);
    if (err) return setError(err);
    const res = addNote(learnerId, body, rating === "0" ? undefined : (Number(rating) as 1 | 2 | 3 | 4 | 5), bookingId);
    if (!res.ok) return setError(res.error);
    toast.success("Progress note added", { description: `${learnerName === "Student" ? "The family" : learnerName.split(" ")[0]} can see it now.` });
    close(false);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Add a progress note" description={`Visible to ${learnerName} and any linked parent account.`}>
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-5">
            <Field label="What did you work on, and how did it go?" required error={error}>
              <Textarea value={body} onChange={(e) => { setBody(e.target.value); if (error) setError(validate(e.target.value)); }} onBlur={() => body && setError(validate(body))} rows={5} maxLength={1000} showCount placeholder="e.g. Solid on one-step equations. Next time: two-step equations with negatives." />
            </Field>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">Understanding <span className="font-normal text-muted">(optional)</span></p>
              <Segmented
                label="Understanding from 1 to 5"
                value={rating}
                onChange={setRating}
                size="sm"
                options={[{ value: "0", label: "Skip" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }]}
              />
              <p className="text-[12.5px] text-muted">1 = still new, 5 = confident and independent.</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit">Save note</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignHomeworkDialog({ open, onOpenChange, learnerId, learnerName, subject, tz, now }: { open: boolean; onOpenChange: (o: boolean) => void; learnerId: string; learnerName: string; subject: string; tz: string; now: number }) {
  const assign = useApp((s) => s.assignHomework);
  const today = dateKey(new Date(now), tz);
  const [title, setTitle] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [due, setDue] = React.useState("");
  const [errors, setErrors] = React.useState<{ title?: string; due?: string; form?: string }>({});
  const check = (field: "title" | "due", v: string) => {
    if (field === "title") return v.trim().length < 3 ? "Add a short title." : undefined;
    if (!v) return "Choose a due date.";
    return v < today ? "The due date can't be in the past." : undefined;
  };
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setTitle("");
      setInstructions("");
      setDue("");
      setErrors({});
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { title: check("title", title), due: check("due", due) };
    if (next.title || next.due) return setErrors(next);
    const res = assign({ learnerId, subject, title: title.trim(), instructions: instructions.trim(), dueDate: due });
    if (!res.ok) return setErrors({ form: res.error });
    toast.success("Homework assigned", { description: `Due ${labelForKey(due, { weekday: "short", month: "short", day: "numeric" })}` });
    close(false);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Assign homework" description={`${subjectName(subject)} · for ${learnerName}`}>
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            <Field label="Title" required error={errors.title}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title && setErrors((x) => ({ ...x, title: check("title", title) }))} maxLength={120} placeholder="e.g. Two-step equations practice" />
            </Field>
            <Field label="Instructions" optional hint="What to do, and what to bring to the next lesson.">
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} maxLength={1500} showCount />
            </Field>
            <Field label="Due date" required error={errors.due}>
              <Input type="date" min={today} value={due} onChange={(e) => { setDue(e.target.value); setErrors((x) => ({ ...x, due: undefined })); }} onBlur={() => due && setErrors((x) => ({ ...x, due: check("due", due) }))} />
            </Field>
            {errors.form && <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-[13px] text-danger">{errors.form}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit">Assign homework</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

