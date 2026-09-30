"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Inbox, Info, MapPin, MessagesSquare, Undo2 } from "lucide-react";
import type { Application, ApplicationStatus, Requirement } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useNow } from "@/lib/store/hooks";
import { GRADE_LABEL, MODE_LABEL, subjectName } from "@/lib/data/catalog";
import { formatCents, formatDate, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Controls";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { NeedsTutorProfile } from "./shared";
import { useMyTutor } from "./hooks";
import { ACTIVE_APPLICATION, APPLICATION_PIPELINE, APPLICATION_STATUS_META, budgetLabel } from "./jobs-shared";

type Group = "all" | "active" | "hired" | "inactive";

const GROUP_OF = (s: ApplicationStatus): Exclude<Group, "all"> => (ACTIVE_APPLICATION.includes(s) ? "active" : s === "hired" ? "hired" : "inactive");

interface Row {
  app: Application;
  req: Requirement | undefined;
}

export function ApplicationsView() {
  const { tutor } = useMyTutor();
  const now = useNow(60_000);
  const applications = useApp((s) => s.applications);
  const requirements = useApp((s) => s.requirements);
  const setStatus = useApp((s) => s.setApplicationStatus);
  const [group, setGroup] = React.useState<Group>("all");
  const [status, setStatusFilter] = React.useState<"" | ApplicationStatus>("");
  const [withdraw, setWithdraw] = React.useState<Row | null>(null);

  const rows: Row[] = React.useMemo(
    () =>
      tutor
        ? applications
            .filter((a) => a.tutorId === tutor.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((app) => ({ app, req: requirements.find((r) => r.id === app.requirementId) }))
        : [],
    [applications, requirements, tutor],
  );

  if (!tutor) return <NeedsTutorProfile what="applications" />;

  const byGroup = (g: Group) => (g === "all" ? rows : rows.filter((r) => GROUP_OF(r.app.status) === g));
  const visible = byGroup(group).filter((r) => !status || r.app.status === status);
  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.app.status]: (acc[r.app.status] ?? 0) + 1 }), {});

  return (
    <div>
      <PageHeader
        title="My applications"
        description="Track every job you've applied to. Families update the status as they review tutors."
        actions={
          <Button asChild>
            <Link href="/dashboard/jobs">Find more jobs</Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Segmented
                label="Application group"
                value={group}
                onChange={(g) => {
                  setGroup(g);
                  setStatusFilter("");
                }}
                options={[
                  { value: "all", label: "All", count: rows.length },
                  { value: "active", label: "Active", count: byGroup("active").length },
                  { value: "hired", label: "Hired", count: byGroup("hired").length },
                  { value: "inactive", label: "Closed", count: byGroup("inactive").length },
                ]}
              />
            </div>
            <Select
              aria-label="Filter by status"
              className="sm:w-56"
              value={status}
              onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "")}
              placeholder="Any status"
              options={(Object.keys(APPLICATION_STATUS_META) as ApplicationStatus[])
                .filter((s) => group === "all" || GROUP_OF(s) === group)
                .map((s) => ({ value: s, label: `${APPLICATION_STATUS_META[s].label} (${statusCounts[s] ?? 0})` }))}
            />
          </div>

          {rows.length === 0 ? (
            <div data-spotlight className="rounded-xl border border-line bg-surface">
              <EmptyState icon={<Inbox />} title="No applications yet" description="Browse student jobs that match your subjects and send your first application." action={<Button asChild><Link href="/dashboard/jobs">Browse jobs</Link></Button>} />
            </div>
          ) : visible.length === 0 ? (
            <div data-spotlight className="rounded-xl border border-line bg-surface">
              <EmptyState
                compact
                icon={<Inbox />}
                title="No applications with this status"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setGroup("all");
                      setStatusFilter("");
                    }}
                  >
                    Show all applications
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {visible.map((r) => (
                  <motion.li key={r.app.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <ApplicationCard row={r} now={now} onWithdraw={() => setWithdraw(r)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <aside>
          <Card className="xl:sticky xl:top-20">
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Info className="size-4 text-ink" aria-hidden /> What each status means
                </span>
              }
            />
            <CardContent className="pt-4">
              <dl className="space-y-3">
                {(Object.keys(APPLICATION_STATUS_META) as ApplicationStatus[]).map((s) => (
                  <div key={s}>
                    <dt>
                      <Badge tone={APPLICATION_STATUS_META[s].tone} size="sm" dot>
                        {APPLICATION_STATUS_META[s].label}
                      </Badge>
                    </dt>
                    <dd className="mt-1 text-[13px] leading-snug text-muted">{APPLICATION_STATUS_META[s].description}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={!!withdraw}
        onOpenChange={(o) => !o && setWithdraw(null)}
        title="Withdraw this application?"
        description={withdraw?.req ? `“${withdraw.req.title}”. The family will no longer see your application. Credits spent on it aren't refunded.` : undefined}
        confirmLabel="Withdraw application"
        tone="danger"
        onConfirm={() => {
          if (!withdraw) return;
          const res = setStatus(withdraw.app.id, "withdrawn");
          if (!res.ok) toast.error(res.error);
          else toast.success("Application withdrawn");
          setWithdraw(null);
        }}
      />
    </div>
  );
}

function Pipeline({ status }: { status: ApplicationStatus }) {
  const idx = APPLICATION_PIPELINE.indexOf(status);
  if (idx < 0) return null;
  return (
    <ol className="flex items-center gap-1" aria-label={`Progress: ${APPLICATION_STATUS_META[status].label}, step ${idx + 1} of ${APPLICATION_PIPELINE.length}`}>
      {APPLICATION_PIPELINE.map((s, i) => (
        <li key={s} className="flex items-center gap-1" aria-hidden>
          <span className={cn("h-1.5 w-6 rounded-full transition-colors sm:w-8", i <= idx ? (status === "hired" ? "bg-success" : "bg-ink") : "bg-sunken")} title={APPLICATION_STATUS_META[s].label} />
        </li>
      ))}
    </ol>
  );
}

function ApplicationCard({ row, now, onWithdraw }: { row: Row; now: number; onWithdraw: () => void }) {
  const { app, req } = row;
  const [open, setOpen] = React.useState(false);
  const meta = APPLICATION_STATUS_META[app.status];
  const canWithdraw = ACTIVE_APPLICATION.includes(app.status);
  return (
    <article data-spotlight className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
            {req && (
              <Badge tone="neutral" size="sm">
                {subjectName(req.subject)} · {GRADE_LABEL[req.grade]}
              </Badge>
            )}
          </div>
          <h2 className="mt-2 text-[15.5px] font-semibold leading-snug tracking-tight text-ink">
            {req ? (
              <Link href={`/tutor-jobs/${req.id}`} className="hover:text-ink">
                {req.title}
              </Link>
            ) : (
              "This job is no longer available"
            )}
          </h2>
          {req && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {req.city}, {req.state}
              </span>
              <span>{req.modes.map((m) => MODE_LABEL[m]).join(" or ")}</span>
              <span className="tabular-nums">Budget {budgetLabel(req)}</span>
              {req.status !== "published" && <span className="font-medium text-ink-2">Job {req.status}</span>}
            </p>
          )}
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[12px] text-muted">Your rate</p>
          <p className="text-lg font-semibold tabular-nums text-ink">{formatCents(app.proposedRateCents)}/hr</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg bg-canvas px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-ink-2">{meta.description}</p>
        <Pipeline status={app.status} />
      </div>

      <div className="mt-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
          {open ? "Hide your message" : "Show your message"}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden whitespace-pre-line pt-2 text-sm leading-relaxed text-ink-2">
              {app.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3.5 sm:flex-row sm:items-center">
        <p className="flex-1 text-[12.5px] text-muted">
          Applied {formatDate(app.createdAt)} · updated {formatRelative(app.updatedAt, now)}
        </p>
        <div className="flex flex-wrap gap-2">
          {req && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/tutor-jobs/${req.id}`}>View job</Link>
            </Button>
          )}
          {["contacted", "trial_requested", "hired", "shortlisted"].includes(app.status) && (
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/messages">
                <MessagesSquare /> Messages
              </Link>
            </Button>
          )}
          {canWithdraw && (
            <Button variant="danger-outline" size="sm" onClick={onWithdraw}>
              <Undo2 /> Withdraw
            </Button>
          )}
          {app.status === "hired" && (
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-success">
              <Check className="size-4" aria-hidden /> Hired
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
