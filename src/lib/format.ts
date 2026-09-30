/** Formatting helpers. Money is always integer cents; dates are UTC ISO strings rendered in a time zone. */

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** $95 for whole dollars, $95.50 otherwise. Integer math only — no float accumulation. */
export function formatCents(cents: number, opts: { exact?: boolean } = {}): string {
  const whole = cents % 100 === 0;
  return (whole && !opts.exact ? usd0 : usd2).format(cents / 100);
}

/** Basis-point share of an amount, rounded half-up to the cent. */
export function applyBps(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

/** Price of a session of `minutes` at an hourly rate, rounded to the cent. */
export function sessionPrice(hourlyCents: number, minutes: number): number {
  return Math.round((hourlyCents * minutes) / 60);
}

export function formatDate(iso: string, tz?: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(new Date(iso));
}

export function formatTime(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

export function formatDateTime(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

export function formatWeekdayDate(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz }).format(new Date(iso));
}

export function tzAbbrev(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? tz;
}

const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (abs < min) return "just now";
  if (abs < hr) return rtf.format(Math.round(diff / min), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hr), "hour");
  if (abs < 7 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDate(iso);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "(555) 010-1234" from any 10-digit US number. */
export function formatUsPhone(input: string): string {
  const d = input.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
