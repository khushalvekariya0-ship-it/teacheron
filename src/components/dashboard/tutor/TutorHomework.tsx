"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ClipboardCheck, FileText, MessageSquareText, NotebookPen, Plus } from "lucide-react";
import type { Homework } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { SUBJECTS, subjectName } from "@/lib/data/catalog";
import { formatDate, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { NeedsTutorProfile } from "./shared";
import { formatDateKey, todayKey, useLearnerName, useMyStudents, useMyTutor } from "./hooks";

type Status = Homework["status"];
type Tab = "all" | Status;

const STATUS_META: Record<Status, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  assigned: { label: "Assigned", tone: "accent" },
  submitted: { label: "Needs review", tone: "warning" },
  reviewed: { label: "Reviewed", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
};
const ORDER: Status[] = ["submitted", "overdue", "assigned", "reviewed"];

export function TutorHomework() {
  const { tutor } = useMyTutor();
  const now = useNow(60_000);
  const tz = useViewerTimezone();
  const all = useApp((s) => s.homework);
  const students = useMyStudents(tutor?.id);
  const nameOf = useLearnerName();
  const [tab, setTab] = React.useState<Tab>("all");
  const [assigning, setAssigning] = React.useState(false);
  const [reviewing, setReviewing] = React.useState<Homework | null>(null);

  const today = todayKey(now, tz);
  /** Assigned work past its due date is shown as overdue. */
  const statusOf = React.useCallback((h: Homework): Status => (h.status === "assigned" && h.dueDate < today ? "overdue" : h.status), [today]);
  const mine = React.useMemo(
    () =>
      tutor
        ? all
            .filter((h) => h.tutorId === tutor.id)
            .sort((a, b) => ORDER.indexOf(statusOf(a)) - ORDER.indexOf(statusOf(b)) || a.dueDate.localeCompare(b.dueDate))
        : [],
    [all, tutor, statusOf],
  );

  if (!tutor) return <NeedsTutorProfile what="homework" />;

  const count = (s: Status) => mine.filter((h) => statusOf(h) === s).length;
  const visible = tab === "all" ? mine : mine.filter((h) => statusOf(h) === tab);

  return (
    <div>
      <PageHeader
        title="Homework"
        description="Assign practice between lessons and review what students send back."
        actions={
          <Button onClick={() => setAssigning(true)} disabled={!students.length} title={students.length ? undefined : "You can assign homework once you have a confirmed student."}>
            <Plus /> Assign homework
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label="Homework by status">
          <TabsTrigger value="all" count={mine.length}>
            All
          </TabsTrigger>
          <TabsTrigger value="submitted" count={count("submitted")}>
            Needs review
          </TabsTrigger>
          <TabsTrigger value="assigned" count={count("assigned")}>
            Assigned
          </TabsTrigger>
          <TabsTrigger value="overdue" count={count("overdue")}>
            Overdue
          </TabsTrigger>
          <TabsTrigger value="reviewed" count={count("reviewed")}>
            Reviewed
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-5">
        {visible.length === 0 ? (
          <div data-spotlight className="rounded-xl border border-line bg-surface">
            {mine.length === 0 ? (
              <EmptyState
                icon={<NotebookPen />}
                title="No homework yet"
                description={students.length ? "Assign a short practice set after your next lesson. Students and parents are notified right away." : "Once a student has a confirmed lesson with you, you can assign homework here."}
                action={students.length ? <Button onClick={() => setAssigning(true)}><Plus /> Assign homework</Button> : undefined}
              />
            ) : (
              <EmptyState compact icon={<ClipboardCheck />} title={`Nothing ${STATUS_META[tab as Status]?.label.toLowerCase() ?? "here"}`} description="You're all caught up in this list." />
            )}
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            <AnimatePresence initial={false}>
              {visible.map((h) => {
                const s = statusOf(h);
                return (
                  <motion.li key={h.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <article data-spotlight className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby={`hw-${h.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[12.5px] text-muted">
                            {nameOf(h.learnerId)} · {subjectName(h.subject)}
                          </p>
                          <h2 id={`hw-${h.id}`} className="mt-0.5 text-[15px] font-semibold tracking-tight text-ink">
                            {h.title}
                          </h2>
                        </div>
                        <Badge tone={STATUS_META[s].tone} size="sm" dot>
                          {STATUS_META[s].label}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-2">{h.instructions}</p>
                      {h.submission && (
                        <div className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-[13px]">
                          <p className="font-medium text-ink">Submitted {formatRelative(h.submission.submittedAt, now)}</p>
                          {h.submission.body && <p className="mt-0.5 line-clamp-2 text-ink-2">“{h.submission.body}”</p>}
                          {h.submission.fileName && (
                            <p className="mt-1 inline-flex items-center gap-1 text-muted">
                              <FileText className="size-3.5" aria-hidden /> {h.submission.fileName}
                            </p>
                          )}
                        </div>
                      )}
                      {h.feedback && (
                        <div className="mt-3 rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 text-[13px]">
                          <p className="font-medium text-success">Your feedback{h.feedback.grade ? ` · ${h.feedback.grade}` : ""}</p>
                          <p className="mt-0.5 text-ink-2">{h.feedback.body}</p>
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                        <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                          <CalendarDays className="size-3.5" aria-hidden /> Due {formatDateKey(h.dueDate)}
                        </p>
                        {h.status === "submitted" && (
                          <Button size="sm" onClick={() => setReviewing(h)}>
                            <MessageSquareText /> Review
                          </Button>
                        )}
                      </div>
                    </article>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <AssignDialog open={assigning} onOpenChange={setAssigning} students={students.map((s) => ({ id: s.id, name: s.name, subjects: s.subjects }))} tutorSubjects={tutor.subjects} today={today} />
      <ReviewDialog hw={reviewing} learner={reviewing ? nameOf(reviewing.learnerId) : ""} onClose={() => setReviewing(null)} tz={tz} />
    </div>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  students,
  tutorSubjects,
  today,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  students: { id: string; name: string; subjects: string[] }[];
  tutorSubjects: string[];
  today: string;
}) {
  const assign = useApp((s) => s.assignHomework);
  const [learnerId, setLearnerId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [due, setDue] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      const first = students[0];
      setLearnerId(first?.id ?? "");
      setSubject(first?.subjects.find((s) => tutorSubjects.includes(s)) ?? tutorSubjects[0] ?? "");
      setTitle("");
      setInstructions("");
      setDue("");
      setTouched(false);
      setError(null);
    }
  }
  const errs = {
    learner: learnerId ? null : "Choose a student.",
    subject: subject ? null : "Choose a subject.",
    title: title.trim().length < 3 ? "Add a short title." : null,
    instructions: instructions.trim().length < 10 ? "Add instructions (10+ characters)." : null,
    due: !due ? "Choose a due date." : due < today ? "Choose today or a later date." : null,
  };
  const show = (k: keyof typeof errs) => (touched ? errs[k] ?? undefined : undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const res = assign({ learnerId, subject, title: title.trim(), instructions: instructions.trim(), dueDate: due });
    if (!res.ok) return setError(res.error);
    toast.success("Homework assigned", { description: `${students.find((s) => s.id === learnerId)?.name ?? "Your student"} has been notified.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Assign homework" description="Students and parents are notified right away." size="md">
        <form noValidate onSubmit={submit}>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Student" required error={show("learner")}>
                <Select value={learnerId} onChange={(e) => setLearnerId(e.target.value)} placeholder="Choose" options={students.map((s) => ({ value: s.id, label: s.name }))} />
              </Field>
              <Field label="Subject" required error={show("subject")}>
                <Select value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Choose" options={SUBJECTS.filter((s) => tutorSubjects.includes(s.slug)).map((s) => ({ value: s.slug, label: s.name }))} />
              </Field>
            </div>
            <Field label="Title" required error={show("title")}>
              <Input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Related rates practice set" />
            </Field>
            <Field label="Instructions" required error={show("instructions")}>
              <Textarea rows={4} maxLength={1000} showCount value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What to do, how long it should take and what to bring next time." />
            </Field>
            <Field label="Due date" required error={show("due")} className="max-w-56">
              <Input type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Assign</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ hw, learner, onClose, tz }: { hw: Homework | null; learner: string; onClose: () => void; tz: string }) {
  const review = useApp((s) => s.reviewHomework);
  const [feedback, setFeedback] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [forId, setForId] = React.useState<string | null>(null);
  if (hw && forId !== hw.id) {
    setForId(hw.id);
    setFeedback("");
    setGrade("");
    setTouched(false);
    setError(null);
  }
  const fbError = feedback.trim().length < 10 ? "Write a little feedback (10+ characters)." : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!hw || fbError) return;
    const res = review(hw.id, feedback, grade.trim() || undefined);
    if (!res.ok) return setError(res.error);
    toast.success("Feedback sent", { description: `${learner} can see your review.` });
    onClose();
  };

  return (
    <Dialog open={!!hw} onOpenChange={(o) => !o && onClose()}>
      {hw && (
        <DialogContent title={`Review: ${hw.title}`} description={`${learner} · ${subjectName(hw.subject)}`} size="lg">
          <form noValidate onSubmit={submit}>
            <DialogBody className="space-y-5">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}
              <section className="rounded-lg border border-line bg-canvas p-4 text-sm" aria-label="Submission">
                <p className="text-[12.5px] font-medium text-muted">Submitted {hw.submission ? formatDate(hw.submission.submittedAt, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</p>
                <p className="mt-1 whitespace-pre-line leading-relaxed text-ink">{hw.submission?.body || <span className="text-muted">No written note.</span>}</p>
                {hw.submission?.fileName && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[13px] text-ink-2">
                    <FileText className="size-3.5 text-muted" aria-hidden /> {hw.submission.fileName}
                  </p>
                )}
              </section>
              <details className="text-[13px] text-muted">
                <summary className="cursor-pointer font-medium text-ink-2">Original instructions</summary>
                <p className="mt-1.5 whitespace-pre-line">{hw.instructions}</p>
              </details>
              <Field label="Feedback" required error={touched ? fbError ?? undefined : undefined}>
                <Textarea rows={4} maxLength={1000} showCount value={feedback} onChange={(e) => setFeedback(e.target.value)} onBlur={() => setTouched(true)} placeholder="What they did well and one thing to work on." />
              </Field>
              <Field label="Grade" optional hint="e.g. A-, 8/10 or ✓+" className="max-w-48">
                <Input maxLength={12} value={grade} onChange={(e) => setGrade(e.target.value)} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Send feedback</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
