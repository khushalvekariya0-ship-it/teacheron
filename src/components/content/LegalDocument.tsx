"use client";

import * as React from "react";
import { ChevronDown, FileExclamationPoint } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion";

export interface DocSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = ids.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

function Toc({ sections, active, indicatorId }: { sections: DocSection[]; active?: string; indicatorId: string }) {
  return (
    <ol className="space-y-0.5 border-l border-line">
      {sections.map((s, i) => {
        const on = s.id === active;
        return (
          <li key={s.id} className="relative">
            {on && <motion.span layoutId={indicatorId} className="absolute -left-px top-0 h-full w-0.5 rounded-full bg-navy" transition={{ type: "spring", bounce: 0.1, duration: 0.4 }} />}
            <a
              href={`#${s.id}`}
              aria-current={on ? "location" : undefined}
              className={cn("block py-1.5 pl-4 text-[13.5px] leading-snug transition-colors", on ? "font-medium text-ink" : "text-muted hover:text-ink")}
            >
              <span className="mr-1.5 tabular-nums text-muted">{i + 1}.</span>
              {s.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/** Long-form document layout with a sticky, scroll-aware table of contents. */
export function LegalDocument({
  sections,
  intro,
  templateNote = true,
  aside,
}: {
  sections: DocSection[];
  intro?: React.ReactNode;
  templateNote?: boolean;
  aside?: React.ReactNode;
}) {
  const ids = React.useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useActiveSection(ids);
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <details className="group rounded-xl border border-line bg-surface lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              On this page
              <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <nav aria-label="Table of contents" className="border-t border-line px-2 py-3">
              <Toc sections={sections} active={active} indicatorId="toc-mobile" />
            </nav>
          </details>
          <nav aria-label="On this page" className="hidden lg:block">
            <p className="eyebrow mb-3">On this page</p>
            <Toc sections={sections} active={active} indicatorId="toc-desktop" />
          </nav>
          {aside && <div className="mt-8 hidden lg:block">{aside}</div>}
        </aside>

        <div className="min-w-0">
          {templateNote && (
            <Reveal>
              <div role="note" className="mb-10 flex max-w-[68ch] items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3.5">
                <FileExclamationPoint className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <p className="text-sm leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink">Template pending legal review.</span> This document is a working draft for the preview build. It is not legal advice and will be reviewed by counsel before launch.
                </p>
              </div>
            </Reveal>
          )}
          {intro && <div className="prose-page mb-4 text-[17px]">{intro}</div>}
          <div className="prose-page">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
                <h2 id={`${s.id}-h`}>
                  <span className="mr-2 tabular-nums text-muted">{i + 1}.</span>
                  {s.title}
                </h2>
                {s.content}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
