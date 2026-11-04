"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/** A place from GET /api/geo. `zip` is null when it can't be known (a bare city has many). */
export interface GeoResult {
  id: string;
  label: string;
  city: string;
  state: string;
  zip: string | null;
}

/** Search-as-you-type against /api/geo: debounced, newest answer wins, keyboard navigation. `country` is an ISO code. */
export function useGeoSuggest(kind: "address" | "city", country = "US") {
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [active, setActive] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const seq = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const minChars = kind === "city" ? 2 : 4;

  const search = (text: string) => {
    clearTimeout(timer.current);
    const n = ++seq.current;
    if (text.trim().length < minChars) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo?kind=${kind}&country=${encodeURIComponent(country)}&q=${encodeURIComponent(text.trim())}`);
        const body = (await res.json()) as { ok: boolean; error?: string; results: GeoResult[] };
        if (n !== seq.current) return; // a newer search is on its way
        setResults(body.results ?? []);
        setError(body.ok ? null : (body.error ?? "Address search isn't answering right now."));
        setActive(-1);
        setOpen(true);
      } catch {
        if (n === seq.current) setError("Address search isn't answering right now. Type your city, state and postal code instead.");
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, kind === "city" ? 250 : 350);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, pick: (r: GeoResult) => void) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // pick the suggestion instead of submitting the form
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  /** ARIA wiring for the text box that owns the list. */
  const comboProps = (listId: string) => ({
    role: "combobox" as const,
    "aria-expanded": open && results.length > 0,
    "aria-controls": listId,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": active >= 0 ? `${listId}-${active}` : undefined,
    autoComplete: "off",
  });

  return { results, active, setActive, loading, error, open, setOpen, search, onKeyDown, comboProps, minChars };
}

/** The dropdown under the text box. */
export function SuggestionList({ listId, suggest, query, onPick, empty }: { listId: string; suggest: ReturnType<typeof useGeoSuggest>; query: string; onPick: (r: GeoResult) => void; empty: string }) {
  const { results, active, setActive, open, loading, error, minChars } = suggest;
  if (!open || !(results.length > 0 || (!loading && query.trim().length >= minChars && !error))) return null;
  return (
    <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-xl">
      {results.length === 0 ? (
        <li className="px-3.5 py-2.5 text-[13.5px] text-muted">{empty}</li>
      ) : (
        results.map((r, i) => (
          <li
            key={r.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault(); // keep focus so blur doesn't close the list first
              onPick(r);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn("flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 text-[14px] text-ink", i === active && "bg-canvas")}
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <span>{r.label}</span>
          </li>
        ))
      )}
    </ul>
  );
}
