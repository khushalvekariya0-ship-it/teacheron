"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, BellRing, Bookmark, Briefcase, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import type { AlertFrequency, SavedSearch, User } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/Shell";
import { AnimatePresence, motion } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { useApp } from "@/lib/store";
import { useSession, useTutors, useViewerTimezone } from "@/lib/store/hooks";
import { parseTutorSearch, searchTutors, SCHEDULE_PRESETS, SORT_OPTIONS, type TutorSearch } from "@/lib/search";
import { GRADE_LABEL, LEVEL_LABEL, MODE_LABEL, TIMES_OF_DAY, TUTOR_CATEGORY_LABEL, subjectName } from "@/lib/data/catalog";
import { formatCents, formatDate } from "@/lib/format";

const FREQUENCY_OPTIONS: { value: AlertFrequency; label: string }[] = [
  { value: "instant", label: "Instantly" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
  { value: "off", label: "Off" },
];

/** Readable chips for a tutor-search URL. */
function tutorChips(s: TutorSearch): string[] {
  const chips: string[] = [];
  if (s.q) chips.push(`“${s.q}”`);
  if (s.subject) chips.push(subjectName(s.subject));
  if (s.grade) chips.push(GRADE_LABEL[s.grade]);
  else if (s.level) chips.push(LEVEL_LABEL[s.level] ?? s.level);
  if (s.mode) chips.push(MODE_LABEL[s.mode]);
  if (s.location) chips.push(`Near ${s.location}${s.radius ? ` · ${s.radius} mi` : ""}`);
  if (s.schedule) chips.push(SCHEDULE_PRESETS.find((p) => p.value === s.schedule)?.label ?? s.schedule);
  if (s.days?.length) chips.push(s.days.join(", "));
  if (s.times?.length) chips.push(s.times.map((t) => TIMES_OF_DAY.find((x) => x.value === t)?.label ?? t).join(", "));
  if (s.minRate && s.maxRate) chips.push(`${formatCents(s.minRate * 100)}–${formatCents(s.maxRate * 100)}/hr`);
  else if (s.maxRate) chips.push(`Up to ${formatCents(s.maxRate * 100)}/hr`);
  else if (s.minRate) chips.push(`From ${formatCents(s.minRate * 100)}/hr`);
  if (s.exp) chips.push(`${s.exp}+ yrs experience`);
  if (s.lang) chips.push(`Speaks ${s.lang}`);
  if (s.rating) chips.push(`${s.rating}+ stars`);
  if (s.category) chips.push(TUTOR_CATEGORY_LABEL[s.category] ?? s.category);
  if (s.support) chips.push(s.support);
  if (s.verified) chips.push("ID verified");
  if (s.certified) chips.push("Certified teacher");
  if (s.trial) chips.push("Offers a trial");
  if (s.instant) chips.push("Instant booking");
  if (s.sort && s.sort !== "match") chips.push(`Sorted: ${SORT_OPTIONS.find((o) => o.value === s.sort)?.label ?? s.sort}`);
  return chips;
}

function jobChips(query: Record<string, string>): string[] {
  const chips: string[] = [];
  const subjects = (query.subject ?? "").split(",").filter(Boolean);
  chips.push(...subjects.map(subjectName));
  if (query.mode === "online" || query.mode === "in_person") chips.push(MODE_LABEL[query.mode]);
  if (query.grade && query.grade in GRADE_LABEL) chips.push(GRADE_LABEL[query.grade as keyof typeof GRADE_LABEL]);
  if (query.location) chips.push(`Near ${query.location}`);
  if (query.q) chips.push(`“${query.q}”`);
  return chips;
}

export function SavedSearchesView() {
  const me = useSession();
  if (!me) return null;
  return <Inner me={me} />;
}

function Inner({ me }: { me: User }) {
  const tz = useViewerTimezone();
  const saved = useApp((s) => s.savedSearches);
  const requirements = useApp((s) => s.requirements);
  const updateSavedSearch = useApp((s) => s.updateSavedSearch);
  const deleteSavedSearch = useApp((s) => s.deleteSavedSearch);
  const tutors = useTutors();
  const [renaming, setRenaming] = React.useState<SavedSearch | null>(null);
  const [deleting, setDeleting] = React.useState<SavedSearch | null>(null);
  const isTutor = me.role === "tutor";

  const rows = React.useMemo(
    () =>
      saved
        .filter((s) => s.userId === me.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => {
          const params = new URLSearchParams(s.query);
          if (s.kind === "tutors") {
            const parsed = parseTutorSearch(params);
            return { search: s, chips: tutorChips(parsed), count: searchTutors(tutors, parsed).length, noun: "tutor", href: `/tutors${params.size ? `?${params}` : ""}` };
          }
          const subjects = (s.query.subject ?? "").split(",").filter(Boolean);
          const count = requirements.filter((r) => r.status === "published" && (!subjects.length || subjects.includes(r.subject))).length;
          const base = isTutor ? "/dashboard/jobs" : "/tutor-jobs";
          return { search: s, chips: jobChips(s.query), count, noun: "open job", href: `${base}${params.size ? `?${params}` : ""}` };
        }),
    [saved, me.id, tutors, requirements, isTutor],
  );

  const setFrequency = (s: SavedSearch, frequency: AlertFrequency) => {
    const res = updateSavedSearch(s.id, { frequency });
    if (!res.ok) toast.error(res.error);
    else toast.success(frequency === "off" ? "Alerts turned off" : `Alerts set to ${FREQUENCY_OPTIONS.find((f) => f.value === frequency)!.label.toLowerCase()}`, { description: s.label });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const res = deleteSavedSearch(deleting.id);
    if (!res.ok) toast.error(res.error);
    else toast.success("Saved search deleted");
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="Saved searches"
        description={isTutor ? "Job searches you've saved, with alerts when new requirements match." : "Tutor searches you've saved. Get alerts when new tutors match."}
        actions={
          <Button asChild variant="secondary">
            <Link href={isTutor ? "/dashboard/jobs" : "/tutors"}>
              <Search /> {isTutor ? "Search jobs" : "Search tutors"}
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bookmark />}
            title="No saved searches yet"
            description={isTutor ? "Run a job search with the filters you care about, then choose “Save search” to get alerts." : "Search for tutors with the filters you care about, then choose “Save search” to come back to it and get alerts."}
            action={
              <Button asChild>
                <Link href={isTutor ? "/dashboard/jobs" : "/tutors"}>{isTutor ? "Browse jobs" : "Browse tutors"}</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map(({ search: s, chips, count, noun, href }, i) => (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 6) * 0.05 } }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
              >
                <Card className="flex h-full flex-col">
                  <div className="flex items-start gap-3 p-5 pb-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-ink-2" aria-hidden>
                      {s.kind === "tutors" ? <Search className="size-4" /> : <Briefcase className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="min-w-0 text-[15px] font-semibold tracking-tight text-ink">{s.label}</h2>
                        <Badge size="sm" tone="outline">
                          {s.kind === "tutors" ? "Tutor search" : "Job alert"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-muted">Saved {formatDate(s.createdAt, tz)}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${s.label}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setRenaming(s)}>
                          <Pencil /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem tone="danger" onSelect={() => setDeleting(s)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="px-5">
                    {chips.length ? (
                      <ul className="flex flex-wrap gap-1.5" aria-label="Search filters">
                        {chips.map((c) => (
                          <li key={c}>
                            <Badge size="sm">{c}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-muted">No filters — {s.kind === "tutors" ? "all tutors" : "all open jobs"}.</p>
                    )}
                  </div>

                  <div className="mb-5 mt-4 flex items-baseline gap-2 px-5">
                    <motion.span key={count} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[26px] font-semibold leading-none tabular-nums tracking-tight text-ink">
                      {count}
                    </motion.span>
                    <span className="text-[13px] text-muted">
                      {count === 1 ? `${noun} matches` : `${noun}s match`} right now
                    </span>
                  </div>

                  <div className="mt-auto flex flex-col gap-3 border-t border-line px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2.5 text-[13px] text-muted">
                      <BellRing className="size-4 text-subtle" aria-hidden />
                      <span className="shrink-0">Alerts</span>
                      <Select
                        aria-label={`Alert frequency for ${s.label}`}
                        value={s.frequency}
                        onChange={(e) => setFrequency(s, e.target.value as AlertFrequency)}
                        options={FREQUENCY_OPTIONS}
                        className="w-40 [&_select]:h-9 [&_select]:text-sm"
                      />
                    </label>
                    <Button asChild size="sm">
                      <Link href={href}>
                        Run search <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </Card>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <RenameDialog search={renaming} onClose={() => setRenaming(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this saved search?"
        description={`“${deleting?.label ?? ""}” and its alerts will be removed.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

const renameSchema = z.object({ label: z.string().trim().min(2, "Use at least 2 characters").max(80, "Keep it under 80 characters") });

function RenameDialog({ search, onClose }: { search: SavedSearch | null; onClose: () => void }) {
  return (
    <Dialog open={!!search} onOpenChange={(o) => !o && onClose()}>
      {search && (
        <DialogContent size="sm" title="Rename saved search">
          <RenameForm key={search.id} search={search} onDone={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function RenameForm({ search, onDone }: { search: SavedSearch; onDone: () => void }) {
  const updateSavedSearch = useApp((s) => s.updateSavedSearch);
  const form = useForm({ resolver: zodResolver(renameSchema), mode: "onTouched", defaultValues: { label: search.label } });
  const onSubmit = form.handleSubmit(({ label }) => {
    const res = updateSavedSearch(search.id, { label: label.trim() });
    if (!res.ok) return void toast.error(res.error);
    toast.success("Saved search renamed");
    onDone();
  });
  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody>
        <Field label="Name" error={form.formState.errors.label?.message}>
          <Input autoFocus maxLength={80} {...form.register("label")} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
