"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, MessageSquareQuote, PenLine, Star } from "lucide-react";
import type { Booking, Review, User } from "@/lib/types";
import { PageHeader, RoleGate } from "@/components/dashboard/Shell";
import { AnimatePresence, Stagger, StaggerItem, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import { StarInput } from "@/components/ui/StarRating";
import { toast } from "@/components/ui/Toast";
import { useApp } from "@/lib/store";
import { useNow, useSession, useViewerTimezone } from "@/lib/store/hooks";
import { formatDate, formatRelative, pluralize } from "@/lib/format";
import { subjectName } from "@/lib/data/catalog";
import { tutorFullName, useTutorMap } from "@/components/dashboard/shared/hooks";
import { useMyChildren } from "./data";

export function LearnerReviews() {
  return (
    <RoleGate roles={["student", "parent"]}>
      <Inner />
    </RoleGate>
  );
}

const REVIEW_STATUS: Record<Review["status"], { label: string; tone: "success" | "warning" | "outline" } | null> = {
  published: null,
  flagged: { label: "Under moderation", tone: "warning" },
  removed: { label: "Removed by moderators", tone: "outline" },
};

function Inner() {
  const me = useSession() as User;
  const now = useNow(60_000);
  const tz = useViewerTimezone();
  const bookings = useApp((s) => s.bookings);
  const reviews = useApp((s) => s.reviews);
  const kids = useMyChildren(me);
  const tutorMap = useTutorMap();
  const [writing, setWriting] = React.useState<Booking | null>(null);

  const { waiting, mine } = React.useMemo(() => {
    const myBookings = bookings.filter((b) => b.bookerId === me.id);
    const reviewedIds = new Set(reviews.map((r) => r.bookingId));
    const byId = new Map(myBookings.map((b) => [b.id, b]));
    return {
      waiting: myBookings.filter((b) => b.status === "completed" && !b.reviewId && !reviewedIds.has(b.id)).sort((a, b) => b.startUtc.localeCompare(a.startUtc)),
      mine: reviews
        .filter((r) => byId.has(r.bookingId))
        .map((r) => ({ review: r, booking: byId.get(r.bookingId)! }))
        .sort((a, b) => b.review.createdAt.localeCompare(a.review.createdAt)),
    };
  }, [bookings, reviews, me.id]);

  const kidName = (id?: string) => (id ? kids.find((k) => k.id === id)?.firstName : undefined);

  return (
    <div>
      <PageHeader title="Reviews" description="Honest reviews help other families choose. You can review each completed lesson once." />

      <Stagger className="space-y-8" stagger={0.08} amount={0.05}>
        <StaggerItem>
          <section aria-labelledby="waiting-heading">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="waiting-heading" className="text-[15px] font-semibold tracking-tight text-ink">
                Waiting for your review
              </h2>
              {waiting.length > 0 && <span className="text-[13px] tabular-nums text-muted">{pluralize(waiting.length, "lesson")}</span>}
            </div>
            {waiting.length === 0 ? (
              <Card>
                <EmptyState compact icon={<Star />} title="You're all caught up" description="After a lesson is completed, you can review it here." />
              </Card>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {waiting.map((b) => {
                    const tutor = tutorMap.get(b.tutorId);
                    const kid = kidName(b.childId);
                    return (
                      <motion.li key={b.id} layout exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}>
                        <Card className="flex h-full items-center gap-4 p-4 sm:p-5">
                          <Avatar name={tutorFullName(tutor)} src={tutor?.photoUrl} tone={tutor?.tone} size="md" verified={tutor?.verification.identity === "verified"} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">
                              {subjectName(b.subject)}
                              {b.type === "trial" && <span className="font-normal text-muted"> · Trial</span>} with {tutor?.firstName ?? "your tutor"}
                            </p>
                            <p className="truncate text-[12.5px] text-muted">
                              {formatDate(b.startUtc, tz, { weekday: "short", month: "short", day: "numeric" })}
                              {kid && ` · ${kid}'s lesson`}
                            </p>
                          </div>
                          <Button size="sm" onClick={() => setWriting(b)}>
                            <PenLine /> Review
                          </Button>
                        </Card>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </StaggerItem>

        <StaggerItem>
          <section aria-labelledby="yours-heading">
            <h2 id="yours-heading" className="mb-3 text-[15px] font-semibold tracking-tight text-ink">
              Your reviews
            </h2>
            {mine.length === 0 ? (
              <Card>
                <EmptyState compact icon={<MessageSquareQuote />} title="No reviews yet" description="Reviews you write appear here, along with any response from the tutor." />
              </Card>
            ) : (
              <Card>
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>
                    {mine.map(({ review: r, booking: b }) => {
                      const tutor = tutorMap.get(r.tutorId);
                      const status = REVIEW_STATUS[r.status];
                      return (
                        <motion.li key={r.id} layout initial={{ opacity: 0, backgroundColor: "var(--color-brand-50)" }} animate={{ opacity: 1, backgroundColor: "rgba(255,255,255,0)" }} transition={{ duration: 1.2 }} className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar name={tutorFullName(tutor)} src={tutor?.photoUrl} tone={tutor?.tone} size="sm" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink">
                                  {tutor ? (
                                    <Link href={`/tutors/${tutor.slug}#reviews`} className="hover:text-ink">
                                      {tutorFullName(tutor)}
                                    </Link>
                                  ) : (
                                    "Tutor"
                                  )}
                                </p>
                                <p className="text-[12.5px] text-muted">
                                  {subjectName(b.subject)} lesson on {formatDate(b.startUtc, tz, { month: "short", day: "numeric" })} · reviewed {formatRelative(r.createdAt, now)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {status && (
                                <Badge tone={status.tone} size="sm">
                                  {status.label}
                                </Badge>
                              )}
                              <Stars rating={r.rating} />
                            </div>
                          </div>
                          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{r.body}</p>
                          <p className="mt-2 text-[12px] text-muted">Shown publicly as {r.authorName}</p>
                          {r.tutorResponse && (
                            <div className="mt-3 rounded-lg border border-line bg-canvas px-4 py-3">
                              <p className="text-[12px] font-medium text-muted">
                                Response from {tutor?.firstName ?? "the tutor"} · {formatDate(r.tutorResponse.createdAt, tz, { month: "short", day: "numeric" })}
                              </p>
                              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{r.tutorResponse.body}</p>
                            </div>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </Card>
            )}
          </section>
        </StaggerItem>
      </Stagger>

      <ReviewDialog booking={writing} tutorName={writing ? tutorFullName(tutorMap.get(writing.tutorId)) : ""} me={me} tz={tz} onClose={() => setWriting(null)} />
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-px" role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={i <= rating ? "size-4 fill-star text-star" : "size-4 fill-sunken text-line-strong"} aria-hidden />
      ))}
    </span>
  );
}

/* ─── Review dialog ─────────────────────────────────────────────────────────── */

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Choose a star rating").max(5),
  body: z.string().trim().min(20, "Write at least 20 characters").max(1000, "Keep it under 1,000 characters"),
});
type ReviewValues = z.input<typeof reviewSchema>;

function ReviewDialog({ booking, tutorName, me, tz, onClose }: { booking: Booking | null; tutorName: string; me: User; tz: string; onClose: () => void }) {
  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      {booking && (
        <DialogContent
          title={`Review your lesson with ${tutorName}`}
          description={`${subjectName(booking.subject)}${booking.type === "trial" ? " trial" : ""} · ${formatDate(booking.startUtc, tz, { weekday: "long", month: "long", day: "numeric" })}`}
        >
          <ReviewForm key={booking.id} booking={booking} me={me} onDone={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ReviewForm({ booking, me, onDone }: { booking: Booking; me: User; onDone: () => void }) {
  const submitReview = useApp((s) => s.submitReview);
  const form = useForm<ReviewValues>({ resolver: zodResolver(reviewSchema), mode: "onTouched", defaultValues: { rating: 0, body: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit((v) => {
    const res = submitReview(booking.id, v.rating as Review["rating"], v.body);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Thanks — your review is published", { description: "It now appears on the tutor's profile." });
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-5">
        <Controller
          control={form.control}
          name="rating"
          render={({ field }) => (
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Overall rating</p>
              <StarInput value={field.value} onChange={(v) => field.onChange(v)} />
              {errors.rating && (
                <p role="alert" className="mt-1.5 text-[13px] text-danger">
                  {errors.rating.message}
                </p>
              )}
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="body"
          render={({ field }) => (
            <Field label="Your review" error={errors.body?.message} hint="What went well? What should other families know? Minimum 20 characters.">
              <Textarea rows={5} maxLength={1000} showCount placeholder="Describe the lesson — preparation, explanations, how it helped." {...field} />
            </Field>
          )}
        />
        <p className="flex items-start gap-2 rounded-lg border border-line bg-canvas px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden />
          <span>
            Reviews are public and tied to this lesson. They appear as <span className="font-medium text-ink-2">{me.firstName} {me.lastName.charAt(0)}.</span> — contact details are removed automatically, and you can review each lesson only once.
          </span>
        </p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Publish review
        </Button>
      </DialogFooter>
    </form>
  );
}
