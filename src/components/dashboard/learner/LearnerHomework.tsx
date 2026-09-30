"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CalendarDays, CheckCheck, FileText, NotebookPen, Paperclip, Pencil, Send, X } from "lucide-react";
import type { Homework, User } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/Shell";
import { AnimatePresence, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Controls";
import { Field, Textarea } from "@/components/ui/Input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { toast } from "@/components/ui/Toast";
import { useApp } from "@/lib/store";
import { useNow, useSession, useViewerTimezone } from "@/lib/store/hooks";
import { formatDate, formatRelative } from "@/lib/format";
import { subjectName } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";
import { tutorFullName, useTutorMap } from "@/components/dashboard/shared/hooks";
import { daysBetween, formatDateKey, todayKey, useLearners } from "./data";

type TabKey = "todo" | "submitted" | "reviewed";

const isTodo = (h: Homework) => h.status === "assigned" || h.status === "overdue";

function dueLabel(due: string, today: string): { text: string; overdue: boolean; soon: boolean } {
  const d = daysBetween(today, due);
  if (d < 0) return { text: `Overdue by ${-d} ${-d === 1 ? "day" : "days"}`, overdue: true, soon: false };
  if (d === 0) return { text: "Due today", overdue: false, soon: true };
  if (d === 1) return { text: "Due tomorrow", overdue: false, soon: true };
  return { text: `Due ${formatDateKey(due)}`, overdue: false, soon: false };
}

export function LearnerHomework() {
  const me = useSession();
  if (!me) return null;
  return <HomeworkInner me={me} />;
}

function HomeworkInner({ me }: { me: User }) {
  const now = useNow(60_000);
  const tz = useViewerTimezone();
  const homework = useApp((s) => s.homework);
  const learners = useLearners(me);
  const tutorMap = useTutorMap();
  const [tab, setTab] = React.useState<TabKey>("todo");
  const [who, setWho] = React.useState<string>("all");
  const [submitting, setSubmitting] = React.useState<Homework | null>(null);
  const today = todayKey(now, tz);

  const learnerIds = React.useMemo(() => new Set([me.id, ...learners.map((l) => l.id)]), [me.id, learners]);
  const nameOf = (id: string) => {
    if (me.role !== "parent") return undefined;
    const l = learners.find((x) => x.id === id);
    return l?.kind === "self" ? "you" : l?.name;
  };
  const mine = React.useMemo(() => homework.filter((h) => learnerIds.has(h.learnerId) && (who === "all" || h.learnerId === who)), [homework, learnerIds, who]);

  const lists: Record<TabKey, Homework[]> = {
    todo: mine.filter(isTodo).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    submitted: mine.filter((h) => h.status === "submitted").sort((a, b) => (b.submission?.submittedAt ?? "").localeCompare(a.submission?.submittedAt ?? "")),
    reviewed: mine.filter((h) => h.status === "reviewed").sort((a, b) => (b.feedback?.at ?? "").localeCompare(a.feedback?.at ?? "")),
  };
  const overdueCount = lists.todo.filter((h) => h.dueDate < today).length;

  const empty: Record<TabKey, { title: string; description: string }> = {
    todo: { title: "Nothing to do", description: "New assignments from tutors show up here with their due dates." },
    submitted: { title: "Nothing waiting for feedback", description: "Work you submit appears here until your tutor reviews it." },
    reviewed: { title: "No feedback yet", description: "Once a tutor reviews submitted work, their feedback and grade show here." },
  };

  return (
    <div>
      <PageHeader
        title="Homework"
        description={me.role === "parent" ? "Assignments from your children's tutors. Help them submit work and read the feedback." : "Assignments from your tutors. Submit your work and read their feedback."}
      />

      {me.role === "parent" && learners.length > 1 && (
        <div className="-mt-2 mb-5 overflow-x-auto pb-1">
          <Segmented label="Show homework for" value={who} onChange={setWho} options={[{ value: "all", label: "Everyone" }, ...learners.map((l) => ({ value: l.id, label: l.name }))]} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {overdueCount > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning" role="note">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{overdueCount === 1 ? "1 assignment is" : `${overdueCount} assignments are`} overdue.</span> <span className="text-ink-2">You can still submit — your tutor will see when it arrived.</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Homework status">
          <TabsTrigger value="todo" count={lists.todo.length}>
            To do
          </TabsTrigger>
          <TabsTrigger value="submitted" count={lists.submitted.length}>
            Submitted
          </TabsTrigger>
          <TabsTrigger value="reviewed" count={lists.reviewed.length}>
            Reviewed
          </TabsTrigger>
        </TabsList>

        {(Object.keys(lists) as TabKey[]).map((key) => (
          <TabsContent key={key} value={key}>
            {lists[key].length === 0 ? (
              <Card>
                <EmptyState icon={key === "reviewed" ? <CheckCheck /> : <NotebookPen />} title={empty[key].title} description={empty[key].description} />
              </Card>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {lists[key].map((h, i) => {
                    const tutor = tutorMap.get(h.tutorId);
                    const due = dueLabel(h.dueDate, today);
                    const learner = nameOf(h.learnerId);
                    return (
                      <motion.li
                        key={h.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 6) * 0.05 } }}
                        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                      >
                        <Card className={cn(key === "todo" && due.overdue && "border-warning-200")}>
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">{h.title}</h2>
                                  {key === "todo" && due.overdue && (
                                    <Badge tone="warning" size="sm">
                                      <AlertTriangle /> Overdue
                                    </Badge>
                                  )}
                                  {key === "submitted" && (
                                    <Badge tone="accent" size="sm">
                                      Awaiting feedback
                                    </Badge>
                                  )}
                                  {key === "reviewed" && h.feedback?.grade && (
                                    <Badge tone="success" size="sm">
                                      Grade: {h.feedback.grade}
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[13px] text-muted">
                                  {subjectName(h.subject)} · {tutorFullName(tutor)}
                                  {learner && ` · for ${learner}`}
                                </p>
                              </div>
                              <p className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", key === "todo" && due.overdue ? "text-warning" : key === "todo" && due.soon ? "text-ink" : "text-muted")}>
                                <CalendarDays className="size-3.5" aria-hidden />
                                {key === "todo" ? due.text : `Due ${formatDateKey(h.dueDate)}`}
                              </p>
                            </div>

                            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{h.instructions}</p>

                            {h.submission && (
                              <div className="mt-4 rounded-xl bg-canvas px-4 py-3">
                                <p className="text-[12px] font-medium text-muted">
                                  Submitted {formatRelative(h.submission.submittedAt, now)}
                                </p>
                                {h.submission.body && <p className="mt-1 whitespace-pre-line text-[13.5px] text-ink-2">{h.submission.body}</p>}
                                {h.submission.fileName && (
                                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12.5px] text-ink-2">
                                    <FileText className="size-3.5 text-subtle" aria-hidden /> {h.submission.fileName}
                                  </p>
                                )}
                              </div>
                            )}

                            {h.feedback && (
                              <div className="mt-3 flex gap-3 rounded-lg border border-success-200 bg-success-50/60 px-4 py-3">
                                <Avatar name={tutorFullName(tutor)} tone={tutor?.tone} size="sm" />
                                <div className="min-w-0">
                                  <p className="text-[12px] font-medium text-success">
                                    Feedback from {tutor?.firstName ?? "your tutor"} · {formatDate(h.feedback.at, tz, { month: "short", day: "numeric" })}
                                  </p>
                                  <p className="mt-0.5 text-[14px] leading-relaxed text-ink">{h.feedback.body}</p>
                                </div>
                              </div>
                            )}
                          </div>
                          {key !== "reviewed" && (
                            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
                              <span className="text-[12.5px] text-muted">Assigned {formatRelative(h.createdAt, now)}</span>
                              <Button size="sm" variant={key === "todo" ? "primary" : "secondary"} onClick={() => setSubmitting(h)}>
                                {key === "todo" ? (
                                  <>
                                    <Send /> Submit work
                                  </>
                                ) : (
                                  <>
                                    <Pencil /> Update submission
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </Card>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <p className="mt-6 text-[12.5px] text-muted">
        Questions about an assignment?{" "}
        <Link href="/dashboard/messages" className="font-medium text-ink hover:underline">
          Message the tutor
        </Link>
        .
      </p>

      <SubmitDialog homework={submitting} onClose={() => setSubmitting(null)} onSubmitted={() => setTab("submitted")} />
    </div>
  );
}

/* ─── Submit dialog ─────────────────────────────────────────────────────────── */

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt";

const submitSchema = z
  .object({
    body: z.string().max(2000, "Keep it under 2,000 characters"),
    fileName: z.string().optional(),
  })
  .refine((v) => v.body.trim().length > 0 || !!v.fileName, { path: ["body"], message: "Add a note or attach your work" });

type SubmitValues = z.infer<typeof submitSchema>;

function SubmitDialog({ homework, onClose, onSubmitted }: { homework: Homework | null; onClose: () => void; onSubmitted: () => void }) {
  return (
    <Dialog open={!!homework} onOpenChange={(o) => !o && onClose()}>
      {homework && (
        <DialogContent size="lg" title={homework.submission ? "Update your submission" : "Submit your work"} description={homework.title}>
          <SubmitForm key={homework.id} homework={homework} onDone={onClose} onSubmitted={onSubmitted} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function SubmitForm({ homework, onDone, onSubmitted }: { homework: Homework; onDone: () => void; onSubmitted: () => void }) {
  const submitHomework = useApp((s) => s.submitHomework);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const form = useForm<SubmitValues>({
    resolver: zodResolver(submitSchema),
    mode: "onTouched",
    defaultValues: { body: homework.submission?.body ?? "", fileName: homework.submission?.fileName },
  });
  const { errors, isSubmitting } = form.formState;
  const fileName = useWatch({ control: form.control, name: "fileName" });

  const onSubmit = form.handleSubmit((v) => {
    const res = submitHomework(homework.id, v.body, v.fileName);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(homework.submission ? "Submission updated" : "Homework submitted", { description: "Your tutor has been notified." });
    onSubmitted();
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-5">
        <div className="rounded-lg border border-line bg-canvas px-4 py-3">
          <p className="text-[12px] font-medium text-muted">Instructions</p>
          <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{homework.instructions}</p>
        </div>
        <Controller
          control={form.control}
          name="body"
          render={({ field }) => (
            <Field label="Your answer or a note for your tutor" error={errors.body?.message}>
              <Textarea rows={5} maxLength={2000} showCount placeholder="Explain your approach, or tell your tutor where you got stuck." {...field} />
            </Field>
          )}
        />
        <div>
          <p className="text-sm font-medium text-ink" id="hw-file-label">
            Attachment <span className="font-normal text-muted">(optional)</span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-labelledby="hw-file-label"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) {
                setFileError("Files must be 10 MB or smaller.");
                return;
              }
              setFileError(null);
              form.setValue("fileName", f.name, { shouldValidate: true });
            }}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {fileName ? (
              <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface py-1 pl-2.5 pr-1 text-[13px] text-ink-2">
                <Paperclip className="size-3.5 shrink-0 text-subtle" aria-hidden />
                <span className="truncate">{fileName}</span>
                <button type="button" onClick={() => form.setValue("fileName", undefined, { shouldValidate: true })} className="grid size-6 place-items-center rounded text-muted hover:bg-sunken hover:text-ink" aria-label={`Remove ${fileName}`}>
                  <X className="size-3.5" />
                </button>
              </span>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip /> {fileName ? "Replace file" : "Attach a file"}
            </Button>
          </div>
          {fileError ? (
            <p role="alert" className="mt-1.5 text-[13px] text-danger">
              {fileError}
            </p>
          ) : (
            <p className="mt-1.5 text-[12.5px] text-muted">PDF, image, Word or text file up to 10 MB. In this preview only the file name is saved — nothing is uploaded.</p>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          <Send /> {homework.submission ? "Update submission" : "Submit"}
        </Button>
      </DialogFooter>
    </form>
  );
}
