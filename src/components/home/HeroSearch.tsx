"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SUBJECTS } from "@/lib/data/catalog";

/**
 * Search-first hero bar: "what do you want to learn?" + optional ZIP/city. A subject name picked from
 * the suggestions searches that subject; anything else becomes a keyword search.
 */
export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [where, setWhere] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    const match = SUBJECTS.find((s) => s.name.toLowerCase() === text.toLowerCase());
    const params = new URLSearchParams();
    if (match) params.set("subject", match.slug);
    else if (text) params.set("q", text);
    if (where.trim()) params.set("location", where.trim());
    const qs = params.toString();
    router.push(qs ? `/tutors?${qs}` : "/tutors");
  };

  return (
    <form role="search" aria-label="Find a tutor" onSubmit={submit} className="rounded-2xl border border-line bg-surface p-2 shadow-lg">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <label className="flex h-14 items-center gap-3 rounded-xl px-3.5 transition-colors focus-within:bg-canvas hover:bg-canvas">
          <Search className="size-5 shrink-0 text-muted" aria-hidden />
          <span className="sr-only">What do you want to learn?</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            list="hero-subjects"
            placeholder="What do you want to learn?"
            autoComplete="off"
            className="h-full w-full min-w-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
          />
        </label>
        <label className="flex h-14 items-center gap-3 rounded-xl px-3.5 transition-colors focus-within:bg-canvas hover:bg-canvas sm:border-l sm:border-line sm:rounded-l-none">
          <MapPin className="size-5 shrink-0 text-muted" aria-hidden />
          <span className="sr-only">ZIP code or city (optional)</span>
          <input
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="ZIP code"
            autoComplete="postal-code"
            className="h-full w-full min-w-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
          />
        </label>
        <Button type="submit" variant="brand" size="lg" className="h-14 px-8 text-[16px]">
          Search
        </Button>
      </div>
      <datalist id="hero-subjects">
        {SUBJECTS.map((s) => (
          <option key={s.slug} value={s.name} />
        ))}
      </datalist>
    </form>
  );
}
