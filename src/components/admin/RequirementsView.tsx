"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink, Paperclip } from "lucide-react";
import type { Application, ApplicationStatus, Requirement, RequirementStatus } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { GRADE_LABEL, MODE_LABEL, SUBJECTS, subjectName } from "@/lib/data/catalog";
import { ROLE_LABEL } from "@/lib/data/users";
import { formatCents, formatDate, formatDateTime, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, PersonCell, RowOpen, SearchInput, Section, StatusPill, TextLink, Timeline, Toolbar, centsToDecimal,
  humanize, matches, useDirectory, useSticky, useUrlParam,
} from "./kit";

type TabKey = "all" | RequirementStatus;
const TABS: { value: TabKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
];

const REQ_TONE: Record<RequirementStatus, "success" | "neutral" | "warning"> = { published: "success", draft: "neutral", paused: "warning", closed: "neutral" };

const APP_TONE: Record<ApplicationStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  applied: "accent",
  viewed: "neutral",
  shortlisted: "accent",
  contacted: "accent",
  trial_requested: "warning",
  hired: "success",
  rejected: "danger",
  withdrawn: "neutral",
  closed: "neutral",
};

type ModeFilter = "all" | "online" | "in_person";

function budget(r: Requirement) {
  return `${formatCents(r.budgetMinCents)}–${formatCents(r.budgetMaxCents)}/hr`;
}

export function RequirementsView() {
  return (
    <PermissionGate permission="users.read">
      <RequirementsInner />
    </PermissionGate>
  );
}

function RequirementsInner() {
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const [openId, setOpenId] = useUrlParam("id");
  const [tab, setTab] = React.useState<TabKey>("all");
  const [q, setQ] = React.useState("");
  const [subject, setSubject] = React.useState("all");
  const [mode, setMode] = React.useState<ModeFilter>("all");

  const appCount = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const a of applications) if (a.status !== "withdrawn") m.set(a.requirementId, (m.get(a.requirementId) ?? 0) + 1);
    return m;
  }, [applications]);

  const subjectOptions = React.useMemo(() => {
    const used = new Set(requirements.map((r) => r.subject).filter(Boolean));
    return [{ value: "all", label: "Any subject" }, ...SUBJECTS.filter((s) => used.has(s.slug)).map((s) => ({ value: s.slug, label: s.name })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [requirements]);

  const searched = React.useMemo(
    () =>
      requirements.filter(
        (r) => matches(q, r.title, dir.name(r.ownerId), r.city, r.id, subjectName(r.subject)) && (subject === "all" || r.subject === subject) && (mode === "all" || r.modes.includes(mode)),
      ),
    [requirements, q, subject, mode, dir],
  );
  const counts = React.useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, t.value === "all" ? searched.length : searched.filter((r) => r.status === t.value).length])) as Record<TabKey, number>, [searched]);
  const rows = React.useMemo(() => searched.filter((r) => tab === "all" || r.status === tab).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [searched, tab]);
  const filtered = q.trim() !== "" || subject !== "all" || mode !== "all";

  const columns: Column<Requirement>[] = [
    {
      key: "title",
      header: "Requirement",
      sortValue: (r) => r.title,
      cell: (r) => <PersonCell name={<RowOpen onOpen={() => setOpenId(r.id)} label={`Open requirement ${r.title || r.id}`}>{r.title || "Untitled draft"}</RowOpen>} sub={`${subjectName(r.subject) || "No subject"} · ${GRADE_LABEL[r.grade] ?? r.grade}`} className="max-w-72" />,
    },
    {
      key: "owner",
      header: "Posted by",
      sortValue: (r) => dir.name(r.ownerId),
      cell: (r) => {
        const u = dir.userById.get(r.ownerId);
        return <PersonCell name={dir.name(r.ownerId)} sub={u ? ROLE_LABEL[u.role] : undefined} />;
      },
    },
    { key: "budget", header: "Budget", sortValue: (r) => r.budgetMaxCents, cell: (r) => <span className="tabular-nums">{budget(r)}</span>, hideOnMobile: true },
    { key: "mode", header: "Mode", cell: (r) => r.modes.map((m) => MODE_LABEL[m]).join(" · "), hideOnMobile: true },
    { key: "apps", header: "Applications", align: "right", sortValue: (r) => appCount.get(r.id) ?? 0, cell: (r) => appCount.get(r.id) ?? 0 },
    { key: "updated", header: "Updated", sortValue: (r) => r.updatedAt, cell: (r) => <span className="tabular-nums">{formatDate(r.updatedAt, tz)}</span> },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <StatusPill tone={REQ_TONE[r.status]}>{humanize(r.status)}</StatusPill> },
  ];

  const open = requirements.find((r) => r.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Requirements"
        description="Tutor jobs posted by students and parents, with the applications they received. Owners manage their own posts; problems are handled through reports."
        actions={
          <ExportButton
            filename="tutorlink-requirements"
            headers={["ID", "Title", "Subject", "Grade", "Owner", "Status", "Modes", "City", "State", "Budget min (USD)", "Budget max (USD)", "Applications", "Created", "Updated"]}
            rows={() => rows.map((r) => [r.id, r.title, subjectName(r.subject), r.grade, dir.name(r.ownerId), r.status, r.modes.join(" "), r.city, r.state, centsToDecimal(r.budgetMinCents), centsToDecimal(r.budgetMaxCents), appCount.get(r.id) ?? 0, r.createdAt, r.updatedAt])}
          />
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Filter by status">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} count={counts[t.value]}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <Toolbar summary={pluralize(rows.length, "requirement")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search title, owner or city…" label="Search requirements" />
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
                setSubject("all");
                setMode("all");
              }}
            />
          </Toolbar>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpenId(r.id)}
            pageSize={12}
            empty={<EmptyState icon={<ClipboardList />} title={filtered ? "No requirements match these filters" : "No requirements here"} description={filtered ? "Try another subject or clear the search." : "Requirements appear when students and parents post them."} />}
          />
        </TabsContent>
      </Tabs>

      <RequirementSheet requirement={open} onClose={() => setOpenId(null)} />
    </>
  );
}

function RequirementSheet({ requirement: current, onClose }: { requirement: Requirement | null; onClose: () => void }) {
  const r = useSticky(current);
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        title={r ? r.title || "Untitled draft" : "Requirement"}
        description={r ? `${subjectName(r.subject) || "No subject"} · ${r.id}` : undefined}
        className="sm:w-[34rem]"
        footer={
          r && r.status !== "draft" ? (
            <div className="flex justify-end">
              <Button asChild variant="secondary">
                <Link href={`/tutor-jobs/${r.id}`} target="_blank" rel="noopener">
                  Public job page <ExternalLink />
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      >
        {r && <RequirementDetail r={r} />}
      </SheetContent>
    </Sheet>
  );
}

function RequirementDetail({ r }: { r: Requirement }) {
  const applications = useApp((s) => s.applications);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const apps = React.useMemo(() => applications.filter((a) => a.requirementId === r.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [applications, r.id]);
  const owner = dir.userById.get(r.ownerId);
  const child = r.childId ? dir.children.find((c) => c.id === r.childId) : undefined;

  const timeline = [
    { key: "created", title: "Created", meta: formatDateTime(r.createdAt, tz), tone: "default" as const },
    ...(r.publishedAt ? [{ key: "published", title: "Published", meta: formatDateTime(r.publishedAt, tz), tone: "accent" as const }] : []),
    ...(r.updatedAt !== r.createdAt ? [{ key: "updated", title: `Last updated · ${humanize(r.status)}`, meta: formatDateTime(r.updatedAt, tz), tone: "default" as const }] : []),
  ];

  return (
    <div className="divide-y divide-line">
      <Section title="Overview">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusPill tone={REQ_TONE[r.status]}>{humanize(r.status)}</StatusPill>
          {r.draftStep !== undefined && r.status === "draft" && <Badge size="sm">Draft · step {r.draftStep}</Badge>}
        </div>
        <Facts
          items={[
            {
              label: "Posted by",
              value: owner ? (
                <TextLink href={`/admin/users?id=${owner.id}`}>
                  {dir.name(owner.id)} · {ROLE_LABEL[owner.role]}
                </TextLink>
              ) : (
                dir.name(r.ownerId)
              ),
            },
            ...(child ? [{ label: "For", value: `${child.firstName} · grade ${child.grade}` }] : []),
            { label: "Grade", value: GRADE_LABEL[r.grade] ?? r.grade },
            { label: "Budget", value: budget(r) },
            { label: "Modes", value: r.modes.map((m) => MODE_LABEL[m]).join(" · ") },
            { label: "Location", value: [r.city, r.state, r.zip].filter(Boolean).join(", ") || "—" },
            { label: "Schedule", value: `${pluralize(r.sessionsPerWeek, "session")}/week${r.days.length ? ` · ${r.days.join(", ")}` : ""}${r.timesOfDay.length ? ` · ${r.timesOfDay.join(", ")}` : ""}` },
            { label: "Languages", value: r.languages.join(", ") || "—" },
            ...(r.minExperienceYears ? [{ label: "Min. experience", value: pluralize(r.minExperienceYears, "year") }] : []),
            ...(r.learningSupport?.length ? [{ label: "Learning support", value: r.learningSupport.join(", ") }] : []),
          ]}
        />
      </Section>

      <Section title="Objectives & details">
        <div className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
          <p>{r.objectives || <span className="text-muted">No objectives yet.</span>}</p>
          {r.details && <p>{r.details}</p>}
          {r.preferences && (
            <p>
              <span className="font-medium text-ink">Preferences: </span>
              {r.preferences}
            </p>
          )}
        </div>
        {r.attachments?.length ? (
          <ul className="mt-3 space-y-1.5 text-[13px]">
            {r.attachments.map((a) => (
              <li key={a.name} className="flex items-center gap-2 text-ink-2">
                <Paperclip className="size-3.5 text-muted" aria-hidden /> {a.name} <span className="text-muted">· {a.sizeKb} KB</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title={`Applications (${apps.length})`}>
        {apps.length === 0 ? (
          <p className="text-[13px] text-muted">{r.status === "draft" ? "Drafts aren't visible to tutors yet." : "No tutors have applied yet."}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {apps.map((a) => (
              <ApplicationRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Timeline">
        <Timeline items={timeline} />
      </Section>
    </div>
  );
}

function ApplicationRow({ a }: { a: Application }) {
  const dir = useDirectory();
  const tz = useViewerTimezone();
  return (
    <li className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/tutors?id=${a.tutorId}`} className="block truncate text-[13.5px] font-medium text-ink hover:text-ink hover:underline">
            {dir.name(a.tutorId)}
          </Link>
          <p className="text-[12px] text-muted">
            <span className="tabular-nums">{formatCents(a.proposedRateCents)}/hr</span> · applied {formatDate(a.createdAt, tz)}
          </p>
        </div>
        <StatusPill tone={APP_TONE[a.status]}>{humanize(a.status)}</StatusPill>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-2">{a.message}</p>
    </li>
  );
}
