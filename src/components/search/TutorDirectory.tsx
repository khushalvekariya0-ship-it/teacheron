"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Compass, SearchX, SlidersHorizontal } from "lucide-react";
import { describeSearch, parseTutorSearch, searchTutors, toQueryString, type TutorSearch } from "@/lib/search";
import { useTutors } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { TutorCard } from "@/components/domain/TutorCard";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { FilterPanel, applyPatch } from "./FilterPanel";
import { SaveSearchButton } from "./SaveSearchButton";
import { SortControl } from "./SortControl";
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

  return (
    <div className="container-page pb-28 pt-6 lg:pb-24 lg:pt-10">
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        {/* ── Desktop filters ── */}
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="scrollbar-none sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pb-10 pr-1">
            <div className="mb-4 flex h-8 items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <SlidersHorizontal className="size-4 text-muted" aria-hidden /> Filters
              </h2>
              <AnimatePresence>
                {activeCount > 0 && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    onClick={() => update(clearedSearch(params))}
                    className="rounded-md px-2 py-1 text-[13px] font-medium text-navy hover:bg-navy-50"
                  >
                    Clear all
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <FilterPanel value={params} onChange={update} />
          </div>
        </aside>

        {/* ── Results ── */}
        <section aria-labelledby="results-heading" className="min-w-0">
          {/* Mobile toolbar */}
          <div className="sticky top-16 z-20 -mx-4 mb-5 flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 sm:-mx-6 sm:px-6 lg:hidden">
            <Button variant="secondary" size="sm" onClick={openSheet} className="h-9 shrink-0" aria-haspopup="dialog">
              <SlidersHorizontal /> Filters
              {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1.5 text-[11px] font-semibold tabular-nums text-on-ink">{activeCount}</span>}
            </Button>
            <SortControl value={params.sort} onChange={(sort) => update(applyPatch(params, { sort }))} showLabel={false} className="min-w-0 flex-1 justify-end" />
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 id="results-heading" className="font-heading text-2xl font-extrabold tracking-[-0.035em] text-ink sm:text-[30px]" aria-live="polite">
                <motion.span key={results.length} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="inline-block tabular-nums">
                  {results.length}
                </motion.span>{" "}
                {results.length === 1 ? "tutor" : "tutors"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted">{describeSearch(params)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SortControl value={params.sort} onChange={(sort) => update(applyPatch(params, { sort }))} className="hidden lg:flex" />
              <SaveSearchButton params={params} />
            </div>
          </div>

          <ActiveFilterChips value={params} onChange={update} />

          <div className="mt-6">
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong bg-canvas/50">
                <EmptyState
                  icon={<SearchX />}
                  title="No tutors match all of these filters"
                  description={
                    params.mode === "in_person" || (params.location && params.mode !== "online")
                      ? "In-person tutors are limited by distance. Remove a filter or switch to online lessons, which work from anywhere in the U.S."
                      : "Try removing a filter or two, or tell us what you need and we'll help you find a fit."
                  }
                  action={
                    <>
                      {activeCount > 0 && (
                        <Button variant="secondary" onClick={() => update(clearedSearch(params))}>
                          Clear filters
                        </Button>
                      )}
                      {params.mode !== "online" && (
                        <Button variant="secondary" onClick={() => update(applyPatch(params, { mode: "online", radius: undefined }))}>
                          Switch to online
                        </Button>
                      )}
                      <Button asChild>
                        <Link href="/concierge">
                          <Compass /> Help me find a tutor
                        </Link>
                      </Button>
                    </>
                  }
                />
              </div>
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
                      >
                        <TutorCard tutor={r.tutor} layout="row" distance={r.distance} />
                      </motion.li>
                    );
                    return i === calloutAt - 1 ? [card, <CalloutItem key="__concierge" />] : [card];
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>

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
        </section>
      </div>

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
