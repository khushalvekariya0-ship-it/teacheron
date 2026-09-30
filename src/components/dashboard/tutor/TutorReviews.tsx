"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { MessageSquareReply, Star } from "lucide-react";
import type { Review } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useNow, useReviews } from "@/lib/store/hooks";
import { subjectName } from "@/lib/data/catalog";
import { formatDate, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Controls";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { EASE } from "@/components/motion";
import { NeedsTutorProfile } from "./shared";
import { useMyTutor } from "./hooks";

type Filter = "all" | "needs" | "responded";

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-px", className)} role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= rating ? "fill-star text-star" : "fill-line text-line")} aria-hidden />
      ))}
    </span>
  );
}

export function TutorReviews() {
  const { tutor } = useMyTutor();
  const now = useNow(60_000);
  const all = useReviews();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [responding, setResponding] = React.useState<Review | null>(null);

  const reviews = React.useMemo(() => (tutor ? all.filter((r) => r.tutorId === tutor.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []), [all, tutor]);

  if (!tutor) return <NeedsTutorProfile what="reviews" />;

  const count = reviews.length;
  const sum = reviews.reduce((n, r) => n + r.rating, 0);
  const avg = count ? Math.round((sum / count) * 10) / 10 : null;
  const breakdown = ([5, 4, 3, 2, 1] as const).map((star) => ({ star, n: reviews.filter((r) => r.rating === star).length }));
  const needs = reviews.filter((r) => !r.tutorResponse).length;
  const visible = reviews.filter((r) => (filter === "needs" ? !r.tutorResponse : filter === "responded" ? !!r.tutorResponse : true));

  return (
    <div>
      <PageHeader title="Reviews" description="Every review comes from a family who completed a lesson with you. You can reply once to each review, publicly." />

      {count === 0 ? (
        <div data-spotlight className="rounded-xl border border-line bg-surface">
          <EmptyState icon={<Star />} title="No reviews yet" description="After a completed lesson, families are invited to leave a review. They'll appear here and on your public profile." />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="h-fit lg:sticky lg:top-20">
            <CardContent>
              <p className="text-[13px] font-medium text-muted">Average rating</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-[-0.03em] tabular-nums text-ink">{avg?.toFixed(1)}</span>
                <span className="text-sm text-muted">out of 5</span>
              </p>
              <Stars rating={Math.round(avg ?? 0)} className="mt-1.5" />
              <p className="mt-1 text-[13px] text-muted">
                From {count} {count === 1 ? "review" : "reviews"}
              </p>
              <ul className="mt-5 space-y-2" aria-label="Rating breakdown">
                {breakdown.map(({ star, n }, i) => (
                  <li key={star} className="grid grid-cols-[2.25rem_1fr_1.5rem] items-center gap-2 text-[13px]">
                    <span className="inline-flex items-center gap-0.5 text-ink-2">
                      {star} <Star className="size-3 fill-star text-star" aria-hidden />
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
                      <motion.span className="block h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${count ? (n / count) * 100 : 0}%` }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.05 }} />
                    </span>
                    <span className="text-right tabular-nums text-muted">
                      {n}
                      <span className="sr-only"> {n === 1 ? "review" : "reviews"} with {star} stars</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
                <span className="font-medium tabular-nums text-ink">{count - needs}</span> of {count} answered
              </p>
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Segmented
                label="Filter reviews"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count },
                  { value: "needs", label: "Needs a reply", count: needs },
                  { value: "responded", label: "Replied", count: count - needs },
                ]}
              />
            </div>
            {visible.length === 0 ? (
              <div data-spotlight className="rounded-xl border border-line bg-surface">
                <EmptyState compact icon={<MessageSquareReply />} title={filter === "needs" ? "You've replied to every review" : "No replies yet"} description={filter === "needs" ? "Nice work — families notice tutors who respond." : "Replies you post show under each review on your profile."} />
              </div>
            ) : (
              <ul className="space-y-3">
                {visible.map((r) => (
                  <motion.li key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <article data-spotlight className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-label={`Review by ${r.authorName}`}>
                      <div className="flex items-start gap-3">
                        <Avatar name={r.authorName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold text-ink">{r.authorName}</p>
                            <Badge size="sm">{r.authorRole === "parent" ? "Parent" : "Student"}</Badge>
                            <span className="text-[12.5px] text-muted">
                              {subjectName(r.subject)} · <time dateTime={r.createdAt}>{formatDate(r.createdAt)}</time>
                            </span>
                          </div>
                          <Stars rating={r.rating} className="mt-1" />
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-ink-2">{r.body}</p>
                      {r.tutorResponse ? (
                        <div className="mt-4 rounded-lg border-l-2 border-ink bg-canvas px-3.5 py-3">
                          <p className="text-[12.5px] font-medium text-ink">
                            Your reply · <span className="font-normal text-muted">{formatRelative(r.tutorResponse.createdAt, now)}</span>
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-ink-2">{r.tutorResponse.body}</p>
                        </div>
                      ) : (
                        <div className="mt-4 flex justify-end">
                          <Button variant="secondary" size="sm" onClick={() => setResponding(r)}>
                            <MessageSquareReply /> Reply publicly
                          </Button>
                        </div>
                      )}
                    </article>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <RespondDialog review={responding} onClose={() => setResponding(null)} />
    </div>
  );
}

function RespondDialog({ review, onClose }: { review: Review | null; onClose: () => void }) {
  const respond = useApp((s) => s.respondToReview);
  const [body, setBody] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [forId, setForId] = React.useState<string | null>(null);
  if (review && forId !== review.id) {
    setForId(review.id);
    setBody("");
    setTouched(false);
    setError(null);
  }
  const bodyError = body.trim().length < 10 ? "Write at least 10 characters." : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!review || bodyError) return;
    const res = respond(review.id, body);
    if (!res.ok) return setError(res.error);
    toast.success("Reply posted", { description: "It now shows under the review on your public profile." });
    onClose();
  };

  return (
    <Dialog open={!!review} onOpenChange={(o) => !o && onClose()}>
      {review && (
        <DialogContent title={`Reply to ${review.authorName}`} description="Replies are public and can't be edited after posting." size="md">
          <form noValidate onSubmit={submit}>
            <DialogBody className="space-y-4">
              <blockquote className="rounded-lg bg-canvas px-3.5 py-3 text-sm text-ink-2">
                <Stars rating={review.rating} />
                <p className="mt-1.5 line-clamp-4 leading-relaxed">{review.body}</p>
              </blockquote>
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}
              <Field label="Your reply" required hint="Thank them, and keep it professional. Contact details are hidden automatically." error={touched ? bodyError ?? undefined : undefined}>
                <Textarea rows={4} maxLength={1000} showCount value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => setTouched(true)} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Post reply</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
