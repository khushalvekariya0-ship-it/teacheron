"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, Mic, MicOff, Plus, ShieldCheck, Star, Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useHydrated, useNow, useTutors, useViewerTimezone } from "@/lib/store/hooks";
import { SUBJECT_BY_SLUG } from "@/lib/data/catalog";
import { DEFAULT_POLICY } from "@/lib/data/platform";
import { formatCents, formatDate, formatTime, sessionPrice, tzAbbrev } from "@/lib/format";
import { generateSlots, groupSlotsByDay } from "@/lib/time";
import type { Tutor } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

/*
 * Steps 2–4 of the homepage "How it works", working for real like step 1 (QuickMatch):
 * compare real tutors side by side, pick a real opening and carry it into the booking panel,
 * and try the after-lesson record (a clearly labelled example).
 */

const MAX_COMPARE = 3;

/** The tutors picked in step 2 are shared with step 3 (and between the phone and desktop copies). */
const HowContext = React.createContext<{ picked: string[] | null; setPicked: React.Dispatch<React.SetStateAction<string[] | null>> } | null>(null);

export function HowStepsProvider({ children }: { children: React.ReactNode }) {
  const [picked, setPicked] = React.useState<string[] | null>(null);
  const value = React.useMemo(() => ({ picked, setPicked }), [picked]);
  return <HowContext value={value}>{children}</HowContext>;
}

/** Up to four tutors to try it with: verified and featured first, then by rating. Real data only. */
function usePool(): Tutor[] {
  const tutors = useTutors();
  return React.useMemo(
    () =>
      [...tutors]
        .sort(
          (a, b) =>
            Number(b.verification.identity === "verified") - Number(a.verification.identity === "verified") ||
            Number(b.featured) - Number(a.featured) ||
            (b.rating ?? 0) - (a.rating ?? 0) ||
            b.reviewCount - a.reviewCount ||
            a.lastName.localeCompare(b.lastName),
        )
        .slice(0, 4),
    [tutors],
  );
}

/** The picked tutors (the first two until the visitor chooses), limited to the pool. */
function usePicked(pool: Tutor[]) {
  const ctx = React.useContext(HowContext);
  const [local, setLocal] = React.useState<string[] | null>(null);
  const picked = ctx ? ctx.picked : local;
  const setPicked = ctx ? ctx.setPicked : setLocal;
  const ids = (picked ?? pool.slice(0, 2).map((t) => t.id)).filter((id) => pool.some((t) => t.id === id));
  const toggle = (id: string) =>
    setPicked(ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_COMPARE ? ids : [...ids, id]);
  return { ids, toggle };
}

function NoTutors() {
  return (
    <div className="grid h-full place-items-center border border-dashed border-line-strong bg-surface p-6 text-center">
      <div>
        <p className="text-[15px] font-semibold text-ink">Tutors are joining</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted">This step works with real tutor profiles. They appear here as soon as tutors are listed.</p>
        <Link href="/tutors" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand">
          Browse tutors <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function TutorChip({ tutor, on, disabled, onClick, label }: { tutor: Tutor; on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 border pl-1 pr-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        on ? "border-brand bg-brand-50 text-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      <Avatar name={`${tutor.firstName} ${tutor.lastName}`} src={tutor.photoUrl} tone={tutor.tone} size="xs" square />
      <span className="whitespace-nowrap">
        {tutor.firstName} {tutor.lastName.charAt(0)}.
      </span>
      {on ? <Check className="size-3.5 text-brand" strokeWidth={3} aria-hidden /> : <Plus className="size-3.5 opacity-60" aria-hidden />}
    </button>
  );
}

/* ─── Step 2 · Compare ───────────────────────────────────────────────────────── */

type Row = { label: string; value: (t: Tutor) => React.ReactNode; score?: (t: Tutor) => number };

const ROWS: Row[] = [
  { label: "Rate", value: (t) => `${formatCents(t.hourlyRateCents)}/hr`, score: (t) => -t.hourlyRateCents },
  {
    label: "Rating",
    value: (t) =>
      t.rating === null ? (
        <span className="text-muted">No reviews yet</span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <Star className="size-3 fill-current" aria-hidden /> {t.rating.toFixed(1)} <span className="font-normal text-muted">({t.reviewCount})</span>
        </span>
      ),
    score: (t) => (t.rating === null ? -1 : t.rating * 1000 + t.reviewCount),
  },
  { label: "Experience", value: (t) => `${t.experienceYears} ${t.experienceYears === 1 ? "yr" : "yrs"}`, score: (t) => t.experienceYears },
  { label: "Lessons taught", value: (t) => t.lessonsCompleted.toLocaleString("en-US"), score: (t) => t.lessonsCompleted },
  {
    label: "Replies in",
    value: (t) => (t.responseTimeHours === null ? <span className="text-muted">—</span> : t.responseTimeHours < 1 ? "< 1 hr" : `~${Math.round(t.responseTimeHours)} hr`),
    score: (t) => (t.responseTimeHours === null ? -Infinity : -t.responseTimeHours),
  },
  {
    label: "Trial",
    value: (t) => (!t.trial.enabled ? <span className="text-muted">None</span> : t.trial.priceCents === 0 ? `Free · ${t.trial.durationMin} min` : `${formatCents(t.trial.priceCents)} · ${t.trial.durationMin} min`),
  },
];

/** Ids holding the best value in a row — none when everyone ties. */
function bestIds(row: Row, tutors: Tutor[]): Set<string> {
  if (!row.score || tutors.length < 2) return new Set();
  const scores = tutors.map((t) => row.score!(t));
  const top = Math.max(...scores);
  if (scores.every((s) => s === top)) return new Set();
  return new Set(tutors.filter((_, i) => scores[i] === top).map((t) => t.id));
}

export function CompareStep() {
  const router = useRouter();
  const pool = usePool();
  const { ids, toggle } = usePicked(pool);
  const clearCompare = useApp((s) => s.clearCompare);
  const toggleCompare = useApp((s) => s.toggleCompare);
  const chosen = ids.map((id) => pool.find((t) => t.id === id)).filter((t): t is Tutor => !!t);

  if (pool.length === 0) return <NoTutors />;

  const openFull = () => {
    clearCompare();
    for (const id of ids) toggleCompare(id);
    router.push("/compare");
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[14px] font-semibold text-ink">Pick 2 or 3 tutors</p>
          <p className="text-[12.5px] tabular-nums text-muted" aria-live="polite">
            {ids.length} of {MAX_COMPARE} picked
          </p>
        </div>
        <div role="group" aria-label="Tutors to compare" className="mt-2.5 flex flex-wrap gap-2">
          {pool.map((t) => {
            const on = ids.includes(t.id);
            return (
              <TutorChip
                key={t.id}
                tutor={t}
                on={on}
                disabled={!on && ids.length >= MAX_COMPARE}
                onClick={() => toggle(t.id)}
                label={`${on ? "Remove" : "Add"} ${t.firstName} ${t.lastName} ${on ? "from" : "to"} the comparison`}
              />
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto border border-line bg-surface shadow-sm">
        {chosen.length < 2 ? (
          <p className="grid h-full min-h-40 place-items-center p-6 text-center text-[13.5px] text-muted">Pick at least two tutors to see them side by side.</p>
        ) : (
          <table className="w-full min-w-[300px] table-fixed text-[13px]">
            <caption className="sr-only">Picked tutors side by side</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-[28%] px-3 py-2.5 text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Compare
                </th>
                {chosen.map((t) => (
                  <th key={t.id} scope="col" className="px-2 py-2.5 text-left align-bottom">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">
                      {t.firstName} {t.lastName.charAt(0)}.
                    </span>
                    <span className="block truncate text-[11.5px] font-normal text-muted">{SUBJECT_BY_SLUG[t.subjects[0]]?.name ?? "Tutor"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const best = bestIds(row, chosen);
                return (
                  <tr key={row.label} className="border-b border-line last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal text-muted">
                      {row.label}
                    </th>
                    {chosen.map((t) => (
                      <td key={t.id} className={cn("px-2 py-2 tabular-nums", best.has(t.id) ? "font-semibold text-brand" : "text-ink")}>
                        {row.value(t)}
                        {best.has(t.id) && <span className="sr-only"> (best)</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted">Highlighted: the best value in each row</p>
        <button
          type="button"
          onClick={openFull}
          disabled={chosen.length < 2}
          className="inline-flex h-9 items-center gap-1.5 bg-brand-gradient px-3.5 text-[13.5px] font-semibold text-on-brand shadow-sm transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open full comparison <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ─── Step 3 · Book ──────────────────────────────────────────────────────────── */

export function BookStep() {
  const router = useRouter();
  const hydrated = useHydrated();
  const pool = usePool();
  const { ids } = usePicked(pool);
  const candidates = ids.length ? ids.map((id) => pool.find((t) => t.id === id)).filter((t): t is Tutor => !!t) : pool.slice(0, 1);
  const [tutorId, setTutorId] = React.useState<string | null>(null);
  const tutor = candidates.find((t) => t.id === tutorId) ?? candidates[0];

  const [kind, setKind] = React.useState<"trial" | "regular">("trial");
  const tz = useViewerTimezone();
  const bookings = useApp((s) => s.bookings);
  const now = useNow(60_000);
  const [pick, setPick] = React.useState<string | null>(null);

  const type = kind === "trial" && tutor?.trial.enabled ? "trial" : "regular";
  const regularMin = tutor?.rules.sessionLengths[0] ?? 60;
  const minutes = !tutor ? 0 : type === "trial" ? tutor.trial.durationMin : regularMin;

  // Real openings over the next ten days, in the visitor's time zone (same rules as the booking panel).
  // The React Compiler memoizes this, so no manual useMemo.
  const days = tutor && hydrated ? groupSlotsByDay(generateSlots(tutor, { durationMin: minutes, viewerTz: tz, bookings, now, days: 10, stepMin: 60 })).slice(0, 4) : [];

  if (pool.length === 0) return <NoTutors />;
  if (!tutor) return null;

  // A time that is no longer offered (another tutor or lesson type) is dropped.
  const picked = days.some((d) => d.slots.some((s) => s.startUtc === pick)) ? pick : null;
  const price = type === "trial" ? tutor.trial.priceCents : sessionPrice(tutor.hourlyRateCents, regularMin);

  const go = () => {
    if (!picked) return;
    router.push(`/tutors/${tutor.slug}?book=${type}&start=${encodeURIComponent(picked)}`);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {candidates.length > 1 ? (
          <div role="group" aria-label="Tutor to book" className="flex flex-wrap gap-2">
            {candidates.map((t) => (
              <TutorChip key={t.id} tutor={t} on={t.id === tutor.id} onClick={() => setTutorId(t.id)} label={`Book with ${t.firstName} ${t.lastName}`} />
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
            <Avatar name={`${tutor.firstName} ${tutor.lastName}`} src={tutor.photoUrl} tone={tutor.tone} size="sm" square />
            {tutor.firstName} {tutor.lastName.charAt(0)}.
            <span className="font-normal text-muted">· {SUBJECT_BY_SLUG[tutor.subjects[0]]?.name ?? "Tutor"}</span>
          </p>
        )}
        <div role="radiogroup" aria-label="Lesson type" className="inline-flex border border-line bg-surface p-0.5">
          {(["trial", "regular"] as const).map((k) => {
            const on = type === k;
            const off = k === "trial" && !tutor.trial.enabled;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={off}
                onClick={() => setKind(k)}
                className={cn("h-8 px-3 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40", on ? "bg-ink text-on-ink" : "text-ink-2 hover:text-ink")}
              >
                {k === "trial" ? "Trial" : "Lesson"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <CalendarDays className="size-4 text-brand" aria-hidden /> Pick a time
          </p>
          <span className="text-[11.5px] text-muted">{hydrated ? `Your time zone · ${tzAbbrev(tz)}` : "Your time zone"}</span>
        </div>
        {!hydrated ? (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="skeleton h-8" />
            ))}
          </div>
        ) : days.length === 0 ? (
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            No openings in the next ten days.{" "}
            <Link href={`/tutors/${tutor.slug}`} className="font-semibold text-brand">
              See the full calendar
            </Link>
          </p>
        ) : (
          <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {days.map((d) => (
              <div key={d.day} role="group" aria-label={formatDate(d.slots[0].startUtc, tz, { weekday: "long", month: "long", day: "numeric" })}>
                <p className="pb-1.5 text-[12px] font-medium text-muted">{formatDate(d.slots[0].startUtc, tz, { weekday: "short", month: "short", day: "numeric" })}</p>
                <div className="grid gap-1.5">
                  {d.slots.slice(0, 3).map((s) => {
                    const on = s.startUtc === picked;
                    return (
                      <button
                        key={s.startUtc}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPick(on ? null : s.startUtc)}
                        className={cn(
                          "h-8 border text-[12.5px] font-medium tabular-nums transition-colors",
                          on ? "border-transparent bg-brand-gradient text-on-brand shadow-sm" : "border-brand/25 bg-brand-50 text-ink hover:border-brand",
                        )}
                      >
                        {formatTime(s.startUtc, tz)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-[12.5px] leading-snug text-ink-2" aria-live="polite">
          {picked ? (
            <>
              <span className="font-semibold text-ink">
                {formatDate(picked, tz, { weekday: "short", month: "short", day: "numeric" })} · {formatTime(picked, tz)}
              </span>{" "}
              · {minutes} min · {price === 0 ? "Free" : formatCents(price)}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <ShieldCheck className="size-3.5" aria-hidden /> Free cancellation up to {DEFAULT_POLICY.freeCancellationHours} h before
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={go}
          disabled={!picked}
          className="inline-flex h-9 items-center gap-1.5 bg-brand-gradient px-3.5 text-[13.5px] font-semibold text-on-brand shadow-sm transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to book <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4 · Learn ─────────────────────────────────────────────────────────── */

const NOTES = ["Factoring works when you look for two numbers that multiply to c and add to b.", "Check each answer by expanding it back out.", "Slow down on negative signs — most mistakes were there."];
const HOMEWORK = ["Practice set 3, questions 1–10", "Re-do the two factoring examples", "Write one question for next lesson"];
type LearnTab = "notes" | "homework" | "goal";

export function LearnStep() {
  const [mic, setMic] = React.useState(true);
  const [cam, setCam] = React.useState(true);
  const [tab, setTab] = React.useState<LearnTab>("homework");
  const [done, setDone] = React.useState<boolean[]>([true, false, false]);
  const id = React.useId();
  const doneCount = done.filter(Boolean).length;
  const progress = 25 + Math.round((doneCount / HOMEWORK.length) * 75);
  const tabs: { key: LearnTab; label: string }[] = [
    { key: "notes", label: "Notes" },
    { key: "homework", label: `Homework ${doneCount}/${HOMEWORK.length}` },
    { key: "goal", label: "Goal" },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      {/* The lesson: tutor large, learner small, working mic and camera buttons */}
      <div className="relative h-[164px] shrink-0 overflow-hidden border border-line bg-canvas">
        <Image src="/images/tutor-at-laptop.jpg" alt="" fill sizes="(min-width: 1024px) 520px, 90vw" className="object-cover object-[40%_30%]" />
        <span className="absolute left-2.5 top-2.5 bg-night/75 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">Example lesson · secure link</span>
        <div className="absolute bottom-2.5 right-2.5 grid aspect-[4/3] w-[26%] place-items-center overflow-hidden border-2 border-surface bg-night shadow-lg">
          {cam ? (
            <Image src="/images/adult-learner-online.jpg" alt="" fill sizes="140px" className="object-cover object-[74%_30%]" />
          ) : (
            <VideoOff className="size-5 text-white/70" aria-hidden />
          )}
          {!mic && (
            <span className="absolute left-1 top-1 grid size-5 place-items-center bg-danger text-white">
              <MicOff className="size-3" aria-hidden />
            </span>
          )}
        </div>
        <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
          <button
            type="button"
            aria-pressed={!mic}
            onClick={() => setMic((v) => !v)}
            className={cn("grid size-9 place-items-center backdrop-blur transition-colors", mic ? "bg-night/70 text-white hover:bg-night/90" : "bg-danger text-white")}
            aria-label={mic ? "Mute microphone" : "Unmute microphone"}
          >
            {mic ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
          </button>
          <button
            type="button"
            aria-pressed={!cam}
            onClick={() => setCam((v) => !v)}
            className={cn("grid size-9 place-items-center backdrop-blur transition-colors", cam ? "bg-night/70 text-white hover:bg-night/90" : "bg-danger text-white")}
            aria-label={cam ? "Turn camera off" : "Turn camera on"}
          >
            {cam ? <Video className="size-4" aria-hidden /> : <VideoOff className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      {/* What's kept after it */}
      <div className="flex min-h-0 flex-1 flex-col border border-line bg-surface shadow-sm">
        <div role="tablist" aria-label="After the lesson" className="flex border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${id}-${t.key}-tab`}
              aria-selected={tab === t.key}
              aria-controls={`${id}-${t.key}`}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex-1 border-b-2 px-2 py-2.5 text-[12.5px] font-medium tabular-nums transition-colors",
                tab === t.key ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`${id}-${tab}`} aria-labelledby={`${id}-${tab}-tab`} className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "notes" && (
            <ul className="space-y-2 text-[13px] leading-snug text-ink-2">
              {NOTES.map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {n}
                </li>
              ))}
            </ul>
          )}
          {tab === "homework" && (
            <ul className="space-y-1.5">
              {HOMEWORK.map((h, i) => (
                <li key={h}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done[i]}
                    onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
                    className="flex w-full items-center gap-2.5 py-1 text-left text-[13px] text-ink"
                  >
                    <span className={cn("grid size-[18px] shrink-0 place-items-center border transition-colors", done[i] ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface")}>
                      {done[i] && <Check className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className={cn(done[i] && "text-muted line-through")}>{h}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {tab === "goal" && (
            <div>
              <p className="text-[13.5px] font-semibold text-ink">Ready for the unit test</p>
              <div className="mt-2.5 h-2 overflow-hidden bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Goal progress">
                <div className="h-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[12.5px] text-muted">
                {progress}% · {doneCount} of {HOMEWORK.length} homework tasks done. Tick them in the Homework tab.
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="-mt-1 text-[12px] text-muted">An example record. Yours is saved in your dashboard after every lesson.</p>
    </div>
  );
}
