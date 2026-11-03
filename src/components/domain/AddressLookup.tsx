"use client";

import * as React from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { SuggestionList, useGeoSuggest, type GeoResult } from "./geoSuggest";

export interface PickedAddress {
  city: string;
  state: string;
  zip: string | null;
}

/**
 * "Find your address": type a street address, pick it, and city, state and ZIP fill in.
 * Only those three are kept; the street address is used for the lookup and then dropped.
 * With `collapsed`, it starts as a small "Find my ZIP from my address" link.
 */
export function AddressLookup({ onPick, collapsed = false, className }: { onPick: (a: PickedAddress) => void; collapsed?: boolean; className?: string }) {
  const id = React.useId();
  const listId = `${id}-list`;
  const suggest = useGeoSuggest("address");
  const [open, setOpen] = React.useState(!collapsed);
  const [q, setQ] = React.useState("");
  const [done, setDone] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pick = (r: GeoResult) => {
    onPick({ city: r.city, state: r.state, zip: r.zip });
    setDone(r.zip ? `Filled in: ${r.city}, ${r.state} ${r.zip}` : `Filled in ${r.city}, ${r.state}. Add your street and number to get the ZIP, or type it below.`);
    setQ(r.label);
    suggest.setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline decoration-brand underline-offset-4 hover:decoration-2", className)}
      >
        <MapPin className="size-3.5" aria-hidden /> Don&apos;t know your ZIP? Find it from your address
      </button>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={`${id}-input`} className="block text-sm font-medium text-ink">
        Find your address
      </label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={`${id}-input`}
          {...suggest.comboProps(listId)}
          aria-describedby={`${id}-hint`}
          placeholder="Start typing, e.g. 233 S Wacker Dr, Chicago"
          icon={<Search />}
          suffix={suggest.loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setDone(null);
            suggest.search(e.target.value);
          }}
          onKeyDown={(e) => suggest.onKeyDown(e, pick)}
          onFocus={() => suggest.results.length && suggest.setOpen(true)}
          onBlur={() => setTimeout(() => suggest.setOpen(false), 150)}
        />
        <SuggestionList listId={listId} suggest={suggest} query={q} onPick={pick} empty="No US address found. Try adding the city, or type your city, state and ZIP below." />
      </div>
      <p id={`${id}-hint`} role={done || suggest.error ? "status" : undefined} className={cn("text-[13px]", suggest.error ? "text-danger" : done ? "text-success" : "text-muted")}>
        {suggest.error ?? done ?? "Pick your address and the city, state and ZIP fill in. Your street address isn't saved."}
      </p>
    </div>
  );
}

/** A picked city, with its ZIP codes on the way (null if they couldn't be looked up). */
export interface PickedCity {
  city: string;
  state: string;
  zips: Promise<string[] | null>;
}

async function fetchZips(city: string, state: string): Promise<string[] | null> {
  try {
    const res = await fetch(`/api/geo?kind=zips&state=${state}&city=${encodeURIComponent(city)}`);
    const body = (await res.json()) as { ok: boolean; zips: string[] | null };
    return body.ok ? body.zips : null;
  } catch {
    return null;
  }
}

/** After a city is picked: keep the ZIP if it belongs to that city, fill it in if the city has only one, otherwise clear it. */
export function zipForCity(current: string, zips: string[] | null): string {
  if (!zips) return current; // couldn't check, so leave it alone
  if (zips.includes(current.trim())) return current;
  return zips.length === 1 ? zips[0] : "";
}

/**
 * The City box: type a few letters, pick a US town or city, and the state fills in too.
 * Works like a normal text box with react-hook-form's register() (any city can still be typed).
 */
export const CityInput = React.forwardRef<HTMLInputElement, InputProps & { onPick: (c: PickedCity) => void }>(function CityInput(
  { onPick, onChange, onBlur, onKeyDown, onFocus, ...props },
  ref,
) {
  const listId = `${React.useId()}-cities`;
  const suggest = useGeoSuggest("city");
  const [q, setQ] = React.useState("");

  const pick = (r: GeoResult) => {
    onPick({ city: r.city, state: r.state, zips: fetchZips(r.city, r.state) });
    setQ(r.city);
    suggest.setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        ref={ref}
        {...props}
        {...suggest.comboProps(listId)}
        // Always a suffix slot, so the spinner appearing doesn't rebuild the box and drop the cursor.
        suffix={suggest.loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : (props.suffix ?? <span aria-hidden />)}
        onChange={(e) => {
          onChange?.(e);
          setQ(e.target.value);
          suggest.search(e.target.value);
        }}
        onKeyDown={(e) => {
          suggest.onKeyDown(e, pick);
          onKeyDown?.(e);
        }}
        onFocus={(e) => {
          if (suggest.results.length) suggest.setOpen(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          setTimeout(() => suggest.setOpen(false), 150);
        }}
      />
      <SuggestionList listId={listId} suggest={suggest} query={q} onPick={pick} empty="No US city by that name. Check the spelling, or just type it in." />
    </div>
  );
});
