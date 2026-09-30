"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BlogPost } from "@/lib/data/content";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";
import { FeaturedPost, PostCard } from "./Blog";

type Filter = "All" | BlogPost["category"];

export function BlogIndex({ posts }: { posts: BlogPost[] }) {
  const [filter, setFilter] = React.useState<Filter>("All");
  const categories = React.useMemo(() => Array.from(new Set(posts.map((p) => p.category))), [posts]);
  const visible = filter === "All" ? posts : posts.filter((p) => p.category === filter);
  const [featured, ...rest] = visible;
  const options: { value: Filter; count: number }[] = [{ value: "All", count: posts.length }, ...categories.map((c) => ({ value: c, count: posts.filter((p) => p.category === c).length }))];

  return (
    <div>
      <div role="group" aria-label="Filter articles by category" className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === filter;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(o.value)}
              className={cn(
                "relative inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-200",
                active ? "border-navy text-on-ink" : "border-line-strong bg-surface text-ink-2 hover:border-subtle hover:text-ink",
              )}
            >
              {active && <motion.span layoutId="blog-filter" className="absolute inset-0 rounded-full bg-navy" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
              <span className="relative">{o.value}</span>
              <span className={cn("relative text-xs tabular-nums", active ? "text-on-ink/70" : "text-muted")}>{o.count}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={filter} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }} className="mt-10">
          {featured && <FeaturedPost post={featured} />}
          {rest.length > 0 && (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p, i) => (
                <motion.li key={p.slug} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.05 + i * 0.06 }}>
                  <PostCard post={p} />
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
