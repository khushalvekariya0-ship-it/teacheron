"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock, ClipboardList, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Target, Trash2, Users } from "lucide-react";
import type { Child, Grade, User } from "@/lib/types";
import { PageHeader, RoleGate } from "@/components/dashboard/Shell";
import { AnimatePresence, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { useApp } from "@/lib/store";
import { useNow, useSession } from "@/lib/store/hooks";
import { isUpcoming } from "@/lib/booking";
import { GRADES, GRADE_LABEL, subjectName } from "@/lib/data/catalog";
import { pluralize } from "@/lib/format";
import { TagInput } from "@/components/dashboard/shared/TagInput";
import { SubjectPicker } from "@/components/dashboard/shared/SubjectPicker";
import { useMyChildren } from "./data";

const EASE = [0.22, 1, 0.36, 1] as const;
const GRADE_VALUES = GRADES.map((g) => g.value) as [Grade, ...Grade[]];

export function ChildrenView() {
  return (
    <RoleGate roles={["parent"]}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const me = useSession() as User;
  const now = useNow(60_000);
  const kids = useMyChildren(me);
  const bookings = useApp((s) => s.bookings);
  const requirements = useApp((s) => s.requirements);
  const removeChild = useApp((s) => s.removeChild);
  const [editing, setEditing] = React.useState<Child | "new" | null>(null);
  const [removing, setRemoving] = React.useState<Child | null>(null);

  const stats = React.useMemo(() => {
    const m = new Map<string, { upcoming: number; openReqs: number }>();
    for (const c of kids) {
      m.set(c.id, {
        upcoming: bookings.filter((b) => b.bookerId === me.id && b.childId === c.id && isUpcoming(b, now)).length,
        openReqs: requirements.filter((r) => r.ownerId === me.id && r.childId === c.id && r.status !== "closed").length,
      });
    }
    return m;
  }, [kids, bookings, requirements, me.id, now]);

  const confirmRemove = () => {
    if (!removing) return;
    const res = removeChild(removing.id);
    if (!res.ok) toast.error(res.error);
    else toast.success(`${removing.firstName}'s profile was removed`);
    setRemoving(null);
  };

  return (
    <div>
      <PageHeader
        title="Children"
        description="A profile for each child you book lessons for, with their grade, goals and the subjects they're working on."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add a child
          </Button>
        }
      />

      <InlineAlert className="mb-6" title={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4" aria-hidden /> Safeguards for children</span>}>
        Conversations and lessons for your children are visible to this parent account. Children don&apos;t have separate logins in this build — you book, message and pay on their behalf.
      </InlineAlert>

      {kids.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users />}
            title="Add your first child"
            description="Child profiles let you post requirements, book lessons and follow progress separately for each of your kids."
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus /> Add a child
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {kids.map((c, i) => {
              const s = stats.get(c.id) ?? { upcoming: 0, openReqs: 0 };
              const age = c.birthYear ? new Date(now).getFullYear() - c.birthYear : null;
              const search = new URLSearchParams({ ...(c.subjects[0] ? { subject: c.subjects[0] } : {}), grade: c.grade }).toString();
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: i * 0.06 } }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
                >
                  <Card className="flex h-full flex-col">
                    <div className="flex items-start gap-3.5 p-5">
                      <Avatar name={c.firstName} size="lg" />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{c.firstName}</h2>
                        <p className="text-[13px] text-muted">
                          {GRADE_LABEL[c.grade]}
                          {age !== null && ` · about ${age - 1}–${age} years old`}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.firstName}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setEditing(c)}>
                            <Pencil /> Edit profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem tone="danger" onSelect={() => setRemoving(c)}>
                            <Trash2 /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="grid grid-cols-2 border-y border-line">
                      <Link href="/dashboard/bookings" className="group border-r border-line px-5 py-3 transition-colors hover:bg-canvas">
                        <p className="flex items-center gap-1.5 text-[12px] text-muted">
                          <CalendarClock className="size-3.5" aria-hidden /> Upcoming lessons
                        </p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{s.upcoming}</p>
                      </Link>
                      <Link href="/dashboard/requirements" className="group px-5 py-3 transition-colors hover:bg-canvas">
                        <p className="flex items-center gap-1.5 text-[12px] text-muted">
                          <ClipboardList className="size-3.5" aria-hidden /> Open requirements
                        </p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{s.openReqs}</p>
                      </Link>
                    </div>

                    <div className="flex-1 space-y-4 p-5">
                      <div>
                        <p className="text-[12px] font-medium text-muted">Learning goals</p>
                        {c.learningGoals.length ? (
                          <ul className="mt-1.5 space-y-1">
                            {c.learningGoals.map((g) => (
                              <li key={g} className="flex items-start gap-2 text-[13.5px] text-ink-2">
                                <Target className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden /> {g}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[13px] text-muted">No goals added yet.</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-muted">Subjects</p>
                        {c.subjects.length ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {c.subjects.map((sub) => (
                              <Badge key={sub} size="sm">
                                {subjectName(sub)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-[13px] text-muted">No subjects yet.</p>
                        )}
                      </div>
                      {c.notes && (
                        <div>
                          <p className="text-[12px] font-medium text-muted">Notes for tutors</p>
                          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{c.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3.5">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/tutors?${search}`}>
                          <Search /> Find tutors
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/post-requirement?childId=${encodeURIComponent(c.id)}`}>
                          <Plus /> Post a requirement
                        </Link>
                      </Button>
                    </div>
                  </Card>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <ChildDialog child={editing} currentYear={new Date(now).getFullYear()} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.firstName ?? "this child"}?`}
        description={
          removing && (stats.get(removing.id)?.upcoming ?? 0) > 0
            ? `${removing.firstName} has ${pluralize(stats.get(removing.id)!.upcoming, "upcoming lesson")}. Cancel them before removing the profile.`
            : "Their profile is removed from your account. Past lessons and payments stay in your history."
        }
        confirmLabel="Remove"
        tone="danger"
        onConfirm={confirmRemove}
      />
    </div>
  );
}

/* ─── Add / edit dialog ─────────────────────────────────────────────────────── */

function makeSchema(currentYear: number) {
  return z.object({
    firstName: z.string().trim().min(1, "Enter your child's first name").max(40, "Keep it under 40 characters"),
    grade: z.enum(GRADE_VALUES, { errorMap: () => ({ message: "Choose a grade" }) }),
    birthYear: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{4}$/.test(v) && +v >= currentYear - 25 && +v <= currentYear - 3), `Enter a year between ${currentYear - 25} and ${currentYear - 3}`),
    learningGoals: z.array(z.string()).max(6, "Add up to 6 goals"),
    subjects: z.array(z.string()).max(8, "Choose up to 8 subjects"),
    notes: z.string().max(500, "Keep notes under 500 characters"),
  });
}

type ChildValues = z.infer<ReturnType<typeof makeSchema>>;

function ChildDialog({ child, currentYear, onClose }: { child: Child | "new" | null; currentYear: number; onClose: () => void }) {
  const open = child !== null;
  const existing = child && child !== "new" ? child : null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && (
        <DialogContent
          size="lg"
          title={existing ? `Edit ${existing.firstName}'s profile` : "Add a child"}
          description="Used when you post requirements and book lessons for this child."
        >
          <ChildForm key={existing?.id ?? "new"} existing={existing} currentYear={currentYear} onDone={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ChildForm({ existing, currentYear, onDone }: { existing: Child | null; currentYear: number; onDone: () => void }) {
  const saveChild = useApp((s) => s.saveChild);
  const schema = React.useMemo(() => makeSchema(currentYear), [currentYear]);
  const form = useForm<ChildValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      firstName: existing?.firstName ?? "",
      grade: existing?.grade ?? ("" as Grade),
      birthYear: existing?.birthYear ? String(existing.birthYear) : "",
      learningGoals: existing?.learningGoals ?? [],
      subjects: existing?.subjects ?? [],
      notes: existing?.notes ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit((v) => {
    const res = saveChild({
      ...(existing ? { id: existing.id } : {}),
      firstName: v.firstName,
      grade: v.grade,
      birthYear: v.birthYear ? Number(v.birthYear) : undefined,
      learningGoals: v.learningGoals,
      subjects: v.subjects,
      notes: v.notes.trim() || undefined,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(existing ? `${res.data.firstName}'s profile was updated` : `${res.data.firstName} was added`);
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName?.message}>
            <Input autoComplete="off" {...form.register("firstName")} />
          </Field>
          <Field label="Grade" required error={errors.grade?.message}>
            <Select placeholder="Choose a grade" options={GRADES.map((g) => ({ value: g.value, label: g.label }))} {...form.register("grade")} />
          </Field>
        </div>
        <Field label="Birth year" optional error={errors.birthYear?.message} hint="Year only — we never ask for a full date of birth.">
          <Input inputMode="numeric" maxLength={4} placeholder={String(currentYear - 10)} className="sm:max-w-40" {...form.register("birthYear")} />
        </Field>
        <Controller
          control={form.control}
          name="learningGoals"
          render={({ field }) => (
            <Field id="child-goals" label="Learning goals" optional error={errors.learningGoals?.message} hint="Press Enter after each goal. Up to 6.">
              <TagInput id="child-goals" value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="e.g. Finish homework independently" invalid={!!errors.learningGoals} describedBy={errors.learningGoals ? "child-goals-error" : "child-goals-hint"} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="subjects"
          render={({ field }) => (
            <Field id="child-subjects" label="Subjects" optional error={errors.subjects?.message}>
              <SubjectPicker id="child-subjects" value={field.value} onChange={field.onChange} invalid={!!errors.subjects} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="notes"
          render={({ field }) => (
            <Field label="Notes for tutors" optional error={errors.notes?.message} hint="Anything that helps a tutor prepare — how they learn best, accommodations, interests.">
              <Textarea rows={3} maxLength={500} showCount {...field} />
            </Field>
          )}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {existing ? "Save changes" : "Add child"}
        </Button>
      </DialogFooter>
    </form>
  );
}
