"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Flag, Info, MessageSquareQuote, RotateCcw, Star, Trash } from "lucide-react";
import type { Report, Review } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { REVIEWS } from "@/lib/data/reviews";
import { subjectName } from "@/lib/data/catalog";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { ConfirmDialog, Sheet, SheetContent } from "@/components/ui/Overlay";
import { StarRating } from "@/components/ui/StarRating";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { BookingStatusBadge } from "@/components/domain/Badges";
import { toast } from "@/components/ui/Toast";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, Mono, PermissionButton, PersonCell, RowOpen, SearchInput, Section, StatusPill, TextLink, Timeline,
  Toolbar, formatAge, humanize, matches, useDirectory, useStaff, useSticky, useUrlParam,
} from "./kit";
import { auditTone, describeAudit, sortAudit } from "./AuditLogView";

/* ─── Shared review helpers (also used by Reports) ───────────────────────────── */

export const REVIEW_STATUS_META: Record<Review["status"], { label: string; tone: "success" | "warning" | "danger" }> = {
  published: { label: "Published", tone: "success" },
  flagged: { label: "Flagged", tone: "warning" },
  removed: { label: "Removed", tone: "danger" },
};

/** Sample reviews merged with the store; the store copy wins (moderation copies a sample review into the store). */
export function useAllReviews(): Review[] {
  const local = useApp((s) => s.reviews);
  return React.useMemo(() => {
    const ids = new Set(local.map((r) => r.id));
    return [...local, ...REVIEWS.filter((r) => !ids.has(r.id))];
  }, [local]);
}

/** "4 ★" with a proper screen-reader label. */
export function RatingText({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap tabular-nums text-ink", className)}>
      <span aria-hidden>{rating}</span>
      <Star className="size-3.5 fill-star text-star" aria-hidden />
      <span className="sr-only">{rating} out of 5 stars</span>
    </span>
  );
}

/** Five stars, filled to the rating, plus "4 out of 5". */
export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex items-center gap-px" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn("size-4", i <= rating ? "fill-star text-star" : "fill-sunken text-line-strong")} />
        ))}
      </span>
      <span className="text-[13px] font-medium tabular-nums text-ink">{rating} out of 5</span>
    </span>
  );
}

const REPORT_STATUS: Record<Report["status"], { label: string; tone: "warning" | "accent" | "success" | "neutral" }> = {
  open: { label: "Open", tone: "warning" },
  reviewing: { label: "Reviewing", tone: "accent" },
  actioned: { label: "Action taken", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

/* ─── Page ───────────────────────────────────────────────────────────────────── */

type TabKey = "all" | Review["status"];
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

const TABS: { value: TabKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "flagged", label: "Flagged" },
  { value: "removed", label: "Removed" },
];

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: "all", label: "Any rating" },
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
];

export function ReviewsView() {
  return (
    <PermissionGate permission="reports.moderate">
      <ReviewsInner />
    </PermissionGate>
  );
}

function ReviewsInner() {
  const reviews = useAllReviews();
  const reports = useApp((s) => s.reports);
  const dir = useDirectory();
  const tz = useViewerTimezone();

  const [openId, setOpenId] = useUrlParam("id");
  // A linked flagged/removed review opens on its own tab; everything else starts on All.
  const [tab, setTab] = React.useState<TabKey>(() => {
    const linked = reviews.find((r) => r.id === openId)?.status;
    return linked && linked !== "published" ? linked : "all";
  });
  const [q, setQ] = React.useState("");
  const [rating, setRating] = React.useState<RatingFilter>("all");

  const openReports = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports) if (r.targetType === "review" && (r.status === "open" || r.status === "reviewing")) m.set(r.targetId, (m.get(r.targetId) ?? 0) + 1);
    return m;
  }, [reports]);

  const searched = React.useMemo(
    () =>
      reviews
        .filter((r) => (rating === "all" || r.rating === Number(rating)) && matches(q, dir.name(r.tutorId), r.authorName, r.body, subjectName(r.subject), r.id, r.bookingId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reviews, rating, q, dir],
  );
  const counts = React.useMemo(
    () => ({ all: searched.length, published: searched.filter((r) => r.status === "published").length, flagged: searched.filter((r) => r.status === "flagged").length, removed: searched.filter((r) => r.status === "removed").length }),
    [searched],
  );
  const rows = React.useMemo(() => (tab === "all" ? searched : searched.filter((r) => r.status === tab)), [searched, tab]);
  const filtered = q.trim() !== "" || rating !== "all";

  const columns: Column<Review>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.createdAt, cell: (r) => <RowOpen onOpen={() => setOpenId(r.id)} label={`Open review by ${r.authorName}`} className="whitespace-nowrap tabular-nums">{formatDate(r.createdAt, tz)}</RowOpen> },
    { key: "tutor", header: "Tutor", sortValue: (r) => dir.name(r.tutorId), cell: (r) => <span className="block max-w-44 truncate font-medium text-ink">{dir.name(r.tutorId)}</span> },
    { key: "author", header: "Author", sortValue: (r) => r.authorName, cell: (r) => <PersonCell name={r.authorName} sub={humanize(r.authorRole)} className="max-w-36" /> },
    { key: "rating", header: "Rating", sortValue: (r) => r.rating, cell: (r) => <RatingText rating={r.rating} /> },
    {
      key: "excerpt",
      header: "Review",
      cell: (r) => (
        <span className="flex min-w-0 max-w-80 items-center gap-2">
          <span className="truncate">{r.body}</span>
          {openReports.get(r.id) ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-warning">
              <Flag className="size-3" aria-hidden /> {pluralize(openReports.get(r.id)!, "report")}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <StatusPill tone={REVIEW_STATUS_META[r.status].tone}>{REVIEW_STATUS_META[r.status].label}</StatusPill> },
  ];

  const open = reviews.find((r) => r.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Every review on TutorLink, each created from a completed booking. Only published reviews count toward a tutor's public rating."
        actions={
          <ExportButton
            filename="tutorlink-reviews"
            headers={["ID", "Date", "Tutor ID", "Tutor", "Author", "Author role", "Rating", "Subject", "Status", "Booking ID", "Review"]}
            rows={() => rows.map((r) => [r.id, r.createdAt, r.tutorId, dir.name(r.tutorId), r.authorName, r.authorRole, r.rating, subjectName(r.subject), r.status, r.bookingId, r.body])}
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Filter by review status">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} count={counts[t.value]}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <Toolbar summary={pluralize(rows.length, "review")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search tutor, author or text…" label="Search reviews" />
            <FilterSelect label="Rating" value={rating} onChange={setRating} options={RATING_OPTIONS} />
            <ClearFilters
              active={filtered}
              onClear={() => {
                setQ("");
                setRating("all");
              }}
            />
          </Toolbar>

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpenId(r.id)}
            mobileTitle="tutor"
            pageSize={12}
            empty={
              <EmptyState
                icon={<MessageSquareQuote />}
                title={filtered ? "No reviews match these filters" : tab === "all" ? "No reviews yet" : `No ${TABS.find((t) => t.value === tab)!.label.toLowerCase()} reviews`}
                description={
                  filtered
                    ? "Try another tutor, author or phrase, or clear the filters."
                    : tab === "flagged"
                      ? "Flag a review while you investigate it; it stays out of public ratings until you restore or remove it."
                      : tab === "removed"
                        ? "Removed reviews appear here so they can be restored if needed."
                        : "Reviews appear after families complete a lesson and leave feedback."
                }
              />
            }
          />
        </TabsContent>
      </Tabs>

      <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-muted">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden /> Removed and flagged reviews are excluded from public ratings — tutor ratings are recomputed from published reviews only.
      </p>

      <ReviewSheet review={open} onClose={() => setOpenId(null)} />
    </>
  );
}

/* ─── Detail drawer ──────────────────────────────────────────────────────────── */

function ReviewSheet({ review: current, onClose }: { review: Review | null; onClose: () => void }) {
  const review = useSticky(current);
  const dir = useDirectory();
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        title={review ? `Review of ${dir.name(review.tutorId)}` : "Review"}
        description={review ? `${subjectName(review.subject)} · ${review.id}` : undefined}
        className="sm:w-[34rem]"
        footer={review ? <ReviewActions review={review} /> : undefined}
      >
        {review && <ReviewDetail review={review} />}
      </SheetContent>
    </Sheet>
  );
}

function ReviewDetail({ review }: { review: Review }) {
  const bookings = useApp((s) => s.bookings);
  const reports = useApp((s) => s.reports);
  const auditLogs = useApp((s) => s.auditLogs);
  const dir = useDirectory();
  const { can } = useStaff();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const tutor = dir.tutorById.get(review.tutorId);
  const booking = bookings.find((b) => b.id === review.bookingId);
  const related = React.useMemo(() => reports.filter((r) => r.targetType === "review" && r.targetId === review.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [reports, review.id]);
  const history = React.useMemo(() => sortAudit(auditLogs.filter((a) => a.targetType === "review" && a.targetId === review.id)).slice(0, 8), [auditLogs, review.id]);

  return (
    <div className="divide-y divide-line">
      <div className="space-y-3 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RatingStars rating={review.rating} />
          <StatusPill tone={REVIEW_STATUS_META[review.status].tone}>{REVIEW_STATUS_META[review.status].label}</StatusPill>
        </div>
        <p className="text-[13px] text-muted">
          <span className="font-medium text-ink">{review.authorName}</span> · {humanize(review.authorRole)} · {formatDate(review.createdAt, tz)}
        </p>
        {review.status === "flagged" && (
          <InlineAlert tone="warning" title="Flagged">
            Excluded from {tutor ? tutor.firstName : "the tutor"}&apos;s public rating until it&apos;s restored or removed.
          </InlineAlert>
        )}
        {review.status === "removed" && (
          <InlineAlert tone="danger" title="Removed">
            Excluded from public ratings. Restore it if it was removed by mistake.
          </InlineAlert>
        )}
      </div>

      <Section title="Review">
        <blockquote className="rounded-lg border border-line bg-canvas px-4 py-3 text-[14px] leading-relaxed text-ink">{review.body}</blockquote>
        {review.tutorResponse ? (
          <div className="mt-3 rounded-lg border border-line px-4 py-3">
            <p className="text-[12px] font-medium text-muted">
              Response from {tutor ? tutor.firstName : "the tutor"} · {formatDate(review.tutorResponse.createdAt, tz)}
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{review.tutorResponse.body}</p>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted">The tutor hasn&apos;t responded to this review.</p>
        )}
      </Section>

      <Section title="Tutor">
        {tutor ? (
          <>
            <Facts
              items={[
                { label: "Tutor", value: <TextLink href={`/admin/tutors?id=${encodeURIComponent(tutor.id)}`}>{dir.name(tutor.id)}</TextLink> },
                { label: "Public rating now", value: <StarRating rating={tutor.rating} count={tutor.reviewCount} /> },
                { label: "Subject reviewed", value: subjectName(review.subject) },
              ]}
            />
            <p className="mt-2.5 text-[12.5px] text-muted">
              Recomputed from published reviews only.{" "}
              <Link href={`/tutors/${tutor.slug}`} className="inline-flex items-center gap-0.5 font-medium text-ink underline-offset-4 hover:underline">
                Public profile <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </p>
          </>
        ) : (
          <p className="text-[13px] text-muted">
            Tutor <Mono>{review.tutorId}</Mono> isn&apos;t in this preview&apos;s data.
          </p>
        )}
      </Section>

      <Section title="Verified booking" description="Every review is created from a completed booking by the account that booked it.">
        {booking ? (
          <Facts
            items={[
              { label: "Booking", value: <TextLink href={`/admin/bookings?id=${encodeURIComponent(booking.id)}`}>{booking.id}</TextLink> },
              { label: "Lesson", value: `${subjectName(booking.subject)} · ${formatDateTime(booking.startUtc, tz)}` },
              { label: "Status", value: <BookingStatusBadge status={booking.status} /> },
              { label: "Booked by", value: <TextLink href={`/admin/users?id=${encodeURIComponent(booking.bookerId)}`}>{dir.name(booking.bookerId)}</TextLink> },
            ]}
          />
        ) : (
          <Facts
            items={[
              { label: "Booking", value: <Mono>{review.bookingId}</Mono> },
              { label: "Record", value: <span className="font-normal text-muted">Historical sample booking — not present in this preview&apos;s data</span> },
            ]}
          />
        )}
      </Section>

      <Section title="Reports">
        {related.length === 0 ? (
          <p className="text-[13px] text-muted">No one has reported this review.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/reports?id=${encodeURIComponent(r.id)}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] hover:bg-canvas">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{r.reason}</span>
                    <span className="block truncate text-muted">
                      {dir.name(r.reporterId)} · {formatAge(now - new Date(r.createdAt).getTime())} ago
                    </span>
                  </span>
                  <StatusPill tone={REPORT_STATUS[r.status].tone}>{REPORT_STATUS[r.status].label}</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Moderation history"
        action={can("audit.read") ? <TextLink href={`/admin/audit-log?q=${encodeURIComponent(review.id)}`} className="text-[12.5px]">Audit log</TextLink> : undefined}
      >
        <Timeline
          empty="No moderation actions on this review yet."
          items={history.map((a) => ({ key: a.id, tone: auditTone(a), title: describeAudit(a), meta: `${dir.name(a.actorId)} · ${formatDateTime(a.createdAt, tz)}` }))}
        />
      </Section>
    </div>
  );
}

/* ─── Moderation actions ─────────────────────────────────────────────────────── */

const MODERATION: Record<Review["status"], { title: string; confirm: string; toast: string; tone: "default" | "danger"; description: (tutor: string) => string }> = {
  flagged: {
    title: "Flag this review?",
    confirm: "Flag review",
    toast: "Review flagged",
    tone: "default",
    description: (t) => `It stays on record but no longer counts toward ${t}'s public rating while you investigate. You can restore or remove it later.`,
  },
  removed: {
    title: "Remove this review?",
    confirm: "Remove review",
    toast: "Review removed",
    tone: "danger",
    description: (t) => `It's excluded from ${t}'s public rating. It stays listed here under Removed so it can be restored.`,
  },
  published: {
    title: "Restore this review?",
    confirm: "Restore review",
    toast: "Review restored",
    tone: "default",
    description: (t) => `It's published again and counts toward ${t}'s public rating.`,
  },
};

function ReviewActions({ review }: { review: Review }) {
  const moderateReview = useApp((s) => s.moderateReview);
  const dir = useDirectory();
  const [pending, setPending] = React.useState<Review["status"] | null>(null);
  const shown = useSticky(pending);
  const tutorFirst = dir.tutorById.get(review.tutorId)?.firstName ?? "the tutor";

  const confirm = () => {
    if (!pending) return;
    const res = moderateReview(review.id, pending);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(MODERATION[pending].toast, { description: "Recorded in the audit log." });
    setPending(null);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {review.status !== "published" && (
        <PermissionButton permission="reports.moderate" variant="secondary" onClick={() => setPending("published")}>
          <RotateCcw /> Restore
        </PermissionButton>
      )}
      {review.status === "published" && (
        <PermissionButton permission="reports.moderate" variant="secondary" onClick={() => setPending("flagged")}>
          <Flag /> Flag
        </PermissionButton>
      )}
      {review.status !== "removed" && (
        <PermissionButton permission="reports.moderate" variant="danger-outline" onClick={() => setPending("removed")}>
          <Trash /> Remove
        </PermissionButton>
      )}
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={shown ? MODERATION[shown].title : "Moderate review"}
        description={shown ? MODERATION[shown].description(tutorFirst) : undefined}
        confirmLabel={shown ? MODERATION[shown].confirm : "Confirm"}
        tone={shown ? MODERATION[shown].tone : "default"}
        onConfirm={confirm}
      >
        <blockquote className="line-clamp-4 rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
          <RatingText rating={review.rating} className="mr-1.5 align-[-2px]" />
          {review.body}
        </blockquote>
      </ConfirmDialog>
    </div>
  );
}
