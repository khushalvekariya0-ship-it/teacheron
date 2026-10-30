"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, BookOpen, Eye, EyeOff, MapPin, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import type { Subject, SubjectCategory, Tutor } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useCatalog, useTutors } from "@/lib/store/hooks";
import { MODE_LABEL, US_TIMEZONES, slugify } from "@/lib/data/catalog";
import { METROS, distanceMiles, type Metro } from "@/lib/data/geo";
import { formatCents, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, Sheet, SheetContent } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Controls";
import { toast } from "@/components/ui/Toast";
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
  /** Hidden itself or inside a hidden area — either way it doesn't show on the site. */
  hidden: boolean;
  ownHidden: boolean;
  tutors: Tutor[];
  inPerson: number;
}

interface MetroRow {
  metro: Metro;
  inPerson: { tutor: Tutor; miles: number }[];
  based: Tutor[];
  basedOnline: number;
}

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

/**
 * Admin → Subjects (main subjects and their sub-categories, editable) and Admin → Locations (metro areas,
 * read-only). In the site's data a main subject is a "category" and a sub-category is a "subject".
 */
export function CatalogView({ publicRoutes, section }: { publicRoutes: string[] | null; section: TabKey }) {
  return (
    <PermissionGate permission="content.manage">
      <CatalogInner publicRoutes={publicRoutes} tab={section} />
    </PermissionGate>
  );
}

function CatalogInner({ publicRoutes, tab }: { publicRoutes: string[] | null; tab: TabKey }) {
  const tutors = useTutors();
  const catalog = useCatalog();
  const moveItem = useApp((s) => s.moveCatalogItem);
  const loadStarter = useApp((s) => s.loadStarterCatalog);
  const [openId, setOpenId] = useUrlParam("id");
  // Editors: an area (slug null = new) and a subject (slug null = new, optionally inside an area).
  const [areaEdit, setAreaEdit] = React.useState<{ slug: string | null } | null>(null);
  const [subjectEdit, setSubjectEdit] = React.useState<{ slug: string | null; area?: string } | null>(null);

  // Every subject, hidden ones included, in the catalog's order.
  const subjects = React.useMemo<SubjectRow[]>(
    () =>
      catalog.allCategories.flatMap((c) =>
        catalog.allSubjects
          .filter((s) => s.category === c.slug)
          .map((s) => {
            const list = tutors.filter((t) => t.subjects.includes(s.slug));
            return {
              slug: s.slug,
              name: s.name,
              category: s.category,
              categoryName: c.name,
              summary: s.summary,
              popular: !!s.popular,
              hidden: !!s.hidden || !!c.hidden,
              ownHidden: !!s.hidden,
              tutors: list,
              inPerson: list.filter((t) => t.modes.includes("in_person")).length,
            };
          }),
      ),
    [tutors, catalog],
  );
  const addStarterList = () => {
    const res = loadStarter();
    if (!res.ok) return toast.error(res.error);
    toast.success(`Added ${pluralize(res.data.areas, "subject")} and ${pluralize(res.data.subjects, "sub-category", "sub-categories")}`, { description: "Edit, hide or delete any of them to make the list yours." });
  };
  const move = (kind: "area" | "subject", slug: string, direction: -1 | 1) => {
    const res = moveItem(kind, slug, direction);
    if (!res.ok) toast.error(res.error);
  };

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
  const thinSubjects = subjects.filter((s) => !s.hidden && s.tutors.length <= THIN);
  const thinMetros = metros.filter((m) => m.inPerson.length <= THIN);

  const openSubject = subjects.find((s) => s.slug === openId) ?? null;
  const openMetro = openSubject ? null : (metros.find((m) => m.metro.slug === openId) ?? null);

  return (
    <>
      <PageHeader
        title={tab === "subjects" ? "Subjects" : "Locations"}
        description={
          tab === "subjects"
            ? "Add main subjects (like Mathematics) and their sub-categories (like Algebra or Geometry). They show on the website's menus, search, filters and subject pages."
            : "Metro areas that power location search and city pages, with live in-person tutor supply from current profiles."
        }
        actions={
          tab === "subjects" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setAreaEdit({ slug: null })}>
                <Plus aria-hidden /> Add subject
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSubjectEdit({ slug: null })}>
                <Plus aria-hidden /> Add sub-category
              </Button>
              <ExportButton
                filename="tutorlink-subjects"
                headers={["Slug", "Sub-category", "Subject", "Popular", "Shown on site", "Tutors", "Tutors offering in person"]}
                rows={() => subjects.map((s) => [s.slug, s.name, s.categoryName, s.popular, !s.hidden, s.tutors.length, s.inPerson])}
              />
            </div>
          ) : (
            <ExportButton
              filename="tutorlink-metros"
              headers={["Slug", "City", "State", "ZIP", "Time zone", "In-person tutors in range", "Tutors based here", "Online tutors based here"]}
              rows={() => metros.map((m) => [m.metro.slug, m.metro.city, m.metro.state, m.metro.zip, m.metro.timezone, m.inPerson.length, m.based.length, m.basedOnline])}
            />
          )
        }
      />

      {tab === "subjects" ? (
        <>
          <InlineAlert tone="info" title="What you add here shows on the website" className="mb-6">
            Subjects and sub-categories you add, rename, reorder or hide update the website&rsquo;s menus, search, filters, subject pages, tutor profiles and every subject picker. Until the database is connected, changes are saved in this browser only.
          </InlineAlert>
          {catalog.allCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
              <EmptyState
                icon={<BookOpen />}
                title="No subjects yet"
                description="Add your first main subject (for example Mathematics), then its sub-categories (Algebra, Geometry…). They appear on the website straight away. Or start from our ready-made list of 9 subjects and 38 sub-categories and edit it."
                action={
                  <>
                    <Button onClick={() => setAreaEdit({ slug: null })}>
                      <Plus aria-hidden /> Add your first subject
                    </Button>
                    <Button variant="secondary" onClick={addStarterList}>
                      Use the starter list
                    </Button>
                  </>
                }
              />
            </div>
          ) : (
          <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Subjects" value={catalog.categories.length} hint={`${catalog.allCategories.length - catalog.categories.length} hidden`} />
            <MiniStat label="Sub-categories" value={catalog.subjects.length} hint={`${subjects.filter((s) => s.hidden).length} hidden`} />
            <MiniStat label="Thin sub-categories" value={thinSubjects.length} tone={thinSubjects.length ? "warning" : undefined} hint={`${THIN} or fewer tutors`} />
            <MiniStat label="Tutors" value={tutors.length} hint={`${onlineTutors} teach online`} />
          </div>
          <SubjectsTab
            rows={subjects}
            areas={catalog.allCategories}
            thin={thinSubjects}
            publicRoutes={publicRoutes}
            onOpen={setOpenId}
            onEditArea={(slug) => setAreaEdit({ slug })}
            onAddSubject={(area) => setSubjectEdit({ slug: null, area })}
            onMove={move}
          />
          </>
          )}
        </>
      ) : (
        <>
          <InlineAlert tone="info" title="Read-only" className="mb-6">
            Metro areas come from the list built into the site. Tutor counts are computed from current tutor profiles.
          </InlineAlert>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MiniStat label="Metros" value={METROS.length} hint={`${thinMetros.length} with thin in-person supply`} />
            <MiniStat label="Online tutors" value={onlineTutors} hint={`of ${pluralize(tutors.length, "tutor")} · available everywhere`} />
            <MiniStat label="In-person tutors" value={tutors.filter((t) => t.modes.includes("in_person")).length} hint="Counted in every metro their radius reaches" />
          </div>
          <MetrosTab rows={metros} onlineTutors={onlineTutors} publicRoutes={publicRoutes} onOpen={setOpenId} />
        </>
      )}

      <SubjectSheet row={openSubject} publicRoutes={publicRoutes} onClose={() => setOpenId(null)} onEdit={(slug) => setSubjectEdit({ slug })} onMove={move} />
      <AreaDialog
        open={!!areaEdit}
        area={areaEdit?.slug ? (catalog.categoryBySlug[areaEdit.slug] ?? null) : null}
        subjectCount={areaEdit?.slug ? catalog.allSubjects.filter((x) => x.category === areaEdit.slug).length : 0}
        onOpenChange={(o) => !o && setAreaEdit(null)}
      />
      <SubjectDialog
        open={!!subjectEdit}
        subject={subjectEdit?.slug ? (catalog.bySlug[subjectEdit.slug] ?? null) : null}
        defaultArea={subjectEdit?.area}
        areas={catalog.allCategories}
        onOpenChange={(o) => !o && setSubjectEdit(null)}
        onDeleted={() => setOpenId(null)}
      />
      <MetroSheet row={openMetro} publicRoutes={publicRoutes} onClose={() => setOpenId(null)} />
    </>
  );
}

/* ─── Subjects ───────────────────────────────────────────────────────────────── */

function SubjectsTab({
  rows,
  areas,
  thin,
  publicRoutes,
  onOpen,
  onEditArea,
  onAddSubject,
  onMove,
}: {
  rows: SubjectRow[];
  areas: SubjectCategory[];
  thin: SubjectRow[];
  publicRoutes: string[] | null;
  onOpen: (slug: string) => void;
  onEditArea: (slug: string) => void;
  onAddSubject: (area: string) => void;
  onMove: (kind: "area" | "subject", slug: string, direction: -1 | 1) => void;
}) {
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
      areas.map((c) => {
        const inCat = rows.filter((s) => s.category === c.slug);
        const tutorIds = new Set(inCat.flatMap((s) => s.tutors.map((t) => t.id)));
        return { ...c, subjects: inCat.length, tutors: tutorIds.size, thin: inCat.filter((s) => s.tutors.length <= THIN).length };
      }),
    [rows, areas],
  );

  const columns: Column<SubjectRow>[] = [
    {
      key: "name",
      header: "Sub-category",
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="block min-w-0">
          <span className={cn("flex flex-wrap items-center gap-1.5 font-medium", s.hidden ? "text-muted" : "text-ink")}>
            {s.name}
            {s.popular && (
              <Badge tone="accent" size="sm">
                <Star aria-hidden /> Popular
              </Badge>
            )}
            {s.hidden && <StatusPill tone="neutral">Hidden</StatusPill>}
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

  // With no filters every area is listed (new, empty ones too); with filters only areas with matches.
  const groups = areas.map((c) => ({ ...c, rows: visible.filter((s) => s.category === c.slug) })).filter((g) => g.rows.length || (!filtered && category === "all"));

  return (
    <>
      {thin.length > 0 && (
        <InlineAlert tone="warning" title={`${pluralize(thin.length, "sub-category", "sub-categories")} with thin supply`} className="mb-5">
          {thin.filter((s) => s.tutors.length === 0).length} with no tutors and {thin.filter((s) => s.tutors.length === 1).length} with one. Their pages and search results will show few or no tutors — recruit tutors before promoting them.
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
              <span className={cn("block truncate text-[13.5px] font-medium", c.hidden ? "text-muted line-through" : "text-ink")}>{c.name}</span>
              <span className="mt-0.5 block text-[12px] tabular-nums text-muted">
                {pluralize(c.subjects, "sub-category", "sub-categories")} · {pluralize(c.tutors, "tutor")}
                {c.thin > 0 && <span className="text-warning"> · {c.thin} thin</span>}
              </span>
            </button>
          );
        })}
      </div>

      <Toolbar summary={pluralize(visible.length, "sub-category", "sub-categories")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search sub-categories…" label="Search sub-categories" />
        <FilterSelect label="Subject" value={category} onChange={setCategory} options={[{ value: "all", label: "All subjects" }, ...areas.map((c) => ({ value: c.slug, label: c.name }))]} />
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
          <EmptyState icon={<BookOpen />} title="Nothing matches these filters" description="Try a different name, or clear the filters." />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.slug} aria-labelledby={`cat-${g.slug}`}>
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h2 id={`cat-${g.slug}`} className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                    {g.name}
                    {g.hidden && <StatusPill tone="neutral">Hidden</StatusPill>}
                  </h2>
                  {g.description && <p className="mt-0.5 text-[12.5px] text-muted">{g.description}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${g.name} up`} onClick={() => onMove("area", g.slug, -1)}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${g.name} down`} onClick={() => onMove("area", g.slug, 1)}>
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => onEditArea(g.slug)}>
                    <Pencil aria-hidden /> Edit subject
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => onAddSubject(g.slug)}>
                    <Plus aria-hidden /> Add sub-category
                  </Button>
                </div>
              </div>
              {g.rows.length ? (
                <DataTable rows={g.rows} columns={columns} rowKey={(s) => s.slug} onRowClick={(s) => onOpen(s.slug)} pageSize={50} />
              ) : (
                <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-[13.5px] text-muted">No sub-categories yet. Add one and it shows on the website.</p>
              )}
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

function SubjectSheet({
  row: current,
  publicRoutes,
  onClose,
  onEdit,
  onMove,
}: {
  row: SubjectRow | null;
  publicRoutes: string[] | null;
  onClose: () => void;
  onEdit: (slug: string) => void;
  onMove: (kind: "area" | "subject", slug: string, direction: -1 | 1) => void;
}) {
  const row = useSticky(current);
  const saveSubject = useApp((s) => s.saveSubject);
  const toggleHidden = (r: SubjectRow) => {
    const res = saveSubject({ slug: r.slug, name: r.name, category: r.category, summary: r.summary, popular: r.popular, hidden: !r.ownHidden });
    if (!res.ok) toast.error(res.error);
    else toast.success(r.ownHidden ? `${r.name} is shown on the site again` : `${r.name} is hidden from the site`);
  };
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" title={row?.name ?? "Subject"} description={row ? `${row.categoryName} · ${row.slug}` : undefined} className="sm:w-[34rem]">
        {row && (
          <div className="divide-y divide-line">
            <Section title="Sub-category">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onEdit(row.slug)}>
                  <Pencil aria-hidden /> Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => toggleHidden(row)}>
                  {row.ownHidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />} {row.ownHidden ? "Show on site" : "Hide from site"}
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Move up" onClick={() => onMove("subject", row.slug, -1)}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Move down" onClick={() => onMove("subject", row.slug, 1)}>
                  <ArrowDown aria-hidden />
                </Button>
              </div>
              {row.summary && <p className="mb-3 text-[13.5px] leading-relaxed text-ink-2">{row.summary}</p>}
              <Facts
                items={[
                  { label: "On the site", value: row.hidden ? <StatusPill tone="neutral">{row.ownHidden ? "Hidden" : "Hidden (its subject is hidden)"}</StatusPill> : <StatusPill tone="success">Shown</StatusPill> },
                  { label: "Subject", value: row.categoryName },
                  { label: "Slug", value: <Mono className="text-ink">{row.slug}</Mono> },
                  { label: "Popular", value: row.popular ? "Yes — featured in popular lists" : "No" },
                  { label: "Supply", value: supplyPill(row.tutors.length, "tutors") },
                  { label: "Public page", value: <SubjectLink slug={row.slug} publicRoutes={publicRoutes} /> },
                ]}
              />
            </Section>
            <Section title={`Tutors (${row.tutors.length})`} description={`${row.inPerson} of them also teach in person.`}>
              <TutorList
                empty="No tutor teaches this yet."
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

/* ─── Editors ────────────────────────────────────────────────────────────────── */

/** A labelled switch row used in the editors. */
function SwitchRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line px-3.5 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[14px] font-medium text-ink">
          {label}
        </label>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AreaDialog({ open, area, subjectCount, onOpenChange }: { open: boolean; area: SubjectCategory | null; subjectCount: number; onOpenChange: (o: boolean) => void }) {
  const saveArea = useApp((s) => s.saveSubjectArea);
  const deleteArea = useApp((s) => s.deleteSubjectArea);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [shown, setShown] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // Reset whenever the dialog opens (or switches to another area).
  const openKey = open ? (area?.slug ?? "new") : null;
  const [lastKey, setLastKey] = React.useState<string | null>(null);
  if (lastKey !== openKey) {
    setLastKey(openKey);
    if (openKey) {
      setName(area?.name ?? "");
      setDescription(area?.description ?? "");
      setShown(!area?.hidden);
      setError(null);
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = saveArea({ slug: area?.slug, name, description, hidden: !shown });
    if (!res.ok) return setError(res.error);
    toast.success(area ? `${res.data.name} updated` : `${res.data.name} added`, { description: shown ? "It now shows across the site." : "It stays hidden until you show it." });
    onOpenChange(false);
  };
  const remove = () => {
    setConfirmDelete(false);
    if (!area) return;
    const res = deleteArea(area.slug);
    if (!res.ok) return setError(res.error);
    toast.success(`${area.name} deleted`);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title={area ? `Edit ${area.name}` : "New subject"}
          description={area ? `${pluralize(subjectCount, "sub-category", "sub-categories")} · /subjects#${area.slug}` : "A main subject such as Mathematics or Music. Add its sub-categories next."}
          size="md"
        >
          <form onSubmit={submit} noValidate>
            <DialogBody className="space-y-4">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}
              <Field label="Name" required hint="2–60 characters.">
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  maxLength={60}
                  autoFocus={!area}
                />
              </Field>
              <Field label="Description" optional hint="One line, shown on the website's subjects page and homepage.">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} showCount rows={3} />
              </Field>
              <SwitchRow checked={shown} onChange={setShown} label="Show on the site" hint="A hidden subject and its sub-categories disappear from the website's menus, search and pickers. Nothing is deleted." />
            </DialogBody>
            <DialogFooter>
              {area && (
                <Button type="button" variant="danger-outline" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden /> Delete
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit">{area ? "Save changes" : "Add subject"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${area?.name ?? "this subject"}?`}
        description={
          subjectCount > 0
            ? `It still has ${pluralize(subjectCount, "sub-category", "sub-categories")}. Move or delete them first, or hide the subject instead.`
            : "This removes the subject. It can't be undone."
        }
        confirmLabel="Delete subject"
        tone="danger"
        disabled={subjectCount > 0}
        onConfirm={remove}
      />
    </>
  );
}

function SubjectDialog({
  open,
  subject,
  defaultArea,
  areas,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  subject: Subject | null;
  defaultArea?: string;
  areas: SubjectCategory[];
  onOpenChange: (o: boolean) => void;
  onDeleted: () => void;
}) {
  const saveSubject = useApp((s) => s.saveSubject);
  const deleteSubject = useApp((s) => s.deleteSubject);
  const [name, setName] = React.useState("");
  const [area, setArea] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [popular, setPopular] = React.useState(false);
  const [shown, setShown] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // Reset whenever the dialog opens (or switches to another subject).
  const openKey = open ? (subject?.slug ?? `new:${defaultArea ?? ""}`) : null;
  const [lastKey, setLastKey] = React.useState<string | null>(null);
  if (lastKey !== openKey) {
    setLastKey(openKey);
    if (openKey) {
      setName(subject?.name ?? "");
      setArea(subject?.category ?? defaultArea ?? areas[0]?.slug ?? "");
      setSummary(subject?.summary ?? "");
      setPopular(!!subject?.popular);
      setShown(!subject?.hidden);
      setError(null);
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = saveSubject({ slug: subject?.slug, name, category: area, summary, popular, hidden: !shown });
    if (!res.ok) return setError(res.error);
    toast.success(subject ? `${res.data.name} updated` : `${res.data.name} added`, {
      description: shown ? "It now shows in menus, search, filters and subject pickers across the site." : "It stays hidden until you show it.",
    });
    onOpenChange(false);
  };
  const remove = () => {
    setConfirmDelete(false);
    if (!subject) return;
    const res = deleteSubject(subject.slug);
    if (!res.ok) return setError(res.error);
    toast.success(`${subject.name} deleted`);
    onOpenChange(false);
    onDeleted();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title={subject ? `Edit ${subject.name}` : "New sub-category"}
          description={subject ? `Page: /subjects/${subject.slug}` : `Its page will be /subjects/${slugify(name) || "…"}. The address is set once and stays the same if you rename it.`}
          size="md"
        >
          <form onSubmit={submit} noValidate>
            <DialogBody className="space-y-4">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}
              <Field label="Name" required hint="2–60 characters, e.g. Organic Chemistry.">
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  maxLength={60}
                  autoFocus={!subject}
                />
              </Field>
              <Field label="Subject" required hint="The main subject it belongs to.">
                <Select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Choose a subject"
                  options={areas.map((c) => ({ value: c.slug, label: c.hidden ? `${c.name} (hidden)` : c.name }))}
                />
              </Field>
              <Field label="Summary" optional hint="One line, shown on its subject page and in search.">
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={200} showCount rows={3} />
              </Field>
              <SwitchRow checked={popular} onChange={setPopular} label="Popular" hint="Featured in the homepage quick picks, the menu, the footer and search suggestions." />
              <SwitchRow checked={shown} onChange={setShown} label="Show on the site" hint="Hiding keeps it on existing profiles, bookings and requests, but nobody can pick it any more." />
            </DialogBody>
            <DialogFooter>
              {subject && (
                <Button type="button" variant="danger-outline" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden /> Delete
                </Button>
              )}
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit">{subject ? "Save changes" : "Add sub-category"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${subject?.name ?? "this sub-category"}?`}
        description="Only possible while no tutor, booking or request uses it; otherwise hide it instead. This can't be undone."
        confirmLabel="Delete sub-category"
        tone="danger"
        onConfirm={remove}
      />
    </>
  );
}
