"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Compass, Search, SearchX, ShieldCheck, SlidersHorizontal, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import { describeSearch, parseTutorSearch, searchTutors, toQueryString, type TutorSearch } from "@/lib/search";
import { useTutors } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { TutorCard } from "@/components/domain/TutorCard";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { FilterPanel, applyPatch } from "./FilterPanel";
import { SaveSearchButton } from "./SaveSearchButton";
import { SortControl } from "./SortControl";
import { FilterBar } from "./FilterBar";
import { SchedulePreview } from "./SchedulePreview";
import { SUBJECT_BY_SLUG } from "@/lib/data/catalog";
import { clearedSearch, filterCount } from "./filters";

const PAGE = 8;

export function ConciergeCallout({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-line bg-canvas p-5 sm:p-6", className)}>
      <div className="absolute inset-0 bg-dot-grid opacity-50 mask-radial" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-navy shadow-xs">
          <Compass className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">Not sure where to start?</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted">Describe what you need and get a shortlist, with the reasons each tutor fits.</p>
        </div>
        <Button asChild variant="secondary" size="sm" className="self-start sm:self-auto">
          <Link href="/concierge">
            Help me find a tutor <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

const TRUST_TAGS: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: "No paid placement" },
  { icon: Search, label: "Free to search" },
  { icon: Wallet, label: "Pay per lesson" },
];

const QUICK_SUBJECTS = ["algebra", "sat", "reading", "spanish", "chemistry", "python"];

const NEXT_STEPS = [
  { title: "Post what you need", body: "Subject, grade, schedule and budget — it only takes a couple of minutes." },
  { title: "Tutors apply to you", body: "Each application comes with a personal note. Contact details stay private." },
  { title: "Choose and book", body: "Compare profiles, send a message and book a first lesson when you're ready." },
];

/** Shown while no tutors are listed at all: a useful next step instead of an empty list. */
function NoTutorsYet() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-36px_rgb(15_23_42/0.35)]">
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="p-7 sm:p-10">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-gradient text-on-brand">
            <UserPlus className="size-6" aria-hidden />
          </span>
          <h3 className="mt-6 font-heading text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">Tutors are joining TutorLink</h3>
          <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-ink-2">
            New tutors are setting up their profiles and completing their checks. You don&rsquo;t have to wait &mdash; post what you need and tutors who teach it can apply to you.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="brand" size="lg">
              <Link href="/post-requirement">
                Post a requirement <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/concierge">
                <Compass /> Help me find a tutor
              </Link>
            </Button>
          </div>
          <p className="mt-8 border-t border-line pt-5 text-[14.5px] text-ink-2">
            Are you a tutor?{" "}
            <Link href="/become-a-tutor" className="font-semibold text-brand underline-offset-4 hover:underline">
              Create your profile &rarr;
            </Link>
          </p>
        </div>
        <div className="border-t border-line bg-canvas p-7 sm:p-10 lg:border-l lg:border-t-0">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">What happens next</p>
          <ol className="mt-6 space-y-6">
            {NEXT_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-[14px] font-bold text-on-brand">{i + 1}</span>
                <span>
                  <span className="block text-[16px] font-semibold text-ink">{step.title}</span>
                  <span className="mt-1 block text-[14.5px] leading-relaxed text-ink-2">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Shown when tutors exist but none match every filter. */
function NoMatches({
  inPerson,
  canClear,
  canSwitchOnline,
  onClear,
  onOnline,
}: {
  inPerson: boolean;
  canClear: boolean;
  canSwitchOnline: boolean;
  onClear: () => void;
  onOnline: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-7 text-center sm:p-12">
      <span className="mx-auto grid size-12 place-items-center rounded-xl border border-line text-brand">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h3 className="mt-5 font-heading text-[24px] font-bold tracking-[-0.02em] text-ink">No tutors match all of these filters</h3>
      <p className="mx-auto mt-2 max-w-lg text-[15.5px] leading-relaxed text-ink-2">
        {inPerson
          ? "In-person tutors are limited by distance. Remove a filter or switch to online lessons, which work from anywhere in the U.S."
          : "Try removing a filter or two, or tell us what you need and we'll help you find a fit."}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {canClear && (
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        )}
        {canSwitchOnline && (
          <Button variant="secondary" onClick={onOnline}>
            Switch to online
          </Button>
        )}
        <Button asChild variant="brand">
          <Link href="/concierge">
            <Compass /> Help me find a tutor
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function TutorDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const params = React.useMemo(() => parseTutorSearch(new URLSearchParams(qs)), [qs]);
  const tutors = useTutors();
  const results = React.useMemo(() => searchTutors(tutors, params), [tutors, params]);
  const activeCount = filterCount(params);

  const update = React.useCallback(
    (next: TutorSearch) => {
      const q = toQueryString(next);
      router.replace(q ? `/tutors?${q}` : "/tutors", { scroll: false });
    },
    [router],
  );

  // Show 8 at a time; start over whenever the search changes.
  const key = toQueryString(params);
  const [visible, setVisible] = React.useState(PAGE);
  const [prevKey, setPrevKey] = React.useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setVisible(PAGE);
  }
  const shown = results.slice(0, visible);

  // Mobile filter sheet edits a draft and applies it on press.
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<TutorSearch>(params);
  const draftCount = React.useMemo(() => (sheetOpen ? searchTutors(tutors, draft).length : 0), [sheetOpen, tutors, draft]);
  const openSheet = () => {
    setDraft(params);
    setSheetOpen(true);
  };

  const calloutAt = Math.min(3, shown.length);
  const subjectName = params.subject ? SUBJECT_BY_SLUG[params.subject]?.name : undefined;
  const title = subjectName ? `${subjectName} tutors & teachers for private lessons` : "Online and in-person tutors for private lessons";
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const previewTutor = shown.find((r) => r.tutor.id === hoveredId)?.tutor ?? shown[0]?.tutor;

  return (
    <div className="container-page pb-28 pt-8 sm:pt-10 lg:pb-24">
      {/* ── Title: follows the search; the last words carry the gradient ── */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="kicker">
            <span className="kicker-dot" aria-hidden />
            Find a tutor
          </p>
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="mt-4 text-balance font-heading text-[2.1rem] font-bold leading-[1.05] tracking-[-0.04em] text-ink sm:text-[2.6rem] lg:text-[3rem]"
          >
            {/* Non-breaking hyphen so "in-person" never splits across lines */}
            {title.replace(/private lessons$/, "").replace("in-person", "in\u2011person")}
            <span className="text-gradient">private lessons</span>
          </motion.h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted sm:text-[17px]">
            Choose a tutor who teaches your subject at your level, on your schedule. Results are ordered by how well each tutor fits your filters.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 lg:max-w-[480px] lg:shrink-0 lg:justify-end" aria-label="How search works">
          {TRUST_TAGS.map((t) => (
            <li key={t.label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 shadow-xs">
              <t.icon className="size-4 text-brand" aria-hidden /> {t.label}
            </li>
          ))}
        </ul>
      </header>

      {/* ── Desktop filter bar ── */}
      <div className="mt-8 hidden lg:block">
        <FilterBar value={params} onChange={update} />
      </div>

      {/* ── Phones and tablets: sticky toolbar ── */}
      <div className="sticky top-[68px] z-20 -mx-4 mt-6 flex items-center gap-2 border-y border-line bg-surface px-4 py-2.5 sm:-mx-6 sm:px-6 lg:hidden">
        <Button variant="secondary" size="sm" onClick={openSheet} className="h-9 shrink-0" aria-haspopup="dialog">
          <SlidersHorizontal /> Filters
          {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1.5 text-[11px] font-semibold tabular-nums text-on-ink">{activeCount}</span>}
        </Button>
        <SortControl value={params.sort} onChange={(sort) => update(applyPatch(params, { sort }))} showLabel={false} className="min-w-0 flex-1 justify-end" />
      </div>

      {!params.subject && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13.5px] font-medium text-muted">Popular:</span>
          {QUICK_SUBJECTS.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => update(applyPatch(params, { subject: slug }))}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-brand/40 hover:bg-brand-50 hover:text-brand"
            >
              {SUBJECT_BY_SLUG[slug]?.name ?? slug}
            </button>
          ))}
        </div>
      )}

      <ActiveFilterChips value={params} onChange={update} />

      {/* ── Results ── */}
      <section aria-labelledby="results-heading" className="mt-8">
        <div className={cn("flex flex-wrap items-end justify-between gap-4", tutors.length === 0 && "sr-only")}>
          <div className="min-w-0">
            <h2 id="results-heading" className="font-heading text-[1.35rem] font-bold tracking-[-0.02em] text-ink sm:text-[1.6rem]" aria-live="polite">
              {results.length === 0 ? (
                tutors.length === 0 ? "No tutors listed yet" : "No tutors found"
              ) : (
                <>
                  <motion.span key={results.length} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="inline-block tabular-nums">
                    {results.length}
                  </motion.span>{" "}
                  {subjectName ? `${subjectName} ` : ""}
                  {results.length === 1 ? "tutor" : "tutors"} ready to help you
                </>
              )}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">{describeSearch(params)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => update(clearedSearch(params))}>
                Clear all filters
              </Button>
            )}
            <SaveSearchButton params={params} />
          </div>
        </div>

        <div className={cn("mt-6", previewTutor && "xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8")}>
          <div className="min-w-0">
            {results.length === 0 ? (
              tutors.length === 0 ? (
                <NoTutorsYet />
              ) : (
                <NoMatches
                  inPerson={params.mode === "in_person" || (!!params.location && params.mode !== "online")}
                  canClear={activeCount > 0}
                  canSwitchOnline={params.mode !== "online"}
                  onClear={() => update(clearedSearch(params))}
                  onOnline={() => update(applyPatch(params, { mode: "online", radius: undefined }))}
                />
              )
            ) : (
              <ul className="space-y-4" aria-label="Tutors">
                <AnimatePresence mode="popLayout">
                  {shown.flatMap((r, i) => {
                    const card = (
                      <motion.li
                        key={r.tutor.id}
                        layout="position"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: (i % PAGE) * 0.045 } }}
                        exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.16 } }}
                        onMouseEnter={() => setHoveredId(r.tutor.id)}
                        onFocusCapture={() => setHoveredId(r.tutor.id)}
                      >
                        <TutorCard tutor={r.tutor} layout="row" distance={r.distance} />
                      </motion.li>
                    );
                    return i === calloutAt - 1 ? [card, <CalloutItem key="__concierge" />] : [card];
                  })}
                </AnimatePresence>
              </ul>
            )}

            {results.length > visible && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                  Show more tutors <ChevronDown />
                </Button>
                <p className="text-[13px] tabular-nums text-muted">
                  Showing {shown.length} of {results.length}
                </p>
              </div>
            )}
            {results.length > 0 && results.length <= visible && results.length > PAGE && (
              <p className="mt-8 text-center text-[13px] text-muted">You&rsquo;ve seen all {results.length} tutors for this search.</p>
            )}
          </div>

          {/* ── Wide screens: schedule preview of the tutor under the pointer ── */}
          {previewTutor && (
            <aside className="hidden xl:block" aria-label="Schedule preview">
              <div className="sticky top-24">
                <SchedulePreview tutor={previewTutor} />
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* ── Mobile filter sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          title="Filters"
          description="Changes apply when you press Show."
          footer={
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setDraft(clearedSearch(draft))} disabled={filterCount(draft) === 0}>
                Clear all
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={() => {
                  update(draft);
                  setSheetOpen(false);
                }}
              >
                {`Show ${draftCount} ${draftCount === 1 ? "tutor" : "tutors"}`}
              </Button>
            </div>
          }
        >
          <div className="px-5 py-5">
            <FilterPanel value={draft} onChange={setDraft} defaultOpen={["subject", "location"]} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CalloutItem() {
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: 0.2 } }} exit={{ opacity: 0 }}>
      <ConciergeCallout />
    </motion.li>
  );
}
