"use client";

import * as React from "react";
import { Globe, Loader2, MapPin } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Input";
import { resolveLocation } from "@/lib/data/geo";
import { COUNTRIES, regionsOf, regionValue, type Region } from "@/lib/location";
import { isPostalCode, POSTAL_MAX_LENGTH, postalLabel, postalNumeric, postalPlaceholder } from "@/lib/postal";
import { cn } from "@/lib/utils";
import { AddressLookup, CityInput, fetchPlace, fetchZips, type PickedCity } from "./AddressLookup";

/*
 * Country, postal code, city and state for any country, filling each other in:
 *   - pick a city from the suggestions → its state, and its postal code when it has one (several → choose);
 *   - type a city and choose its state → the postal code is looked up the same way;
 *   - type a postal code first → its city and state fill in.
 * `state` is saved as the 2-letter code in the US and the region's name elsewhere (see src/lib/location.ts).
 * Controlled: the form passes the values in and applies the changes it gets back.
 */

export interface LocationValue {
  country: string;
  zip: string;
  city: string;
  state: string;
}

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export const regionLabel = (country: string) => (country === "CA" ? "Province" : country === "GB" ? "County / region" : country === "US" || country === "IN" || country === "AU" ? "State" : "State / province");

/** A country's regions, loaded on demand (null while loading). */
function useRegions(country: string): Region[] | null {
  const [loaded, setLoaded] = React.useState<{ country: string; list: Region[] } | null>(null);
  React.useEffect(() => {
    let alive = true;
    void regionsOf(country).then((list) => {
      if (alive) setLoaded({ country, list });
    });
    return () => {
      alive = false;
    };
  }, [country]);
  return loaded?.country === country ? loaded.list : null;
}

export function LocationFields({
  value,
  onChange,
  errors = {},
  required = {},
  idPrefix,
  addressLookup = true,
  className,
}: {
  value: LocationValue;
  onChange: (patch: Partial<LocationValue>) => void;
  errors?: Partial<Record<keyof LocationValue, string | undefined>>;
  required?: Partial<Record<keyof LocationValue, boolean>>;
  idPrefix: string;
  addressLookup?: boolean;
  className?: string;
}) {
  const { country, zip, city, state } = value;
  const regions = useRegions(country);
  const [choices, setChoices] = React.useState<{ key: string; zips: string[] } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const lastLookup = React.useRef("");
  const zipTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = React.useRef(0);
  const code = postalLabel(country);
  const key = `${country}|${city.trim().toLowerCase()}|${state}`;
  const shownChoices = choices && choices.key === key ? choices.zips : null;

  /** A city's postal codes arrived: keep a matching one, fill a single one, or offer the list. */
  const applyZips = (zips: string[] | null, forKey: string, currentZip: string) => {
    if (!zips || !zips.length) return setChoices(null);
    if (zips.includes(currentZip.trim())) return setChoices(zips.length > 1 ? { key: forKey, zips } : null);
    if (zips.length === 1) {
      onChange({ zip: zips[0] });
      return setChoices(null);
    }
    if (currentZip.trim()) onChange({ zip: "" });
    setChoices({ key: forKey, zips });
  };

  const lookupZips = async (c: string, s: string, currentZip: string) => {
    const k = `${country}|${c.trim().toLowerCase()}|${s}`;
    if (!c.trim() || (country === "US" && !s) || lastLookup.current === k) return;
    lastLookup.current = k;
    const n = ++seq.current;
    setBusy(true);
    const zips = await fetchZips(c.trim(), s, country);
    if (n !== seq.current) return;
    setBusy(false);
    applyZips(zips, k, currentZip);
  };

  const onCityPick = async (picked: PickedCity) => {
    onChange({ city: picked.city, state: picked.state });
    const k = `${country}|${picked.city.trim().toLowerCase()}|${picked.state}`;
    lastLookup.current = k;
    const n = ++seq.current;
    setBusy(true);
    const zips = await picked.zips;
    if (n !== seq.current) return;
    setBusy(false);
    applyZips(zips, k, zip);
  };

  const onZipChange = (raw: string) => {
    const next = (postalNumeric(country) ? raw.replace(/\D/g, "") : raw.toUpperCase()).slice(0, POSTAL_MAX_LENGTH);
    onChange({ zip: next });
    clearTimeout(zipTimer.current);
    // A postal code typed first fills in its city and state.
    if (isPostalCode(next, country) && !city.trim()) {
      zipTimer.current = setTimeout(async () => {
        const n = ++seq.current;
        setBusy(true);
        const place = await fetchPlace(next, country);
        if (n !== seq.current) return;
        setBusy(false);
        if (place) {
          lastLookup.current = `${country}|${place.city.trim().toLowerCase()}|${place.state}`;
          onChange({ city: place.city, state: place.state });
        }
      }, 450);
    }
  };

  // The US keeps its offline "near Chicago, IL" hint for a ZIP code.
  const usPoint = country === "US" && /^\d{5}$/.test(zip) ? resolveLocation(zip) : null;
  const regionOptions = (regions ?? []).map((r) => ({ value: regionValue(country, r), label: country === "US" && r.code ? `${r.name}` : r.name }));
  if (state && !regionOptions.some((o) => o.value === state)) regionOptions.unshift({ value: state, label: state });

  return (
    <div className={cn("space-y-4", className)}>
      <Field label="Country" id={`${idPrefix}-country`} required={required.country} error={errors.country}>
        <Select
          id={`${idPrefix}-country`}
          options={COUNTRY_OPTIONS}
          value={country}
          autoComplete="country"
          onChange={(e) => {
            const next = e.target.value;
            if (next === country) return;
            lastLookup.current = "";
            setChoices(null);
            onChange({ country: next, state: "", zip: "" });
          }}
        />
      </Field>

      {addressLookup && (
        <AddressLookup
          key={country}
          collapsed
          country={country}
          onPick={(a) => {
            lastLookup.current = `${country}|${a.city.trim().toLowerCase()}|${a.state}`;
            setChoices(null);
            onChange({ city: a.city, state: a.state, ...(a.zip ? { zip: a.zip } : {}) });
            if (!a.zip) void lookupZips(a.city, a.state, "");
          }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label={code} id={`${idPrefix}-zip`} required={required.zip} error={errors.zip} hint={usPoint ? usPoint.label.replace(/^\d{5} · /, "") : undefined}>
          <Input
            id={`${idPrefix}-zip`}
            value={zip}
            inputMode={postalNumeric(country) ? "numeric" : "text"}
            autoComplete="postal-code"
            maxLength={POSTAL_MAX_LENGTH}
            placeholder={postalPlaceholder(country)}
            icon={<MapPin />}
            suffix={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <span aria-hidden />}
            onChange={(e) => onZipChange(e.target.value)}
          />
        </Field>
        <Field label="City" id={`${idPrefix}-city`} required={required.city} error={errors.city}>
          <CityInput
            key={country}
            id={`${idPrefix}-city`}
            country={country}
            value={city}
            autoComplete="address-level2"
            placeholder={country === "US" ? "e.g. Brooklyn" : country === "IN" ? "e.g. Rajkot" : ""}
            onChange={(e) => {
              onChange({ city: e.target.value });
              setChoices(null);
            }}
            onBlur={() => void lookupZips(city, state, zip)}
            onPick={(p) => void onCityPick(p)}
          />
        </Field>
        <Field label={regionLabel(country)} id={`${idPrefix}-state`} required={required.state} error={errors.state}>
          {regions && regions.length === 0 ? (
            <Input id={`${idPrefix}-state`} value={state} autoComplete="address-level1" onChange={(e) => onChange({ state: e.target.value })} />
          ) : (
            <Select
              id={`${idPrefix}-state`}
              options={regionOptions}
              value={state}
              placeholder={regions ? "Choose" : "Loading…"}
              autoComplete="address-level1"
              onChange={(e) => {
                const next = e.target.value;
                onChange({ state: next });
                void lookupZips(city, next, zip);
              }}
            />
          )}
        </Field>
      </div>

      {shownChoices && (
        <div role="group" aria-label={`Choose your ${code}`} className="rounded-xl border border-line bg-canvas p-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Globe className="size-3.5 text-muted" aria-hidden />
            {city.trim() || "This city"} has {shownChoices.length} {code}s. Pick yours:
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {shownChoices.map((z) => (
              <button
                key={z}
                type="button"
                data-postal-choice={z}
                aria-pressed={zip === z}
                onClick={() => onChange({ zip: z })}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-[13px] tabular-nums transition-colors",
                  zip === z ? "border-ink bg-ink text-on-ink" : "border-line-strong bg-surface text-ink hover:border-ink",
                )}
              >
                {z}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-muted">Not sure? Check a letter or your address on any delivery app, or type it in.</p>
        </div>
      )}
    </div>
  );
}
