import { pointLocation, resolveLocation } from "@/lib/data/geo";
import { isPostalCode } from "@/lib/postal";

export type FoundPlace = { location: string } | { problem: "not_found" | "failed" };

/** True when the text is a postal code of that country (a PIN code in India, a ZIP in the US, a postcode in the UK). */
export const looksPostal = (text: string, country: string) => /\d/.test(text) && isPostalCode(text.trim(), country);

/**
 * Turns what someone typed ("380015", "Ahmedabad", "SW1A 1AA", "60614", "Dubai Marina") into a search location.
 * A postal code is looked up inside the searcher's own country: on its own, 380015 could be a Singapore code.
 * US ZIP codes and the built-in cities are found offline; any other place is looked up online.
 */
export async function findPlace(text: string, country: string): Promise<FoundPlace> {
  const v = text.trim();
  const postal = looksPostal(v, country);
  if ((!postal || country === "US") && resolveLocation(v)) return { location: v };
  try {
    const res = await fetch(`/api/geo?kind=point&q=${encodeURIComponent(v)}${postal ? `&country=${country}` : ""}`);
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; point?: { lat: number; lng: number; label: string } | null };
    if (data.point) return { location: pointLocation(data.point) };
    return { problem: data.ok === false ? "failed" : "not_found" };
  } catch {
    return { problem: "failed" };
  }
}
