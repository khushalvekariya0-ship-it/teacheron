import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Tx } from "./db";

/*
 * One-time 6-digit email codes, kept apart by purpose (table public.email_codes):
 *   "verify_email"   – the first-time check of a new account's email address (src/server/email-verification.ts);
 *   "password_reset" – typed on the Forgot password page, unlocks one reset link (src/server/password-reset.ts).
 * The purpose is part of the stored fingerprint and of every lookup, so a code made for one purpose can
 * never be used for the other. A newer code cancels older ones of the same purpose; five wrong tries
 * cancel a code; a code works once.
 */

export type CodePurpose = "verify_email" | "password_reset";

export const CODE_MINUTES = 15;
export const MAX_CODE_TRIES = 5;

const fingerprint = (purpose: CodePurpose, id: string, code: string) => createHash("sha256").update(`${purpose}:${id}:${code}`).digest("hex");
const sameHex = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

/** Spaces and dashes typed between the digits are ignored. */
export const cleanCode = (raw: string) => raw.replace(/[\s-]/g, "");
export const isCodeShape = (code: string) => /^\d{6}$/.test(code);

/** Makes a new code for the account (cancelling its older codes of the same purpose) and returns it. */
export async function issueCode(tx: Tx, userId: string, purpose: CodePurpose, resetId?: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const id = `otp_${randomBytes(9).toString("hex")}`;
  await tx`update public.email_codes set used_at = now() where user_id = ${userId} and purpose = ${purpose} and used_at is null`;
  await tx`insert into public.email_codes (id, user_id, purpose, code_hash, reset_id, expires_at)
           values (${id}, ${userId}, ${purpose}, ${fingerprint(purpose, id, code)}, ${resetId ?? null}, now() + make_interval(mins => ${CODE_MINUTES}))`;
  return code;
}

/** How many codes of this purpose the account got in the last hour. */
export async function codesThisHour(tx: Tx, userId: string, purpose: CodePurpose): Promise<number> {
  const [{ n }] = await tx`select count(*)::int n from public.email_codes where user_id = ${userId} and purpose = ${purpose} and created_at > now() - interval '1 hour'`;
  return n;
}

export type CodeCheck =
  | { ok: true; userId: string; resetId: string | null }
  | { ok: false; reason: "no_code" | "wrong" | "too_many"; userId?: string; resetId?: string | null };

/**
 * Checks a typed code against the newest open code of that purpose for the account with this email, and
 * uses it up when it matches. Call inside a transaction; the row is locked so two tries can't race.
 */
export async function consumeCode(tx: Tx, email: string, purpose: CodePurpose, code: string): Promise<CodeCheck> {
  const [row] = await tx`
    select c.id, c.user_id, c.code_hash, c.tries, c.reset_id
    from public.email_codes c
    join public.users u on u.id = c.user_id
    where lower(u.email) = lower(${email.trim()}) and c.purpose = ${purpose} and c.used_at is null and c.expires_at > now()
    order by c.created_at desc
    limit 1
    for update of c`;
  if (!row) return { ok: false, reason: "no_code" };
  const userId = String(row.user_id);
  const resetId = row.reset_id ? String(row.reset_id) : null;
  if (!isCodeShape(code) || !sameHex(fingerprint(purpose, String(row.id), code), String(row.code_hash))) {
    const tries = Number(row.tries) + 1;
    if (tries >= MAX_CODE_TRIES) await tx`update public.email_codes set tries = ${tries}, used_at = now() where id = ${row.id}`;
    else await tx`update public.email_codes set tries = ${tries} where id = ${row.id}`;
    return { ok: false, reason: tries >= MAX_CODE_TRIES ? "too_many" : "wrong", userId, resetId };
  }
  await tx`update public.email_codes set used_at = now() where id = ${row.id}`;
  return { ok: true, userId, resetId };
}

/** Cancels every open code of this purpose for the account (e.g. once its password was reset by link). */
export async function cancelCodes(tx: Tx, userId: string, purpose: CodePurpose): Promise<void> {
  await tx`update public.email_codes set used_at = now() where user_id = ${userId} and purpose = ${purpose} and used_at is null`;
}
