import { US_STATES } from "@/lib/data/catalog";
import regionData from "@/lib/data/regions.json";
import { countryName, DEFAULT_COUNTRY, isCountryCode, matchRegion, type Region } from "@/lib/location";
import { isPostalCode } from "@/lib/postal";
import { clientIp, json, rateLimit, tooMany } from "@/server/http";

/*
 * Place lookups for the location forms, in any country (country=XX, ISO code; the US when left out):
 *   ?q=<address>                         address suggestions ("Find your address"): city, state and postal code
 *   ?kind=city&q=<text>                  towns and cities, so the City box fills in the state
 *   ?kind=zips&city=…&state=…            that city's postal codes, so the code can follow the city
 *   ?kind=place&code=<postal code>       the city and state of a postal code
 * Sources (free, no key): Photon (OpenStreetMap) for places; the US Census geocoder for a US street address
 * without a ZIP; Zippopotam.us for US ZIP codes and other countries' codes; India Post for Indian PIN codes.
 * `state` comes back as the 2-letter code in the US and the region's name elsewhere. Nothing is stored.
 */
export const dynamic = "force-dynamic";

export interface GeoResult {
  id: string;
  label: string;
  city: string;
  state: string;
  zip: string | null;
}

const STATE_CODE = new Map(US_STATES.map((s) => [s.label.toLowerCase(), s.value]));
const REGIONS = regionData as unknown as Record<string, [string, string?][]>;
const regionsOf = (country: string): Region[] => (REGIONS[country] ?? []).map(([name, code]) => ({ name, code }));
const UA = "TutorLink/1.0 (address lookup)";
const cache = new Map<string, unknown>();
const remember = <T,>(key: string, value: T): T => {
  if (cache.size > 1000) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
  return value;
};
const norm = (s: string | null | undefined) => (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A map service's region name → what the forms save (US code, or the region's name from our list). */
function stateFor(country: string, raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (country === "US") return STATE_CODE.get(raw.toLowerCase());
  return matchRegion(regionsOf(country), raw)?.name ?? raw;
}

type PhotonProps = { type?: string; name?: string; housenumber?: string; street?: string; city?: string; district?: string; county?: string; state?: string; postcode?: string; countrycode?: string; osm_id?: number };

async function photon(q: string, kind: "address" | "city", country: string): Promise<PhotonProps[]> {
  // The US keeps its map box (sharper results); elsewhere the whole world is searched and filtered.
  const box = country === "US" ? "&bbox=-180,17,-64,72" : "";
  const url = `https://photon.komoot.io/api/?lang=en&limit=${country === "US" ? 10 : 20}${box}${kind === "city" ? "&layer=city" : ""}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const body = (await res.json()) as { features?: { properties?: PhotonProps }[] };
  return (body.features ?? []).map((f) => f.properties ?? {}).filter((p) => p.countrycode === country);
}

async function censusZip(address: string): Promise<string | null> {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(4000) });
    const body = (await res.json()) as { result?: { addressMatches?: { addressComponents?: { zip?: string } }[] } };
    const zip = body.result?.addressMatches?.[0]?.addressComponents?.zip ?? "";
    return /^\d{5}$/.test(zip) ? zip : null;
  } catch {
    return null;
  }
}

async function lookup(q: string, kind: "address" | "city", country: string): Promise<GeoResult[]> {
  let found = await photon(q, kind, country);
  // A place name shared with other countries ("Manchester") may need the country to come up.
  if (found.length < 3 && country !== "US") found = [...found, ...(await photon(`${q}, ${countryName(country)}`, kind, country))];
  const seen = new Set<string>();
  const picked: (GeoResult & { street?: string })[] = [];
  for (const p of found) {
    const state = stateFor(country, p.state);
    // A town result names the town itself; anything smaller carries the town it's in. Counties and states are skipped.
    const city = p.type === "city" || p.type === "town" || p.type === "village" ? p.name : p.city;
    if (!city || (country === "US" && !state)) continue;
    const where = [city, state].filter(Boolean).join(", ");
    if (kind === "city") {
      // Towns can have several postal codes, so a city pick fills only the city and state.
      if (!seen.has(where)) picked.push({ id: String(p.osm_id ?? where), label: where, city, state: state ?? "", zip: null });
      seen.add(where);
      if (picked.length === 6) break;
      continue;
    }
    const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
    const zip = country === "US" ? (/^\d{5}/.test(p.postcode ?? "") ? p.postcode!.slice(0, 5) : null) : p.postcode && isPostalCode(p.postcode, country) ? p.postcode : null;
    const label = [street ?? (p.name !== city ? p.name : undefined), city, `${state ?? ""}${zip ? ` ${zip}` : ""}`.trim()].filter(Boolean).join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    picked.push({ id: String(p.osm_id ?? label), label, city, state: state ?? "", zip, street: p.housenumber ? street : undefined });
    if (picked.length === 5) break;
  }
  // A full US street address without a ZIP: ask the Census geocoder.
  if (country === "US") {
    await Promise.all(
      picked.map(async (r) => {
        if (r.zip || !r.street) return;
        r.zip = await censusZip(`${r.street}, ${r.city}, ${r.state}`);
        if (r.zip) r.label = `${r.label} ${r.zip}`;
      }),
    );
  }
  return picked.map((r) => ({ id: r.id, label: r.label, city: r.city, state: r.state, zip: r.zip }));
}

type IndiaPost = { Name?: string; Block?: string; Division?: string; District?: string; State?: string; Pincode?: string };

async function indiaPost(path: string): Promise<IndiaPost[]> {
  const res = await fetch(`https://api.postalpincode.in/${path}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`india post ${res.status}`);
  const body = (await res.json()) as { Status?: string; PostOffice?: IndiaPost[] | null }[];
  return body?.[0]?.PostOffice ?? [];
}

/** A city's postal codes (up to 40), or [] if they can't be found. */
async function cityCodes(country: string, city: string, state: string): Promise<string[]> {
  if (country === "US") {
    if (!US_STATES.some((s) => s.value === state)) return [];
    const res = await fetch(`https://api.zippopotam.us/us/${state.toLowerCase()}/${encodeURIComponent(city)}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`zippopotam ${res.status}`);
    const body = (await res.json()) as { places?: { "place name"?: string; "post code"?: string }[] };
    const exact = (body.places ?? []).filter((pl) => norm(pl["place name"]) === norm(city));
    return [...new Set(exact.map((pl) => pl["post code"] ?? "").filter((z) => /^\d{5}$/.test(z)))].sort();
  }
  if (country === "IN") {
    const c = norm(city);
    const offices = (await indiaPost(`postoffice/${encodeURIComponent(city)}`)).filter((o) => !state || norm(o.State) === norm(state));
    // Post offices in the city itself first; otherwise every office of the district by that name.
    const inCity = offices.filter((o) => norm(o.Name).startsWith(c) || norm(o.Block) === c || norm(o.Division) === c);
    const pick = inCity.length ? inCity : offices.filter((o) => norm(o.District) === c);
    return [...new Set(pick.map((o) => o.Pincode ?? "").filter((p) => isPostalCode(p, "IN")))].sort().slice(0, 40);
  }
  // Elsewhere: the postal code the map gives for the town, when it has one.
  const found = await photon(`${city}${state ? `, ${state}` : ""}, ${countryName(country)}`, "city", country);
  const town = found.filter((p) => norm(p.name) === norm(city) && p.postcode && isPostalCode(p.postcode, country));
  return [...new Set(town.map((p) => p.postcode!))].slice(0, 10);
}

/** The city and state of a postal code, or null. */
async function placeOf(country: string, code: string): Promise<{ city: string; state: string } | null> {
  if (country === "IN") {
    const o = (await indiaPost(`pincode/${encodeURIComponent(code)}`))[0];
    if (!o) return null;
    const city = o.Block && o.Block !== "NA" ? o.Block : (o.District ?? "");
    return city ? { city, state: stateFor("IN", o.State) ?? o.State ?? "" } : null;
  }
  // The UK and Canada are looked up by the first part of the code ("M1" of "M1 1AE", "K1A" of "K1A 0B1").
  const tries = [code.trim().toUpperCase()];
  if (country === "GB") tries.push(code.trim().split(/\s+/)[0].toUpperCase());
  if (country === "CA") tries.push(code.replace(/\s+/g, "").slice(0, 3).toUpperCase());
  let res: Response | null = null;
  for (const c of [...new Set(tries)]) {
    res = await fetch(`https://api.zippopotam.us/${country.toLowerCase()}/${encodeURIComponent(c)}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
    if (res.status !== 404) break;
  }
  if (!res || res.status === 404) return null;
  if (!res.ok) throw new Error(`zippopotam ${res.status}`);
  const body = (await res.json()) as { places?: { "place name"?: string; state?: string; "state abbreviation"?: string }[] };
  const pl = body.places?.[0];
  if (!pl?.["place name"]) return null;
  const state = country === "US" ? (pl["state abbreviation"] ?? "") : (stateFor(country, pl.state) ?? pl.state ?? "");
  return { city: pl["place name"], state };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const rawCountry = (params.get("country") ?? DEFAULT_COUNTRY).toUpperCase();
  const country = isCountryCode(rawCountry) ? rawCountry : DEFAULT_COUNTRY;
  const limited = () => {
    const limit = rateLimit(`geo:${clientIp(request)}`, 60, 60_000);
    return limit.ok ? null : tooMany(limit.retryAfterSec);
  };

  if (kind === "zips") {
    const city = (params.get("city") ?? "").trim().slice(0, 80);
    const state = (params.get("state") ?? "").trim().slice(0, 80);
    if (!city) return json({ ok: true, zips: [] });
    const block = limited();
    if (block) return block;
    const key = `zips:${country}:${state.toLowerCase()}:${city.toLowerCase()}`;
    try {
      const zips = (cache.get(key) as string[] | undefined) ?? remember(key, await cityCodes(country, city, country === "US" ? state.toUpperCase() : state));
      return json({ ok: true, zips });
    } catch {
      return json({ ok: false, zips: null }, { status: 502 });
    }
  }

  if (kind === "place") {
    const code = (params.get("code") ?? "").trim().slice(0, 12);
    if (!isPostalCode(code, country)) return json({ ok: true, place: null });
    const block = limited();
    if (block) return block;
    const key = `place:${country}:${code.toUpperCase()}`;
    try {
      const place = cache.has(key) ? (cache.get(key) as { city: string; state: string } | null) : remember(key, await placeOf(country, code));
      return json({ ok: true, place });
    } catch {
      return json({ ok: false, place: null }, { status: 502 });
    }
  }

  const q = (params.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const what = kind === "city" ? "city" : "address";
  if (q.length < (what === "city" ? 2 : 3)) return json({ ok: true, results: [] });
  const block = limited();
  if (block) return block;
  const key = `${what}:${country}:${q.toLowerCase()}`;
  const hit = cache.get(key) as GeoResult[] | undefined;
  if (hit) return json({ ok: true, results: hit });
  try {
    return json({ ok: true, results: remember(key, await lookup(q, what, country)) });
  } catch {
    return json({ ok: false, error: "Address search isn't answering right now. Type your city, state and postal code instead.", results: [] }, { status: 502 });
  }
}
