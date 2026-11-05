/*
 * Time zones for every country, from the browser's / server's own list (IANA). Labels read like
 * "India Standard Time (GMT+5:30) · Kolkata" so they can be searched by country-ish name, city or offset.
 */

const part = (tz: string, style: "longGeneric" | "shortOffset") => {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
};

const city = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");

/**
 * Chrome (and Node) list some zones under their old names ("Asia/Calcutta"): the current name is used
 * instead, so "Kolkata" or "Kyiv" can be found; the old city name stays searchable in the label.
 */
const RENAMED: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Africa/Asmera": "Africa/Asmara",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Enderbury": "Pacific/Kanton",
  "America/Godthab": "America/Nuuk",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Mendoza": "America/Argentina/Mendoza",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Coral_Harbour": "America/Atikokan",
};

/** The current IANA name of a zone ("Asia/Calcutta" → "Asia/Kolkata"). */
export const currentZoneName = (tz: string): string => RENAMED[tz] ?? tz;

/** "India Standard Time (GMT+5:30)"; unknown zones read as their id. */
export function timeZoneLabel(tz: string): string {
  const name = part(tz, "longGeneric");
  const offset = part(tz, "shortOffset");
  if (!name) return tz.replace(/_/g, " ");
  return offset && offset !== name ? `${name} (${offset})` : name;
}

/** Minutes east of UTC right now, for sorting. */
function offsetMinutes(tz: string): number {
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part(tz, "shortOffset"));
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

let cache: { value: string; label: string }[] | null = null;

/** Every time zone, west to east, labelled with its name, offset and main city. */
export function allTimeZones(): { value: string; label: string }[] {
  if (cache) return cache;
  let ids: string[] = [];
  try {
    ids = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    ids = [];
  }
  if (!ids.length) ids = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Asia/Kolkata", "Asia/Dubai", "Australia/Sydney"];
  const seen = new Set<string>();
  cache = ids
    .map((old) => ({ old, tz: currentZoneName(old) }))
    .filter(({ tz }) => !seen.has(tz) && !!seen.add(tz))
    .map(({ old, tz }) => ({ old, tz, off: offsetMinutes(old) }))
    .sort((a, b) => a.off - b.off || a.tz.localeCompare(b.tz))
    .map(({ old, tz }) => ({ value: tz, label: `${timeZoneLabel(old)} · ${city(tz)}${old !== tz && city(old) !== city(tz) ? ` (${city(old)})` : ""}` }));
  return cache;
}
