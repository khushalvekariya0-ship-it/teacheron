"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const RADII = [5, 10, 25];

/** ZIP + distance search for in-person tutors. Opens the directory filtered to that area. */
export function ZipSearch({ className }: { className?: string }) {
  const router = useRouter();
  const id = React.useId();
  const [zip, setZip] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [error, setError] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip.trim())) {
      setError(true);
      return;
    }
    const p = new URLSearchParams({ mode: "in_person", location: zip.trim(), radius: String(radius) });
    router.push(`/tutors?${p.toString()}`);
  };

  return (
    <form onSubmit={submit} noValidate className={className} role="search" aria-label="Find tutors near a ZIP code">
      <div className={cn("flex flex-col gap-2 rounded-2xl border bg-surface p-2 shadow-lg transition-colors sm:flex-row sm:items-center", error ? "border-danger" : "border-line-strong focus-within:border-brand")}>
        <label htmlFor={`${id}-zip`} className="sr-only">
          ZIP code
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-3">
          <MapPin className="size-5 shrink-0 text-muted" aria-hidden />
          <input
            id={`${id}-zip`}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="Your ZIP code"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, ""));
              setError(false);
            }}
            aria-invalid={error || undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted sm:h-14 sm:text-[17px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-radius`} className="sr-only">
            Distance
          </label>
          <div className="relative flex-1 sm:flex-none">
            <select
              id={`${id}-radius`}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="h-12 w-full appearance-none rounded-xl border border-line bg-canvas pl-3.5 pr-9 text-[15px] font-medium text-ink outline-none focus:border-brand sm:h-14"
            >
              {RADII.map((r) => (
                <option key={r} value={r}>
                  Within {r} miles
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          </div>
          <Button type="submit" variant="brand" size="lg" className="h-12 shrink-0 px-5 sm:h-14 sm:px-7">
            Search <ArrowRight />
          </Button>
        </div>
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-2 text-[13.5px] text-danger">
          Enter a 5-digit ZIP code.
        </p>
      )}
    </form>
  );
}
