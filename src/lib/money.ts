/*
 * Money in more than one currency. Every amount is an integer in the currency's minor unit (paise for ₹,
 * cents for $, pence for £), never a float. Each tutor charges in their own currency (from their country:
 * ₹ in India, $ in the US, £ in the UK, € in the euro area…); a booking, its payments and refunds stay in
 * that currency. Learners' Study Credits are kept in the learner's own currency.
 *
 * Only currencies with two decimal places that Razorpay accepts are offered; anywhere else uses US dollars.
 */

export const CURRENCIES = {
  INR: { symbol: "₹", name: "Indian rupee", locale: "en-IN" },
  USD: { symbol: "$", name: "US dollar", locale: "en-US" },
  GBP: { symbol: "£", name: "British pound", locale: "en-GB" },
  EUR: { symbol: "€", name: "Euro", locale: "en-IE" },
  CAD: { symbol: "CA$", name: "Canadian dollar", locale: "en-CA" },
  AUD: { symbol: "A$", name: "Australian dollar", locale: "en-AU" },
  NZD: { symbol: "NZ$", name: "New Zealand dollar", locale: "en-NZ" },
  SGD: { symbol: "S$", name: "Singapore dollar", locale: "en-SG" },
  AED: { symbol: "AED", name: "UAE dirham", locale: "en-AE" },
  SAR: { symbol: "SAR", name: "Saudi riyal", locale: "en-US" },
  QAR: { symbol: "QAR", name: "Qatari riyal", locale: "en-US" },
  ZAR: { symbol: "R", name: "South African rand", locale: "en-ZA" },
  MYR: { symbol: "RM", name: "Malaysian ringgit", locale: "en-MY" },
  HKD: { symbol: "HK$", name: "Hong Kong dollar", locale: "en-HK" },
  CHF: { symbol: "CHF", name: "Swiss franc", locale: "de-CH" },
  SEK: { symbol: "kr", name: "Swedish krona", locale: "sv-SE" },
  NOK: { symbol: "kr", name: "Norwegian krone", locale: "nb-NO" },
  DKK: { symbol: "kr", name: "Danish krone", locale: "da-DK" },
  NPR: { symbol: "Rs", name: "Nepalese rupee", locale: "en-US" },
} as const;

export type Currency = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as Currency[];
export const DEFAULT_CURRENCY: Currency = "USD";

export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && v in CURRENCIES;
/** A stored code, or US dollars for anything unknown (older rows, bad input). */
export const asCurrency = (v: unknown): Currency => (isCurrency(v) ? v : DEFAULT_CURRENCY);

const EURO_AREA = ["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"];
const BY_COUNTRY: Record<string, Currency> = {
  IN: "INR", US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", SG: "SGD", AE: "AED", SA: "SAR", QA: "QAR", ZA: "ZAR",
  MY: "MYR", HK: "HKD", CH: "CHF", LI: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", NP: "NPR",
  ...Object.fromEntries(EURO_AREA.map((c) => [c, "EUR" as Currency])),
};

/** The currency people in a country pay in on TutorLink (US dollars where we don't offer the local one). */
export function currencyForCountry(country: string | null | undefined): Currency {
  return BY_COUNTRY[(country ?? "").toUpperCase()] ?? DEFAULT_CURRENCY;
}

const cache = new Map<string, Intl.NumberFormat>();
function formatter(currency: Currency, decimals: 0 | 2): Intl.NumberFormat {
  const key = `${currency}:${decimals}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(CURRENCIES[currency].locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    cache.set(key, f);
  }
  return f;
}

/** ₹450 / $45 for whole amounts, ₹450.50 / $45.50 otherwise (or always two decimals with `exact`). */
export function formatMoney(minor: number, currency: Currency = DEFAULT_CURRENCY, opts: { exact?: boolean } = {}): string {
  const c = asCurrency(currency);
  const whole = minor % 100 === 0;
  return formatter(c, whole && !opts.exact ? 0 : 2).format(minor / 100);
}

/** The symbol for price inputs ("₹", "$", "£"). */
export const currencySymbol = (currency: Currency | string | null | undefined): string => CURRENCIES[asCurrency(currency)].symbol;

/** Whole units typed in a form → minor units (₹450 → 45000). */
export const toMinor = (major: number): number => Math.round(major * 100);

/*
 * Local amounts, in whole units of each currency: the hourly-rate range tutors can set, the Study Credit
 * amounts suggested for top-ups, and how many local units the site's own dollar amounts (the platform
 * credit after a tutor no-show) become. These are TutorLink's own settings, never exchange rates: no
 * price anyone pays is ever converted.
 */
interface Local {
  rate: readonly [min: number, max: number];
  topUps: readonly number[];
  /** Site amounts set in dollars (Admin → Settings) × this = the local amount. */
  perDollar: number;
}
const STRONG: Local = { rate: [15, 500], topUps: [25, 50, 100, 200], perDollar: 1 };
const LOCAL: Partial<Record<Currency, Local>> = {
  INR: { rate: [100, 20000], topUps: [500, 1000, 2000, 5000], perDollar: 50 },
  NPR: { rate: [200, 30000], topUps: [1000, 2000, 5000, 10000], perDollar: 100 },
  ZAR: { rate: [100, 10000], topUps: [500, 1000, 2000, 4000], perDollar: 15 },
  AED: { rate: [50, 2000], topUps: [100, 200, 400, 800], perDollar: 4 },
  SAR: { rate: [50, 2000], topUps: [100, 200, 400, 800], perDollar: 4 },
  QAR: { rate: [50, 2000], topUps: [100, 200, 400, 800], perDollar: 4 },
  MYR: { rate: [50, 2000], topUps: [100, 200, 400, 800], perDollar: 4 },
  HKD: { rate: [100, 4000], topUps: [200, 400, 800, 1600], perDollar: 8 },
  SEK: { rate: [100, 5000], topUps: [250, 500, 1000, 2000], perDollar: 10 },
  NOK: { rate: [100, 5000], topUps: [250, 500, 1000, 2000], perDollar: 10 },
  DKK: { rate: [100, 5000], topUps: [250, 500, 1000, 2000], perDollar: 7 },
};
const local = (c: Currency): Local => LOCAL[c] ?? STRONG;

/** The hourly rate range (minor units) a tutor charging in this currency can set. */
export function rateLimits(currency: Currency): { min: number; max: number } {
  const [min, max] = local(asCurrency(currency)).rate;
  return { min: min * 100, max: max * 100 };
}

/** "Hourly rate must be between ₹100 and ₹20,000." */
export function rateProblem(minor: number, currency: Currency, what = "Hourly rate"): string | null {
  const { min, max } = rateLimits(currency);
  if (Number.isInteger(minor) && minor >= min && minor <= max) return null;
  return `${what} must be between ${formatMoney(min, currency)} and ${formatMoney(max, currency)}.`;
}

/** Suggested Study Credit top-ups (minor units) in a learner's currency. */
export const topUpAmounts = (currency: Currency): number[] => local(asCurrency(currency)).topUps.map((n) => n * 100);

/** The hourly budget range a learner or a job post can give, in whole units ($10–$500, ₹100–₹20,000…). */
export function budgetLimits(currency: Currency): { min: number; max: number } {
  const c = asCurrency(currency);
  if (!LOCAL[c]) return { min: 10, max: 500 };
  const [min, max] = local(c).rate;
  return { min, max };
}

/** Quick budget choices per hour, in whole units ("Under $30", "₹500–₹1,000"…). */
export function budgetPresets(currency: Currency): { label: string; min: number; max: number }[] {
  const c = asCurrency(currency);
  const steps = c === "INR" ? [100, 500, 1000, 2000, 4000] : LOCAL[c] ? [15, 30, 50, 80, 150].map((n) => Math.round((n * local(c).perDollar) / 10) * 10) : [15, 30, 50, 80, 150];
  const m = (n: number) => formatMoney(n * 100, c);
  return [
    { label: `Under ${m(steps[1])}`, min: steps[0], max: steps[1] },
    { label: `${m(steps[1])}–${m(steps[2])}`, min: steps[1], max: steps[2] },
    { label: `${m(steps[2])}–${m(steps[3])}`, min: steps[2], max: steps[3] },
    { label: `${m(steps[3])}+`, min: steps[3], max: steps[4] },
  ];
}

/** The most a trial lesson can cost (minor units): $200, or the local equivalent setting (₹10,000…). */
export const trialPriceMax = (currency: Currency): number => fromDollarSetting(20000, currency);

/** A site amount set in dollar cents (e.g. the tutor no-show credit) in another currency's minor units. */
export const fromDollarSetting = (usdCents: number, currency: Currency): number => Math.round(usdCents * local(asCurrency(currency)).perDollar);

/** Adds up amounts that may be in different currencies (one total per currency, largest first). */
export function sumByCurrency(items: { amount: number; currency?: Currency | string | null }[]): { currency: Currency; amount: number }[] {
  const totals = new Map<Currency, number>();
  for (const x of items) {
    const c = asCurrency(x.currency);
    totals.set(c, (totals.get(c) ?? 0) + x.amount);
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount);
}

/**
 * Totals across currencies for one line ("₹12,000 + $340"); `empty` (default "₹0"-style zero in `fallback`)
 * when there's nothing. Amounts in different currencies are never added together.
 */
export function formatSums(items: { amount: number; currency?: Currency | string | null }[], fallback: Currency = DEFAULT_CURRENCY, opts: { exact?: boolean } = {}): string {
  const sums = sumByCurrency(items).filter((x) => x.amount !== 0);
  return sums.length ? sums.map((x) => formatMoney(x.amount, x.currency, opts)).join(" + ") : formatMoney(0, fallback, opts);
}
