/**
 * Minimal offline geocoding for the preview build. In production this is replaced by the
 * geocoding provider behind `GeocodingService` (Google Maps / Places).
 */

export interface Metro {
  slug: string;
  city: string;
  state: string;
  stateName: string;
  zip: string;
  lat: number;
  lng: number;
  timezone: string;
}

/** Location landing pages are limited to metros with real tutor supply to avoid thin pages. */
export const METROS: Metro[] = [
  { slug: "new-york-ny", city: "New York", state: "NY", stateName: "New York", zip: "10001", lat: 40.7506, lng: -73.9972, timezone: "America/New_York" },
  { slug: "brooklyn-ny", city: "Brooklyn", state: "NY", stateName: "New York", zip: "11201", lat: 40.6943, lng: -73.9903, timezone: "America/New_York" },
  { slug: "boston-ma", city: "Boston", state: "MA", stateName: "Massachusetts", zip: "02116", lat: 42.3496, lng: -71.0746, timezone: "America/New_York" },
  { slug: "washington-dc", city: "Washington", state: "DC", stateName: "District of Columbia", zip: "20009", lat: 38.9192, lng: -77.0374, timezone: "America/New_York" },
  { slug: "philadelphia-pa", city: "Philadelphia", state: "PA", stateName: "Pennsylvania", zip: "19103", lat: 39.9529, lng: -75.1741, timezone: "America/New_York" },
  { slug: "atlanta-ga", city: "Atlanta", state: "GA", stateName: "Georgia", zip: "30309", lat: 33.7984, lng: -84.3883, timezone: "America/New_York" },
  { slug: "miami-fl", city: "Miami", state: "FL", stateName: "Florida", zip: "33131", lat: 25.7663, lng: -80.1918, timezone: "America/New_York" },
  { slug: "chicago-il", city: "Chicago", state: "IL", stateName: "Illinois", zip: "60614", lat: 41.9227, lng: -87.6533, timezone: "America/Chicago" },
  { slug: "austin-tx", city: "Austin", state: "TX", stateName: "Texas", zip: "78701", lat: 30.2711, lng: -97.7437, timezone: "America/Chicago" },
  { slug: "houston-tx", city: "Houston", state: "TX", stateName: "Texas", zip: "77005", lat: 29.7179, lng: -95.4263, timezone: "America/Chicago" },
  { slug: "dallas-tx", city: "Dallas", state: "TX", stateName: "Texas", zip: "75205", lat: 32.8366, lng: -96.7963, timezone: "America/Chicago" },
  { slug: "denver-co", city: "Denver", state: "CO", stateName: "Colorado", zip: "80206", lat: 39.7322, lng: -104.9530, timezone: "America/Denver" },
  { slug: "phoenix-az", city: "Phoenix", state: "AZ", stateName: "Arizona", zip: "85016", lat: 33.5092, lng: -112.0304, timezone: "America/Phoenix" },
  { slug: "seattle-wa", city: "Seattle", state: "WA", stateName: "Washington", zip: "98103", lat: 47.6733, lng: -122.3426, timezone: "America/Los_Angeles" },
  { slug: "san-francisco-ca", city: "San Francisco", state: "CA", stateName: "California", zip: "94110", lat: 37.7486, lng: -122.4158, timezone: "America/Los_Angeles" },
  { slug: "san-jose-ca", city: "San Jose", state: "CA", stateName: "California", zip: "95126", lat: 37.3249, lng: -121.9153, timezone: "America/Los_Angeles" },
  { slug: "los-angeles-ca", city: "Los Angeles", state: "CA", stateName: "California", zip: "90024", lat: 34.0658, lng: -118.4353, timezone: "America/Los_Angeles" },
  { slug: "san-diego-ca", city: "San Diego", state: "CA", stateName: "California", zip: "92103", lat: 32.7457, lng: -117.1680, timezone: "America/Los_Angeles" },
];

/** Additional ZIP prefixes resolved to a nearby metro centroid (3-digit ZIP prefix → metro slug). */
const ZIP3_TO_METRO: Record<string, string> = {
  "100": "new-york-ny", "101": "new-york-ny", "102": "new-york-ny", "103": "new-york-ny", "104": "new-york-ny",
  "112": "brooklyn-ny", "113": "brooklyn-ny", "110": "brooklyn-ny", "070": "new-york-ny", "071": "new-york-ny", "073": "new-york-ny",
  "021": "boston-ma", "022": "boston-ma", "024": "boston-ma", "019": "boston-ma",
  "200": "washington-dc", "201": "washington-dc", "208": "washington-dc", "209": "washington-dc", "220": "washington-dc", "222": "washington-dc",
  "190": "philadelphia-pa", "191": "philadelphia-pa", "080": "philadelphia-pa",
  "303": "atlanta-ga", "300": "atlanta-ga", "301": "atlanta-ga",
  "331": "miami-fl", "330": "miami-fl", "333": "miami-fl",
  "606": "chicago-il", "600": "chicago-il", "601": "chicago-il", "604": "chicago-il",
  "787": "austin-tx", "786": "austin-tx",
  "770": "houston-tx", "772": "houston-tx", "773": "houston-tx", "774": "houston-tx",
  "752": "dallas-tx", "750": "dallas-tx", "751": "dallas-tx", "760": "dallas-tx",
  "802": "denver-co", "800": "denver-co", "801": "denver-co",
  "850": "phoenix-az", "852": "phoenix-az", "853": "phoenix-az",
  "981": "seattle-wa", "980": "seattle-wa", "984": "seattle-wa",
  "941": "san-francisco-ca", "940": "san-francisco-ca", "944": "san-francisco-ca", "945": "san-francisco-ca", "946": "san-francisco-ca",
  "950": "san-jose-ca", "951": "san-jose-ca",
  "900": "los-angeles-ca", "902": "los-angeles-ca", "903": "los-angeles-ca", "904": "los-angeles-ca", "910": "los-angeles-ca", "913": "los-angeles-ca", "917": "los-angeles-ca",
  "920": "san-diego-ca", "921": "san-diego-ca",
};

export const METRO_BY_SLUG: Record<string, Metro> = Object.fromEntries(METROS.map((m) => [m.slug, m]));

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim());
}

/**
 * Resolves a ZIP code, "City, ST" or a bare city name to coordinates.
 * Returns null when the location cannot be resolved offline.
 */
export function resolveLocation(input: string): GeoPoint | null {
  const q = input.trim().toLowerCase();
  if (!q) return null;

  if (/^\d{5}$/.test(q)) {
    const exact = METROS.find((m) => m.zip === q);
    if (exact) return { lat: exact.lat, lng: exact.lng, label: `${exact.city}, ${exact.state} ${exact.zip}` };
    const metro = METRO_BY_SLUG[ZIP3_TO_METRO[q.slice(0, 3)] ?? ""];
    if (metro) return { lat: metro.lat, lng: metro.lng, label: `${q} · near ${metro.city}, ${metro.state}` };
    return null;
  }

  const [cityPart, statePart] = q.split(",").map((s) => s.trim());
  const metro = METROS.find(
    (m) => m.city.toLowerCase() === cityPart && (!statePart || m.state.toLowerCase() === statePart || m.stateName.toLowerCase() === statePart),
  ) ?? METROS.find((m) => m.city.toLowerCase().startsWith(cityPart));
  return metro ? { lat: metro.lat, lng: metro.lng, label: `${metro.city}, ${metro.state}` } : null;
}

/** Great-circle distance in miles. */
export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
