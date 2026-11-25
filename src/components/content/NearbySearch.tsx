"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useViewerCountry } from "@/lib/store/hooks";
import { findPlace, looksPostal } from "@/lib/find-place";
import { postalLabel } from "@/lib/postal";

/**
 * "Tutors near you" search, in any country: a PIN, ZIP or postal code (looked up in the visitor's own country)
 * or a city name. Opens the directory with in-person tutors whose own travel area covers that place.
 */
export function NearbySearch({ className }: { className?: string }) {
  const router = useRouter();
  const id = React.useId();
  const country = useViewerCountry();
  // "PIN code" in India, "ZIP code" in the US, "postal code" elsewhere.
  const code = /^(PIN|ZIP)/.test(postalLabel(country)) ? postalLabel(country) : postalLabel(country).toLowerCase();
  const [text, setText] = React.useState("");
  const [looking, setLooking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return setError(`Enter your ${code} or city.`);
    setLooking(true);
    const found = await findPlace(v, country);
    setLooking(false);
    if ("location" in found) {
      router.push(`/tutors?${new URLSearchParams({ mode: "in_person", location: found.location }).toString()}`);
      return;
    }
    if (found.problem === "failed") setError("We couldn't look that up just now. Check your connection and try again.");
    else setError(looksPostal(v, country) ? "We couldn't find this code. Try your city name instead." : "We couldn't find that place. Try a city name, e.g. “Ahmedabad” or “London”.");
  };

  return (
    <form onSubmit={submit} noValidate className={className} role="search" aria-label="Find tutors near you">
      <div className={cn("flex flex-col gap-2 rounded-2xl border bg-surface p-2 shadow-lg transition-colors sm:flex-row sm:items-center", error ? "border-danger" : "border-line-strong focus-within:border-brand")}>
        <label htmlFor={`${id}-place`} className="sr-only">
          Your {code} or city
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-3">
          <MapPin className="size-5 shrink-0 text-muted" aria-hidden />
          <input
            id={`${id}-place`}
            autoComplete="postal-code"
            enterKeyHint="search"
            maxLength={80}
            placeholder={`Your ${code} or city`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted sm:h-14 sm:text-[17px]"
          />
        </div>
        <Button type="submit" variant="brand" size="lg" disabled={looking} className="h-12 shrink-0 px-5 sm:h-14 sm:px-7">
          {looking ? "Finding…" : "Search"} {!looking && <ArrowRight />}
        </Button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-[13.5px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
