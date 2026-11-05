import "server-only";
import { countryName } from "@/lib/location";
import { db } from "./db";

/*
 * Map coordinates for places outside the built-in US list, from Photon (OpenStreetMap; free, no key).
 * Used so "tutors near me" works in every country: a tutor's city gets coordinates when they save it,
 * and a place typed into search is turned into a point. Nothing about the person is sent: only the
 * place name.
 */

export interface Point {
  lat: number;
  lng: number;
  label: string;
}

const cache = new Map<string, Point | null>();

/** The best match for a place name ("Rajkot, Gujarat"), optionally inside one country (ISO code). */
export async function pointOf(place: string, country?: string): Promise<Point | null> {
  const q = place.trim().replace(/\s+/g, " ").slice(0, 120);
  if (q.length < 2) return null;
  const key = `${country ?? "*"}:${q.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;
  const url = `https://photon.komoot.io/api/?lang=en&limit=8&q=${encodeURIComponent(country ? `${q}, ${countryName(country)}` : q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "TutorLink/1.0 (place lookup)" }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const body = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] }; properties?: { name?: string; city?: string; state?: string; country?: string; countrycode?: string; type?: string } }[] };
  const hits = (body.features ?? []).filter((f) => Array.isArray(f.geometry?.coordinates) && (!country || f.properties?.countrycode === country));
  // Towns and cities first: they're what people mean by "near".
  const best = hits.find((f) => ["city", "town", "village", "district", "county"].includes(f.properties?.type ?? "")) ?? hits[0];
  let point: Point | null = null;
  if (best) {
    const [lng, lat] = best.geometry!.coordinates!;
    const p = best.properties ?? {};
    const label = [p.name ?? p.city, p.state, p.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
    if (Number.isFinite(lat) && Number.isFinite(lng)) point = { lat: Math.round(lat * 10_000) / 10_000, lng: Math.round(lng * 10_000) / 10_000, label: label || q };
  }
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  cache.set(key, point);
  return point;
}

/** Gives a tutor outside the US the coordinates of their city (US tutors are placed offline already). */
export async function placeTutor(tutorId: string): Promise<boolean> {
  const [t] = await db()`select country, city, state from public.tutors where id = ${tutorId}`;
  if (!t || !t.country || t.country === "US" || !t.city) return false;
  try {
    const p = await pointOf(`${t.city}${t.state ? `, ${t.state}` : ""}`, t.country);
    if (!p) return false;
    await db()`update public.tutors set lat = ${p.lat}, lng = ${p.lng} where id = ${tutorId}`;
    return true;
  } catch (e) {
    console.warn("[geocode] couldn't place tutor", tutorId, (e as Error)?.message);
    return false;
  }
}
