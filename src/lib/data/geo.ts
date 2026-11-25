import type { Tutor } from "@/lib/types";

/**
 * Cities with a "Tutors in …" page, and offline lookups for them (a typed city name, a US ZIP). Any other
 * place in the world is found online (`/api/geo?kind=point`) and kept as a point ("@lat,lng|label").
 */

export interface Metro {
  slug: string;
  city: string;
  /** The US state's 2-letter code; elsewhere the region's name ("Gujarat"), or "" for a city-state. */
  state: string;
  stateName: string;
  /** ISO country code. */
  country: string;
  /** US only: a central ZIP code (searches there resolve offline). */
  zip?: string;
  lat: number;
  lng: number;
  timezone: string;
}

const city = (slug: string, name: string, state: string, country: string, lat: number, lng: number, timezone: string): Metro => ({
  slug, city: name, state, stateName: state, country, lat, lng, timezone,
});

/** Cities around the world, India first (the US list follows). Cities without in-person tutors yet aren't indexed. */
const WORLD_METROS: Metro[] = [
  // India
  city("ahmedabad-in", "Ahmedabad", "Gujarat", "IN", 23.0225, 72.5714, "Asia/Kolkata"),
  city("mumbai-in", "Mumbai", "Maharashtra", "IN", 19.076, 72.8777, "Asia/Kolkata"),
  city("delhi-in", "Delhi", "Delhi", "IN", 28.6139, 77.209, "Asia/Kolkata"),
  city("bengaluru-in", "Bengaluru", "Karnataka", "IN", 12.9716, 77.5946, "Asia/Kolkata"),
  city("surat-in", "Surat", "Gujarat", "IN", 21.1702, 72.8311, "Asia/Kolkata"),
  city("pune-in", "Pune", "Maharashtra", "IN", 18.5204, 73.8567, "Asia/Kolkata"),
  city("hyderabad-in", "Hyderabad", "Telangana", "IN", 17.385, 78.4867, "Asia/Kolkata"),
  city("chennai-in", "Chennai", "Tamil Nadu", "IN", 13.0827, 80.2707, "Asia/Kolkata"),
  city("kolkata-in", "Kolkata", "West Bengal", "IN", 22.5726, 88.3639, "Asia/Kolkata"),
  city("vadodara-in", "Vadodara", "Gujarat", "IN", 22.3072, 73.1812, "Asia/Kolkata"),
  city("rajkot-in", "Rajkot", "Gujarat", "IN", 22.3039, 70.8022, "Asia/Kolkata"),
  city("gandhinagar-in", "Gandhinagar", "Gujarat", "IN", 23.2156, 72.6369, "Asia/Kolkata"),
  city("bhavnagar-in", "Bhavnagar", "Gujarat", "IN", 21.7645, 72.1519, "Asia/Kolkata"),
  city("jamnagar-in", "Jamnagar", "Gujarat", "IN", 22.4707, 70.0577, "Asia/Kolkata"),
  city("jaipur-in", "Jaipur", "Rajasthan", "IN", 26.9124, 75.7873, "Asia/Kolkata"),
  city("lucknow-in", "Lucknow", "Uttar Pradesh", "IN", 26.8467, 80.9462, "Asia/Kolkata"),
  city("noida-in", "Noida", "Uttar Pradesh", "IN", 28.5355, 77.391, "Asia/Kolkata"),
  city("gurugram-in", "Gurugram", "Haryana", "IN", 28.4595, 77.0266, "Asia/Kolkata"),
  city("chandigarh-in", "Chandigarh", "Chandigarh", "IN", 30.7333, 76.7794, "Asia/Kolkata"),
  city("indore-in", "Indore", "Madhya Pradesh", "IN", 22.7196, 75.8577, "Asia/Kolkata"),
  city("bhopal-in", "Bhopal", "Madhya Pradesh", "IN", 23.2599, 77.4126, "Asia/Kolkata"),
  city("nagpur-in", "Nagpur", "Maharashtra", "IN", 21.1458, 79.0882, "Asia/Kolkata"),
  city("patna-in", "Patna", "Bihar", "IN", 25.5941, 85.1376, "Asia/Kolkata"),
  city("bhubaneswar-in", "Bhubaneswar", "Odisha", "IN", 20.2961, 85.8245, "Asia/Kolkata"),
  city("visakhapatnam-in", "Visakhapatnam", "Andhra Pradesh", "IN", 17.6868, 83.2185, "Asia/Kolkata"),
  city("guwahati-in", "Guwahati", "Assam", "IN", 26.1445, 91.7362, "Asia/Kolkata"),
  city("kochi-in", "Kochi", "Kerala", "IN", 9.9312, 76.2673, "Asia/Kolkata"),
  city("coimbatore-in", "Coimbatore", "Tamil Nadu", "IN", 11.0168, 76.9558, "Asia/Kolkata"),
  // United Kingdom
  city("london-gb", "London", "England", "GB", 51.5074, -0.1278, "Europe/London"),
  city("birmingham-gb", "Birmingham", "England", "GB", 52.4862, -1.8904, "Europe/London"),
  city("manchester-gb", "Manchester", "England", "GB", 53.4808, -2.2426, "Europe/London"),
  city("leicester-gb", "Leicester", "England", "GB", 52.6369, -1.1398, "Europe/London"),
  // Canada
  city("toronto-ca", "Toronto", "Ontario", "CA", 43.6532, -79.3832, "America/Toronto"),
  city("brampton-ca", "Brampton", "Ontario", "CA", 43.7315, -79.7624, "America/Toronto"),
  city("montreal-ca", "Montreal", "Quebec", "CA", 45.5017, -73.5673, "America/Toronto"),
  city("vancouver-ca", "Vancouver", "British Columbia", "CA", 49.2827, -123.1207, "America/Vancouver"),
  city("calgary-ca", "Calgary", "Alberta", "CA", 51.0447, -114.0719, "America/Edmonton"),
  // Australia and New Zealand
  city("sydney-au", "Sydney", "New South Wales", "AU", -33.8688, 151.2093, "Australia/Sydney"),
  city("melbourne-au", "Melbourne", "Victoria", "AU", -37.8136, 144.9631, "Australia/Melbourne"),
  city("brisbane-au", "Brisbane", "Queensland", "AU", -27.4698, 153.0251, "Australia/Brisbane"),
  city("perth-au", "Perth", "Western Australia", "AU", -31.9505, 115.8605, "Australia/Perth"),
  city("adelaide-au", "Adelaide", "South Australia", "AU", -34.9285, 138.6007, "Australia/Adelaide"),
  city("auckland-nz", "Auckland", "Auckland", "NZ", -36.8485, 174.7633, "Pacific/Auckland"),
  // Gulf
  city("dubai-ae", "Dubai", "Dubai", "AE", 25.2048, 55.2708, "Asia/Dubai"),
  city("abu-dhabi-ae", "Abu Dhabi", "Abu Dhabi", "AE", 24.4539, 54.3773, "Asia/Dubai"),
  city("sharjah-ae", "Sharjah", "Sharjah", "AE", 25.3463, 55.4209, "Asia/Dubai"),
  city("doha-qa", "Doha", "", "QA", 25.2854, 51.531, "Asia/Qatar"),
  city("riyadh-sa", "Riyadh", "Riyadh", "SA", 24.7136, 46.6753, "Asia/Riyadh"),
  city("jeddah-sa", "Jeddah", "Makkah", "SA", 21.4858, 39.1925, "Asia/Riyadh"),
  city("muscat-om", "Muscat", "Muscat", "OM", 23.588, 58.3829, "Asia/Muscat"),
  city("kuwait-city-kw", "Kuwait City", "", "KW", 29.3759, 47.9774, "Asia/Kuwait"),
  city("manama-bh", "Manama", "", "BH", 26.2285, 50.586, "Asia/Bahrain"),
  // Asia
  city("singapore-sg", "Singapore", "", "SG", 1.3521, 103.8198, "Asia/Singapore"),
  city("kuala-lumpur-my", "Kuala Lumpur", "", "MY", 3.139, 101.6869, "Asia/Kuala_Lumpur"),
  city("kathmandu-np", "Kathmandu", "Bagmati", "NP", 27.7172, 85.324, "Asia/Kathmandu"),
  city("dhaka-bd", "Dhaka", "Dhaka", "BD", 23.8103, 90.4125, "Asia/Dhaka"),
  city("colombo-lk", "Colombo", "Western Province", "LK", 6.9271, 79.8612, "Asia/Colombo"),
  city("karachi-pk", "Karachi", "Sindh", "PK", 24.8607, 67.0011, "Asia/Karachi"),
  city("lahore-pk", "Lahore", "Punjab", "PK", 31.5204, 74.3587, "Asia/Karachi"),
  city("manila-ph", "Manila", "Metro Manila", "PH", 14.5995, 120.9842, "Asia/Manila"),
  city("tokyo-jp", "Tokyo", "Tokyo", "JP", 35.6762, 139.6503, "Asia/Tokyo"),
  // Africa
  city("nairobi-ke", "Nairobi", "Nairobi", "KE", -1.2921, 36.8219, "Africa/Nairobi"),
  city("lagos-ng", "Lagos", "Lagos", "NG", 6.5244, 3.3792, "Africa/Lagos"),
  city("johannesburg-za", "Johannesburg", "Gauteng", "ZA", -26.2041, 28.0473, "Africa/Johannesburg"),
  // Europe
  city("dublin-ie", "Dublin", "Leinster", "IE", 53.3498, -6.2603, "Europe/Dublin"),
  city("berlin-de", "Berlin", "Berlin", "DE", 52.52, 13.405, "Europe/Berlin"),
  city("paris-fr", "Paris", "Île-de-France", "FR", 48.8566, 2.3522, "Europe/Paris"),
];

const US_METROS: Omit<Metro, "country">[] = [
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

/** Every built-in city page: the world list, then the US. */
export const METROS: Metro[] = [...WORLD_METROS, ...US_METROS.map((m) => ({ ...m, country: "US" }))];

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

/** "Ahmedabad, Gujarat", "New York, NY", or just "Singapore". */
export const metroLabel = (m: Pick<Metro, "city" | "state">) => (m.state && m.state !== m.city ? `${m.city}, ${m.state}` : m.city);

/** What a city page searches for: a US ZIP (found offline), or the city's own map point anywhere else. */
export const metroLocation = (m: Metro) => (m.country === "US" && m.zip ? m.zip : pointLocation({ lat: m.lat, lng: m.lng, label: metroLabel(m) }));

const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

type PlacedTutor = Pick<Tutor, "city" | "state" | "country" | "lat" | "lng" | "timezone" | "modes">;

/**
 * Every city with a page: the built-in list, plus each other city where a listed tutor teaches in person
 * (more than 25 miles from every built-in city), so a tutor anywhere in the world gets a city page.
 */
export function allMetros(tutors: PlacedTutor[]): Metro[] {
  const extra = new Map<string, Metro>();
  for (const t of tutors) {
    if (!t.modes.includes("in_person") || !t.city || !t.country) continue;
    if (!Number.isFinite(t.lat) || !Number.isFinite(t.lng) || (t.lat === 0 && t.lng === 0)) continue;
    if (METROS.some((m) => distanceMiles(m, t) <= 25)) continue;
    const slug = slugify(`${t.city} ${t.country}`);
    if (!slug || METRO_BY_SLUG[slug] || extra.has(slug)) continue;
    extra.set(slug, { slug, city: t.city, state: t.state ?? "", stateName: t.state ?? "", country: t.country, lat: t.lat, lng: t.lng, timezone: t.timezone });
  }
  return [...METROS, ...extra.values()];
}

/** A city page's city: built in, or a tutor's own city. */
export const metroBySlug = (slug: string, tutors: PlacedTutor[]): Metro | undefined => METRO_BY_SLUG[slug] ?? allMetros(tutors).find((m) => m.slug === slug);

/** Countries that measure distance in miles; everywhere else uses kilometres. */
const MILE_COUNTRIES = new Set(["US", "GB", "LR", "MM"]);
export const distanceUnit = (country?: string | null): "mi" | "km" => (!country || MILE_COUNTRIES.has(country) ? "mi" : "km");

/** A distance kept in miles, written in the reader's unit: "16 km", "10 mi", "<1 km". */
export function formatDistance(miles: number, unit: "mi" | "km"): string {
  const v = unit === "km" ? miles * 1.609344 : miles;
  return `${v < 1 ? "<1" : Math.round(v)} ${unit}`;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim());
}

/** A place outside the built-in US list, found once with the place lookup and kept with its coordinates. */
export const pointLocation = (p: { lat: number; lng: number; label: string }) => `@${p.lat},${p.lng}|${p.label.replace(/\|/g, " ")}`;

/** What a location reads as ("Ahmedabad, Gujarat, India", "60614 · near Chicago, IL", or as typed). */
export const locationLabel = (input: string | undefined | null): string => (input ? (/^@/.test(input) ? (resolveLocation(input)?.label ?? input) : input) : "");

/**
 * Resolves a ZIP code, "City, ST", a bare city name, or a place with coordinates ("@lat,lng|label") to
 * coordinates. Returns null when the location cannot be resolved offline.
 */
export function resolveLocation(input: string): GeoPoint | null {
  const at = /^@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)\|(.{1,160})$/.exec(input.trim());
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng, label: at[3].trim() } : null;
  }
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
  ) ?? (statePart ? undefined : METROS.find((m) => m.city.toLowerCase().startsWith(cityPart))); // "Birmingham, AL" isn't Birmingham, England: looked up online instead
  return metro ? { lat: metro.lat, lng: metro.lng, label: metroLabel(metro) } : null;
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
