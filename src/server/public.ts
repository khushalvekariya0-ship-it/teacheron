import "server-only";
import { cache } from "react";
import type { Requirement, Subject, SubjectCategory, Tutor } from "@/lib/types";
import { DEFAULT_CATALOG, buildCatalog } from "@/lib/data/catalog";
import type { BlogPostItem, FaqItem, TestimonialItem } from "@/lib/domain/data";
import { BLOG_POSTS, FAQS } from "@/lib/data/content";
import { db } from "./db";
import { env } from "./env";
import { SPECS, fromRowWith } from "./tables";

/*
 * Read-only public data for server-rendered pages (metadata, JSON-LD, sitemap, landing-page figures).
 * The same rules as the browser state apply: only tutors with an active account, only published jobs
 * and published content. Before a database is connected these return the built-in content (and no
 * tutors or jobs), so the site still builds and renders.
 */

const spec = (table: string) => SPECS.find((s) => s.table === table)!;

async function safe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  if (!env.dbUrl) return fallback;
  try {
    return await run();
  } catch (e) {
    console.error("[public data]", (e as Error).message);
    return fallback;
  }
}

const LISTED = "not t.hidden and exists (select 1 from public.users u where u.tutor_id = t.id and u.status = 'active')";

/** Tutors shown publicly, with rating and review count from published reviews. */
export const listedTutors = cache(() =>
  safe<Tutor[]>([], async () => {
    const rows = await db().unsafe(`
      select t.*, r.avg_rating, r.n_reviews from public.tutors t
      left join (select tutor_id, avg(rating)::float8 avg_rating, count(*)::int n_reviews from public.reviews where status = 'published' group by tutor_id) r on r.tutor_id = t.id
      where ${LISTED} order by t.joined_at`);
    return rows.map((row) => ({
      ...fromRowWith<Tutor>(spec("tutors").cols, row),
      rating: row.n_reviews ? Math.round(Number(row.avg_rating) * 10) / 10 : null,
      reviewCount: Number(row.n_reviews ?? 0),
    }));
  }),
);

export const tutorBySlug = cache(async (slug: string): Promise<Tutor | undefined> => (await listedTutors()).find((t) => t.slug === slug || t.id === slug));

export const publishedRequirements = cache(() =>
  safe<Requirement[]>([], async () => {
    const rows = await db().unsafe(`select * from public.requirements where status = 'published' order by published_at desc limit 1000`);
    return rows.map((r) => spec("requirements").fromRow!(r) as Requirement);
  }),
);

const fallbackFaqs = (): FaqItem[] => FAQS.map((f, i) => ({ id: `faq_${String(i + 1).padStart(2, "0")}`, audience: f.audience, q: f.q, a: f.a, published: true }));
const fallbackPosts = (): BlogPostItem[] => BLOG_POSTS.map((p) => ({ ...p, status: "published" as const }));

export const publishedFaqs = cache(() =>
  safe<FaqItem[]>(fallbackFaqs(), async () => (await db().unsafe(`select * from public.faqs where published order by position`)).map((r) => spec("faqs").fromRow!(r) as FaqItem)),
);

export const publishedPosts = cache(() =>
  safe<BlogPostItem[]>(fallbackPosts(), async () =>
    (await db().unsafe(`select * from public.blog_posts where status = 'published' order by published_on desc`)).map((r) => spec("blog_posts").fromRow!(r) as BlogPostItem),
  ),
);

export const publishedTestimonials = cache(() =>
  safe<TestimonialItem[]>([], async () =>
    (await db().unsafe(`select * from public.testimonials where published and consent_confirmed order by position`)).map((r) => spec("testimonials").fromRow!(r) as TestimonialItem),
  ),
);

/** The subject catalog as edited in Admin → Subjects (the built-in list before a database is connected). */
export const publicCatalog = cache(() =>
  safe(DEFAULT_CATALOG, async () => {
    const [cats, subs] = await Promise.all([db().unsafe(`select * from public.subject_categories order by position`), db().unsafe(`select * from public.subjects order by position`)]);
    return buildCatalog(cats.map((r) => spec("subject_categories").fromRow!(r) as SubjectCategory), subs.map((r) => spec("subjects").fromRow!(r) as Subject));
  }),
);
