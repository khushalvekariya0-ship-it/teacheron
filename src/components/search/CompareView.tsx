"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, CircleDashed, Clock3, GitCompareArrows, Link2, Plus, Search, X } from "lucide-react";
import type { Tutor, VerificationKind } from "@/lib/types";
import { LEVELS, subjectName } from "@/lib/data/catalog";
import { formatCents, formatDateTime } from "@/lib/format";
import { useApp } from "@/lib/store";
import { useHydrated, useNow, useTutors, useViewerTimezone } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StarRating } from "@/components/ui/StarRating";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { VERIFICATION_LABEL } from "@/components/domain/Badges";
import { useTutorActions } from "@/components/domain/useTutorActions";
import { useNextOpening } from "@/components/tutor-profile/useOpening";
import { weeklyGrid } from "@/components/tutor-profile/availability";
import { modeSummary } from "@/components/tutor-profile/ProfileHeader";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const KINDS: VerificationKind[] = ["identity", "education", "certification", "background"];

/** Factual, per-attribute highlights only when one tutor is strictly ahead. Never an overall winner. */
function highlights(tutors: Tutor[]): Record<string, string[]> {
  const out: Record<string, string[]> = Object.fromEntries(tutors.map((t) => [t.id, []]));
  if (tutors.length < 2) return out;
  const unique = (pick: (t: Tutor) => number, dir: "min" | "max", label: string) => {
    const vals = tutors.map(pick);
    const best = dir === "min" ? Math.min(...vals) : Math.max(...vals);
    const winners = tutors.filter((t) => pick(t) === best);
    if (winners.length === 1) out[winners[0].id].push(label);
  };
  unique((t) => t.hourlyRateCents, "min", "Lowest hourly rate");
  unique((t) => t.experienceYears, "max", "Most experience");
  unique((t) => t.lessonsCompleted, "max", "Most lessons completed");
  return out;
}

/* ─── Cells ─────────────────────────────────────────────────────────────────── */

function HeaderCard({ tutor, notes, onRemove }: { tutor: Tutor; notes: string[]; onRemove: () => void }) {
  const actions = useTutorActions(tutor);
  const name = `${tutor.firstName} ${tutor.lastName}`;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <Avatar name={name} tone={tutor.tone} size="lg" verified={tutor.verification.identity === "verified"} />
        <button type="button" onClick={onRemove} className="-mr-1 -mt-1 grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label={`Remove ${name} from comparison`}>
          <X className="size-4" />
        </button>
      </div>
      <h2 className="mt-3 text-[15px] font-semibold leading-snug tracking-tight text-ink sm:text-base">
        <Link href={`/tutors/${tutor.slug}`} className="hover:text-navy">
          {name}
        </Link>
      </h2>
      <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-muted">{tutor.headline}</p>
      {notes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {notes.map((n) => (
            <Badge key={n} tone="accent" size="sm" className="whitespace-normal py-0.5 text-left leading-tight">
              {n}
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        {tutor.trial.enabled ? (
          <Button size="sm" onClick={actions.bookTrial} className="w-full">
            Book trial
          </Button>
        ) : (
          <Button size="sm" onClick={actions.book} className="w-full">
            Book lesson
          </Button>
        )}
        <Button asChild size="sm" variant="secondary" className="w-full">
          <Link href={`/tutors/${tutor.slug}`}>View profile</Link>
        </Button>
      </div>
    </div>
  );
}

function AvailabilityCell({ tutor }: { tutor: Tutor }) {
  const hydrated = useHydrated();
  const tz = useViewerTimezone();
  const now = useNow(5 * 60_000);
  const opening = useNextOpening(tutor);
  const days = React.useMemo(() => {
    if (!hydrated) return null;
    const grid = weeklyGrid(tutor, tz, now);
    return WEEK.filter((d) => Object.values(grid.cells[d]).some((m) => m > 0));
  }, [hydrated, tutor, tz, now]);
  if (!days) return <Skeleton className="h-10 w-full" />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" aria-label={days.length ? `Available ${days.map((d) => DAY_SHORT[d]).join(", ")}` : "No regular weekly hours"}>
        {WEEK.map((d) => (
          <span key={d} aria-hidden className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", days.includes(d) ? "bg-navy-50 text-navy" : "bg-sunken text-subtle line-through decoration-subtle/60")}>
            {DAY_SHORT[d].slice(0, 2)}
          </span>
        ))}
      </div>
      <p className="text-[13px] text-muted">
        {opening === undefined ? "…" : opening ? (
          <>
            Next: <span className="font-medium text-ink-2">{formatDateTime(opening.startUtc, tz)}</span>
          </>
        ) : (
          "No openings in 2 weeks"
        )}
      </p>
    </div>
  );
}

function VerificationCell({ tutor }: { tutor: Tutor }) {
  return (
    <ul className="space-y-1.5">
      {KINDS.map((k) => {
        const s = tutor.verification[k];
        const done = s === "verified";
        const inReview = s === "submitted" || s === "under_review";
        return (
          <li key={k} className={cn("flex items-start gap-1.5 text-[13px] leading-snug", done ? "text-ink-2" : "text-muted")}>
            {done ? <BadgeCheck className="mt-px size-3.5 shrink-0 text-navy" aria-hidden /> : inReview ? <Clock3 className="mt-px size-3.5 shrink-0 text-subtle" aria-hidden /> : <CircleDashed className="mt-px size-3.5 shrink-0 text-subtle" aria-hidden />}
            <span>
              {VERIFICATION_LABEL[k]}
              <span className="sr-only">:</span>
              <span className={cn("block text-[12px]", done ? "text-success" : "text-muted")}>{done ? "Verified" : inReview ? "Review in progress" : s === "expired" ? "No longer current" : "Not completed"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type RowDef = { key: string; label: string; render: (t: Tutor) => React.ReactNode };

const ROWS: RowDef[] = [
  {
    key: "subjects",
    label: "Subjects",
    render: (t) => (
      <div className="flex flex-wrap gap-1">
        {t.subjects.map((s) => (
          <Badge key={s} tone="neutral" size="sm" className="whitespace-normal py-0.5 leading-tight">
            {subjectName(s)}
          </Badge>
        ))}
      </div>
    ),
  },
  { key: "levels", label: "Grade levels", render: (t) => LEVELS.filter((l) => t.levels.includes(l.value)).map((l) => l.label).join(", ") },
  {
    key: "experience",
    label: "Experience",
    render: (t) => (
      <>
        <span className="font-medium text-ink">{t.experienceYears} years</span>
        {t.lessonsCompleted > 0 && <span className="block text-[13px] text-muted">{t.lessonsCompleted.toLocaleString("en-US")} lessons completed</span>}
      </>
    ),
  },
  {
    key: "education",
    label: "Education",
    render: (t) =>
      t.education.length ? (
        <ul className="space-y-2">
          {t.education.map((e) => (
            <li key={`${e.degree}-${e.institution}`} className="leading-snug">
              <span className="text-ink-2">
                {e.degree} {e.field}
              </span>
              <span className="block text-[12.5px] text-muted">
                {e.institution}, {e.year}
                {e.verified && t.verification.education === "verified" && <span className="ml-1 font-medium text-success">· Verified</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-muted">None listed</span>
      ),
  },
  {
    key: "certifications",
    label: "Certifications",
    render: (t) =>
      t.certifications.length ? (
        <ul className="space-y-2">
          {t.certifications.map((c) => (
            <li key={c.name} className="leading-snug">
              <span className="text-ink-2">{c.name}</span>
              <span className="block text-[12.5px] text-muted">
                {c.issuer}, {c.year}
                {c.verified && t.verification.certification === "verified" && <span className="ml-1 font-medium text-success">· Verified</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-muted">None listed</span>
      ),
  },
  { key: "rating", label: "Rating", render: (t) => <StarRating rating={t.rating} count={t.reviewCount} showStars={false} /> },
  { key: "reviews", label: "Reviews", render: (t) => (t.reviewCount ? `${t.reviewCount} from completed lessons` : <span className="text-muted">None yet</span>) },
  {
    key: "rate",
    label: "Hourly rate",
    render: (t) => (
      <span className="text-[15px] font-semibold tabular-nums text-ink">
        {formatCents(t.hourlyRateCents)}
        <span className="text-[13px] font-normal text-muted">/hr</span>
      </span>
    ),
  },
  {
    key: "trial",
    label: "Trial lesson",
    render: (t) => (t.trial.enabled ? `${t.trial.priceCents === 0 ? "Free" : formatCents(t.trial.priceCents)} · ${t.trial.durationMin} min` : <span className="text-muted">Not offered</span>),
  },
  { key: "availability", label: "Availability", render: (t) => <AvailabilityCell tutor={t} /> },
  {
    key: "mode",
    label: "Teaching mode",
    render: (t) => (
      <>
        {modeSummary(t)}
        <span className="block text-[12.5px] text-muted">{t.rules.requiresApproval ? "Tutor confirms each request" : "Instant booking"}</span>
      </>
    ),
  },
  {
    key: "location",
    label: "Location",
    render: (t) => (
      <>
        {t.city}, {t.state}
        <span className="block text-[12.5px] text-muted">{t.modes.includes("in_person") && t.serviceRadiusMiles > 0 ? `In person within ~${t.serviceRadiusMiles} mi` : "Online only"}</span>
      </>
    ),
  },
  { key: "languages", label: "Languages", render: (t) => t.languages.join(", ") },
  { key: "verification", label: "Verification", render: (t) => <VerificationCell tutor={t} /> },
];

/* ─── View ──────────────────────────────────────────────────────────────────── */

function CompareSkeletonInner() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading comparison">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-[200px_1fr_1fr_1fr]">
        <Skeleton className="hidden h-48 lg:block" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="hidden h-48 rounded-xl lg:block" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function CompareSkeleton() {
  return <CompareSkeletonInner />;
}

export function CompareView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const ids = useApp((s) => s.compare);
  const toggleCompare = useApp((s) => s.toggleCompare);
  const clearCompare = useApp((s) => s.clearCompare);
  const tutors = useTutors();

  const selected = React.useMemo(() => ids.map((id) => tutors.find((t) => t.id === id)).filter((t): t is Tutor => !!t), [ids, tutors]);
  const idsParam = searchParams.get("ids");
  const shared = React.useMemo(
    () =>
      Array.from(new Set((idsParam ?? "").split(",").map((x) => tutors.find((t) => t.id === x.trim() || t.slug === x.trim())?.id).filter((x): x is string => !!x))).slice(0, 3),
    [idsParam, tutors],
  );

  // A shared link fills an empty comparison automatically.
  React.useEffect(() => {
    if (!hydrated || !shared.length) return;
    if (useApp.getState().compare.length === 0) for (const id of shared) useApp.getState().toggleCompare(id);
  }, [hydrated, shared]);

  const sharedDiffers = hydrated && shared.length > 0 && ids.length > 0 && (shared.length !== ids.length || shared.some((id) => !ids.includes(id)));
  const notes = React.useMemo(() => highlights(selected), [selected]);
  const n = selected.length;

  const remove = (t: Tutor) => {
    const r = toggleCompare(t.id);
    if (!r.ok) return toast.error(r.error);
    toast(`Removed ${t.firstName} from comparison`, { action: { label: "Undo", onClick: () => toggleCompare(t.id) } });
  };

  const share = async () => {
    const url = `${window.location.origin}/compare?ids=${ids.join(",")}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Comparison link copied", { description: "Anyone with the link sees these tutors side by side." });
    } catch {
      toast.error("Couldn't copy the link", { description: url });
    }
  };

  if (!hydrated) return <CompareSkeletonInner />;

  const sharedBanner = sharedDiffers && (
    <InlineAlert
      className="mb-6"
      title="This link shares a different comparison"
      action={
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            onClick={() => {
              clearCompare();
              for (const id of shared) toggleCompare(id);
            }}
          >
            Show shared
          </Button>
          <Button size="sm" variant="ghost" onClick={() => router.replace("/compare", { scroll: false })}>
            Keep mine
          </Button>
        </div>
      }
    >
      You&rsquo;re currently comparing {selected.map((t) => t.firstName).join(", ")}.
    </InlineAlert>
  );

  if (n < 2) {
    return (
      <>
        {sharedBanner}
        <div className="rounded-2xl border border-dashed border-line-strong bg-canvas/50">
          <EmptyState
            icon={<GitCompareArrows />}
            title={n === 1 ? "Add one more tutor to compare" : "Pick tutors to compare"}
            description={
              n === 1
                ? `You've added ${selected[0].firstName} ${selected[0].lastName}. Choose “Compare” on another tutor's card to see them side by side.`
                : "Choose “Compare” on up to three tutor cards or profiles, then come back here to see them side by side."
            }
            action={
              <>
                <Button asChild>
                  <Link href="/tutors">
                    <Search /> Browse tutors
                  </Link>
                </Button>
                {n === 1 && (
                  <Button asChild variant="secondary">
                    <Link href={`/tutors/${selected[0].slug}`}>View {selected[0].firstName}&rsquo;s profile</Link>
                  </Button>
                )}
              </>
            }
          />
        </div>
      </>
    );
  }

  // Phones show only the chosen tutors; wider screens add an "Add a tutor" column while there is room.
  const cols = { "--n": n + (n < 3 ? 1 : 0), "--m": n } as React.CSSProperties;
  const rowGrid = "lg:grid-cols-[200px_repeat(var(--n),minmax(0,1fr))]";
  const valueGrid = "grid grid-cols-[repeat(var(--m),minmax(0,1fr))] lg:contents";

  return (
    <>
      {sharedBanner}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">Tutors are listed in the order you added them. We don&rsquo;t rank tutors in this view.</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {n < 3 && (
            <Button asChild variant="secondary" size="sm" className="lg:hidden">
              <Link href="/tutors">
                <Plus /> Add a tutor
              </Link>
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={share}>
            <Link2 /> Share link
          </Button>
          <Button variant="ghost" size="sm" onClick={clearCompare}>
            Clear all
          </Button>
        </div>
      </div>

      <div role="table" aria-label="Tutor comparison" style={cols} className="rounded-2xl border border-line bg-surface">
        {/* Sticky compact header keeps names in view while scrolling long rows. */}
        <div role="rowgroup" className="sticky top-16 z-20 rounded-t-2xl border-b border-line bg-surface">
          <div role="row" className={cn("grid", rowGrid)}>
            <div role="columnheader" className="hidden items-center px-5 text-[12px] font-medium uppercase tracking-[0.08em] text-muted lg:flex">
              Comparing {n}
            </div>
            <div role="none" className={valueGrid}>
              <AnimatePresence initial={false} mode="popLayout">
                {selected.map((t) => (
                  <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="columnheader" className="flex min-w-0 items-center gap-2 border-l border-line px-3 py-2.5 first:border-l-0 sm:px-4 lg:first:border-l">
                    <Avatar name={`${t.firstName} ${t.lastName}`} tone={t.tone} size="xs" className="hidden sm:inline-flex" />
                    <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
                      {t.firstName} {t.lastName.charAt(0)}.
                    </span>
                    <span className="ml-auto hidden shrink-0 text-[12.5px] tabular-nums text-muted sm:inline">{formatCents(t.hourlyRateCents)}/hr</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {n < 3 && <div role="columnheader" aria-label="Add a tutor" className="hidden border-l border-line lg:block" />}
            </div>
          </div>
        </div>

        <div role="rowgroup">
          <div role="row" className={cn("grid border-b border-line", rowGrid)}>
            <div role="rowheader" className="sr-only lg:not-sr-only lg:px-5 lg:py-5 lg:text-sm lg:font-medium lg:text-muted">
              Tutor
            </div>
            <div role="none" className={valueGrid}>
              {selected.map((t, i) => (
                <motion.div
                  key={t.id}
                  role="cell"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.07 }}
                  className="min-w-0 border-l border-line px-3 py-4 first:border-l-0 sm:px-5 sm:py-5 lg:first:border-l"
                >
                  <HeaderCard tutor={t} notes={notes[t.id] ?? []} onRemove={() => remove(t)} />
                </motion.div>
              ))}
              {n < 3 && (
                <div role="cell" className="hidden border-l border-line p-5 lg:block">
                  <Link
                    href="/tutors"
                    className="group flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-3 text-center text-[13px] font-medium text-muted transition-colors hover:border-navy/40 hover:text-navy"
                  >
                    <span className="grid size-9 place-items-center rounded-full border border-line bg-surface transition-colors group-hover:border-navy/30">
                      <Plus className="size-4" aria-hidden />
                    </span>
                    Add a tutor
                  </Link>
                </div>
              )}
            </div>
          </div>

          {ROWS.map((row, ri) => (
            <div key={row.key} role="row" className={cn("grid border-b border-line last:border-b-0", rowGrid, ri % 2 === 1 && "lg:bg-canvas/40")}>
              <div role="rowheader" className="px-3 pt-3.5 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted sm:px-5 lg:py-4 lg:text-sm lg:normal-case lg:tracking-normal">
                {row.label}
              </div>
              <div role="none" className={valueGrid}>
                {selected.map((t) => (
                  <div key={t.id} role="cell" className="min-w-0 break-words border-l border-line px-3 pb-3.5 pt-2 text-sm text-ink-2 first:border-l-0 sm:px-5 lg:py-4 lg:first:border-l">
                    {row.render(t)}
                  </div>
                ))}
                {n < 3 && <div role="cell" aria-hidden className="hidden border-l border-line lg:block" />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-[12.5px] text-muted">Ratings come only from reviews of completed lessons. A &ldquo;Verified&rdquo; mark means our team reviewed that item&rsquo;s documents.</p>
    </>
  );
}
