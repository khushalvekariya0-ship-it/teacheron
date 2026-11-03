import { US_STATES } from "@/lib/data/catalog";
import { clientIp, json, rateLimit, tooMany } from "@/server/http";

/*
 * GET /api/geo?q=<what the person typed>[&kind=city] → { ok, results: [{ id, label, city, state, zip }] }
 *
 * Address suggestions for the "Find your address" box, so city, state and ZIP fill in by themselves;
 * with kind=city, US towns and cities for the City box (it fills in the state); with
 * kind=zips&city=…&state=…, that city's ZIP codes (from Zippopotam.us), so the ZIP can follow the city.
 * Suggestions come from Photon (OpenStreetMap, free, no key). A street address without a ZIP is
 * completed with the US Census geocoder. A bare city gets no ZIP (cities have many; we don't guess).
 * The street address is only used for the lookup; nothing here is stored.
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
const UA = "TutorLink/1.0 (address lookup)";
const cache = new Map<string, GeoResult[]>();

type PhotonProps = { type?: string; name?: string; housenumber?: string; street?: string; city?: string; district?: string; county?: string; state?: string; postcode?: string; countrycode?: string; osm_id?: number };

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

async function lookup(q: string, kind: "address" | "city"): Promise<GeoResult[]> {
  const url = `https://photon.komoot.io/api/?lang=en&limit=10&bbox=-180,17,-64,72${kind === "city" ? "&layer=city" : ""}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const body = (await res.json()) as { features?: { properties?: PhotonProps }[] };
  const seen = new Set<string>();
  const picked: (GeoResult & { street?: string })[] = [];
  for (const f of body.features ?? []) {
    const p = f.properties ?? {};
    const state = STATE_CODE.get((p.state ?? "").toLowerCase());
    // A town result names the town itself; anything smaller carries the town it's in. Counties and states are skipped.
    const city = p.type === "city" ? p.name : p.city;
    if (p.countrycode !== "US" || !state || !city) continue;
    if (kind === "city") {
      // Towns can have several ZIPs, so a city pick fills only the city and state.
      const label = `${city}, ${state}`;
      if (!seen.has(label)) picked.push({ id: String(p.osm_id ?? label), label, city, state, zip: null });
      seen.add(label);
      if (picked.length === 6) break;
      continue;
    }
    const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
    const zip = /^\d{5}/.test(p.postcode ?? "") ? p.postcode!.slice(0, 5) : null;
    const label = [street ?? (p.name !== city ? p.name : undefined), city, `${state}${zip ? ` ${zip}` : ""}`].filter(Boolean).join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    picked.push({ id: String(p.osm_id ?? label), label, city, state, zip, street: p.housenumber ? street : undefined });
    if (picked.length === 5) break;
  }
  // A full street address without a ZIP: ask the Census geocoder.
  await Promise.all(
    picked.map(async (r) => {
      if (r.zip || !r.street) return;
      r.zip = await censusZip(`${r.street}, ${r.city}, ${r.state}`);
      if (r.zip) r.label = `${r.label} ${r.zip}`;
    }),
  );
  return picked.map((r) => ({ id: r.id, label: r.label, city: r.city, state: r.state, zip: r.zip }));
}

const zipCache = new Map<string, string[]>();

/** Every ZIP code of one US city (exact name match), or [] if it isn't known. */
async function cityZips(city: string, state: string): Promise<string[]> {
  const res = await fetch(`https://api.zippopotam.us/us/${state.toLowerCase()}/${encodeURIComponent(city)}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`zippopotam ${res.status}`);
  const body = (await res.json()) as { places?: { "place name"?: string; "post code"?: string }[] };
  const exact = (body.places ?? []).filter((pl) => (pl["place name"] ?? "").toLowerCase() === city.toLowerCase());
  return [...new Set(exact.map((pl) => pl["post code"] ?? "").filter((z) => /^\d{5}$/.test(z)))];
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("kind") === "zips") {
    const city = (params.get("city") ?? "").trim().slice(0, 80);
    const state = (params.get("state") ?? "").trim().toUpperCase();
    if (!city || !US_STATES.some((s) => s.value === state)) return json({ ok: true, zips: [] });
    const limit = rateLimit(`geo:${clientIp(request)}`, 60, 60_000);
    if (!limit.ok) return tooMany(limit.retryAfterSec);
    const key = `${state}:${city.toLowerCase()}`;
    try {
      const zips = zipCache.get(key) ?? (await cityZips(city, state));
      if (zipCache.size > 500) zipCache.delete(zipCache.keys().next().value!);
      zipCache.set(key, zips);
      return json({ ok: true, zips });
    } catch {
      return json({ ok: false, zips: null }, { status: 502 });
    }
  }
  const q = (params.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const kind = params.get("kind") === "city" ? "city" : "address";
  if (q.length < (kind === "city" ? 2 : 3)) return json({ ok: true, results: [] });
  const limit = rateLimit(`geo:${clientIp(request)}`, 60, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec);
  const key = `${kind}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return json({ ok: true, results: hit });
  try {
    const results = await lookup(q, kind);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, results);
    return json({ ok: true, results });
  } catch {
    return json({ ok: false, error: "Address search isn't answering right now. Type your city, state and ZIP instead.", results: [] }, { status: 502 });
  }
}
