/*
 * Postal codes by country: a 5-digit ZIP code in the US, a 6-digit PIN code in India, and elsewhere the
 * letters and digits each country uses (UK "SW1A 1AA", Canada "K1A 0B1"). Only US ZIP codes are placed on
 * the map for distance; other codes are saved and shown, and distance just isn't scored for them.
 */

export const POSTAL_MAX_LENGTH = 10;

/** Any country's postal code shape: 3–10 letters, digits, spaces or dashes. */
export const POSTAL_CODE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/;

const BY_COUNTRY: Record<string, RegExp> = {
  US: /^\d{5}$/,
  IN: /^[1-9]\d{5}$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
  AU: /^\d{4}$/,
  NZ: /^\d{4}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  ES: /^\d{5}$/,
  IT: /^\d{5}$/,
  PK: /^\d{5}$/,
  BD: /^\d{4}$/,
  NP: /^\d{5}$/,
  LK: /^\d{5}$/,
  SG: /^\d{6}$/,
  MY: /^\d{5}$/,
  PH: /^\d{4}$/,
  ZA: /^\d{4}$/,
  NG: /^\d{6}$/,
  KE: /^\d{5}$/,
  NL: /^\d{4} ?[A-Za-z]{2}$/,
  JP: /^\d{3}-?\d{4}$/,
  BR: /^\d{5}-?\d{3}$/,
  MX: /^\d{5}$/,
};

/** The pattern a country's postal codes follow (any country's shape when the country isn't known). */
export const postalPattern = (country?: string | null) => (country && BY_COUNTRY[country]) || POSTAL_CODE;

export const isPostalCode = (v: string | null | undefined, country?: string | null) => postalPattern(country).test((v ?? "").trim());

/** "ZIP code" in the US, "PIN code" in India, "Postal code" elsewhere. */
export const postalLabel = (country?: string | null) => (country === "US" ? "ZIP code" : country === "IN" ? "PIN code" : "Postal code");

export const postalError = (country?: string | null) =>
  country === "US" ? "Enter a 5-digit ZIP code." : country === "IN" ? "Enter a 6-digit PIN code." : "Enter a valid postal code.";

/**
 * Where a postal code is asked for even when it's optional elsewhere: the US and India, whose codes the
 * site can look up. Some countries have no postal codes at all, so it isn't required there.
 */
export const postalRequired = (country?: string | null) => !country || country === "US" || country === "IN";

/** A generic message for forms that don't know the country. */
export const POSTAL_ERROR = "Enter a valid ZIP, PIN or postal code.";

const PLACEHOLDER: Record<string, string> = { US: "e.g. 60614", IN: "e.g. 360001", GB: "e.g. SW1A 1AA", CA: "e.g. K1A 0B1", AU: "e.g. 2000", DE: "e.g. 10115" };
export const postalPlaceholder = (country?: string | null) => (country && PLACEHOLDER[country]) || "";

const DIGITS_ONLY = new Set(["US", "IN", "AU", "NZ", "DE", "FR", "ES", "IT", "PK", "BD", "NP", "LK", "SG", "MY", "PH", "ZA", "NG", "KE", "MX"]);
/** Countries whose codes are only digits, so phones show the number pad. */
export const postalNumeric = (country?: string | null) => !!country && DIGITS_ONLY.has(country);
