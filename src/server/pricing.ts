import "server-only";
import { readPricing, type Pricing } from "@/lib/data/platform";
import { SITE } from "@/lib/site";
import { db } from "./db";

/**
 * Tutor plans and lead-credit packs as saved in Admin → Plans & credits (the defaults until an administrator
 * changes them), with Starter's commission from the platform fee. Used where no action runs: checkout
 * (the amount to charge) and the public pages.
 */
export async function loadPricing(): Promise<Pricing> {
  const rows = await db()`select key, value from public.platform_settings where key in ('pricing', 'platform_fee_bps')`;
  const fee = rows.find((r) => r.key === "platform_fee_bps")?.value;
  return readPricing(rows.find((r) => r.key === "pricing")?.value, typeof fee === "number" ? fee : SITE.platformFeeBps);
}
