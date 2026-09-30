"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark, BookmarkCheck, Briefcase, CalendarDays, CircleCheck, CircleDashed, CircleMinus, Coins, MapPin, Monitor, Search, SlidersHorizontal, Users, Wallet, X,
} from "lucide-react";
import type { Level, Requirement, TeachingMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useCreditBalance, useFlag, useNow } from "@/lib/store/hooks";
import { scoreTutor, type MatchResult } from "@/lib/matching";
import { GRADE_LABEL, LEVELS, MODE_LABEL, SUBJECTS, gradeToLevel, subjectName } from "@/lib/data/catalog";
import { CREDITS_PER_APPLICATION } from "@/lib/data/platform";
import { formatCents, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Segmented, Switch } from "@/components/ui/Controls";
import { Dialog, DialogBody, DialogContent, DialogFooter, Popover, PopoverContent, PopoverTrigger, Sheet, SheetContent } from "@/components/ui/Overlay";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchRing, NeedsTutorProfile } from "./shared";
import { useMyTutor } from "./hooks";
import { APPLICATION_STATUS_META, budgetLabel, requirementCriteria, scheduleLabel } from "./jobs-shared";

type Tab = "all" | "saved" | "applied";
type Sort = "match" | "newest" | "budget";

interface Row {
  req: Requirement;
  match: MatchResult;
  saved: boolean;
  applicationStatus?: string;
  applicants: number;
}

export function JobsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading jobs">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-12 w-full rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function JobsView() {
  const { me, tutor } = useMyTutor();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow(60_000);
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const savedJobs = useApp((s) => s.savedJobs);
  const toggleSavedJob = useApp((s) => s.toggleSavedJob);
  const credits = useCreditBalance(tutor?.id);
  const creditsOn = useFlag("lead_credits");

  const urlQ = params.get("q") ?? "";
  const [q, setQ] = React.useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = React.useState(urlQ);
  if (prevUrlQ !== urlQ) {
    setPrevUrlQ(urlQ);
    setQ(urlQ);
  }
  const [tab, setTab] = React.useState<Tab>("all");
  const [mine, setMine] = React.useState(true);
  const [subject, setSubject] = React.useState("");
  const [mode, setMode] = React.useState<"any" | TeachingMode>("any");
  const [level, setLevel] = React.useState<"" | Level>("");
  const [sort, setSort] = React.useState<Sort>("match");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [applyTo, setApplyTo] = React.useState<Requirement | null>(null);

  // Keep ?q= in sync with the keyword box (debounced).
  React.useEffect(() => {
    if (q === urlQ) return;
    const t = setTimeout(() => router.replace(q.trim() ? `${pathname}?q=${encodeURIComponent(q.trim())}` : pathname, { scroll: false }), 350);
    return () => clearTimeout(t);
  }, [q, urlQ, pathname, router]);

  const saved = React.useMemo(() => new Set(me ? savedJobs[me.id] ?? [] : []), [savedJobs, me]);
  const rows: Row[] = React.useMemo(() => {
    if (!tutor) return [];
    return requirements
      .filter((r) => r.status === "published")
      .map((req) => {
        const apps = applications.filter((a) => a.requirementId === req.id);
        const mineApp = apps.find((a) => a.tutorId === tutor.id && a.status !== "withdrawn");
        return {
          req,
          match: scoreTutor(tutor, requirementCriteria(req)),
          saved: saved.has(req.id),
          applicationStatus: mineApp?.status,
          applicants: apps.filter((a) => a.status !== "withdrawn").length,
        };
      });
  }, [requirements, applications, tutor, saved]);

  /** Rows matching every filter except the tab, so tab counts reflect the current filters. */
  const matching = React.useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows
      .filter((r) => (subject ? r.req.subject === subject : mine && tutor ? tutor.subjects.includes(r.req.subject) : true))
      .filter((r) => (mode === "any" ? true : r.req.modes.includes(mode)))
      .filter((r) => (level ? gradeToLevel(r.req.grade) === level : true))
      .filter((r) => {
        if (!kw) return true;
        const hay = [r.req.title, r.req.objectives, r.req.details, subjectName(r.req.subject), r.req.city, r.req.state].join(" ").toLowerCase();
        return kw.split(/\s+/).every((w) => hay.includes(w));
      });
  }, [rows, subject, mine, tutor, mode, level, q]);

  const filtered = React.useMemo(
    () =>
      matching
        .filter((r) => (tab === "saved" ? r.saved : tab === "applied" ? !!r.applicationStatus : true))
        .sort((a, b) =>
        sort === "newest"
          ? (b.req.publishedAt ?? b.req.createdAt).localeCompare(a.req.publishedAt ?? a.req.createdAt)
          : sort === "budget"
            ? b.req.budgetMaxCents - a.req.budgetMaxCents
            : Number(a.match.disqualified) - Number(b.match.disqualified) || b.match.percent - a.match.percent,
        ),
    [matching, tab, sort],
  );

  if (!me || !tutor) return <NeedsTutorProfile what="the jobs board" />;

  const counts = { all: matching.length, saved: matching.filter((r) => r.saved).length, applied: matching.filter((r) => r.applicationStatus).length };
  const totals = { saved: rows.filter((r) => r.saved).length, applied: rows.filter((r) => r.applicationStatus).length };
  const activeFilters = [subject, mode !== "any", level, q.trim()].filter(Boolean).length + (mine && !subject ? 1 : 0);
  const clearFilters = () => {
    setSubject("");
    setMode("any");
    setLevel("");
    setMine(false);
    setQ("");
  };

  const onSave = (id: string) => {
    const res = toggleSavedJob(id);
    if (!res.ok) toast.error(res.error);
    else toast.success(res.data ? "Job saved" : "Removed from saved jobs");
  };

  const subjectOptions = (mine ? SUBJECTS.filter((s) => tutor.subjects.includes(s.slug)) : SUBJECTS).map((s) => ({ value: s.slug, label: s.name }));

  const filterControls = (prefix: string) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <div className="flex h-10 items-center gap-2.5 lg:order-last lg:ml-auto">
        <Switch
          id={`${prefix}-mine-only`}
          checked={mine}
          onCheckedChange={(v) => {
            setMine(v);
            if (v && subject && !tutor.subjects.includes(subject)) setSubject("");
          }}
        />
        <label htmlFor={`${prefix}-mine-only`} className="text-sm font-medium text-ink">
          Only my subjects
        </label>
      </div>
      <Field label="Subject" className="lg:w-52">
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} options={subjectOptions} placeholder={mine ? "All my subjects" : "All subjects"} />
      </Field>
      <Field label="Grade level" className="lg:w-48">
        <Select value={level} onChange={(e) => setLevel(e.target.value as Level | "")} options={LEVELS.map((l) => ({ value: l.value, label: l.label }))} placeholder="All levels" />
      </Field>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink" aria-hidden>
          Lesson format
        </p>
        <Segmented
          label="Lesson format"
          value={mode}
          onChange={setMode}
          options={[
            { value: "any", label: "Any" },
            { value: "online", label: "Online" },
            { value: "in_person", label: "In person" },
          ]}
        />
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Student jobs"
        description="Requests posted by families and students. Match scores use the same transparent factors families see."
        actions={
          creditsOn ? (
            <Link href="/dashboard/credits" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm transition-colors hover:border-ink">
              <Coins className="size-4 text-muted" aria-hidden />
              <span className="font-semibold tabular-nums text-ink">{credits}</span>
              <span className="text-muted">credits · {CREDITS_PER_APPLICATION} per application</span>
            </Link>
          ) : (
            <Badge tone="success">Applying is free right now</Badge>
          )
        }
      />

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            aria-label="Search jobs by keyword"
            icon={<Search />}
            placeholder="Search by keyword, e.g. AP, SAT, Austin"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1"
            suffix={
              q ? (
                <button type="button" onClick={() => setQ("")} className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" aria-label="Clear search">
                  <X className="size-4" />
                </button>
              ) : undefined
            }
          />
          <Button variant="secondary" className="lg:hidden" onClick={() => setFiltersOpen(true)} aria-label={`Filters${activeFilters ? `, ${activeFilters} active` : ""}`}>
            <SlidersHorizontal /> Filters
            {activeFilters > 0 && <span className="rounded-md bg-ink px-1.5 text-[11px] font-semibold tabular-nums text-on-ink">{activeFilters}</span>}
          </Button>
          <Select
            aria-label="Sort jobs"
            className="hidden w-44 sm:block"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            options={[
              { value: "match", label: "Best match" },
              { value: "newest", label: "Newest" },
              { value: "budget", label: "Highest budget" },
            ]}
          />
        </div>

        <div data-spotlight className="hidden rounded-xl border border-line bg-surface p-4 lg:block">{filterControls("desktop")}</div>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent
            side="bottom"
            title="Filter jobs"
            footer={
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={clearFilters}>
                  Clear all
                </Button>
                <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                  Show {filtered.length} {filtered.length === 1 ? "job" : "jobs"}
                </Button>
              </div>
            }
          >
            <div className="space-y-5 px-5 py-5">
              {filterControls("sheet")}
              <Field label="Sort by" className="sm:hidden">
                <Select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  options={[
                    { value: "match", label: "Best match" },
                    { value: "newest", label: "Newest" },
                    { value: "budget", label: "Highest budget" },
                  ]}
                />
              </Field>
            </div>
          </SheetContent>
        </Sheet>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList aria-label="Job lists">
            <TabsTrigger value="all" count={counts.all}>
              All jobs
            </TabsTrigger>
            <TabsTrigger value="saved" count={counts.saved}>
              Saved
            </TabsTrigger>
            <TabsTrigger value="applied" count={counts.applied}>
              Applied
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between gap-3 text-[13px] text-muted" aria-live="polite">
          <span>
            {filtered.length} {filtered.length === 1 ? "job" : "jobs"}
            {activeFilters > 0 && " match your filters"}
          </span>
          {activeFilters > 0 && (
            <button type="button" onClick={clearFilters} className="font-medium text-ink hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div data-spotlight className="rounded-xl border border-line bg-surface">
            {tab === "saved" && totals.saved === 0 ? (
              <EmptyState icon={<Bookmark />} title="No saved jobs" description="Save jobs you want to come back to. They stay here until the family closes the request." action={<Button variant="secondary" onClick={() => setTab("all")}>Browse all jobs</Button>} />
            ) : tab === "applied" && totals.applied === 0 ? (
              <EmptyState icon={<Briefcase />} title="You haven't applied yet" description="When you apply to a job, it shows here with its current status." action={<Button variant="secondary" onClick={() => setTab("all")}>Browse all jobs</Button>} />
            ) : (
              <EmptyState icon={<Search />} title="No jobs match these filters" description="Try another subject, turn off “Only my subjects”, or clear your keyword." action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((r) => (
                <motion.li key={r.req.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <JobCard row={r} now={now} onSave={() => onSave(r.req.id)} onApply={() => setApplyTo(r.req)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <ApplyDialog req={applyTo} onClose={() => setApplyTo(null)} defaultRate={Math.round(tutor.hourlyRateCents / 100)} credits={credits} creditsOn={creditsOn} />
    </div>
  );
}

const FACTOR_ICON = { match: CircleCheck, partial: CircleMinus, miss: CircleDashed, neutral: CircleDashed } as const;

function JobCard({ row, now, onSave, onApply }: { row: Row; now: number; onSave: () => void; onApply: () => void }) {
  const { req, match } = row;
  const status = row.applicationStatus as keyof typeof APPLICATION_STATUS_META | undefined;
  const active = match.factors.filter((f) => f.status !== "neutral");
  return (
    <article data-spotlight className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-ink sm:p-5" aria-labelledby={`job-${req.id}`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent" size="sm">
              {subjectName(req.subject)}
            </Badge>
            <Badge tone="neutral" size="sm">
              {GRADE_LABEL[req.grade]}
            </Badge>
            <span className="text-[12.5px] text-muted">Posted {formatRelative(req.publishedAt ?? req.createdAt, now)}</span>
          </div>
          <h2 id={`job-${req.id}`} className="mt-2 text-[15.5px] font-semibold leading-snug tracking-tight text-ink">
            <Link href={`/tutor-jobs/${req.id}`} className="hover:text-ink">
              {req.title}
            </Link>
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-2">{req.objectives}</p>
        </div>
        <Popover>
          <PopoverTrigger className="shrink-0 rounded-full outline-offset-2" aria-label={`${match.percent}% match. Show how this score is calculated`}>
            <MatchRing percent={match.percent} size={52} />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <p className="text-sm font-semibold text-ink">Why {match.percent}%?</p>
            <p className="mt-0.5 text-[12.5px] text-muted">Weighted factors from this request compared with your profile.</p>
            <ul className="mt-3 space-y-2">
              {active.map((f) => {
                const Icon = FACTOR_ICON[f.status];
                return (
                  <li key={f.key} className="flex gap-2 text-[13px]">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", f.status === "match" ? "text-success" : f.status === "partial" ? "text-warning" : "text-muted")} aria-hidden />
                    <span>
                      <span className="font-medium text-ink">{f.label}</span>
                      <span className="text-muted"> · {f.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      <dl className="mt-3.5 grid gap-x-5 gap-y-1.5 text-[13px] text-muted sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Format</dt>
          <Monitor className="size-3.5 shrink-0 text-subtle" aria-hidden />
          <dd className="truncate">{req.modes.map((m) => MODE_LABEL[m]).join(" or ")}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Location</dt>
          <MapPin className="size-3.5 shrink-0 text-subtle" aria-hidden />
          <dd className="truncate">
            {req.city}, {req.state}
            {match.distanceMiles != null && match.distanceMiles <= 100 && req.modes.includes("in_person") ? ` · ~${Math.max(1, Math.round(match.distanceMiles))} mi away` : ""}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Budget</dt>
          <Wallet className="size-3.5 shrink-0 text-subtle" aria-hidden />
          <dd className="truncate tabular-nums">{budgetLabel(req)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Schedule</dt>
          <CalendarDays className="size-3.5 shrink-0 text-subtle" aria-hidden />
          <dd className="truncate">{scheduleLabel(req)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3.5 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2 text-[12.5px] text-muted">
          {status ? (
            <Badge tone={APPLICATION_STATUS_META[status].tone} size="sm" dot>
              You applied · {APPLICATION_STATUS_META[status].label}
            </Badge>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> {row.applicants === 0 ? "Be the first to apply" : `${row.applicants} ${row.applicants === 1 ? "tutor has" : "tutors have"} applied`}
          </span>
          {req.minExperienceYears ? <span>· {req.minExperienceYears}+ years preferred</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onSave} aria-pressed={row.saved} aria-label={row.saved ? `Remove “${req.title}” from saved jobs` : `Save “${req.title}”`}>
            {row.saved ? <BookmarkCheck className="text-ink" /> : <Bookmark />}
          </Button>
          <Button asChild variant="secondary" size="sm" className="flex-1 sm:flex-none">
            <Link href={`/tutor-jobs/${req.id}`}>View details</Link>
          </Button>
          {status ? (
            <Button asChild variant="subtle" size="sm" className="flex-1 sm:flex-none">
              <Link href="/dashboard/applications">View application</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={onApply} className="flex-1 sm:flex-none">
              Apply
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

const applySchema = z.object({
  message: z.string().trim().min(40, "Write at least 40 characters so the family knows why you're a good fit.").max(1500, "Keep your message under 1,500 characters."),
  rate: z.number({ invalid_type_error: "Enter your proposed hourly rate." }).int("Use whole dollars.").min(10, "Enter a rate of at least $10.").max(500, "Enter a rate up to $500."),
});
type ApplyValues = z.infer<typeof applySchema>;

function ApplyDialog({ req, onClose, defaultRate, credits, creditsOn }: { req: Requirement | null; onClose: () => void; defaultRate: number; credits: number; creditsOn: boolean }) {
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      {req && (
        <DialogContent title="Apply to this job" description={req.title} size="lg">
          <ApplyForm key={req.id} req={req} onClose={onClose} defaultRate={defaultRate} credits={credits} creditsOn={creditsOn} />
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Mounted fresh for each job, so the form always starts clean. */
function ApplyForm({ req, onClose, defaultRate, credits, creditsOn }: { req: Requirement; onClose: () => void; defaultRate: number; credits: number; creditsOn: boolean }) {
  const applyToJob = useApp((s) => s.applyToJob);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<ApplyValues>({ resolver: zodResolver(applySchema), defaultValues: { message: "", rate: defaultRate }, mode: "onTouched" });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  const outOfCredits = creditsOn && credits < CREDITS_PER_APPLICATION;

  const onSubmit = (v: ApplyValues) => {
    const res = applyToJob(req.id, v.message, v.rate * 100);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Application sent", { description: creditsOn ? `${CREDITS_PER_APPLICATION} credit used · ${credits - CREDITS_PER_APPLICATION} left` : "The family will see it on their request." });
    onClose();
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-5">
        <div className="grid gap-3 rounded-lg border border-line bg-canvas p-3.5 text-[13px] sm:grid-cols-3">
          <div>
            <p className="text-muted">Subject</p>
            <p className="font-medium text-ink">
              {subjectName(req.subject)} · {GRADE_LABEL[req.grade]}
            </p>
          </div>
          <div>
            <p className="text-muted">Family&apos;s budget</p>
            <p className="font-medium tabular-nums text-ink">{budgetLabel(req)}</p>
          </div>
          <div>
            <p className="text-muted">Location</p>
            <p className="font-medium text-ink">
              {req.city}, {req.state}
            </p>
          </div>
        </div>
        {outOfCredits && (
          <InlineAlert
            tone="warning"
            title="You're out of lead credits"
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/credits">Buy credits</Link>
              </Button>
            }
          >
            Each application uses {CREDITS_PER_APPLICATION} credit. Buy a pack or upgrade your plan for more monthly credits.
          </InlineAlert>
        )}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <Field label="Message to the family" required hint="Explain how you'd approach their goals. Contact details are hidden automatically until you're booked." error={errors.message?.message}>
          <Textarea rows={6} maxLength={1500} showCount placeholder="Hi — I'd start with a short diagnostic to see where things stand…" {...register("message")} />
        </Field>
        <Field label="Your proposed rate" required hint={`Your profile rate is ${formatCents(defaultRate * 100)}/hr.`} error={errors.rate?.message} className="max-w-56">
          <Input type="number" inputMode="numeric" prefixText="$" suffix={<span className="pr-1 text-sm">/hr</span>} {...register("rate", { valueAsNumber: true })} />
        </Field>
      </DialogBody>
      <DialogFooter className="sm:items-center">
        <p className="mr-auto flex items-center gap-1.5 text-[13px] text-muted">
          <Coins className="size-4" aria-hidden />
          {creditsOn ? (
            <>
              Costs {CREDITS_PER_APPLICATION} credit · <span className="tabular-nums">{credits}</span> available
            </>
          ) : (
            "Applying is free right now"
          )}
        </p>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={outOfCredits}>
          Send application
        </Button>
      </DialogFooter>
    </form>
  );
}
