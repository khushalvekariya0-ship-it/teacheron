"use client";

import * as React from "react";
import Link from "next/link";
import type { ClassRestriction, ContactFlag, SafetyAppeal } from "@/lib/types";
import type { ContactSafety } from "@/lib/safety-settings";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { formatDateTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Controls";
import { Input, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { FilterSelect, MiniStat, PersonCell, StatusPill, Toolbar, formatAge, useDirectory, useStaff } from "./kit";
import { Gavel, LockOpen, ShieldCheck } from "lucide-react";

/*
 * Admin → Chat safety: the personal-information protection panels. Overview (totals by who, where and
 * how it was found, day by day and lesson by lesson), class restrictions (audio pauses, lift early),
 * appeals (accept or reject), and the settings. Only masked notes are shown: the contact details
 * themselves are never stored.
 */

const DOC = /\.(pdf|docx|txt)$/i;

/** Which part of the protection caught it (for the totals). */
export function flagArea(f: ContactFlag): "chat" | "voice" | "image" | "document" | "class picture" | "other" {
  if (f.source === "speech") return "voice";
  if (f.source === "board" || f.source === "screen" || f.source === "camera") return "class picture";
  if (f.source === "text") return f.channel === "chat" ? "chat" : "other";
  if (f.fileName && DOC.test(f.fileName)) return "document";
  return "image";
}

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All kept" },
] as const;
type Range = (typeof RANGES)[number]["value"];

export function ProtectionOverview({ flags, restrictions, appeals, onOpenPerson }: { flags: ContactFlag[]; restrictions: ClassRestriction[]; appeals: SafetyAppeal[]; onOpenPerson: (id: string) => void }) {
  const dir = useDirectory();
  const now = useNow(60_000);
  const [range, setRange] = React.useState<Range>("30");
  const from = range === "all" ? 0 : now - Number(range) * 86_400_000;
  const inRange = React.useMemo(() => flags.filter((f) => new Date(f.createdAt).getTime() >= from), [flags, from]);
  const tutorOf = (id: string) => {
    const u = dir.userById.get(id);
    return u?.role === "tutor" || !!u?.tutorId;
  };
  const count = (pred: (f: ContactFlag) => boolean) => inRange.filter(pred).length;
  const days = React.useMemo(() => {
    const n = range === "all" ? 30 : Math.min(Number(range), 30);
    const out: { day: string; n: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ day: d, n: inRange.filter((f) => f.createdAt.slice(0, 10) === d).length });
    }
    return out;
  }, [inRange, now, range]);
  const peak = Math.max(1, ...days.map((d) => d.n));
  const lessons = React.useMemo(() => {
    const by = new Map<string, ContactFlag[]>();
    for (const f of inRange) if (f.channel === "lesson" && f.contextId) by.set(f.contextId, [...(by.get(f.contextId) ?? []), f]);
    return [...by.entries()].map(([id, list]) => ({ id, list, people: [...new Set(list.map((f) => f.userId))] })).sort((a, b) => b.list.length - a.list.length).slice(0, 8);
  }, [inRange]);
  const pausesInRange = restrictions.filter((r) => new Date(r.createdAt).getTime() >= from);
  const repeat = React.useMemo(() => {
    const by = new Map<string, number>();
    for (const f of inRange) if (f.status !== "dismissed") by.set(f.userId, (by.get(f.userId) ?? 0) + 1);
    return [...by.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [inRange]);

  return (
    <div className="space-y-6" data-protection-overview="">
      <Toolbar summary={pluralize(inRange.length, "catch", "catches")}>
        <FilterSelect label="Period" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
      </Toolbar>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="All catches" value={inRange.length} />
        <MiniStat label="By students and parents" value={count((f) => !tutorOf(f.userId))} />
        <MiniStat label="By tutors" value={count((f) => tutorOf(f.userId))} />
        <MiniStat label="Waiting for review" value={count((f) => f.status === "open")} tone={count((f) => f.status === "open") ? "warning" : undefined} />
        <MiniStat label="Chat" value={count((f) => flagArea(f) === "chat")} />
        <MiniStat label="Voice (in class)" value={count((f) => flagArea(f) === "voice")} />
        <MiniStat label="Pictures and screenshots" value={count((f) => flagArea(f) === "image")} />
        <MiniStat label="PDF and documents" value={count((f) => flagArea(f) === "document")} />
        <MiniStat label="Whiteboard, screen, camera" value={count((f) => flagArea(f) === "class picture")} />
        <MiniStat label="QR codes" value={count((f) => f.detector === "qr")} />
        <MiniStat label="Asked to talk outside" value={count((f) => f.kinds.includes("request"))} />
        <MiniStat label="Audio pauses" value={pausesInRange.length} hint={`${appeals.filter((a) => a.status === "open").length} appeals open`} />
      </div>

      <section aria-labelledby="per-day" className="rounded-xl border border-line bg-surface p-4">
        <h3 id="per-day" className="mb-3 text-sm font-semibold">Day by day</h3>
        <ul className="space-y-1">
          {days.map((d) => (
            <li key={d.day} className="flex items-center gap-3 text-[12.5px]">
              <span className="w-20 shrink-0 tabular-nums text-muted">{d.day.slice(5)}</span>
              <span className="h-2.5 rounded-sm bg-brand" style={{ width: `${(d.n / peak) * 70}%`, minWidth: d.n ? 4 : 0 }} aria-hidden />
              <span className="tabular-nums text-ink-2">{d.n}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="by-lesson" className="rounded-xl border border-line bg-surface p-4">
          <h3 id="by-lesson" className="mb-3 text-sm font-semibold">Lessons with the most catches</h3>
          {lessons.length === 0 ? (
            <p className="text-[13px] text-muted">None in this period.</p>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {lessons.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <Link href={`/admin/bookings?id=${encodeURIComponent(l.id)}`} className="font-medium text-ink underline-offset-2 hover:underline">
                      {l.id}
                    </Link>
                    <span className="block truncate text-muted">{l.people.map((p) => dir.name(p)).join(", ")}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold">{l.list.length}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="repeat" className="rounded-xl border border-line bg-surface p-4">
          <h3 id="repeat" className="mb-3 text-sm font-semibold">Repeated (3 or more in this period)</h3>
          {repeat.length === 0 ? (
            <p className="text-[13px] text-muted">Nobody.</p>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {repeat.map(([id, n]) => (
                <li key={id} className="flex items-center justify-between gap-3 py-2">
                  <button type="button" onClick={() => onOpenPerson(id)} className="min-w-0 truncate text-left font-medium text-ink underline-offset-2 hover:underline">
                    {dir.name(id)}
                  </button>
                  <span className="shrink-0 tabular-nums font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── Class restrictions ─────────────────────────────────────────────────────── */

export function RestrictionsPanel({ restrictions }: { restrictions: ClassRestriction[] }) {
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(30_000);
  const { can } = useStaff();
  const refresh = useApp((s) => s.refresh);
  const [busy, setBusy] = React.useState<string | null>(null);
  const state = (r: ClassRestriction) => (r.liftedAt ? (r.liftedBy && r.liftedBy !== "system" ? "lifted" : "ended") : new Date(r.endsAt).getTime() > now ? "active" : "ended");
  const lift = async (r: ClassRestriction) => {
    setBusy(r.id);
    try {
      const res = await fetch("/api/classroom/lift", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restrictionId: r.id }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) toast.error(data.error ?? "That didn't work. Try again.");
      else toast.success("Audio restored", { description: `${dir.name(r.userId)} can be heard again.` });
      await refresh();
    } finally {
      setBusy(null);
    }
  };
  const columns: Column<ClassRestriction>[] = [
    { key: "who", header: "Person", sortValue: (r) => dir.name(r.userId), cell: (r) => <PersonCell name={dir.name(r.userId)} sub={r.reason} /> },
    { key: "lesson", header: "Lesson", cell: (r) => <Link href={`/admin/bookings?id=${encodeURIComponent(r.bookingId)}`} className="text-ink-2 underline-offset-2 hover:underline">{r.bookingId}</Link>, hideOnMobile: true },
    { key: "when", header: "Paused", sortValue: (r) => r.startsAt, cell: (r) => <span className="whitespace-nowrap tabular-nums text-ink-2">{formatDateTime(r.startsAt, tz)} → {formatDateTime(r.liftedAt ?? r.endsAt, tz)}</span> },
    {
      key: "state",
      header: "Now",
      sortValue: (r) => state(r),
      cell: (r) => {
        const s = state(r);
        return <StatusPill tone={s === "active" ? "danger" : s === "lifted" ? "accent" : "neutral"}>{s === "active" ? "Paused" : s === "lifted" ? `Lifted by ${dir.name(r.liftedBy)}` : "Ended"}</StatusPill>;
      },
    },
    {
      key: "act",
      header: "",
      cell: (r) =>
        state(r) === "active" && can("reports.moderate") ? (
          <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => void lift(r)}>
            <LockOpen /> Restore audio now
          </Button>
        ) : null,
    },
  ];
  return (
    <DataTable
      rows={restrictions}
      columns={columns}
      rowKey={(r) => r.id}
      mobileTitle="who"
      pageSize={15}
      empty={<EmptyState icon={<ShieldCheck />} title="No class restrictions" description="When contact details are shared again in a lesson, the person's audio is paused for a few minutes; those pauses are listed here." />}
    />
  );
}

/* ─── Appeals ────────────────────────────────────────────────────────────────── */

export function AppealsPanel({ appeals, flags, restrictions }: { appeals: SafetyAppeal[]; flags: ContactFlag[]; restrictions: ClassRestriction[] }) {
  const dir = useDirectory();
  const now = useNow(60_000);
  const { can } = useStaff();
  const decide = useApp((s) => s.decideAppeal);
  const refresh = useApp((s) => s.refresh);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [show, setShow] = React.useState<"open" | "all">("open");
  const list = appeals.filter((a) => show === "all" || a.status === "open");
  const act = async (a: SafetyAppeal, accept: boolean) => {
    setBusy(a.id);
    try {
      const note = notes[a.id] ?? "";
      const restriction = a.restrictionId ? restrictions.find((r) => r.id === a.restrictionId) : undefined;
      // Accepting a class pause restores the audio (which also answers the appeal).
      if (accept && restriction && !restriction.liftedAt && new Date(restriction.endsAt).getTime() > Date.now()) {
        const res = await fetch("/api/classroom/lift", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restrictionId: restriction.id, note }) });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) return void toast.error(data.error ?? "That didn't work.");
        await refresh();
        return void toast.success("Accepted: audio restored");
      }
      const r = await decide(a.id, accept, note);
      if (!r.ok) return void toast.error(r.error);
      toast.success(accept ? "Accepted: it no longer counts" : "Rejected: it stays");
    } finally {
      setBusy(null);
    }
  };
  if (!appeals.length) return <EmptyState icon={<Gavel />} title="No appeals" description="People can ask for a review when they think a blocked message, file or class pause was a mistake." />;
  return (
    <div>
      <Toolbar summary={pluralize(list.length, "appeal")}>
        <FilterSelect label="Show" value={show} onChange={setShow} options={[{ value: "open", label: "Waiting" }, { value: "all", label: "All" }]} />
      </Toolbar>
      <ul className="space-y-3" data-appeals="">
        {list.map((a) => {
          const flag = a.flagId ? flags.find((f) => f.id === a.flagId) : undefined;
          const restriction = a.restrictionId ? restrictions.find((r) => r.id === a.restrictionId) : undefined;
          return (
            <li key={a.id} className="rounded-xl border border-line bg-surface p-4 text-[13px]" data-appeal={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">{dir.name(a.userId)}</span>
                <span className="text-muted">{formatAge(now - new Date(a.createdAt).getTime())} ago</span>
              </div>
              <p className="mt-1 text-ink-2">
                {restriction ? `Audio pause in lesson ${restriction.bookingId}: ${restriction.reason}` : flag ? `Blocked ${flag.source === "file" ? "file" : "message"}: ${flag.excerpt}` : "The item was deleted."}
              </p>
              {a.note && <p className="mt-1 italic text-ink">“{a.note}”</p>}
              {a.status === "open" ? (
                can("reports.moderate") && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input value={notes[a.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} placeholder="Note to them (optional)" maxLength={500} className="min-w-0 flex-1" aria-label="Note to them" />
                    <Button size="sm" disabled={busy === a.id} onClick={() => void act(a, true)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" disabled={busy === a.id} onClick={() => void act(a, false)}>
                      Reject
                    </Button>
                  </div>
                )
              ) : (
                <p className="mt-2">
                  <StatusPill tone={a.status === "accepted" ? "success" : "neutral"}>{a.status === "accepted" ? "Accepted" : "Rejected"}</StatusPill>
                  <span className="ml-2 text-muted">by {dir.name(a.decidedBy)}{a.decisionNote ? `: ${a.decisionNote}` : ""}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── Settings ───────────────────────────────────────────────────────────────── */

const SWITCHES: { key: keyof ContactSafety; label: string; hint: string }[] = [
  { key: "chat", label: "Check messages", hint: "Messages, homework and lesson notes." },
  { key: "requests", label: "Catch requests to talk outside TutorLink", hint: "“Send me your number”, “બહાર વાત કરીએ”, “pay me on GPay” …" },
  { key: "voice", label: "Check speech in class", hint: "Each person's own browser (Chrome / Edge send the audio to Google / Microsoft to recognise it)." },
  { key: "voiceOnPhones", label: "Also check speech on phones", hint: "Phones may beep when listening restarts and can lose the call's microphone." },
  { key: "images", label: "Read pictures", hint: "Chat and homework images, whiteboard pictures and drawings, shared screens." },
  { key: "screenShare", label: "Protect screen sharing", hint: "A shared screen is checked before the others see it: contact details are blacked out, or the share pauses. Needs “Read pictures”." },
  { key: "whiteboard", label: "Protect the whiteboard", hint: "Drawings and handwriting are checked before the others see them; contact details are removed. Needs “Read pictures”." },
  { key: "camera", label: "Read the camera in class", hint: "Paper or a poster held up to the camera." },
  { key: "documents", label: "Read PDF, Word and text files", hint: "Including scanned pages." },
  { key: "qr", label: "Read QR codes", hint: "In pictures and documents: phone, email, WhatsApp, social or UPI codes." },
  { key: "aiReading", label: "Use Gemini to read class pictures", hint: "Better with handwriting and Gujarati / Hindi digits. Sends the pictures to Google; needs GEMINI_API_KEY." },
];

const NUMBERS: { key: "strongWarningAt" | "muteAt" | "muteMinutes" | "removeAt" | "pauseAccountAfterRemovals" | "retentionDays" | "splitWindowMinutes" | "shareBlockAt" | "shareBlockMinutes"; label: string; hint: string; min: number; max: number }[] = [
  { key: "strongWarningAt", label: "Stronger warning from catch", hint: "In one lesson; moderators are told.", min: 1, max: 20 },
  { key: "muteAt", label: "Pause audio from catch", hint: "In one lesson. 0 = never.", min: 0, max: 20 },
  { key: "muteMinutes", label: "Audio pause (minutes)", hint: "Each further catch starts it again.", min: 1, max: 120 },
  { key: "shareBlockAt", label: "Block screen share / whiteboard from catch", hint: "In one lesson, counted separately for each. 0 = never.", min: 0, max: 20 },
  { key: "shareBlockMinutes", label: "Sharing block (minutes)", hint: "Dismissing a catch in Chat safety lifts it.", min: 1, max: 120 },
  { key: "removeAt", label: "Remove from the class at catch", hint: "0 = never (recommended).", min: 0, max: 20 },
  { key: "pauseAccountAfterRemovals", label: "Pause the account after removals", hint: "Within 90 days, for review. 0 = never.", min: 0, max: 10 },
  { key: "retentionDays", label: "Keep records (days)", hint: "Reviewed catches, ended pauses and decided appeals are deleted after this.", min: 30, max: 3650 },
  { key: "splitWindowMinutes", label: "Numbers sent in pieces (minutes)", hint: "How far back one person's short messages are read together.", min: 5, max: 240 },
];

export function ProtectionSettings() {
  const saved = useApp((s) => s.contactSafety);
  const save = useApp((s) => s.saveContactSafety);
  const { can } = useStaff();
  const editable = can("settings.manage");
  const [draft, setDraft] = React.useState<ContactSafety>(saved);
  const [block, setBlock] = React.useState(saved.block.join("\n"));
  const [allow, setAllow] = React.useState(saved.allow.join("\n"));
  const [busy, setBusy] = React.useState(false);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await save({ ...draft, block: lines(block), allow: lines(allow) });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Protection settings saved");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-6" data-protection-settings="">
      {!editable && <p className="text-[13px] text-muted">Only administrators with settings access can change these.</p>}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">What is checked</h3>
        <ul className="divide-y divide-line">
          {SWITCHES.map((s) => (
            <li key={s.key} className="flex items-start justify-between gap-4 py-2.5">
              <label htmlFor={`cs-${s.key}`} className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{s.label}</span>
                <span className="block text-[12.5px] text-muted">{s.hint}</span>
              </label>
              <Switch id={`cs-${s.key}`} checked={draft[s.key] as boolean} disabled={!editable} onCheckedChange={(v) => setDraft((d) => ({ ...d, [s.key]: v }))} />
            </li>
          ))}
          <li className="flex items-start justify-between gap-4 py-2.5">
            <label htmlFor="cs-sensitivity" className="min-w-0">
              <span className="block text-[13.5px] font-medium text-ink">App names in messages</span>
              <span className="block text-[12.5px] text-muted">Normal: only next to a handle or number, or in a request. Strict: any mention.</span>
            </label>
            <select id="cs-sensitivity" disabled={!editable} value={draft.sensitivity} onChange={(e) => setDraft((d) => ({ ...d, sensitivity: e.target.value === "strict" ? "strict" : "normal" }))} className="h-9 border border-line bg-canvas px-2 text-sm">
              <option value="normal">Normal</option>
              <option value="strict">Strict</option>
            </select>
          </li>
        </ul>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Warnings and limits</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBERS.map((n) => (
            <label key={n.key} className="block text-[13px]">
              <span className="font-medium text-ink">{n.label}</span>
              <Input
                type="number"
                min={n.min}
                max={n.max}
                disabled={!editable}
                value={String(draft[n.key])}
                onChange={(e) => setDraft((d) => ({ ...d, [n.key]: Math.max(n.min, Math.min(n.max, Math.round(Number(e.target.value) || 0))) }))}
                className="mt-1"
                aria-describedby={`cs-${n.key}-hint`}
              />
              <span id={`cs-${n.key}-hint`} className="mt-1 block text-[12px] text-muted">{n.hint}</span>
            </label>
          ))}
        </div>
      </section>
      <section className={cn("grid gap-4 rounded-xl border border-line bg-surface p-4 md:grid-cols-2")}>
        <label className="block text-[13px]">
          <span className="font-medium text-ink">Also block these phrases</span>
          <span className="block text-[12px] text-muted">One per line, any language. Counted as a request to talk outside TutorLink.</span>
          <Textarea value={block} onChange={(e) => setBlock(e.target.value)} disabled={!editable} rows={6} className="mt-1" placeholder={"personal tuition at my home\nમારા ઘરે ટ્યુશન"} />
        </label>
        <label className="block text-[13px]">
          <span className="font-medium text-ink">Never block these phrases</span>
          <span className="block text-[12px] text-muted">One per line: lesson phrases wrongly caught. Real numbers and emails inside them still are.</span>
          <Textarea value={allow} onChange={(e) => setAllow(e.target.value)} disabled={!editable} rows={6} className="mt-1" placeholder="whatsapp business case study" />
        </label>
      </section>
      {editable && (
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            Save settings
          </Button>
        </div>
      )}
    </form>
  );
}
