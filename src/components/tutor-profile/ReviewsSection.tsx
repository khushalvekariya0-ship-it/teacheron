"use client";

import * as React from "react";
import { BadgeCheck, ChevronDown, MessageSquareQuote, Star } from "lucide-react";
import type { Review, Tutor } from "@/lib/types";
import { subjectName } from "@/lib/data/catalog";
import { formatDate } from "@/lib/format";
import { useHydrated, useReviews, useViewerTimezone } from "@/lib/store/hooks";
import { REVIEWS } from "@/lib/data/reviews";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { StarRating } from "@/components/ui/StarRating";
import { EmptyState } from "@/components/ui/States";
import { ProfileSection } from "./ProfileSections";

type ReviewSort = "newest" | "highest" | "lowest";
const PAGE = 4;
/** Reviews created in this browser depend on persisted data, so they join after hydration (keeps SSR deterministic). */
const SAMPLE_IDS = new Set(REVIEWS.map((r) => r.id));

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-px" aria-label={`${rating} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={i <= rating ? "size-3.5 fill-star text-star" : "size-3.5 fill-line text-line"} aria-hidden />
      ))}
    </span>
  );
}

function ReviewItem({ review, tutor, tz, index }: { review: Review; tutor: Tutor; tz: string; index: number }) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: (index % PAGE) * 0.05 } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      className="py-6 first:pt-0"
    >
      <article aria-label={`Review by ${review.authorName}`}>
        <div className="flex items-start gap-3">
          <Avatar name={review.authorName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-semibold text-ink">{review.authorName}</p>
              <span className="text-[13px] text-muted">{review.authorRole === "parent" ? "Parent" : "Student"}</span>
              <Badge tone="neutral" size="sm">
                <BadgeCheck /> Verified booking
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
              <Stars rating={review.rating} />
              <span aria-hidden>·</span>
              <span>{subjectName(review.subject)}</span>
              <span aria-hidden>·</span>
              <time dateTime={review.createdAt}>{formatDate(review.createdAt, tz)}</time>
            </div>
          </div>
        </div>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{review.body}</p>
        {review.tutorResponse && (
          <div className="mt-4 rounded-lg border-l-2 border-navy/30 bg-canvas px-4 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <MessageSquareQuote className="size-3.5 text-navy" aria-hidden /> Response from {tutor.firstName}
              <span className="font-normal text-muted">· {formatDate(review.tutorResponse.createdAt, tz)}</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{review.tutorResponse.body}</p>
          </div>
        )}
      </article>
    </motion.li>
  );
}

export function ReviewsSection({ tutor }: { tutor: Tutor }) {
  const all = useReviews();
  const hydrated = useHydrated();
  const tz = useViewerTimezone();
  const [sort, setSort] = React.useState<ReviewSort>("newest");
  const [visible, setVisible] = React.useState(PAGE);

  const reviews = React.useMemo(() => all.filter((r) => r.tutorId === tutor.id && (hydrated || SAMPLE_IDS.has(r.id))), [all, tutor.id, hydrated]);
  const sorted = React.useMemo(() => {
    const list = [...reviews];
    if (sort === "newest") list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "highest") list.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
    if (sort === "lowest") list.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [reviews, sort]);
  const breakdown = React.useMemo(() => {
    const out: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) out[r.rating]++;
    return out;
  }, [reviews]);
  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;

  return (
    <ProfileSection id="reviews" title="Reviews" description="Only families who completed a lesson with this tutor can leave a review.">
      {count === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong">
          <EmptyState compact icon={<Star />} title="No reviews yet" description="Reviews come only from completed lessons, so new tutors start with none. Book a trial to be among the first." />
        </div>
      ) : (
        <>
          <div data-spotlight className="grid gap-6 rounded-xl border border-line p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8 sm:p-6">
            <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-start sm:justify-center sm:gap-1">
              <p className="text-5xl font-semibold tracking-[-0.03em] tabular-nums text-ink">{average!.toFixed(1)}</p>
              <div className="space-y-1">
                <StarRating rating={average} count={count} showStars size="md" className="[&>span:nth-child(2)]:hidden [&>span:nth-child(3)]:hidden" />
                <p className="text-[13px] text-muted">
                  {count} {count === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>
            <ul className="space-y-2" aria-label="Rating breakdown">
              {([5, 4, 3, 2, 1] as const).map((n, i) => {
                const c = breakdown[n];
                const pct = count ? (c / count) * 100 : 0;
                return (
                  <li key={n} className="flex items-center gap-3 text-[13px]">
                    <span className="flex w-8 shrink-0 items-center gap-1 tabular-nums text-ink-2">
                      {n} <Star className="size-3 fill-star text-star" aria-hidden />
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
                      <motion.span
                        className="block h-full rounded-full bg-navy"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true, amount: 0.8 }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.07 }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right tabular-nums text-muted">
                      <span className="sr-only">
                        {n} stars:{" "}
                      </span>
                      {c}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mb-2 mt-8 flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              Showing {Math.min(visible, count)} of {count}
            </p>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              Sort
              <Select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as ReviewSort);
                  setVisible(PAGE);
                }}
                options={[
                  { value: "newest", label: "Newest" },
                  { value: "highest", label: "Highest rated" },
                  { value: "lowest", label: "Lowest rated" },
                ]}
                size="sm" className="w-40"
              />
            </label>
          </div>

          <ul className="divide-y divide-line border-t border-line pt-6">
            <AnimatePresence mode="popLayout" initial={false}>
              {sorted.slice(0, visible).map((r, i) => (
                <ReviewItem key={`${sort}-${r.id}`} review={r} tutor={tutor} tz={tz} index={i} />
              ))}
            </AnimatePresence>
          </ul>

          {count > visible && (
            <div className="mt-2 flex justify-center">
              <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                Show more reviews <ChevronDown />
              </Button>
            </div>
          )}
        </>
      )}
    </ProfileSection>
  );
}
