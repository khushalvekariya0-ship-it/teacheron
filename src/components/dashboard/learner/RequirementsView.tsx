"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight, CircleSlash, ClipboardList, Eye, Monitor, MoreHorizontal, Pause, Pencil, Play, Plus, Send, Trash2, Users as UsersIcon,
} from "lucide-react";
import type { Requirement, RequirementStatus, User } from "@/lib/types";
import { PageHeader, RoleGate } from "@/components/dashboard/Shell";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/Overlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { toast } from "@/components/ui/Toast";
import { useApp, type Result } from "@/lib/store";
import { useNow, useSession } from "@/lib/store/hooks";
import { subjectName, GRADE_LABEL, MODE_LABEL } from "@/lib/data/catalog";
import { formatCents, formatRelative, pluralize } from "@/lib/format";
import { useMyChildren } from "./data";
import { RequirementStatusBadge, isVisibleApplication } from "./meta";

type TabKey = "all" | RequirementStatus;

const TABS: { value: TabKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
];

const EMPTY_COPY: Record<TabKey, { title: string; description: string }> = {
  all: { title: "Post your first requirement", description: "Describe the subject, schedule and budget. Qualified tutors apply, and you choose who to talk to." },
  draft: { title: "No drafts", description: "Requirements you start but don't publish are saved here." },
  published: { title: "Nothing published", description: "Publish a requirement so tutors can find it and apply." },
  paused: { title: "Nothing paused", description: "Pause a published requirement to stop new applications for a while." },
  closed: { title: "Nothing closed", description: "Close a requirement once you've found the right tutor." },
};

type Pending = { kind: "close" | "delete"; req: Requirement } | null;

export function RequirementsView() {
  return (
    <RoleGate roles={["student", "parent"]}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const me = useSession() as User;
  const now = useNow(60_000);
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const publishRequirement = useApp((s) => s.publishRequirement);
  const setRequirementStatus = useApp((s) => s.setRequirementStatus);
  const deleteRequirement = useApp((s) => s.deleteRequirement);
  const children = useMyChildren(me);
  const [tab, setTab] = React.useState<TabKey>("all");
  const [pending, setPending] = React.useState<Pending>(null);

  const mine = React.useMemo(() => requirements.filter((r) => r.ownerId === me.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [requirements, me.id]);
  const stats = React.useMemo(() => {
    const m = new Map<string, { total: number; fresh: number; hired: number }>();
    for (const a of applications) {
      if (!isVisibleApplication(a.status)) continue;
      const s = m.get(a.requirementId) ?? { total: 0, fresh: 0, hired: 0 };
      s.total++;
      if (a.status === "applied") s.fresh++;
      if (a.status === "hired") s.hired++;
      m.set(a.requirementId, s);
    }
    return m;
  }, [applications]);
  const counts = React.useMemo(() => {
    const c: Record<TabKey, number> = { all: mine.length, draft: 0, published: 0, paused: 0, closed: 0 };
    for (const r of mine) c[r.status]++;
    return c;
  }, [mine]);

  const childName = (id?: string) => (id ? children.find((c) => c.id === id)?.firstName : undefined);

  const act = (res: Result<unknown>, success: string) => {
    if (!res.ok) toast.error(res.error);
    else toast.success(success);
    return res.ok;
  };

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "close") act(setRequirementStatus(pending.req.id, "closed"), "Requirement closed");
    else act(deleteRequirement(pending.req.id), "Requirement deleted");
    setPending(null);
  };

  return (
    <div>
      <PageHeader
        title="My requirements"
        description="Tell tutors what you need. Review who applies, message them and book a trial when you're ready."
        actions={
          <Button asChild>
            <Link href="/post-requirement">
              <Plus /> Post a requirement
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Filter requirements by status">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} count={counts[t.value]}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => {
          const list = t.value === "all" ? mine : mine.filter((r) => r.status === t.value);
          return (
            <TabsContent key={t.value} value={t.value}>
              {list.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<ClipboardList />}
                    title={EMPTY_COPY[t.value].title}
                    description={EMPTY_COPY[t.value].description}
                    action={
                      <Button asChild size="sm">
                        <Link href="/post-requirement">
                          <Plus /> Post a requirement
                        </Link>
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {list.map((r, i) => {
                      const s = stats.get(r.id) ?? { total: 0, fresh: 0, hired: 0 };
                      const kid = childName(r.childId);
                      return (
                        <motion.li
                          key={r.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 6) * 0.04 } }}
                          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                        >
                          <RequirementRow
                            req={r}
                            stats={s}
                            childName={kid}
                            now={now}
                            onPublish={() => act(publishRequirement(r.id), "Requirement published — tutors can now apply")}
                            onPause={() => act(setRequirementStatus(r.id, "paused"), "Requirement paused")}
                            onResume={() => act(setRequirementStatus(r.id, "published"), "Requirement resumed")}
                            onClose={() => setPending({ kind: "close", req: r })}
                            onDelete={() => setPending({ kind: "delete", req: r })}
                          />
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <ConfirmDialog
        open={pending?.kind === "close"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Close this requirement?"
        description="Tutors will no longer be able to apply, and any open applications will be marked closed. This can't be undone."
        confirmLabel="Close requirement"
        onConfirm={confirm}
      />
      <ConfirmDialog
        open={pending?.kind === "delete"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Delete this requirement?"
        description={`“${pending?.req.title || "Untitled draft"}” and its applications will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirm}
      />
    </div>
  );
}

function RequirementRow({
  req,
  stats,
  childName,
  now,
  onPublish,
  onPause,
  onResume,
  onClose,
  onDelete,
}: {
  req: Requirement;
  stats: { total: number; fresh: number; hired: number };
  childName?: string;
  now: number;
  onPublish: () => void;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const href = `/dashboard/requirements/${req.id}`;
  const editHref = `/post-requirement?id=${encodeURIComponent(req.id)}`;
  const meta = [
    req.subject ? subjectName(req.subject) : "No subject yet",
    GRADE_LABEL[req.grade],
    childName ? `For ${childName}` : null,
    req.modes.map((m) => MODE_LABEL[m]).join(" or "),
  ].filter(Boolean);

  return (
    <Card className="transition-colors duration-200 hover:border-ink">
      <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 text-[15px] font-semibold tracking-tight text-ink">
              <Link href={href} className="hover:text-ink">
                {req.title || "Untitled draft"}
              </Link>
            </h2>
            <RequirementStatusBadge status={req.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
            {meta.map((m, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span aria-hidden className="text-subtle">·</span>}
                <span>{m}</span>
              </React.Fragment>
            ))}
          </p>
          <p className="mt-1 text-[12.5px] text-muted">
            Budget {formatCents(req.budgetMinCents)}–{formatCents(req.budgetMaxCents)}/hr · Updated {formatRelative(req.updatedAt, now)}
          </p>
        </div>

        <div className="flex items-center gap-4 md:gap-5">
          <Link href={href} className="group flex min-w-28 items-center gap-2.5 rounded-lg py-1 text-[13px]" aria-label={`${pluralize(stats.total, "application")}${stats.fresh ? `, ${stats.fresh} new` : ""}. View`}>
            <span className="grid size-9 place-items-center rounded-lg border border-line bg-canvas text-ink-2 group-hover:border-line-strong">
              <UsersIcon className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold tabular-nums text-ink">{pluralize(stats.total, "application")}</span>
              <span className="block text-[12px] text-muted">{stats.hired ? `${stats.hired} hired` : stats.fresh ? <span className="font-medium text-ink">{stats.fresh} new</span> : req.status === "draft" ? "Not published" : "No new"}</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {req.status === "draft" ? (
              <>
                <Button asChild variant="secondary" size="sm">
                  <Link href={editHref}>
                    <Pencil /> Edit
                  </Link>
                </Button>
                <Button size="sm" onClick={onPublish}>
                  <Send /> Publish
                </Button>
              </>
            ) : req.status === "paused" ? (
              <Button variant="secondary" size="sm" onClick={onResume}>
                <Play /> Resume
              </Button>
            ) : (
              <Button asChild variant={stats.fresh ? "primary" : "secondary"} size="sm">
                <Link href={href}>
                  {stats.total ? "Review" : "View"} <ArrowRight />
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${req.title || "this draft"}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link href={href}>
                    <Eye /> View details
                  </Link>
                </DropdownMenuItem>
                {req.status !== "closed" && (
                  <DropdownMenuItem asChild>
                    <Link href={editHref}>
                      <Pencil /> Edit
                    </Link>
                  </DropdownMenuItem>
                )}
                {req.status === "draft" && (
                  <DropdownMenuItem onSelect={onPublish}>
                    <Send /> Publish
                  </DropdownMenuItem>
                )}
                {req.status === "published" && (
                  <DropdownMenuItem onSelect={onPause}>
                    <Pause /> Pause applications
                  </DropdownMenuItem>
                )}
                {req.status === "paused" && (
                  <DropdownMenuItem onSelect={onResume}>
                    <Play /> Resume
                  </DropdownMenuItem>
                )}
                {(req.status === "published" || req.status === "paused") && (
                  <DropdownMenuItem onSelect={onClose}>
                    <CircleSlash /> Close requirement
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem tone="danger" onSelect={onDelete}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {req.status === "draft" && (
        <div className="flex items-center gap-2 border-t border-line bg-canvas px-4 py-2.5 text-[12.5px] text-muted sm:px-5">
          <Monitor className="size-3.5 text-subtle" aria-hidden /> Only you can see drafts. Publish when it&apos;s ready and tutors can apply.
        </div>
      )}
    </Card>
  );
}
