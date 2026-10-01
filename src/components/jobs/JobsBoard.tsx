"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BellPlus, Briefcase, Coins, Inbox, MapPin, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import type { AlertFrequency, ApplicationStatus, Level, Requirement, Role, TeachingMode } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useCreditBalance, useFlag, useHydrated, useNow, useSession, useTutor } from "@/lib/store/hooks";
import { LEVELS, LEVEL_LABEL, SUBJECT_BY_SLUG, gradeToLevel, subjectName } from "@/lib/data/catalog";
import { isValidZip, resolveLocation } from "@/lib/data/geo";
import { scoreTutor } from "@/lib/matching";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Controls";
import { Sheet, SheetContent, Popover, PopoverContent, PopoverTrigger, PopoverClose } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { AnimatePresence, motion, EASE } from "@/components/motion";
import { SubjectSelect } from "@/components/requirements/SubjectSelect";
import { cn } from "@/lib/utils";
import { JobCard, JobCardSkeleton } from "./JobCard";
import { criteriaFromRequirement, jobDistance } from "./jobUtils";

/* ─── URL contract ──────────────────────────────────────────────────────────── */

type SortKey = "newest" | "budget" | "closest" | "match";
type PostedWithin = "1" | "3" | "7" | "30";

interface JobFilters {
  q?: string;
  subject?: string;
  level?: Level;
  mode?: TeachingMode;
  location?: string;
  radius: number;
  minBudget?: number; // dollars
  posted?: PostedWithin;
  sort: SortKey;
}

const RADIUS_CHOICES = [5, 10, 25, 50];
const DEFAULT_RADIUS = 25;
const BUDGET_CHOICES = [40, 60, 80, 100, 120];
const POSTED_OPTIONS: { value: PostedWithin; label: string }[] = [
  { value: "1", label: "Last 24 hours" },
  { value: "3", label: "Last 3 days" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

function parseFilters(p: URLSearchParams): JobFilters {
  const subject = p.get("subject") ?? undefined;
  const level = p.get("level") as Level | null;
  const mode = p.get("mode");
  const radius = Number(p.get("radius"));
  const minBudget = Number(p.get("minBudget"));
  const posted = p.get("posted") as PostedWithin | null;
  const sort = p.get("sort") as SortKey | null;
  return {
    q: p.get("q")?.trim() || undefined,
    subject: subject && SUBJECT_BY_SLUG[subject] ? subject : undefined,
    level: level && LEVELS.some((l) => l.value === level) ? level : undefined,
    mode: mode === "online" || mode === "in_person" ? mode : undefined,
    location: p.get("location")?.trim() || undefined,
    radius: RADIUS_CHOICES.includes(radius) ? radius : DEFAULT_RADIUS,
    minBudget: minBudget > 0 ? minBudget : undefined,
    posted: posted && POSTED_OPTIONS.some((o) => o.value === posted) ? posted : undefined,
    sort: sort && ["newest", "budget", "closest", "match"].includes(sort) ? sort : "newest",
  };
}

function activeCount(f: JobFilters): number {
  return [f.subject, f.level, f.mode, f.location, f.minBudget, f.posted].filter(Boolean).length;
}

function describeFilters(f: JobFilters): string {
  const parts: string[] = [];
  if (f.subject) parts.push(`${subjectName(f.subject)} jobs`);
  else if (f.q) parts.push(`“${f.q}” jobs`);
  else parts.push("All jobs");
  if (f.level) parts.push(LEVEL_LABEL[f.level]);
  if (f.mode) parts.push(f.mode === "online" ? "Online" : "In person");
  if (f.location) parts.push(`Within ${f.radius} mi of ${f.location}`);
  if (f.minBudget) parts.push(`$${f.minBudget}+/hr`);
  return parts.join(" · ");
}

/* ─── View ──────────────────────────────────────────────────────────────────── */

interface Row {
  job: Requirement;
  ownerRole?: Role;
  applicants: number;
  distance: number | null;
  match: number | null;
  applied?: ApplicationStatus;
  saved: boolean;
  postedMs: number;
}

export function JobsBoard() {
  const hydrated = useHydrated();
  const me = useSession();
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const users = useApp((s) => s.users);
  const savedJobsMap = useApp((s) => s.savedJobs);
  const toggleSavedJob = useApp((s) => s.toggleSavedJob);
  const tutor = useTutor(me?.role === "tutor" ? me.tutorId : undefined);
  const now = useNow(60_000);

  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = React.useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const update = React.useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const point = React.useMemo(() => (filters.location ? resolveLocation(filters.location) : null), [filters.location]);

  const rows = React.useMemo<Row[]>(() => {
    const roleById = new Map(users.map((u) => [u.id, u.role]));
    const counts = new Map<string, number>();
    const mine = new Map<string, ApplicationStatus>();
    for (const a of applications) {
      if (a.status !== "withdrawn") counts.set(a.requirementId, (counts.get(a.requirementId) ?? 0) + 1);
      if (tutor && a.tutorId === tutor.id && a.status !== "withdrawn") mine.set(a.requirementId, a.status);
    }
    const saved = new Set(me ? savedJobsMap[me.id] ?? [] : []);
    return requirements
      .filter((r) => r.status === "published")
      .map((job) => ({
        job,
        ownerRole: roleById.get(job.ownerId),
        applicants: counts.get(job.id) ?? 0,
        distance: jobDistance(job, point),
        match: tutor ? scoreTutor(tutor, criteriaFromRequirement(job)).percent : null,
        applied: mine.get(job.id),
        saved: saved.has(job.id),
        postedMs: new Date(job.publishedAt ?? job.createdAt).getTime(),
      }));
  }, [requirements, applications, users, savedJobsMap, me, tutor, point]);

  const results = React.useMemo(() => {
    const q = filters.q?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
    const list = rows.filter((r) => {
      const j = r.job;
      if (q.length) {
        const hay = [j.title, j.objectives, j.details, j.preferences, subjectName(j.subject), j.city, j.state, ...(j.learningSupport ?? [])].join(" ").toLowerCase();
        if (!q.every((w) => hay.includes(w))) return false;
      }
      if (filters.subject && j.subject !== filters.subject) return false;
      if (filters.level && gradeToLevel(j.grade) !== filters.level) return false;
      if (filters.mode && !j.modes.includes(filters.mode)) return false;
      if (point) {
        // Online-capable jobs can be taught from anywhere unless the tutor asks for in-person only.
        const needsDistance = filters.mode === "in_person" || !j.modes.includes("online");
        if (needsDistance && (r.distance == null || r.distance > filters.radius)) return false;
      }
      if (filters.minBudget && j.budgetMaxCents < filters.minBudget * 100) return false;
      if (filters.posted && now - r.postedMs > Number(filters.posted) * 86_400_000) return false;
      return true;
    });
    const sort = filters.sort === "closest" && !point ? "newest" : filters.sort === "match" && !tutor ? "newest" : filters.sort;
    return list.sort((a, b) => {
      if (sort === "budget") return b.job.budgetMaxCents - a.job.budgetMaxCents || b.job.budgetMinCents - a.job.budgetMinCents || b.postedMs - a.postedMs;
      if (sort === "closest") return (a.distance ?? Infinity) - (b.distance ?? Infinity) || b.postedMs - a.postedMs;
      if (sort === "match") return (b.match ?? 0) - (a.match ?? 0) || b.postedMs - a.postedMs;
      return b.postedMs - a.postedMs;
    });
  }, [rows, filters, point, now, tutor]);

  const loginHref = `/login?next=${encodeURIComponent(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)}`;

  const onToggleSave = (job: Requirement) => {
    if (!me) {
      toast("Sign in to save jobs", { description: "Saving jobs is available to tutor accounts.", action: { label: "Sign in", onClick: () => router.push(loginHref) } });
      return;
    }
    if (me.role !== "tutor") {
      toast.error("Only tutor accounts can save jobs.", { description: "Want to teach? Create a tutor profile to save and apply to jobs." });
      return;
    }
    const r = toggleSavedJob(job.id);
    if (!r.ok) toast.error(r.error);
    else toast.success(r.data ? "Job saved" : "Removed from saved jobs", { description: job.title });
  };

  const count = activeCount(filters);
  const isTutor = me?.role === "tutor";
  const openTotal = rows.length;

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "budget", label: "Highest budget" },
    { value: "closest", label: point ? "Closest" : "Closest (add a location)", disabled: !point },
    ...(tutor ? [{ value: "match", label: "Best match for me" }] : []),
  ];

  return (
    <div className="container-page pb-24 pt-8 sm:pt-10">
      <div className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-10 xl:gap-12">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block" aria-label="Job filters">
          <div className="sticky top-24 space-y-5">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold tracking-[-0.02em] text-ink">Filters</h2>
                {count > 0 && (
                  <button type="button" onClick={() => update({ subject: undefined, level: undefined, mode: undefined, location: undefined, radius: undefined, minBudget: undefined, posted: undefined })} className="text-[13px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                    Clear all
                  </button>
                )}
              </div>
              <FiltersPanel filters={filters} update={update} idPrefix="d" />
            </div>
            {hydrated && <SideCard role={me?.role} tutorId={tutor?.id} />}
          </div>
        </aside>

        <div className="min-w-0">
          <Toolbar
            filters={filters}
            update={update}
            count={count}
            onOpenFilters={() => setSheetOpen(true)}
            sortOptions={sortOptions}
            canSave={isTutor}
          />

          {hydrated && (
            <div className="mb-5 lg:hidden">
              <SideCard role={me?.role} tutorId={tutor?.id} compact />
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted" aria-live="polite">
              {hydrated ? (
                <>
                  <span className="font-semibold tabular-nums text-ink">{results.length}</span> of {pluralize(openTotal, "open job")}
                  {tutor && <span className="hidden sm:inline"> · match scores use your profile</span>}
                </>
              ) : (
                <span className="skeleton inline-block h-4 w-32 align-middle" />
              )}
            </p>
            {count > 0 && <ActiveChips filters={filters} update={update} />}
          </div>

          {!hydrated ? (
            <div className="space-y-4" role="status" aria-label="Loading jobs">
              {Array.from({ length: 4 }).map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong">
              {openTotal === 0 ? (
                <EmptyState
                  icon={<Briefcase />}
                  title="No open jobs right now"
                  description={isTutor ? "New requirements appear here as families post them. Save a search to hear about the next one." : "When families post requirements, they appear here for tutors to apply."}
                  action={
                    me?.role === "student" || me?.role === "parent" ? (
                      <Button asChild><Link href="/post-requirement">Post a requirement</Link></Button>
                    ) : (
                      <Button asChild variant="secondary"><Link href="/tutors">Browse tutors</Link></Button>
                    )
                  }
                />
              ) : (
                <EmptyState
                  icon={<Search />}
                  title="No jobs match these filters"
                  description={
                    filters.location && filters.radius < 50
                      ? `Try widening the distance beyond ${filters.radius} miles, removing the budget minimum, or clearing filters.`
                      : "Try a different keyword, a broader grade level, or clear your filters to see every open job."
                  }
                  action={
                    <>
                      {filters.location && filters.radius < 50 && (
                        <Button variant="secondary" onClick={() => update({ radius: 50 })}>
                          Widen to 50 mi
                        </Button>
                      )}
                      <Button
                        onClick={() => update({ q: undefined, subject: undefined, level: undefined, mode: undefined, location: undefined, radius: undefined, minBudget: undefined, posted: undefined })}
                      >
                        Clear all filters
                      </Button>
                    </>
                  }
                />
              )}
            </div>
          ) : (
            <ul className="space-y-4">
              <AnimatePresence initial={false} mode="popLayout">
                {results.map((r, i) => (
                  <motion.li
                    key={r.job.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: Math.min(i * 0.04, 0.24) } }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                  >
                    <JobCard
                      job={r.job}
                      ownerRole={r.ownerRole}
                      applicants={r.applicants}
                      now={now}
                      applied={r.applied}
                      saved={r.saved}
                      onToggleSave={() => onToggleSave(r.job)}
                      match={r.match}
                      distance={filters.location ? r.distance : null}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          title="Filters"
          description={count ? `${pluralize(count, "filter")} applied` : "Narrow the list of open jobs"}
          footer={
            <div className="flex gap-2">
              {count > 0 && (
                <Button variant="secondary" className="flex-1" onClick={() => update({ subject: undefined, level: undefined, mode: undefined, location: undefined, radius: undefined, minBudget: undefined, posted: undefined })}>
                  Clear all
                </Button>
              )}
              <Button className="flex-[2]" onClick={() => setSheetOpen(false)}>
                Show {pluralize(results.length, "job")}
              </Button>
            </div>
          }
        >
          <div className="px-5 py-5">
            <FiltersPanel filters={filters} update={update} idPrefix="m" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Toolbar: keyword, sort, filters button, save search ──────────────────── */

function Toolbar({
  filters,
  update,
  count,
  onOpenFilters,
  sortOptions,
  canSave,
}: {
  filters: JobFilters;
  update: (patch: Record<string, string | number | undefined>) => void;
  count: number;
  onOpenFilters: () => void;
  sortOptions: { value: string; label: string; disabled?: boolean }[];
  canSave: boolean;
}) {
  const urlQ = filters.q ?? "";
  const [draft, setDraft] = React.useState(urlQ);
  const [synced, setSynced] = React.useState(urlQ);
  const [committed, setCommitted] = React.useState(urlQ);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Reflect external URL changes (clear all, back/forward) without clobbering what the user is typing.
  if (urlQ !== synced) {
    setSynced(urlQ);
    if (urlQ !== committed) {
      setDraft(urlQ);
      setCommitted(urlQ);
    }
  }
  React.useEffect(() => {
    const t = timer;
    return () => clearTimeout(t.current);
  }, []);

  const commit = (value: string) => {
    clearTimeout(timer.current);
    const v = value.trim();
    setCommitted(v);
    update({ q: v || undefined });
  };

  return (
    <div className="mb-5 space-y-3">
      <form
        role="search"
        aria-label="Search jobs"
        onSubmit={(e) => {
          e.preventDefault();
          commit(draft);
        }}
        className="flex gap-2"
      >
        <label htmlFor="jobs-q" className="sr-only">
          Search jobs by keyword
        </label>
        <Input
          id="jobs-q"
          type="search"
          icon={<Search />}
          value={draft}
          placeholder="Search by keyword — e.g. AP Calculus, dyslexia, SAT"
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => commit(v), 350);
          }}
          className="flex-1"
          suffix={
            draft ? (
              <button type="button" onClick={() => { setDraft(""); commit(""); }} className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            ) : undefined
          }
        />
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" className="lg:hidden" onClick={onOpenFilters} aria-label={count ? `Filters, ${count} applied` : "Filters"}>
          <SlidersHorizontal /> Filters
          {count > 0 && <span className="rounded-md bg-ink px-1.5 py-px text-[11px] font-bold tabular-nums text-on-ink">{count}</span>}
        </Button>
        <div className="flex items-center gap-2">
          <label htmlFor="jobs-sort" className="hidden text-sm text-muted sm:block">
            Sort by
          </label>
          <Select
            id="jobs-sort"
            aria-label="Sort jobs"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })}
            options={sortOptions}
            className="w-44 sm:w-52"
          />
        </div>
        {canSave && <SaveSearchButton filters={filters} />}
      </div>
    </div>
  );
}

/* ─── Filters panel (sidebar + mobile sheet) ───────────────────────────────── */

function FiltersPanel({ filters, update, idPrefix }: { filters: JobFilters; update: (patch: Record<string, string | number | undefined>) => void; idPrefix: string }) {
  const urlLoc = filters.location ?? "";
  const [loc, setLoc] = React.useState(urlLoc);
  const [syncedLoc, setSyncedLoc] = React.useState(urlLoc);
  const [locError, setLocError] = React.useState<string | null>(null);
  if (urlLoc !== syncedLoc) {
    setSyncedLoc(urlLoc);
    setLoc(urlLoc);
    setLocError(null);
  }
  const resolved = urlLoc ? resolveLocation(urlLoc) : null;

  const commitLoc = () => {
    const v = loc.trim();
    if (v === urlLoc) return;
    if (v && !resolveLocation(v)) {
      setLocError(isValidZip(v) ? "We can't place this ZIP yet. Try a nearby city." : "Enter a 5-digit ZIP or a city like “Austin, TX”.");
      return;
    }
    setLocError(null);
    const patch: Record<string, string | undefined> = { location: v || undefined };
    if (!v) {
      patch.radius = undefined;
      if (filters.sort === "closest") patch.sort = undefined;
    }
    update(patch);
  };

  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <div className="space-y-5">
      <Field label="Subject" id={id("subject")}>
        <SubjectSelect id={id("subject")} value={filters.subject ?? ""} onChange={(v) => update({ subject: v || undefined })} placeholder="All subjects" />
      </Field>
      <Field label="Grade level" id={id("level")}>
        <Select id={id("level")} value={filters.level ?? ""} onChange={(e) => update({ level: e.target.value || undefined })} placeholder="All levels" options={LEVELS.map((l) => ({ value: l.value, label: l.label }))} />
      </Field>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink" aria-hidden>
          Format
        </p>
        <Segmented
          label="Lesson format"
          size="sm"
          value={filters.mode ?? "any"}
          onChange={(v) => update({ mode: v === "any" ? undefined : v })}
          options={[
            { value: "any", label: "Any" },
            { value: "online", label: "Online" },
            { value: "in_person", label: "In person" },
          ]}
          className="flex w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:whitespace-nowrap [&>button]:px-2"
        />
      </div>
      <Field
        label="Location"
        id={id("loc")}
        error={locError ?? undefined}
        hint={resolved ? `Near ${resolved.label}` : "ZIP code or city. Applied when you press Enter or leave the field."}
      >
        <Input
          id={id("loc")}
          icon={<MapPin />}
          value={loc}
          placeholder="e.g. 10001 or Austin, TX"
          autoComplete="postal-code"
          onChange={(e) => {
            setLoc(e.target.value);
            setLocError(null);
          }}
          onBlur={commitLoc}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitLoc();
            }
          }}
        />
      </Field>
      <Field label="Distance" id={id("radius")} hint={filters.location ? "Online jobs are included from anywhere. Choose “In person” to see only local jobs." : "Add a location to filter by distance."}>
        <Select
          id={id("radius")}
          value={String(filters.radius)}
          disabled={!filters.location}
          onChange={(e) => update({ radius: Number(e.target.value) === DEFAULT_RADIUS ? undefined : e.target.value })}
          options={RADIUS_CHOICES.map((r) => ({ value: String(r), label: `Within ${r} miles` }))}
        />
      </Field>
      <Field label="Minimum budget" id={id("budget")} hint="Jobs whose budget reaches at least this hourly rate.">
        <Select
          id={id("budget")}
          value={filters.minBudget ? String(filters.minBudget) : ""}
          onChange={(e) => update({ minBudget: e.target.value || undefined })}
          placeholder="Any budget"
          options={BUDGET_CHOICES.map((b) => ({ value: String(b), label: `$${b}+/hr` }))}
        />
      </Field>
      <Field label="Posted" id={id("posted")}>
        <Select id={id("posted")} value={filters.posted ?? ""} onChange={(e) => update({ posted: e.target.value || undefined })} placeholder="Any time" options={POSTED_OPTIONS} />
      </Field>
    </div>
  );
}

function ActiveChips({ filters, update }: { filters: JobFilters; update: (patch: Record<string, string | number | undefined>) => void }) {
  const chips: { key: string; label: string; clear: Record<string, undefined> }[] = [];
  if (filters.subject) chips.push({ key: "subject", label: subjectName(filters.subject), clear: { subject: undefined } });
  if (filters.level) chips.push({ key: "level", label: LEVEL_LABEL[filters.level], clear: { level: undefined } });
  if (filters.mode) chips.push({ key: "mode", label: filters.mode === "online" ? "Online" : "In person", clear: { mode: undefined } });
  if (filters.location) chips.push({ key: "location", label: `≤ ${filters.radius} mi of ${filters.location}`, clear: { location: undefined, radius: undefined } });
  if (filters.minBudget) chips.push({ key: "minBudget", label: `$${filters.minBudget}+/hr`, clear: { minBudget: undefined } });
  if (filters.posted) chips.push({ key: "posted", label: POSTED_OPTIONS.find((o) => o.value === filters.posted)!.label, clear: { posted: undefined } });
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Active filters">
      <AnimatePresence initial={false}>
        {chips.map((c) => (
          <motion.li key={c.key} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.18 }}>
            <button
              type="button"
              onClick={() => update(c.clear)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-ink bg-surface pl-2.5 pr-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-canvas"
              aria-label={`Remove filter: ${c.label}`}
            >
              {c.label}
              <X className="size-3.5 text-muted" aria-hidden />
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/* ─── Save this search (tutors) ────────────────────────────────────────────── */

function SaveSearchButton({ filters }: { filters: JobFilters }) {
  const saveSearch = useApp((s) => s.saveSearch);
  const router = useRouter();
  const suggested = describeFilters(filters);
  const [label, setLabel] = React.useState(suggested);
  const [syncedSuggested, setSyncedSuggested] = React.useState(suggested);
  if (suggested !== syncedSuggested) {
    setSyncedSuggested(suggested);
    setLabel(suggested);
  }
  const [frequency, setFrequency] = React.useState<AlertFrequency>(filters.subject ? "instant" : "daily");
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = () => {
    const name = label.trim();
    if (name.length < 3) {
      setError("Give this search a short name (3+ characters).");
      return;
    }
    const query: Record<string, string> = {};
    if (filters.q) query.q = filters.q;
    if (filters.subject) query.subject = filters.subject;
    if (filters.level) query.level = filters.level;
    if (filters.mode) query.mode = filters.mode;
    if (filters.location) {
      query.location = filters.location;
      query.radius = String(filters.radius);
    }
    if (filters.minBudget) query.minBudget = String(filters.minBudget);
    const r = saveSearch({ kind: "jobs", label: name, query, frequency });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setOpen(false);
    setError(null);
    toast.success("Search saved", {
      description: frequency === "off" ? "Find it any time under Saved searches." : `We'll alert you ${frequency === "instant" ? "as soon as" : frequency === "daily" ? "daily when" : "weekly when"} new jobs match.`,
      action: { label: "Manage", onClick: () => router.push("/dashboard/saved-searches") },
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="ml-auto">
          <BellPlus /> Save this search
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(calc(100vw-2rem),22rem)] p-4">
        <p className="text-[15px] font-semibold text-ink">Save this search</p>
        <p className="mt-0.5 text-[13px] text-muted">Get notified about new jobs that match.</p>
        <div className="mt-4 space-y-4">
          <Field label="Name" id="ss-label" error={error ?? undefined}>
            <Input id="ss-label" value={label} maxLength={80} onChange={(e) => { setLabel(e.target.value); setError(null); }} />
          </Field>
          <Field label="Alerts" id="ss-frequency" hint={filters.subject ? `Alerts fire when a new ${subjectName(filters.subject)} job is posted.` : "Tip: add a subject filter — job alerts match on subject."}>
            <Select
              id="ss-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
              options={[
                { value: "instant", label: "Instantly" },
                { value: "daily", label: "Daily digest" },
                { value: "weekly", label: "Weekly digest" },
                { value: "off", label: "No alerts" },
              ]}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <PopoverClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </PopoverClose>
          <Button size="sm" onClick={save}>Save search</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Side card: role-aware next step ──────────────────────────────────────── */

function SideCard({ role, tutorId, compact }: { role?: Role; tutorId?: string; compact?: boolean }) {
  const leadCredits = useFlag("lead_credits");
  const balance = useCreditBalance(tutorId);

  if (role === "tutor") {
    if (compact) return null;
    return (
      <div className="rounded-2xl bg-canvas p-5">
        <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
          <Inbox className="size-4 text-ink" aria-hidden /> Your applications
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Track replies and status changes from families.</p>
        {leadCredits && tutorId && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
            <Coins className="size-3.5 text-muted" aria-hidden />
            <span>
              <span className="font-semibold tabular-nums text-ink">{balance}</span> lead {balance === 1 ? "credit" : "credits"} · 1 per application
            </span>
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <Button asChild size="sm" variant="secondary"><Link href="/dashboard/applications">My applications</Link></Button>
          {leadCredits && <Link href="/dashboard/credits" className="text-center text-[13px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">Buy lead credits</Link>}
        </div>
      </div>
    );
  }

  const family = role === "student" || role === "parent";
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-brand-soft p-5", compact && "flex items-center gap-4 p-4")}>
      <div className="relative min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
          <Sparkles className="size-4 text-ink" aria-hidden /> Are you a tutor?
        </p>
        <p className={cn("text-[13px] leading-relaxed text-ink-2", compact ? "mt-0.5" : "mt-1.5")}>
          Create a profile to apply{family ? " — tutor accounts are separate from family accounts." : ". It's free to join."}
        </p>
        {!compact && (
          <div className="mt-4 flex flex-col gap-2">
            <Button asChild size="sm">
              <Link href="/become-a-tutor">Become a tutor <ArrowRight /></Link>
            </Button>
            {family ? (
              <Link href="/post-requirement" className="text-center text-[13px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">Looking for a tutor? Post a requirement</Link>
            ) : !role ? (
              <Link href="/login?next=/tutor-jobs" className="text-center text-[13px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">Already a tutor? Sign in</Link>
            ) : null}
          </div>
        )}
      </div>
      {compact && (
        <Button asChild size="sm" className="relative shrink-0">
          <Link href="/become-a-tutor">Become a tutor</Link>
        </Button>
      )}
    </div>
  );
}
