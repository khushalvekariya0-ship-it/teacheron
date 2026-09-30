/*
 * SERVER ONLY — imported by server `page.tsx` files, never by client components (it uses node:fs).
 *
 * Reads the App Router source at request time and extracts the statically readable part of each
 * route's `metadata` export (title, description, robots, canonical), following Next.js' shallow
 * metadata merge: a page inherits any key it doesn't set from the nearest layout that does.
 * Nothing here is invented — values that aren't string literals (or `SITE.*` constants) are
 * reported as unreadable rather than guessed.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { SITE } from "@/lib/site";

export type MetaSource = "page" | "layout" | "generated" | "default" | "unreadable";

export interface ScannedRoute {
  /** "/", "/tutors", "/tutor-jobs/[id]", or "/admin/*" for private areas. */
  route: string;
  /** Source file, relative to the project root, with forward slashes. */
  file: string;
  kind: "static" | "template" | "private";
  /** Effective <title> (layout template applied). */
  title: string | null;
  titleSource: MetaSource;
  description: string | null;
  descriptionSource: MetaSource;
  indexed: boolean;
  indexSource: MetaSource;
  canonical: string | null;
  canonicalSource: MetaSource;
  /** Where an inherited value came from (e.g. "src/app/layout.tsx"). */
  inheritedFrom: Partial<Record<"title" | "description" | "robots" | "canonical", string>>;
  /** Private areas only: number of pages below the area. */
  pageCount?: number;
}

export type SeoScan =
  | { ok: true; routes: ScannedRoute[]; sitemap: string | null; robots: string | null; scannedAt: string }
  | { ok: false; error: string };

/* ─── Minimal literal parser ────────────────────────────────────────────────── */

type Val =
  | { kind: "string"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "object"; props: Record<string, Val> }
  | { kind: "other" };

/** Index just past the string/template/comment starting at `i`, or -1 if `i` doesn't start one. */
function skipNonCode(src: string, i: number): number {
  const c = src[i];
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
    return j + 1;
  }
  if (c === "`") {
    let j = i + 1;
    while (j < src.length && src[j] !== "`") {
      if (src[j] === "\\") j += 2;
      else if (src[j] === "$" && src[j + 1] === "{") {
        let depth = 1;
        j += 2;
        while (j < src.length && depth > 0) {
          const k = skipNonCode(src, j);
          if (k > 0) {
            j = k;
            continue;
          }
          if (src[j] === "{") depth++;
          else if (src[j] === "}") depth--;
          j++;
        }
      } else j++;
    }
    return j + 1;
  }
  if (c === "/" && src[i + 1] === "/") {
    const nl = src.indexOf("\n", i);
    return nl === -1 ? src.length : nl + 1;
  }
  if (c === "/" && src[i + 1] === "*") {
    const end = src.indexOf("*/", i + 2);
    return end === -1 ? src.length : end + 2;
  }
  return -1;
}

/** Index of the bracket that closes the one at `open`. */
function matchBracket(src: string, open: number): number {
  const pairs: Record<string, string> = { "{": "}", "[": "]", "(": ")" };
  const stack: string[] = [];
  let i = open;
  while (i < src.length) {
    const k = skipNonCode(src, i);
    if (k > 0) {
      i = k;
      continue;
    }
    const c = src[i];
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
    }
    i++;
  }
  return -1;
}

/** Splits the inside of an object literal into top-level "key: value" segments. */
function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < body.length) {
    const k = skipNonCode(body, i);
    if (k > 0) {
      i = k;
      continue;
    }
    const c = body[i];
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  out.push(body.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function siteConstant(key: string): string | null {
  const v = (SITE as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

function parseValue(raw: string): Val {
  const text = raw.replace(/\s+as\s+const$/, "").trim();
  if (text.startsWith("{") && matchBracket(text, 0) === text.length - 1) return { kind: "object", props: parseObject(text.slice(1, -1)) };
  const q = text[0];
  if ((q === '"' || q === "'") && text.endsWith(q) && skipNonCode(text, 0) === text.length) {
    return { kind: "string", value: text.slice(1, -1).replace(/\\(["'\\])/g, "$1").replace(/\\n/g, "\n") };
  }
  if (q === "`" && skipNonCode(text, 0) === text.length) {
    let readable = true;
    const value = text.slice(1, -1).replace(/\$\{\s*([^}]*)\s*\}/g, (_m, expr: string) => {
      const site = /^SITE\.(\w+)$/.exec(expr.trim());
      const v = site ? siteConstant(site[1]) : null;
      if (v === null) readable = false;
      return v ?? "…";
    });
    return readable ? { kind: "string", value } : { kind: "other" };
  }
  if (text === "true" || text === "false") return { kind: "bool", value: text === "true" };
  const site = /^SITE\.(\w+)$/.exec(text);
  if (site) {
    const v = siteConstant(site[1]);
    if (v !== null) return { kind: "string", value: v };
  }
  return { kind: "other" };
}

function parseObject(body: string): Record<string, Val> {
  const props: Record<string, Val> = {};
  for (const seg of splitTopLevel(body)) {
    const m = /^(?:([A-Za-z_$][\w$]*)|"([^"]+)"|'([^']+)')\s*:\s*([\s\S]*)$/.exec(seg);
    if (!m) continue; // spreads, shorthand properties, methods — not statically readable
    props[m[1] ?? m[2] ?? m[3]] = parseValue(m[4]);
  }
  return props;
}

interface FileMeta {
  file: string;
  /** Absolute directory (route segment) the file sits in. */
  dir: string;
  /** Present when the file exports a static `metadata` object. */
  meta: Record<string, Val> | null;
  generated: boolean;
}

async function readMeta(abs: string, root: string): Promise<FileMeta> {
  const src = await fs.readFile(abs, "utf8");
  const file = path.relative(root, abs).split(path.sep).join("/");
  const dir = path.dirname(abs);
  const generated = /export\s+(?:async\s+)?function\s+generateMetadata\b|export\s+const\s+generateMetadata\b/.test(src);
  const decl = /export\s+const\s+metadata\s*(?::\s*[\w.<>]+)?\s*=\s*/.exec(src);
  if (!decl) return { file, dir, meta: null, generated };
  const open = src.indexOf("{", decl.index + decl[0].length - 1);
  const close = open === -1 ? -1 : matchBracket(src, open);
  if (open === -1 || close === -1) return { file, dir, meta: null, generated };
  return { file, dir, meta: parseObject(src.slice(open + 1, close)), generated };
}

/* ─── Resolution (Next.js shallow merge) ────────────────────────────────────── */

const str = (v: Val | undefined) => (v?.kind === "string" ? v.value : null);
const obj = (v: Val | undefined) => (v?.kind === "object" ? v.props : null);

function resolveRoute(route: string, kind: ScannedRoute["kind"], page: FileMeta | null, layouts: FileMeta[], file: string): Omit<ScannedRoute, "pageCount"> {
  const inheritedFrom: ScannedRoute["inheritedFrom"] = {};
  /** Nearest file (page first, then layouts from deepest) that sets `key`. */
  const chain = [...(page ? [page] : []), ...[...layouts].reverse()];
  const setter = (key: string) => chain.find((f) => f.meta && key in f.meta);

  // Title. A layout's `title.template` applies to child segments only — never to a page or
  // `title.default` in its own segment — so templates are looked up strictly above the setter.
  let title: string | null = null;
  let titleSource: MetaSource = "default";
  const templateOf = (f: FileMeta) => str(obj(f.meta?.title)?.template);
  const templateAbove = (dir: string) =>
    layouts
      .filter((l) => dir.startsWith(l.dir + path.sep))
      .reverse()
      .map(templateOf)
      .find((t) => t) ?? null;
  const applyTemplate = (value: string, dir: string) => {
    const tpl = templateAbove(dir);
    return tpl ? tpl.replace("%s", value) : value;
  };
  if (page?.generated) titleSource = "generated";
  else {
    const t = setter("title");
    const tv = t?.meta?.title;
    if (t && tv) {
      const isPage = t === page;
      if (tv.kind === "string") {
        title = applyTemplate(tv.value, t.dir);
        titleSource = isPage ? "page" : "layout";
      } else if (tv.kind === "object") {
        const absolute = str(tv.props.absolute);
        const def = str(tv.props.default);
        title = absolute ?? (def !== null ? applyTemplate(def, t.dir) : null);
        titleSource = title === null ? "unreadable" : isPage ? "page" : "layout";
      } else titleSource = "unreadable";
      if (!isPage) inheritedFrom.title = t.file;
    }
  }

  // Description.
  let description: string | null = null;
  let descriptionSource: MetaSource = "default";
  if (page?.generated) descriptionSource = "generated";
  else {
    const d = setter("description");
    if (d) {
      description = str(d.meta!.description);
      descriptionSource = description === null ? "unreadable" : d === page ? "page" : "layout";
      if (d !== page) inheritedFrom.description = d.file;
    }
  }

  // Robots → indexing.
  let indexed = true;
  let indexSource: MetaSource = "default";
  const r = setter("robots");
  if (r) {
    const rv = r.meta!.robots;
    if (rv.kind === "object") {
      const idx = rv.props.index;
      if (idx?.kind === "bool") indexed = idx.value;
      indexSource = idx && idx.kind !== "bool" ? "unreadable" : r === page ? "page" : "layout";
    } else if (rv.kind === "string") {
      indexed = !/noindex/i.test(rv.value);
      indexSource = r === page ? "page" : "layout";
    } else indexSource = "unreadable";
    if (r !== page) inheritedFrom.robots = r.file;
  }

  // Canonical (alternates is replaced as a whole when a nearer segment sets it).
  let canonical: string | null = null;
  let canonicalSource: MetaSource = "default";
  if (page?.generated) canonicalSource = "generated";
  else {
    const a = setter("alternates");
    if (a) {
      const av = a.meta!.alternates;
      canonical = str(obj(av)?.canonical);
      canonicalSource = av.kind !== "object" || (obj(av)?.canonical && canonical === null) ? "unreadable" : a === page ? "page" : "layout";
      if (a !== page) inheritedFrom.canonical = a.file;
    }
  }

  return { route, file, kind, title, titleSource, description, descriptionSource, indexed, indexSource, canonical, canonicalSource, inheritedFrom };
}

/* ─── Walk ──────────────────────────────────────────────────────────────────── */

const PAGE_FILES = ["page.tsx", "page.ts", "page.jsx", "page.js", "page.mdx"];
const LAYOUT_FILES = ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"];
/** Top-level folders that aren't public pages. Private areas get one summary row each. */
const PRIVATE_AREAS = ["admin", "dashboard"];
const SKIP_TOP = ["api", ...PRIVATE_AREAS];

async function listDir(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return {
    files: new Set(entries.filter((e) => e.isFile()).map((e) => e.name)),
    dirs: entries.filter((e) => e.isDirectory()).map((e) => e.name),
  };
}

async function countPages(dir: string): Promise<number> {
  const { files, dirs } = await listDir(dir);
  let n = PAGE_FILES.some((f) => files.has(f)) ? 1 : 0;
  for (const d of dirs) n += await countPages(path.join(dir, d));
  return n;
}

async function walk(dir: string, segments: string[], layouts: FileMeta[], root: string, out: ScannedRoute[], top: boolean) {
  const { files, dirs } = await listDir(dir);
  const layoutFile = LAYOUT_FILES.find((f) => files.has(f));
  const chain = layoutFile ? [...layouts, await readMeta(path.join(dir, layoutFile), root)] : layouts;
  const pageFile = PAGE_FILES.find((f) => files.has(f));
  if (pageFile) {
    const abs = path.join(dir, pageFile);
    const route = "/" + segments.join("/");
    const kind = segments.some((s) => s.startsWith("[")) ? "template" : "static";
    out.push(resolveRoute(route, kind, await readMeta(abs, root), chain, path.relative(root, abs).split(path.sep).join("/")));
  }
  for (const name of dirs.sort()) {
    if (name.startsWith("_") || name.startsWith("@") || name.startsWith("(.")) continue; // private folders, slots, interceptors
    if (top && SKIP_TOP.includes(name)) continue;
    const isGroup = name.startsWith("(") && name.endsWith(")");
    await walk(path.join(dir, name), isGroup ? segments : [...segments, name], chain, root, out, top && isGroup);
  }
}

async function firstExisting(root: string, candidates: string[]): Promise<string | null> {
  for (const c of candidates) {
    try {
      await fs.access(path.join(root, c));
      return c;
    } catch {
      /* not present */
    }
  }
  return null;
}

/** Scans `src/app` for public routes and their metadata. Never throws. */
export async function scanSeo(): Promise<SeoScan> {
  try {
    // Not traced/bundled: this reads source files at runtime, not assets for the build output.
    const root = /* turbopackIgnore: true */ process.cwd();
    const appDir = path.join(root, "src", "app");
    const rootLayoutFile = LAYOUT_FILES.map((f) => path.join(appDir, f));
    let rootLayout: FileMeta | null = null;
    for (const f of rootLayoutFile) {
      try {
        rootLayout = await readMeta(f, root);
        break;
      } catch {
        /* try next */
      }
    }
    const base = rootLayout ? [rootLayout] : [];
    const routes: ScannedRoute[] = [];

    // Public routes. The root layout is applied once here, so the walk starts without it.
    const { files, dirs } = await listDir(appDir);
    const rootPage = PAGE_FILES.find((f) => files.has(f));
    if (rootPage) {
      const abs = path.join(appDir, rootPage);
      routes.push(resolveRoute("/", "static", await readMeta(abs, root), base, path.relative(root, abs).split(path.sep).join("/")));
    }
    for (const name of dirs.sort()) {
      if (name.startsWith("_") || name.startsWith("@") || SKIP_TOP.includes(name)) continue;
      const isGroup = name.startsWith("(") && name.endsWith(")");
      await walk(path.join(appDir, name), isGroup ? [] : [name], base, root, routes, isGroup);
    }

    // Private areas: one row each, resolved from the area's layout.
    for (const area of PRIVATE_AREAS) {
      const dir = path.join(appDir, area);
      let listing: Awaited<ReturnType<typeof listDir>>;
      try {
        listing = await listDir(dir);
      } catch {
        continue;
      }
      const layoutFile = LAYOUT_FILES.find((f) => listing.files.has(f));
      const layout = layoutFile ? await readMeta(path.join(dir, layoutFile), root) : null;
      const chain = layout ? [...base, layout] : base;
      const row = resolveRoute(`/${area}/*`, "private", null, chain, layout?.file ?? `src/app/${area}`);
      routes.push({ ...row, pageCount: await countPages(dir) });
    }

    const order = { static: 0, template: 1, private: 2 } as const;
    routes.sort((a, b) => order[a.kind] - order[b.kind] || a.route.localeCompare(b.route));

    const sitemap = await firstExisting(root, ["src/app/sitemap.ts", "src/app/sitemap.js", "src/app/sitemap.xml", "public/sitemap.xml"]);
    const robots = await firstExisting(root, ["src/app/robots.ts", "src/app/robots.js", "src/app/robots.txt", "public/robots.txt"]);
    return { ok: true, routes, sitemap, robots, scannedAt: new Date().toISOString() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Public route patterns (for linking to public pages only when they exist). */
export function publicRoutePatterns(scan: SeoScan): string[] | null {
  return scan.ok ? scan.routes.filter((r) => r.kind !== "private").map((r) => r.route) : null;
}
