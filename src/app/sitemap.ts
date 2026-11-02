import type { MetadataRoute } from "next";
import { indexableMetros, indexableSubjects } from "@/components/content/insights";
import { setLiveCatalog } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";
import { listedTutors, publicCatalog, publishedPosts, publishedRequirements } from "@/server/public";

/** Rebuilt from the database at most once an hour. */
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/tutors", changeFrequency: "daily", priority: 0.9 },
  { path: "/concierge", changeFrequency: "monthly", priority: 0.8 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/subjects", changeFrequency: "weekly", priority: 0.8 },
  { path: "/locations", changeFrequency: "weekly", priority: 0.8 },
  { path: "/for-students", changeFrequency: "monthly", priority: 0.7 },
  { path: "/for-parents", changeFrequency: "monthly", priority: 0.7 },
  { path: "/become-a-tutor", changeFrequency: "monthly", priority: 0.7 },
  { path: "/tutor-jobs", changeFrequency: "daily", priority: 0.7 },
  { path: "/post-requirement", changeFrequency: "monthly", priority: 0.6 },
  { path: "/trust-safety", changeFrequency: "monthly", priority: 0.6 },
  { path: "/safety", changeFrequency: "monthly", priority: 0.5 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

const url = (path: string) => `${SITE.url.replace(/\/$/, "")}${path === "/" ? "" : path}`;

/**
 * Only pages with real content are listed: subjects with at least one tutor, metros with at least
 * one in-person tutor, published jobs, and every tutor profile. Thin pages are also noindexed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tutorList, posts0, jobs0, catalog] = await Promise.all([listedTutors(), publishedPosts(), publishedRequirements(), publicCatalog()]);
  setLiveCatalog(catalog);
  const staticEntries = STATIC_ROUTES.map((r) => ({ url: url(r.path), changeFrequency: r.changeFrequency, priority: r.priority }));

  const posts = posts0.map((p) => ({ url: url(`/blog/${p.slug}`), lastModified: new Date(`${p.date}T00:00:00Z`), changeFrequency: "yearly" as const, priority: 0.5 }));

  const subjects = indexableSubjects(tutorList).map((s) => ({ url: url(`/subjects/${s.slug}`), changeFrequency: "weekly" as const, priority: 0.7 }));

  const metros = indexableMetros(tutorList).map((m) => ({ url: url(`/locations/${m.slug}`), changeFrequency: "weekly" as const, priority: 0.7 }));

  const tutors = tutorList.map((t) => ({ url: url(`/tutors/${t.slug}`), changeFrequency: "weekly" as const, priority: 0.6 }));

  const jobs = jobs0.map((r) => ({
    url: url(`/tutor-jobs/${r.id}`),
    lastModified: new Date(r.updatedAt),
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...posts, ...subjects, ...metros, ...tutors, ...jobs];
}
