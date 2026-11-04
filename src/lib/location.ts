import { COUNTRIES, type Country } from "./data/countries";

/*
 * Countries and their states/provinces, for every location form (sign-up, profiles, settings, job posts).
 * `state` is saved as the 2-letter code in the US ("IL", as Americans write it) and as the region's name
 * everywhere else ("Gujarat"). The region lists (regions.json) load only when a form needs them.
 */

export { COUNTRIES, type Country };
export const DEFAULT_COUNTRY = "US";

const NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]));
export const isCountryCode = (c: string | null | undefined): c is string => !!c && NAMES.has(c);
export const countryName = (c: string | null | undefined) => (c && NAMES.get(c)) || "";

export interface Region {
  name: string;
  code?: string;
}

type RegionData = Record<string, [string, string?][]>;
let data: Promise<RegionData> | null = null;
const load = () => (data ??= import("./data/regions.json").then((m) => (m.default ?? m) as unknown as RegionData));

/** A country's states, provinces or regions, alphabetical. */
export async function regionsOf(country: string): Promise<Region[]> {
  const all = await load();
  return (all[country] ?? []).map(([name, code]) => ({ name, code }));
}

/** What's saved as `state` for a region. */
export const regionValue = (country: string, r: Region) => (country === "US" && r.code ? r.code : r.name);

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(state|province|region|prefecture|county|district|territory|union territory|of|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The region a map service named ("Gujarat", "New York", "Bavaria"), found in a country's list. */
export function matchRegion(regions: Region[], raw: string | null | undefined): Region | undefined {
  if (!raw) return undefined;
  const n = norm(raw);
  if (!n) return undefined;
  return (
    regions.find((r) => norm(r.name) === n || (r.code && r.code.toLowerCase() === raw.trim().toLowerCase())) ??
    regions.find((r) => norm(r.name).startsWith(n) || n.startsWith(norm(r.name))) ??
    regions.find((r) => norm(r.name).includes(n) || n.includes(norm(r.name)))
  );
}

const ZONE_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Europe/London": "GB", "Asia/Dubai": "AE", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Kathmandu": "NP",
  "Asia/Singapore": "SG", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "America/Toronto": "CA", "America/Vancouver": "CA", "Europe/Berlin": "DE",
  "Europe/Paris": "FR", "Africa/Lagos": "NG", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA", "Asia/Tokyo": "JP", "Asia/Manila": "PH",
};

/** The visitor's likely country, from the browser's language ("en-IN" → IN) or time zone; the US if unknown. */
export function guessCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).region;
    if (isCountryCode(region)) return region;
  } catch {}
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (ZONE_COUNTRY[zone]) return ZONE_COUNTRY[zone];
  } catch {}
  return DEFAULT_COUNTRY;
}

/** "Rajkot, Gujarat, India"; US places read "Chicago, IL". */
export function formatPlace(p: { city?: string | null; state?: string | null; country?: string | null }): string {
  const country = p.country && p.country !== "US" ? countryName(p.country) : "";
  return [p.city, p.state, country].filter((x) => x && String(x).trim()).join(", ");
}
