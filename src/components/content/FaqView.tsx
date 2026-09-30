"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { motion } from "framer-motion";
import type { Faq } from "@/lib/data/content";
import { EASE } from "@/components/motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";

type Group = "all" | Faq["audience"];

export const FAQ_GROUPS: { value: Faq["audience"]; label: string; description: string }[] = [
  { value: "families", label: "Families", description: "Finding a tutor, trials and parent accounts" },
  { value: "tutors", label: "Tutors", description: "Joining, verification, payouts and credits" },
  { value: "payments", label: "Payments", description: "Charges, cancellations and refunds" },
  { value: "safety", label: "Safety", description: "Verification, messaging and safeguards" },
];

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-navy-100 px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function FaqView({ faqs }: { faqs: Faq[] }) {
  const [group, setGroup] = React.useState<Group>("all");
  const [query, setQuery] = React.useState("");
  // Browsing: everything starts closed. Searching: matches start open so answers are visible.
  const [openBrowse, setOpenBrowse] = React.useState<string[]>([]);
  const [closedSearch, setClosedSearch] = React.useState<string[]>([]);
  const q = query.trim();

  const matches = React.useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return faqs.filter((f) => {
      if (group !== "all" && f.audience !== group) return false;
      if (!words.length) return true;
      const hay = `${f.q} ${f.a}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [faqs, group, q]);

  const countFor = (g: Group) => faqs.filter((f) => g === "all" || f.audience === g).length;
  const sections = FAQ_GROUPS.map((g) => ({ ...g, items: matches.filter((f) => f.audience === g.value) })).filter((s) => s.items.length);

  const reset = () => {
    setQuery("");
    setGroup("all");
  };

  const results =
    sections.length === 0 ? (
      <EmptyState
        icon={<Search />}
        title="No questions match your search"
        description="Try a different word, or ask us directly — we read every message."
        action={
          <>
            <Button variant="secondary" onClick={reset}>
              <X /> Clear search
            </Button>
            <Button asChild>
              <Link href="/contact">Contact support</Link>
            </Button>
          </>
        }
      />
    ) : (
      <motion.div key={group} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="space-y-14">
        {sections.map((s) => {
          const ids = s.items.map((f) => f.q);
          const value = q ? ids.filter((id) => !closedSearch.includes(id)) : openBrowse.filter((id) => ids.includes(id));
          const onValueChange = (v: string[]) => {
            if (q) setClosedSearch((c) => [...c.filter((id) => !ids.includes(id)), ...ids.filter((id) => !v.includes(id))]);
            else setOpenBrowse((o) => [...o.filter((id) => !ids.includes(id)), ...v]);
          };
          return (
            <section key={s.value} aria-labelledby={`faq-${s.value}`} className="grid gap-6 lg:grid-cols-[1fr_2.2fr] lg:gap-16">
              <div>
                <h2 id={`faq-${s.value}`} className="text-xl font-semibold tracking-tight text-ink">
                  {s.label}
                </h2>
                <p className="mt-1 text-sm text-muted">{s.description}</p>
              </div>
              <Accordion type="multiple" value={value} onValueChange={onValueChange} className="border-t border-line">
                {s.items.map((f) => (
                  <AccordionItem key={f.q} value={f.q}>
                    <AccordionTrigger>{highlight(f.q, q)}</AccordionTrigger>
                    <AccordionContent>{highlight(f.a, q)}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          );
        })}
      </motion.div>
    );

  return (
    <Tabs value={group} onValueChange={(v) => setGroup(v as Group)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <TabsList aria-label="Filter questions by topic" className="min-w-0">
          <TabsTrigger value="all" count={countFor("all")}>All</TabsTrigger>
          {FAQ_GROUPS.map((g) => (
            <TabsTrigger key={g.value} value={g.value} count={countFor(g.value)}>
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="w-full lg:w-80">
          <label htmlFor="faq-search" className="sr-only">
            Search questions
          </label>
          <Input id="faq-search" type="search" icon={<Search />} placeholder="Search questions" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {q ? `${matches.length} ${matches.length === 1 ? "question matches" : "questions match"} “${q}”` : ""}
      </p>

      {(["all", ...FAQ_GROUPS.map((g) => g.value)] as Group[]).map((v) => (
        <TabsContent key={v} value={v} className="pt-10">
          {v === group && results}
        </TabsContent>
      ))}
    </Tabs>
  );
}
