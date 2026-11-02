import "server-only";
import { emptyData, type ClientConfig, type Data } from "@/lib/domain/data";
import { DEFAULT_FLAGS, DEFAULT_POLICY } from "@/lib/data/platform";
import { DEFAULT_SUBJECTS, DEFAULT_SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { BLOG_POSTS, FAQS } from "@/lib/data/content";
import { SITE } from "@/lib/site";
import { backendStatus, env } from "./env";

/** What the site shows before a database is connected: the built-in catalog and content, and nothing else. */
export function offlineState(): Data {
  return {
    ...emptyData({ flags: DEFAULT_FLAGS, policy: DEFAULT_POLICY, platformFeeBps: SITE.platformFeeBps, catalog: { categories: DEFAULT_SUBJECT_CATEGORIES, subjects: DEFAULT_SUBJECTS } }),
    faqs: FAQS.map((f, i) => ({ id: `faq_${String(i + 1).padStart(2, "0")}`, audience: f.audience, q: f.q, a: f.a, published: true })),
    blogPosts: BLOG_POSTS.map((p) => ({ ...p, status: "published" as const })),
  };
}

export function clientConfig(): ClientConfig {
  const s = backendStatus();
  return { configured: s.database && s.auth, paymentsEnabled: env.paymentsEnabled, uploads: s.storage, email: s.email };
}
