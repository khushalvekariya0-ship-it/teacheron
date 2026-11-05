import { AsYouType, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { countryName } from "./location";
import { formatUsPhone } from "./format";

/*
 * Phone numbers in any country. A number is read for the country chosen in the same form, or for any
 * country when it starts with "+" and the country code (a parent abroad, say). US numbers keep the
 * familiar "(312) 555-0142"; others are kept in international form, "+91 98765 43210".
 */

const asCountry = (country: string | null | undefined) => (country || "US").toUpperCase() as CountryCode;

/** What's wrong with a phone number, or null when it's fine. */
export function phoneProblem(value: string, country: string | null | undefined): string | null {
  const v = value.trim();
  if (!v) return "Enter your mobile number.";
  const parsed = parsePhoneNumberFromString(v, asCountry(country));
  if (parsed?.isValid()) return null;
  const where = country && country !== "US" ? countryName(country) : "US";
  return `Enter a valid ${where} phone number, or start with + and the country code.`;
}

/** The number as it's saved and shown. Unreadable input is returned as typed (the form check catches it). */
export function formatPhone(value: string, country: string | null | undefined): string {
  const parsed = parsePhoneNumberFromString(value.trim(), asCountry(country));
  if (!parsed?.isValid()) return value.trim();
  if (parsed.country === "US" && asCountry(country) === "US") return formatUsPhone(parsed.nationalNumber);
  return parsed.formatInternational();
}

/** Formats as the person types (US: "(312) 555-0142"; elsewhere the country's own grouping). */
export function typePhone(value: string, country: string | null | undefined): string {
  const c = asCountry(country);
  if (c === "US" && !value.trim().startsWith("+")) return formatUsPhone(value);
  return new AsYouType(c).input(value);
}

/** An example placeholder for the country. */
export function phonePlaceholder(country: string | null | undefined): string {
  const c = asCountry(country);
  return c === "US" ? "(555) 010-1234" : c === "IN" ? "98765 43210" : "Mobile number";
}
