import "server-only";
import { setContactRules } from "@/lib/domain/contact";
import { readContactSafety, rulesOf, type ContactSafety } from "@/lib/safety-settings";
import { db } from "./db";

/*
 * The personal-information protection settings for checks outside the action engine (the live class,
 * file uploads). Read from the database at most every 30 seconds; reading them also sets the contact rules.
 */

let cached: { at: number; value: ContactSafety } | null = null;

export async function contactSafety(): Promise<ContactSafety> {
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  const rows = await db()`select value from public.platform_settings where key = 'contact_safety'`.catch(() => []);
  const value = readContactSafety(rows[0]?.value);
  cached = { at: Date.now(), value };
  setContactRules(rulesOf(value));
  return value;
}

/** After staff change the settings on this server. */
export function forgetContactSafety() {
  cached = null;
}
