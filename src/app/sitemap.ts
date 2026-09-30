import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/data/content";
import { SEED_REQUIREMENTS } from "@/lib/data/requirements";
import { TUTORS } from "@/lib/data/tutors";
import { indexableMetros, indexableSubjects } from "@/components/content/insights";
import { SITE } from "@/lib/site";

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
export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = STATIC_ROUTES.map((r) => ({ url: url(r.path), changeFrequency: r.changeFrequency, priority: r.priority }));

  const posts = BLOG_POSTS.map((p) => ({ url: url(`/blog/${p.slug}`), lastModified: new Date(`${p.date}T00:00:00Z`), changeFrequency: "yearly" as const, priority: 0.5 }));

  const subjects = indexableSubjects().map((s) => ({ url: url(`/subjects/${s.slug}`), changeFrequency: "weekly" as const, priority: 0.7 }));

  const metros = indexableMetros().map((m) => ({ url: url(`/locations/${m.slug}`), changeFrequency: "weekly" as const, priority: 0.7 }));

  const tutors = TUTORS.map((t) => ({ url: url(`/tutors/${t.slug}`), changeFrequency: "weekly" as const, priority: 0.6 }));

  const jobs = SEED_REQUIREMENTS.filter((r) => r.status === "published").map((r) => ({
    url: url(`/tutor-jobs/${r.id}`),
    lastModified: new Date(r.updatedAt),
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...posts, ...subjects, ...metros, ...tutors, ...jobs];
}
