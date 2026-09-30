"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, MapPin, Search, Star } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { useTutors } from "@/lib/store/hooks";
import { MODE_LABEL, SUBJECTS, SUBJECT_CATEGORIES, US_TIMEZONES } from "@/lib/data/catalog";
import { METROS, distanceMiles, type Metro } from "@/lib/data/geo";
import { formatCents, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, MiniStat, Mono, SearchInput, Section, StatusPill, Toolbar, fullName, matches, useSticky, useUrlParam,
} from "./kit";

/** Subjects or metros with this many tutors or fewer are flagged as thin supply. */
const THIN = 1;

type TabKey = "subjects" | "metros";
type SupplyFilter = "all" | "thin" | "popular";
type MetroFilter = "all" | "thin";

interface SubjectRow {
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  summary: string;
  popular: boolean;
  tutors: Tutor[];
  inPerson: number;
}

interface MetroRow {
  metro: Metro;
  inPerson: { tutor: Tutor; miles: number }[];
  based: Tutor[];
  basedOnline: number;
}

const CATEGORY_NAME = Object.fromEntries(SUBJECT_CATEGORIES.map((c) => [c.slug, c.name])) as Record<string, string>;
const TZ_LABEL = Object.fromEntries(US_TIMEZONES.map((t) => [t.value, t.label])) as Record<string, string>;

/** Whether a concrete path is served by one of the scanned route patterns ("/subjects/[slug]"). */
function hasRoute(patterns: string[] | null, pathname: string): boolean {
  if (!patterns) return false;
  const parts = pathname.split("/").filter(Boolean);
  return patterns.some((p) => {
    const segs = p.split("/").filter(Boolean);
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].startsWith("[[...") || segs[i].startsWith("[...")) return parts.length >= i + (segs[i].startsWith("[[") ? 0 : 1);
      if (i >= parts.length) return false;
      if (!segs[i].startsWith("[") && segs[i] !== parts[i]) return false;
    }
    return segs.length === parts.length;
  });
}

function supplyPill(n: number, noun: string) {
  if (n === 0) return <StatusPill tone="danger">{`No ${noun}`}</StatusPill>;
  if (n <= THIN) return <StatusPill tone="warning">Thin supply</StatusPill>;
  return <StatusPill tone="success">Covered</StatusPill>;
}

export function CatalogView({ publicRoutes }: { publicRoutes: string[] | null }) {
  return (
    <PermissionGate permission="content.manage">
      <CatalogInner publicRoutes={publicRoutes} />
    </PermissionGate>
  );
}

function CatalogInner({ publicRoutes }: { publicRoutes: string[] | null }) {
  const tutors = useTutors();
  const [tab, setTab] = React.useState<TabKey>("subjects");
  const [openId, setOpenId] = useUrlParam("id");

  const subjects = React.useMemo<SubjectRow[]>(
    () =>
      SUBJECTS.map((s) => {
        const list = tutors.filter((t) => t.subjects.includes(s.slug));
        return {
          slug: s.slug,
          name: s.name,
          category: s.category,
          categoryName: CATEGORY_NAME[s.category] ?? s.category,
          summary: s.summary,
          popular: !!s.popular,
          tutors: list,
          inPerson: list.filter((t) => t.modes.includes("in_person")).length,
        };
      }),
    [tutors],
  );

  const metros = React.useMemo<MetroRow[]>(
    () =>
      METROS.map((m) => {
        const inPerson = tutors
          .filter((t) => t.modes.includes("in_person"))
          .map((t) => ({ tutor: t, miles: distanceMiles(m, t) }))
          .filter((x) => x.miles <= x.tutor.serviceRadiusMiles)
          .sort((a, b) => a.miles - b.miles);
        const based = tutors.filter((t) => t.city === m.city && t.state === m.state);
        return { metro: m, inPerson, based, basedOnline: based.filter((t) => t.modes.includes("online")).length };
      }),
    [tutors],
  );

  const onlineTutors = tutors.filter((t) => t.modes.includes("online")).length;
  const thinSubjects = subjects.filter((s) => s.tutors.length <= THIN);
  const thinMetros = metros.filter((m) => m.inPerson.length <= THIN);

  const openSubject = subjects.find((s) => s.slug === openId) ?? null;
  const openMetro = openSubject ? null : (metros.find((m) => m.metro.slug === openId) ?? null);

  return (
    <>
      <PageHeader
        title="Catalog"
        description="Subjects and metro areas that power search, matching and landing pages, with live tutor supply from current profiles."
        actions={
          tab === "subjects" ? (
            <ExportButton
              filename="tutorlink-subjects"
              headers={["Slug", "Subject", "Category", "Popular", "Tutors", "Tutors offering in person"]}
              rows={() => subjects.map((s) => [s.slug, s.name, s.categoryName, s.popular, s.tutors.length, s.inPerson])}
            />
          ) : (
            <ExportButton
              filename="tutorlink-metros"
              headers={["Slug", "City", "State", "ZIP", "Time zone", "In-person tutors in range", "Tutors based here", "Online tutors based here"]}
              rows={() => metros.map((m) => [m.metro.slug, m.metro.city, m.metro.state, m.metro.zip, m.metro.timezone, m.inPerson.length, m.based.length, m.basedOnline])}
            />
          )
        }
      />

      <InlineAlert tone="info" title="Read-only" className="mb-6">
        Catalog editing is served by the CMS API in production. Subjects, categories and metros here come from the catalog bundled with this preview; tutor counts are computed from current tutor profiles.
      </InlineAlert>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Subjects" value={SUBJECTS.length} hint={`${pluralize(SUBJECT_CATEGORIES.length, "category", "categories")}`} />
        <MiniStat label="Thin subjects" value={thinSubjects.length} tone={thinSubjects.length ? "warning" : undefined} hint={`${THIN} or fewer tutors`} />
        <MiniStat label="Metros" value={METROS.length} hint={`${thinMetros.length} with thin in-person supply`} />
        <MiniStat label="Online tutors" value={onlineTutors} hint={`of ${pluralize(tutors.length, "tutor")} · available everywhere`} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Catalog">
          <TabsTrigger value="subjects" count={SUBJECTS.length}>
            Subjects
          </TabsTrigger>
          <TabsTrigger value="metros" count={METROS.length}>
            Metro areas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="subjects">
          <SubjectsTab rows={subjects} thin={thinSubjects} publicRoutes={publicRoutes} onOpen={setOpenId} />
        </TabsContent>
        <TabsContent value="metros">
          <MetrosTab rows={metros} onlineTutors={onlineTutors} publicRoutes={publicRoutes} onOpen={setOpenId} />
        </TabsContent>
      </Tabs>

      <SubjectSheet row={openSubject} publicRoutes={publicRoutes} onClose={() => setOpenId(null)} />
      <MetroSheet row={openMetro} publicRoutes={publicRoutes} onClose={() => setOpenId(null)} />
    </>
  );
}

/* ─── Subjects ───────────────────────────────────────────────────────────────── */

function SubjectsTab({ rows, thin, publicRoutes, onOpen }: { rows: SubjectRow[]; thin: SubjectRow[]; publicRoutes: string[] | null; onOpen: (slug: string) => void }) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [supply, setSupply] = React.useState<SupplyFilter>("all");

  const visible = React.useMemo(
    () =>
      rows.filter(
        (s) =>
          matches(q, s.name, s.slug, s.summary) &&
          (category === "all" || s.category === category) &&
          (supply === "all" || (supply === "thin" ? s.tutors.length <= THIN : s.popular)),
      ),
    [rows, q, category, supply],
  );
  const filtered = q.trim() !== "" || category !== "all" || supply !== "all";

  const totals = React.useMemo(
    () =>
      SUBJECT_CATEGORIES.map((c) => {
        const inCat = rows.filter((s) => s.category === c.slug);
        const tutorIds = new Set(inCat.flatMap((s) => s.tutors.map((t) => t.id)));
        return { ...c, subjects: inCat.length, tutors: tutorIds.size, thin: inCat.filter((s) => s.tutors.length <= THIN).length };
      }),
    [rows],
  );

  const columns: Column<SubjectRow>[] = [
    {
      key: "name",
      header: "Subject",
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="block min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-ink">
            {s.name}
            {s.popular && (
              <Badge tone="accent" size="sm">
                <Star aria-hidden /> Popular
              </Badge>
            )}
          </span>
          <Mono>{s.slug}</Mono>
        </span>
      ),
    },
    { key: "tutors", header: "Tutors", align: "right", sortValue: (s) => s.tutors.length, cell: (s) => <span className="font-medium text-ink">{s.tutors.length}</span> },
    { key: "inperson", header: "In person", align: "right", sortValue: (s) => s.inPerson, cell: (s) => s.inPerson, hideOnMobile: true },
    { key: "supply", header: "Supply", sortValue: (s) => s.tutors.length, cell: (s) => supplyPill(s.tutors.length, "tutors") },
    { key: "page", header: "Public page", cell: (s) => <SubjectLink slug={s.slug} publicRoutes={publicRoutes} compact />, hideOnMobile: true },
  ];

  const groups = SUBJECT_CATEGORIES.map((c) => ({ ...c, rows: visible.filter((s) => s.category === c.slug) })).filter((g) => g.rows.length);

  return (
    <>
      {thin.length > 0 && (
        <InlineAlert tone="warning" title={`${pluralize(thin.length, "subject")} with thin supply`} className="mb-5">
          {thin.filter((s) => s.tutors.length === 0).length} with no tutors and {thin.filter((s) => s.tutors.length === 1).length} with one. Landing pages and search for these subjects will show few or no results — recruit tutors before promoting them.
        </InlineAlert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-3">
        {totals.map((c) => {
          const active = category === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(active ? "all" : c.slug)}
              className={cn(
                "rounded-lg border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                active ? "border-ink bg-brand-soft" : "border-line bg-surface hover:border-ink",
              )}
            >
              <span className="block truncate text-[13.5px] font-medium text-ink">{c.name}</span>
              <span className="mt-0.5 block text-[12px] tabular-nums text-muted">
                {pluralize(c.subjects, "subject")} · {pluralize(c.tutors, "tutor")}
                {c.thin > 0 && <span className="text-warning"> · {c.thin} thin</span>}
              </span>
            </button>
          );
        })}
      </div>

      <Toolbar summary={pluralize(visible.length, "subject")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search subjects…" label="Search subjects" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...SUBJECT_CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))]} />
        <FilterSelect
          label="Supply"
          value={supply}
          onChange={setSupply}
          options={[
            { value: "all", label: "Any supply" },
            { value: "thin", label: `Thin supply (0–${THIN} tutors)` },
            { value: "popular", label: "Popular only" },
          ]}
        />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setCategory("all");
            setSupply("all");
          }}
        />
      </Toolbar>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={<BookOpen />} title="No subjects match these filters" description="Try a different name, or clear the filters." />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.slug} aria-labelledby={`cat-${g.slug}`}>
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={`cat-${g.slug}`} className="text-[14px] font-semibold text-ink">
                  {g.name}
                </h2>
                <p className="text-[12.5px] text-muted">{g.description}</p>
              </div>
              <DataTable rows={g.rows} columns={columns} rowKey={(s) => s.slug} onRowClick={(s) => onOpen(s.slug)} pageSize={50} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function SubjectLink({ slug, publicRoutes, compact }: { slug: string; publicRoutes: string[] | null; compact?: boolean }) {
  const path = `/subjects/${slug}`;
  if (hasRoute(publicRoutes, path)) {
    return (
      <Link href={path} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline">
        {compact ? "View page" : path} <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    );
  }
  if (hasRoute(publicRoutes, "/tutors")) {
    return (
      <span className="inline-flex flex-col">
        <Link href={`/tutors?subject=${slug}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline">
          <Search className="size-3.5" aria-hidden /> Search results
        </Link>
        {!compact && <span className="text-[12px] text-muted">No subject landing page is built yet ({path}).</span>}
      </span>
    );
  }
  return <Mono>{path}</Mono>;
}

/* ─── Metros ─────────────────────────────────────────────────────────────────── */

function MetrosTab({ rows, onlineTutors, publicRoutes, onOpen }: { rows: MetroRow[]; onlineTutors: number; publicRoutes: string[] | null; onOpen: (slug: string) => void }) {
  const [q, setQ] = React.useState("");
  const [supply, setSupply] = React.useState<MetroFilter>("all");
  const visible = React.useMemo(
    () => rows.filter((r) => matches(q, r.metro.city, r.metro.state, r.metro.stateName, r.metro.slug, r.metro.zip) && (supply === "all" || r.inPerson.length <= THIN)),
    [rows, q, supply],
  );
  const filtered = q.trim() !== "" || supply !== "all";

  const columns: Column<MetroRow>[] = [
    {
      key: "metro",
      header: "Metro",
      sortValue: (r) => `${r.metro.city}, ${r.metro.state}`,
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block font-medium text-ink">
            {r.metro.city}, {r.metro.state}
          </span>
          <Mono>{r.metro.slug}</Mono>
        </span>
      ),
    },
    { key: "tz", header: "Time zone", sortValue: (r) => r.metro.timezone, cell: (r) => TZ_LABEL[r.metro.timezone] ?? r.metro.timezone, hideOnMobile: true },
    { key: "inperson", header: "In person (in range)", align: "right", sortValue: (r) => r.inPerson.length, cell: (r) => <span className="font-medium text-ink">{r.inPerson.length}</span> },
    { key: "based", header: "Based here", align: "right", sortValue: (r) => r.based.length, cell: (r) => r.based.length },
    { key: "online", header: "Online, based here", align: "right", sortValue: (r) => r.basedOnline, cell: (r) => r.basedOnline, hideOnMobile: true },
    { key: "supply", header: "In-person supply", sortValue: (r) => r.inPerson.length, cell: (r) => supplyPill(r.inPerson.length, "in-person tutors") },
    { key: "page", header: "Public page", cell: (r) => <MetroLink metro={r.metro} publicRoutes={publicRoutes} compact />, hideOnMobile: true },
  ];

  return (
    <>
      <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted">
        <span className="font-medium text-ink-2">In person (in range)</span> counts tutors who teach in person and whose service radius reaches the metro centre. Online lessons aren&apos;t tied to a place: {pluralize(onlineTutors, "tutor")} teach online and can serve every metro.
      </p>
      <Toolbar summary={pluralize(visible.length, "metro")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search city, state or ZIP…" label="Search metros" />
        <FilterSelect
          label="In-person supply"
          value={supply}
          onChange={setSupply}
          options={[
            { value: "all", label: "Any supply" },
            { value: "thin", label: `Thin in-person supply (0–${THIN})` },
          ]}
        />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setSupply("all");
          }}
        />
      </Toolbar>
      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(r) => r.metro.slug}
        onRowClick={(r) => onOpen(r.metro.slug)}
        pageSize={20}
        empty={
          <EmptyState
            icon={<MapPin />}
            title={filtered ? "No metros match these filters" : "No metros configured"}
            description={filtered ? "Try another city, state or ZIP, or clear the filters." : "Metros are defined in the catalog served by the CMS API."}
          />
        }
      />
    </>
  );
}

function MetroLink({ metro, publicRoutes, compact }: { metro: Metro; publicRoutes: string[] | null; compact?: boolean }) {
  const path = `/locations/${metro.slug}`;
  if (hasRoute(publicRoutes, path)) {
    return (
      <Link href={path} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline">
        {compact ? "View page" : path} <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    );
  }
  if (hasRoute(publicRoutes, "/tutors")) {
    return (
      <span className="inline-flex flex-col">
        <Link
          href={`/tutors?location=${metro.zip}&mode=in_person`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline"
        >
          <Search className="size-3.5" aria-hidden /> Search results
        </Link>
        {!compact && <span className="text-[12px] text-muted">No location landing page is built yet.</span>}
      </span>
    );
  }
  return <Mono>{metro.slug}</Mono>;
}

/* ─── Drawers ────────────────────────────────────────────────────────────────── */

function TutorList({ items, empty }: { items: { tutor: Tutor; meta: React.ReactNode }[]; empty: string }) {
  if (!items.length) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {items.map(({ tutor: t, meta }) => (
        <li key={t.id}>
          <Link href={`/admin/tutors?id=${t.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] hover:bg-canvas">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{fullName(t)}</span>
              <span className="block truncate text-muted">{meta}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink-2">{formatCents(t.hourlyRateCents)}/hr</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SubjectSheet({ row: current, publicRoutes, onClose }: { row: SubjectRow | null; publicRoutes: string[] | null; onClose: () => void }) {
  const row = useSticky(current);
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" title={row?.name ?? "Subject"} description={row ? `${row.categoryName} · ${row.slug}` : undefined} className="sm:w-[34rem]">
        {row && (
          <div className="divide-y divide-line">
            <Section title="Subject">
              <p className="mb-3 text-[13.5px] leading-relaxed text-ink-2">{row.summary}</p>
              <Facts
                items={[
                  { label: "Category", value: row.categoryName },
                  { label: "Slug", value: <Mono className="text-ink">{row.slug}</Mono> },
                  { label: "Popular", value: row.popular ? "Yes — featured in popular lists" : "No" },
                  { label: "Supply", value: supplyPill(row.tutors.length, "tutors") },
                  { label: "Public page", value: <SubjectLink slug={row.slug} publicRoutes={publicRoutes} /> },
                ]}
              />
            </Section>
            <Section title={`Tutors (${row.tutors.length})`} description={`${row.inPerson} of them also teach in person.`}>
              <TutorList
                empty="No tutor teaches this subject yet."
                items={row.tutors.map((t) => ({ tutor: t, meta: `${t.city}, ${t.state} · ${t.modes.map((m) => MODE_LABEL[m]).join(" & ")}` }))}
              />
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetroSheet({ row: current, publicRoutes, onClose }: { row: MetroRow | null; publicRoutes: string[] | null; onClose: () => void }) {
  const row = useSticky(current);
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" title={row ? `${row.metro.city}, ${row.metro.state}` : "Metro"} description={row ? `${row.metro.stateName} · ${row.metro.slug}` : undefined} className="sm:w-[34rem]">
        {row && (
          <div className="divide-y divide-line">
            <Section title="Metro">
              <Facts
                items={[
                  { label: "Centre ZIP", value: <span className="tabular-nums">{row.metro.zip}</span> },
                  { label: "Time zone", value: TZ_LABEL[row.metro.timezone] ?? row.metro.timezone },
                  { label: "In-person supply", value: supplyPill(row.inPerson.length, "in-person tutors") },
                  { label: "Public page", value: <MetroLink metro={row.metro} publicRoutes={publicRoutes} /> },
                ]}
              />
            </Section>
            <Section title={`In person, in range (${row.inPerson.length})`} description="Tutors whose service radius reaches the metro centre.">
              <TutorList
                empty="No in-person tutor covers this metro yet."
                items={row.inPerson.map(({ tutor: t, miles }) => ({ tutor: t, meta: `${miles.toFixed(1)} mi away · serves ${t.serviceRadiusMiles} mi from ${t.city}` }))}
              />
            </Section>
            <Section title={`Based here (${row.based.length})`} description="Tutors whose profile city is this metro.">
              <TutorList empty="No tutors are based here." items={row.based.map((t) => ({ tutor: t, meta: t.modes.map((m) => MODE_LABEL[m]).join(" & ") }))} />
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
