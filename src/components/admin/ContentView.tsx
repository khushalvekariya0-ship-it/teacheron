"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, FileSearch, FileWarning, HelpCircle, MessageSquareQuote, Newspaper } from "lucide-react";
import type { MetaSource, ScannedRoute, SeoScan } from "./seo-scan";
import { BLOG_POSTS, FAQS, SAMPLE_TESTIMONIALS, type BlogPost, type Faq } from "@/lib/data/content";
import { useViewerTimezone } from "@/lib/store/hooks";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { ClearFilters, ExportButton, Facts, FilterSelect, MiniStat, Mono, SearchInput, Section, StatusPill, Toolbar, matches, useSticky, useUrlParam } from "./kit";

type TabKey = "pages" | "blog" | "faqs" | "testimonials";
const TAB_KEYS: TabKey[] = ["pages", "blog", "faqs", "testimonials"];

const AUDIENCE_LABEL: Record<Faq["audience"], string> = { families: "Families", tutors: "Tutors", payments: "Payments", safety: "Safety" };
const AUDIENCES = Object.keys(AUDIENCE_LABEL) as Faq["audience"][];

/** Whether a concrete path is served by one of the scanned route patterns ("/blog/[slug]"). */
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

function PublicLink({ href, routes, children }: { href: string; routes: string[] | null; children?: React.ReactNode }) {
  if (!hasRoute(routes, href)) {
    return (
      <span className="inline-flex flex-col">
        <Mono>{href}</Mono>
        <span className="text-[11.5px] text-muted">Page not built yet</span>
      </span>
    );
  }
  return (
    <Link href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline">
      {children ?? <span className="font-mono text-[12px]">{href}</span>}
      <ArrowUpRight className="size-3.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </Link>
  );
}

export function ContentView({ scan }: { scan: SeoScan }) {
  return (
    <PermissionGate permission="content.manage">
      <ContentInner scan={scan} />
    </PermissionGate>
  );
}

function ContentInner({ scan }: { scan: SeoScan }) {
  const [tabParam, setTabParam] = useUrlParam("tab");
  const tab: TabKey = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "pages";
  const routes = scan.ok ? scan.routes.filter((r) => r.kind !== "private").map((r) => r.route) : null;

  return (
    <>
      <PageHeader
        title="Content & SEO"
        description="Public pages and their search metadata, blog posts, FAQs and testimonials."
        actions={
          tab === "pages" && scan.ok ? (
            <ExportButton
              filename="tutorlink-seo"
              headers={["Route", "Kind", "Title", "Title source", "Description", "Indexing", "Canonical", "Canonical source", "File"]}
              rows={() => scan.routes.map((r) => [r.route, r.kind, r.title ?? "", r.titleSource, r.description ?? "", r.indexed ? "index" : "noindex", r.canonical ?? "", r.canonicalSource, r.file])}
            />
          ) : tab === "blog" ? (
            <ExportButton
              filename="tutorlink-blog"
              headers={["Slug", "Title", "Category", "Author", "Date", "Read minutes"]}
              rows={() => BLOG_POSTS.map((p) => [p.slug, p.title, p.category, p.author, p.date, p.readMinutes])}
            />
          ) : tab === "faqs" ? (
            <ExportButton filename="tutorlink-faqs" headers={["Audience", "Question", "Answer"]} rows={() => FAQS.map((f) => [AUDIENCE_LABEL[f.audience], f.q, f.a])} />
          ) : null
        }
      />

      <InlineAlert tone="info" title="Read-only" className="mb-6">
        Editing is powered by the CMS API in production. Page metadata below is read from the app&apos;s route files; blog posts, FAQs and testimonials come from the content bundled with this preview.
      </InlineAlert>

      <Tabs value={tab} onValueChange={(v) => setTabParam(v === "pages" ? null : v)}>
        <TabsList aria-label="Content type">
          <TabsTrigger value="pages" count={scan.ok ? scan.routes.length : undefined}>
            Pages & SEO
          </TabsTrigger>
          <TabsTrigger value="blog" count={BLOG_POSTS.length}>
            Blog posts
          </TabsTrigger>
          <TabsTrigger value="faqs" count={FAQS.length}>
            FAQs
          </TabsTrigger>
          <TabsTrigger value="testimonials" count={SAMPLE_TESTIMONIALS.length}>
            Testimonials
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pages">
          <PagesTab scan={scan} />
        </TabsContent>
        <TabsContent value="blog">
          <BlogTab routes={routes} />
        </TabsContent>
        <TabsContent value="faqs">
          <FaqTab routes={routes} />
        </TabsContent>
        <TabsContent value="testimonials">
          <TestimonialsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ─── Pages & SEO ────────────────────────────────────────────────────────────── */

type KindFilter = "all" | ScannedRoute["kind"];
type IndexFilter = "all" | "indexed" | "noindex";

const SOURCE_LABEL: Record<MetaSource, string> = {
  page: "Set on page",
  layout: "Inherited",
  generated: "Generated per page",
  default: "Not set",
  unreadable: "Not statically readable",
};

/** "src/app/layout.tsx" → "root layout", "src/app/(site)/layout.tsx" → "(site) layout". */
function layoutName(file: string | undefined): string {
  if (!file) return "a layout";
  const parts = file.split("/");
  const dir = parts[parts.length - 2];
  return dir === "app" ? "root layout" : `${dir} layout`;
}

function sourceText(r: ScannedRoute, key: "title" | "description" | "canonical", source: MetaSource): string {
  if (source === "layout") return `Inherited from ${layoutName(r.inheritedFrom[key])}`;
  return SOURCE_LABEL[source];
}

interface Check {
  tone: "warning" | "neutral";
  text: string;
}

/** Observations derived from the scanned metadata. Only indexable public routes are checked. */
function checksFor(r: ScannedRoute): Check[] {
  if (r.kind === "private" || !r.indexed) return [];
  const out: Check[] = [];
  if (r.canonicalSource === "layout" && r.route !== "/" && r.canonical === "/") out.push({ tone: "warning", text: "Canonical inherited from the root layout points to “/”" });
  else if (r.canonicalSource === "default") out.push({ tone: "neutral", text: "No canonical URL" });
  if (r.titleSource === "layout" || r.titleSource === "default") out.push({ tone: "warning", text: "No page title — uses the site default" });
  if (r.descriptionSource === "layout" || r.descriptionSource === "default") out.push({ tone: "neutral", text: "No page description — uses the site-wide one" });
  if ([r.titleSource, r.descriptionSource, r.canonicalSource, r.indexSource].includes("unreadable")) out.push({ tone: "neutral", text: "Some metadata isn't statically readable" });
  return out;
}

function IndexPill({ r }: { r: ScannedRoute }) {
  if (r.kind === "private") return <StatusPill tone="neutral">noindex (private)</StatusPill>;
  return r.indexed ? <StatusPill tone="success">Indexed</StatusPill> : <StatusPill tone="neutral">noindex</StatusPill>;
}

function PagesTab({ scan }: { scan: SeoScan }) {
  const tz = useViewerTimezone();
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [index, setIndex] = React.useState<IndexFilter>("all");
  const [openRoute, setOpenRoute] = React.useState<string | null>(null);

  const all = React.useMemo(() => (scan.ok ? scan.routes : []), [scan]);
  const rows = React.useMemo(
    () =>
      all.filter(
        (r) =>
          matches(q, r.route, r.title, r.description, r.file) &&
          (kind === "all" || r.kind === kind) &&
          (index === "all" || (index === "indexed" ? r.indexed : !r.indexed)),
      ),
    [all, q, kind, index],
  );

  if (!scan.ok) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<FileWarning />}
          title="Couldn't read the route files"
          description={
            <>
              This table is built by reading the app&apos;s route files on the server when the page loads, and that failed here ({scan.error}). Where the source isn&apos;t deployed, page metadata comes from the CMS API instead.
            </>
          }
        />
      </div>
    );
  }

  const publicRows = all.filter((r) => r.kind !== "private");
  const flagged = publicRows.filter((r) => checksFor(r).some((c) => c.tone === "warning")).length;
  const filtered = q.trim() !== "" || kind !== "all" || index !== "all";
  const open = all.find((r) => r.route === openRoute) ?? null;

  const columns: Column<ScannedRoute>[] = [
    {
      key: "route",
      header: "Route",
      sortValue: (r) => r.route,
      cell: (r) => (
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span className="font-mono text-[12.5px] text-ink">{r.route}</span>
          {r.kind === "template" && <Badge size="sm">Template</Badge>}
          {r.kind === "private" && <Badge size="sm">{`Private · ${pluralize(r.pageCount ?? 0, "page")}`}</Badge>}
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      sortValue: (r) => r.title ?? "",
      cell: (r) => (
        <span className="block max-w-72 min-w-0">
          <span className="block truncate text-ink">{r.title ?? (r.titleSource === "generated" ? "Generated per page" : "—")}</span>
          <span className="block truncate text-[12px] text-muted">{sourceText(r, "title", r.titleSource)}</span>
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      cell: (r) => (
        <span className="block max-w-80 min-w-0">
          <span className="line-clamp-2 text-[13px] text-ink-2">{r.description ?? (r.descriptionSource === "generated" ? "Generated per page" : "—")}</span>
          {r.descriptionSource !== "page" && <span className="block truncate text-[12px] text-muted">{sourceText(r, "description", r.descriptionSource)}</span>}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "index", header: "Indexing", sortValue: (r) => (r.kind === "private" ? 2 : r.indexed ? 0 : 1), cell: (r) => <IndexPill r={r} /> },
    {
      key: "canonical",
      header: "Canonical",
      sortValue: (r) => r.canonical ?? "",
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-mono text-[12px] text-ink-2">{r.canonical ?? (r.canonicalSource === "generated" ? "Generated" : "—")}</span>
          {r.canonicalSource !== "page" && <span className="block truncate text-[12px] text-muted">{sourceText(r, "canonical", r.canonicalSource)}</span>}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "checks",
      header: "Checks",
      sortValue: (r) => checksFor(r).length,
      cell: (r) => {
        const checks = checksFor(r);
        if (!checks.length) return <span className="text-[12.5px] text-muted">{r.kind === "private" || !r.indexed ? "—" : "No issues"}</span>;
        const warn = checks.filter((c) => c.tone === "warning").length;
        return <StatusPill tone={warn ? "warning" : "neutral"}>{pluralize(checks.length, warn ? "issue" : "note")}</StatusPill>;
      },
    },
  ];

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Public pages" value={publicRows.filter((r) => r.kind === "static").length} hint={`${pluralize(publicRows.filter((r) => r.kind === "template").length, "template")} with per-page metadata`} />
        <MiniStat label="Indexed" value={publicRows.filter((r) => r.indexed).length} hint="Allowed in search results" />
        <MiniStat label="noindex" value={all.filter((r) => !r.indexed).length} hint="Including private areas" />
        <MiniStat label="Need attention" value={flagged} tone={flagged ? "warning" : undefined} hint="Indexed pages with a warning" />
      </div>

      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
        <SiteFile label="sitemap.xml" file={scan.sitemap} expected="src/app/sitemap.ts" />
        <SiteFile label="robots.txt" file={scan.robots} expected="src/app/robots.ts" />
      </div>

      <Toolbar summary={pluralize(rows.length, "route")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search route, title or file…" label="Search pages" />
        <FilterSelect
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "All kinds" },
            { value: "static", label: "Static pages" },
            { value: "template", label: "Templates" },
            { value: "private", label: "Private areas" },
          ]}
        />
        <FilterSelect
          label="Indexing"
          value={index}
          onChange={setIndex}
          options={[
            { value: "all", label: "Any indexing" },
            { value: "indexed", label: "Indexed" },
            { value: "noindex", label: "noindex" },
          ]}
        />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setKind("all");
            setIndex("all");
          }}
        />
      </Toolbar>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.route}
        onRowClick={(r) => setOpenRoute(r.route)}
        pageSize={15}
        empty={
          <EmptyState
            icon={<FileSearch />}
            title={filtered ? "No routes match these filters" : "No public routes found"}
            description={filtered ? "Try another route or title, or clear the filters." : "No page files were found under src/app outside the private areas."}
          />
        }
      />
      <p className="mt-2 text-[12.5px] text-muted">Read from the app&apos;s route files at {formatDateTime(scan.scannedAt, tz)}. Titles include the layout title template.</p>

      <RouteSheet route={open} onClose={() => setOpenRoute(null)} />
    </>
  );
}

function SiteFile({ label, file, expected }: { label: string; file: string | null; expected: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="font-mono text-[12.5px] text-ink">{label}</span>
      {file ? (
        <>
          <StatusPill tone="success">Configured</StatusPill>
          <Mono>{file}</Mono>
        </>
      ) : (
        <>
          <StatusPill tone="warning">Not configured</StatusPill>
          <span className="text-muted">
            no <span className="font-mono text-[12px]">{expected}</span>
          </span>
        </>
      )}
    </p>
  );
}

function RouteSheet({ route: current, onClose }: { route: ScannedRoute | null; onClose: () => void }) {
  const r = useSticky(current);
  const checks = r ? checksFor(r) : [];
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" title={r?.route ?? "Route"} description={r ? (r.kind === "template" ? "Template route" : r.kind === "private" ? "Private area" : "Static page") : undefined} className="sm:w-[34rem]">
        {r && (
          <div className="divide-y divide-line">
            <Section title="Search appearance">
              <div className="rounded-lg border border-line px-3.5 py-3">
                <p className="truncate font-mono text-[12px] text-muted">{r.canonical ?? r.route}</p>
                <p className="mt-0.5 text-[15px] font-medium text-ink">{r.title ?? (r.titleSource === "generated" ? "Title generated per page" : "No title")}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{r.description ?? (r.descriptionSource === "generated" ? "Description generated per page" : "No description")}</p>
              </div>
            </Section>
            <Section title="Metadata">
              <Facts
                items={[
                  { label: "Title", value: sourceText(r, "title", r.titleSource) },
                  { label: "Description", value: sourceText(r, "description", r.descriptionSource) },
                  {
                    label: "Indexing",
                    value: (
                      <span className="inline-flex flex-col items-end gap-1">
                        <IndexPill r={r} />
                        <span className="text-[12px] font-normal text-muted">
                          {r.indexSource === "layout" ? `robots from ${layoutName(r.inheritedFrom.robots)}` : r.indexSource === "page" ? "robots set on page" : r.indexSource === "default" ? "No robots rule — indexable" : SOURCE_LABEL[r.indexSource]}
                        </span>
                      </span>
                    ),
                  },
                  { label: "Canonical", value: <span className="inline-flex flex-col items-end gap-0.5"><span className="font-mono text-[12px]">{r.canonical ?? "—"}</span><span className="text-[12px] font-normal text-muted">{sourceText(r, "canonical", r.canonicalSource)}</span></span> },
                  { label: "Source file", value: <Mono className="break-all">{r.file}</Mono> },
                  ...(r.pageCount !== undefined ? [{ label: "Pages in area", value: r.pageCount }] : []),
                ]}
              />
            </Section>
            <Section title="Checks">
              {checks.length === 0 ? (
                <p className="text-[13px] text-muted">{r.kind === "private" || !r.indexed ? "Not checked — this route isn't indexed." : "No issues found in the readable metadata."}</p>
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {checks.map((c) => (
                    <li key={c.text} className={cn("rounded-lg border px-3 py-2", c.tone === "warning" ? "border-warning-200 bg-warning-50 text-warning" : "border-line bg-canvas text-ink-2")}>
                      {c.text}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            {r.kind === "static" && (
              <Section title="Public page">
                <PublicLink href={r.route} routes={[r.route]} />
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Blog ───────────────────────────────────────────────────────────────────── */

function BlogTab({ routes }: { routes: string[] | null }) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<"all" | BlogPost["category"]>("all");
  const categories = Array.from(new Set(BLOG_POSTS.map((p) => p.category)));
  const rows = BLOG_POSTS.filter((p) => matches(q, p.title, p.excerpt, p.slug) && (category === "all" || p.category === category)).sort((a, b) => b.date.localeCompare(a.date));
  const filtered = q.trim() !== "" || category !== "all";

  const columns: Column<BlogPost>[] = [
    {
      key: "title",
      header: "Post",
      sortValue: (p) => p.title,
      cell: (p) => (
        <span className="block max-w-xl min-w-0">
          <span className="block font-medium text-ink">{p.title}</span>
          <span className="line-clamp-1 text-[12.5px] text-muted">{p.excerpt}</span>
        </span>
      ),
    },
    { key: "category", header: "Category", sortValue: (p) => p.category, cell: (p) => <Badge size="sm">{p.category}</Badge> },
    { key: "author", header: "Author", sortValue: (p) => p.author, cell: (p) => p.author, hideOnMobile: true },
    { key: "date", header: "Published", sortValue: (p) => p.date, cell: (p) => <span className="whitespace-nowrap tabular-nums">{formatDate(`${p.date}T12:00:00Z`, "UTC")}</span> },
    { key: "read", header: "Read time", align: "right", sortValue: (p) => p.readMinutes, cell: (p) => `${p.readMinutes} min`, hideOnMobile: true },
    { key: "link", header: "Public page", cell: (p) => <PublicLink href={`/blog/${p.slug}`} routes={routes}>View</PublicLink> },
  ];

  return (
    <>
      <Toolbar summary={pluralize(rows.length, "post")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search posts…" label="Search blog posts" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setCategory("all");
          }}
        />
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.slug}
        pageSize={10}
        empty={
          <EmptyState
            icon={<Newspaper />}
            title={filtered ? "No posts match these filters" : "No blog posts yet"}
            description={filtered ? "Try another title or category, or clear the filters." : "Posts are published from the CMS."}
          />
        }
      />
    </>
  );
}

/* ─── FAQs ───────────────────────────────────────────────────────────────────── */

function FaqTab({ routes }: { routes: string[] | null }) {
  const [q, setQ] = React.useState("");
  const [audience, setAudience] = React.useState<"all" | Faq["audience"]>("all");
  const rows = FAQS.filter((f) => matches(q, f.q, f.a) && (audience === "all" || f.audience === audience));
  const filtered = q.trim() !== "" || audience !== "all";
  const groups = AUDIENCES.map((a) => ({ audience: a, items: rows.filter((f) => f.audience === a) })).filter((g) => g.items.length);

  return (
    <>
      <Toolbar summary={pluralize(rows.length, "question")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search questions and answers…" label="Search FAQs" />
        <FilterSelect label="Audience" value={audience} onChange={setAudience} options={[{ value: "all", label: "All audiences" }, ...AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))]} />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setAudience("all");
          }}
        />
      </Toolbar>
      <p className="-mt-1 mb-4 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        Public page: <PublicLink href="/faq" routes={routes} />
      </p>
      {groups.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={<HelpCircle />} title={filtered ? "No questions match these filters" : "No FAQs yet"} description={filtered ? "Try other words, or clear the filters." : "FAQs are published from the CMS."} />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.audience} aria-labelledby={`faq-${g.audience}`}>
              <h2 id={`faq-${g.audience}`} className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold text-ink">
                {AUDIENCE_LABEL[g.audience]}
                <span className="rounded-md bg-canvas px-1.5 py-px text-[11px] font-semibold tabular-nums text-ink-2">{g.items.length}</span>
              </h2>
              <Card>
                <dl className="divide-y divide-line">
                  {g.items.map((f) => (
                    <div key={f.q} className="px-4 py-3.5">
                      <dt className="text-[14px] font-medium text-ink">{f.q}</dt>
                      <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{f.a}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Testimonials ───────────────────────────────────────────────────────────── */

function TestimonialsTab() {
  return (
    <>
      <InlineAlert tone="warning" title="Illustrative samples — not real customers" className="mb-5">
        These quotes were written for the preview build. Replace every one with a consented, verified testimonial (with written permission to publish, and the reviewer&apos;s approval of the exact wording) before launch.
      </InlineAlert>
      {SAMPLE_TESTIMONIALS.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={<MessageSquareQuote />} title="No testimonials" description="Add consented testimonials in the CMS." />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SAMPLE_TESTIMONIALS.map((t) => (
            <li key={t.quote}>
              <Card className="flex h-full flex-col p-5">
                <Badge tone="warning" size="sm" className="self-start">
                  Sample — replace before launch
                </Badge>
                <blockquote className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-2">“{t.quote}”</blockquote>
                <p className="mt-4 text-[13px] font-medium text-ink">{t.name}</p>
                <p className="text-[12.5px] text-muted">{t.context}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
