"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, CircleDashed, CircleX, Clock3, ExternalLink, Sparkles, UserRound } from "lucide-react";
import type { Tutor, VerificationKind, VerificationStatus } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useTutors, useViewerTimezone } from "@/lib/store/hooks";
import { TUTOR_PLANS } from "@/lib/data/platform";
import { MODE_LABEL, SUBJECTS, TUTOR_CATEGORY_LABEL, subjectName, LEVEL_LABEL } from "@/lib/data/catalog";
import { formatCents, formatDate, formatDuration, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { EmptyState } from "@/components/ui/States";
import { VERIFICATION_LABEL, VERIFICATION_STATUS_META, VerificationStatusBadge } from "@/components/domain/Badges";
import { cn } from "@/lib/utils";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, MiniStat, RowOpen, SearchInput, Section, TextLink, Toolbar, centsToDecimal, fullName, humanize,
  matches, useDirectory, useSticky, useUrlParam,
} from "./kit";

const KINDS: VerificationKind[] = ["identity", "education", "certification", "background"];
const KIND_SHORT: Record<VerificationKind, string> = { identity: "ID", education: "Edu", certification: "Cert", background: "BG" };

type VerFilter = "all" | "id_verified" | "id_missing" | "pending" | "rejected";
const VER_OPTIONS: { value: VerFilter; label: string }[] = [
  { value: "all", label: "Any verification" },
  { value: "id_verified", label: "Identity verified" },
  { value: "id_missing", label: "Identity not verified" },
  { value: "pending", label: "Has checks in review" },
  { value: "rejected", label: "Has rejected or expired checks" },
];

type ModeFilter = "all" | "online" | "in_person";

const formatBps = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;
const planName = (id: string) => TUTOR_PLANS.find((p) => p.id === id)?.name ?? id;

function verMatches(t: Tutor, f: VerFilter): boolean {
  const v = Object.values(t.verification);
  switch (f) {
    case "all":
      return true;
    case "id_verified":
      return t.verification.identity === "verified";
    case "id_missing":
      return t.verification.identity !== "verified";
    case "pending":
      return v.some((s) => s === "submitted" || s === "under_review");
    case "rejected":
      return v.some((s) => s === "rejected" || s === "expired");
  }
}

function statusIcon(s: VerificationStatus) {
  if (s === "verified") return BadgeCheck;
  if (s === "not_started") return CircleDashed;
  if (s === "rejected" || s === "expired") return CircleX;
  return Clock3;
}

/** Four compact chips — icon + short label, full status for screen readers and on hover. */
export function VerificationChips({ tutor, className }: { tutor: Pick<Tutor, "verification">; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {KINDS.map((k) => {
        const s = tutor.verification[k];
        const Icon = statusIcon(s);
        const tone = VERIFICATION_STATUS_META[s].tone;
        return (
          <span
            key={k}
            title={`${VERIFICATION_LABEL[k]}: ${VERIFICATION_STATUS_META[s].label}`}
            className={cn(
              "inline-flex h-5 items-center gap-0.5 rounded border px-1 text-[10.5px] font-medium",
              tone === "success" && "border-success-200 bg-success-50 text-success",
              tone === "warning" && "border-warning-200 bg-warning-50 text-warning",
              tone === "accent" && "border-brand-soft bg-brand-soft text-ink",
              tone === "danger" && "border-danger-200 bg-danger-50 text-danger",
              tone === "neutral" && "border-line bg-canvas text-muted",
            )}
          >
            <Icon className="size-3" aria-hidden />
            <span aria-hidden>{KIND_SHORT[k]}</span>
            <span className="sr-only">{`${VERIFICATION_LABEL[k]}: ${VERIFICATION_STATUS_META[s].label}`}</span>
          </span>
        );
      })}
    </span>
  );
}

export function TutorsView() {
  return (
    <PermissionGate permission="users.read">
      <TutorsInner />
    </PermissionGate>
  );
}

function TutorsInner() {
  const tutors = useTutors();
  const subscriptions = useApp((s) => s.subscriptions);
  const [q, setQ] = React.useState("");
  const [ver, setVer] = React.useState<VerFilter>("all");
  const [subject, setSubject] = React.useState("all");
  const [mode, setMode] = React.useState<ModeFilter>("all");
  const [openId, setOpenId] = useUrlParam("id");

  const subjectOptions = React.useMemo(() => {
    const taught = new Set(tutors.flatMap((t) => t.subjects));
    return [{ value: "all", label: "Any subject" }, ...SUBJECTS.filter((s) => taught.has(s.slug)).map((s) => ({ value: s.slug, label: s.name })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [tutors]);

  const rows = React.useMemo(
    () =>
      tutors
        .filter((t) => matches(q, fullName(t), t.city, t.state, t.headline, t.id) && verMatches(t, ver) && (subject === "all" || t.subjects.includes(subject)) && (mode === "all" || t.modes.includes(mode)))
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [tutors, q, ver, subject, mode],
  );

  const stats = React.useMemo(
    () => ({
      idVerified: tutors.filter((t) => t.verification.identity === "verified").length,
      inReview: tutors.filter((t) => Object.values(t.verification).some((s) => s === "submitted" || s === "under_review")).length,
      featured: tutors.filter((t) => t.featured).length,
      paid: tutors.filter((t) => subscriptions[t.id] && subscriptions[t.id].plan !== "free" && subscriptions[t.id].status === "active").length,
    }),
    [tutors, subscriptions],
  );

  const filtered = q.trim() !== "" || ver !== "all" || subject !== "all" || mode !== "all";
  const plan = (t: Tutor) => subscriptions[t.id]?.plan ?? "free";

  const columns: Column<Tutor>[] = [
    {
      key: "tutor",
      header: "Tutor",
      sortValue: (t) => fullName(t),
      cell: (t) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={fullName(t)} tone={t.tone} size="sm" className="hidden md:inline-flex" />
          <span className="min-w-0">
            <RowOpen onOpen={() => setOpenId(t.id)} label={`Open ${fullName(t)}`} className="block truncate font-medium text-ink">{fullName(t)}</RowOpen>
            <span className="block truncate text-[12px] text-muted">{t.city}, {t.state}</span>
          </span>
        </span>
      ),
    },
    { key: "verification", header: "Verification", cell: (t) => <VerificationChips tutor={t} />, sortValue: (t) => KINDS.filter((k) => t.verification[k] === "verified").length },
    { key: "rating", header: "Rating", sortValue: (t) => t.rating ?? 0, cell: (t) => <StarRating rating={t.rating} count={t.reviewCount} showStars={false} /> },
    { key: "lessons", header: "Lessons", align: "right", sortValue: (t) => t.lessonsCompleted, cell: (t) => t.lessonsCompleted.toLocaleString("en-US") },
    { key: "rate", header: "Rate", align: "right", sortValue: (t) => t.hourlyRateCents, cell: (t) => `${formatCents(t.hourlyRateCents)}/hr` },
    { key: "plan", header: "Plan", sortValue: (t) => plan(t), cell: (t) => <Badge size="sm" tone={plan(t) === "free" ? "neutral" : "accent"}>{planName(plan(t))}</Badge> },
    { key: "featured", header: "Featured", sortValue: (t) => (t.featured ? 1 : 0), cell: (t) => (t.featured ? <span className="inline-flex items-center gap-1 text-ink-2"><Sparkles className="size-3.5 text-ink" aria-hidden /> Yes</span> : <span className="text-muted">No</span>) },
    { key: "modes", header: "Modes", cell: (t) => t.modes.map((m) => MODE_LABEL[m]).join(" · "), hideOnMobile: true },
  ];

  const open = tutors.find((t) => t.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Tutors"
        description="Every tutor profile with verification progress, reputation and plan. Ratings are recomputed from published reviews only."
        actions={
          <ExportButton
            filename="tutorlink-tutors"
            headers={["ID", "Name", "City", "State", "Identity", "Education", "Certification", "Background", "Rating", "Reviews", "Lessons", "Hourly rate (USD)", "Plan", "Featured", "Modes"]}
            rows={() =>
              rows.map((t) => [t.id, fullName(t), t.city, t.state, t.verification.identity, t.verification.education, t.verification.certification, t.verification.background, t.rating, t.reviewCount, t.lessonsCompleted, centsToDecimal(t.hourlyRateCents), planName(plan(t)), t.featured, t.modes.join(" ")])
            }
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Listed tutors" value={tutors.length} />
        <MiniStat label="Identity verified" value={stats.idVerified} hint={`${Math.round((stats.idVerified / Math.max(1, tutors.length)) * 100)}% of profiles`} />
        <MiniStat label="Checks in review" value={stats.inReview} hint={stats.inReview ? <TextLink href="/admin/verification">Open queue</TextLink> : "Queue is clear"} />
        <MiniStat label="Featured · paid plans" value={`${stats.featured} · ${stats.paid}`} />
      </div>

      <Toolbar summary={pluralize(rows.length, "tutor")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search name or city…" label="Search tutors" />
        <FilterSelect label="Verification" value={ver} onChange={setVer} options={VER_OPTIONS} />
        <FilterSelect label="Subject" value={subject} onChange={setSubject} options={subjectOptions} />
        <FilterSelect<ModeFilter>
          label="Teaching mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "Any mode" },
            { value: "online", label: "Online" },
            { value: "in_person", label: "In person" },
          ]}
        />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setVer("all");
            setSubject("all");
            setMode("all");
          }}
        />
      </Toolbar>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(t) => t.id}
        onRowClick={(t) => setOpenId(t.id)}
        pageSize={12}
        empty={<EmptyState icon={<UserRound />} title={filtered ? "No tutors match these filters" : "No tutor profiles yet"} description={filtered ? "Try another subject or verification state." : "Profiles appear after tutors finish onboarding."} />}
      />

      <TutorSheet tutor={open} onClose={() => setOpenId(null)} />
    </>
  );
}

function TutorSheet({ tutor: current, onClose }: { tutor: Tutor | null; onClose: () => void }) {
  const tutor = useSticky(current);
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        title={tutor ? fullName(tutor) : "Tutor"}
        description={tutor ? `${TUTOR_CATEGORY_LABEL[tutor.category]} · ${tutor.id}` : undefined}
        className="sm:w-[34rem]"
        footer={
          tutor ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="secondary">
                <Link href={`/tutors/${tutor.slug}`} target="_blank" rel="noopener">
                  Public profile <ExternalLink />
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      >
        {tutor && <TutorDetail tutor={tutor} />}
      </SheetContent>
    </Sheet>
  );
}

function TutorDetail({ tutor }: { tutor: Tutor }) {
  const requests = useApp((s) => s.verificationRequests);
  const subscriptions = useApp((s) => s.subscriptions);
  const bookings = useApp((s) => s.bookings);
  const ledger = useApp((s) => s.leadTransactions);
  const defaultFeeBps = useApp((s) => s.platformFeeBps);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const d = React.useMemo(() => {
    const mine = bookings.filter((b) => b.tutorId === tutor.id);
    return {
      requests: requests.filter((r) => r.tutorId === tutor.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
      upcoming: mine.filter((b) => ["pending", "confirmed"].includes(b.status) && new Date(b.startUtc).getTime() > now).length,
      completed: mine.filter((b) => b.status === "completed").length,
      total: mine.length,
      credits: ledger.filter((t) => t.tutorId === tutor.id).reduce((a, t) => a + t.delta, 0),
    };
  }, [requests, bookings, ledger, tutor.id, now]);

  const sub = subscriptions[tutor.id];
  const account = dir.tutorUser.get(tutor.id);
  // Mirrors the store: Starter tutors pay the configurable default; paid plans use their plan's rate.
  const commissionBps = !sub || sub.plan === "free" ? defaultFeeBps : (TUTOR_PLANS.find((p) => p.id === sub.plan)?.commissionBps ?? defaultFeeBps);

  return (
    <div className="divide-y divide-line">
      <div className="flex items-start gap-3.5 px-5 py-5">
        <Avatar name={fullName(tutor)} tone={tutor.tone} size="lg" verified={tutor.verification.identity === "verified"} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{fullName(tutor)}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{tutor.headline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StarRating rating={tutor.rating} count={tutor.reviewCount} />
            {tutor.featured && <Badge size="sm" tone="accent"><Sparkles /> Featured</Badge>}
          </div>
        </div>
      </div>

      <Section title="Verification" action={d.requests.some((r) => r.status === "submitted" || r.status === "under_review") ? <TextLink href="/admin/verification" className="text-[13px]">Queue</TextLink> : undefined}>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {KINDS.map((k) => {
            const latest = d.requests.find((r) => r.kind === k);
            return (
              <li key={k} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px]">
                <span className="min-w-0">
                  <span className="block text-ink">{VERIFICATION_LABEL[k]}</span>
                  {latest && (
                    <Link href={`/admin/verification?id=${latest.id}`} className="text-[12px] text-ink hover:underline">
                      Request {latest.id} · {formatDate(latest.submittedAt, tz)}
                    </Link>
                  )}
                </span>
                <VerificationStatusBadge status={tutor.verification[k]} />
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Profile">
        <Facts
          items={[
            { label: "Category", value: TUTOR_CATEGORY_LABEL[tutor.category] },
            { label: "Experience", value: pluralize(tutor.experienceYears, "year") },
            { label: "Location", value: `${tutor.city}, ${tutor.state} ${tutor.zip}` },
            { label: "Modes", value: tutor.modes.map((m) => (m === "in_person" ? `In person (${tutor.serviceRadiusMiles} mi)` : MODE_LABEL[m])).join(" · ") },
            { label: "Rate", value: `${formatCents(tutor.hourlyRateCents)}/hr` },
            { label: "Trial", value: tutor.trial.enabled ? `${formatDuration(tutor.trial.durationMin)} · ${tutor.trial.priceCents ? formatCents(tutor.trial.priceCents) : "Free"}` : "Not offered" },
            { label: "Booking", value: tutor.rules.requiresApproval ? "Requires approval" : "Instant booking" },
            { label: "Levels", value: tutor.levels.map((l) => LEVEL_LABEL[l]).join(", ") },
            { label: "Languages", value: tutor.languages.join(", ") },
            { label: "Response time", value: tutor.responseTimeHours === null ? "No data yet" : `~${tutor.responseTimeHours} h` },
            { label: "Joined", value: formatDate(tutor.joinedAt, tz) },
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tutor.subjects.map((s) => (
            <Badge key={s} size="sm">{subjectName(s)}</Badge>
          ))}
        </div>
      </Section>

      <Section title="Business">
        <Facts
          items={[
            { label: "Plan", value: sub ? `${planName(sub.plan)} · ${humanize(sub.status)}` : "Starter (no subscription record)" },
            ...(sub?.renewsAt ? [{ label: "Renews", value: formatDate(sub.renewsAt, tz) }] : []),
            { label: "Booking commission", value: <span className="tabular-nums">{formatBps(commissionBps)}</span> },
            { label: "Lead credit balance", value: <span className="tabular-nums">{d.credits}</span> },
            { label: "Lessons completed (profile)", value: tutor.lessonsCompleted.toLocaleString("en-US") },
            { label: "Bookings in this preview", value: `${d.total} total · ${d.completed} completed · ${d.upcoming} upcoming` },
          ]}
        />
      </Section>

      <Section title="Account">
        {account ? (
          <p className="text-[13.5px] text-ink-2">
            Signs in as <span className="font-medium text-ink">{account.email}</span> ·{" "}
            <TextLink href={`/admin/users?id=${account.id}`}>Open account</TextLink>
          </p>
        ) : (
          <p className="text-[13px] text-muted">This sample profile has no sign-in account in the preview, so account status can&apos;t be changed here.</p>
        )}
      </Section>

      <Section title="Verification requests">
        {d.requests.length === 0 ? (
          <p className="text-[13px] text-muted">No documents submitted through the platform.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {d.requests.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/verification?id=${r.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] hover:bg-canvas">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{VERIFICATION_LABEL[r.kind]}</span>
                    <span className="text-muted">
                      {pluralize(r.documents.length, "document")} · submitted {formatDate(r.submittedAt, tz)}
                    </span>
                  </span>
                  <VerificationStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
