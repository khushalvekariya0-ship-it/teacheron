import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { createClient, type User as AuthUser } from "@supabase/supabase-js";
import { SITE } from "@/lib/site";
import type { SignInMethod } from "@/lib/types";
import { db } from "./db";
import { escapeHtml, sendEmail } from "./email";
import { env } from "./env";
import { resetOrigin } from "./password-reset";
import { identityKey, maskEmail, providerLabel } from "./social";

/*
 * Account security for every account (Settings → Security):
 *   - the ways an account can sign in: its password, and Google / Facebook / Apple connected to it;
 *   - checking the current password without touching the browser's session (a session that passed
 *     two-step login must not be swapped for a password-only one);
 *   - backup codes for two-step login: ten single-use codes shown once when it's turned on, for when the
 *     phone with the authenticator app is lost. Only fingerprints are stored (public.mfa_recovery_codes).
 */

/** Whether the account has a password (accounts made with Google / Facebook / Apple start without one). */
export async function hasPassword(userId: string, au?: AuthUser): Promise<boolean> {
  try {
    const [row] = await db()`select coalesce(encrypted_password, '') <> '' as has from auth.users where id = ${userId}::uuid`;
    if (row) return row.has === true;
  } catch (e) {
    console.error("[account] couldn't read whether the account has a password:", (e as Error).message);
  }
  return (au?.identities ?? []).some((i) => i.provider === "email");
}

/**
 * Checks a password with a separate, throw-away sign-in (the browser's cookies are never touched),
 * and ends that sign-in again right away.
 */
export async function passwordMatches(email: string, password: string): Promise<boolean> {
  if (!env.supabaseUrl || !env.supabaseAnonKey || !email) return false;
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await client.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}

/* ─── Sign-in methods ───────────────────────────────────────────────────────── */

const SOCIAL = (p: string) => p !== "email" && p !== "phone";

export async function signInMethods(au: AuthUser, userId: string): Promise<{ hasPassword: boolean; social: SignInMethod[] }> {
  const pw = await hasPassword(userId, au);
  const all = au.identities ?? [];
  const social = all.filter((i) => SOCIAL(i.provider));
  const passwordWorks = pw && !!au.email && !!au.email_confirmed_at;
  return {
    hasPassword: pw,
    social: social.map((i) => ({
      id: identityKey(i),
      provider: i.provider,
      label: providerLabel(i.provider),
      email: typeof i.identity_data?.email === "string" ? i.identity_data.email : null,
      connectedAt: i.created_at ?? null,
      lastUsedAt: i.last_sign_in_at ?? null,
      // Supabase keeps at least one connected sign-in on every account.
      locked: social.length < 2 && !passwordWorks ? "only" : all.length < 2 ? "last" : null,
    })),
  };
}

/* ─── Backup codes for two-step login ───────────────────────────────────────── */

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i
export const RECOVERY_CODES = 10;
const cleanRecovery = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9]/g, "");
const fingerprint = (userId: string, code: string) => createHash("sha256").update(`mfa-recovery:${userId}:${code}`).digest("hex");

/** Ten new codes ("k7m2q-9xhtd"), replacing any earlier ones. Shown once; only fingerprints are kept. */
export async function newRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODES }, () => {
    let s = "";
    for (let i = 0; i < 10; i++) s += ALPHABET[randomInt(0, ALPHABET.length)];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  await db().begin(async (tx) => {
    await tx`delete from public.mfa_recovery_codes where user_id = ${userId}`;
    for (const c of codes) {
      await tx`insert into public.mfa_recovery_codes (id, user_id, code_hash) values (${`rc_${randomBytes(9).toString("hex")}`}, ${userId}, ${fingerprint(userId, cleanRecovery(c))})`;
    }
  });
  return codes;
}

/** Uses up one backup code; false when it's wrong or already used. */
export async function spendRecoveryCode(userId: string, raw: string): Promise<boolean> {
  const code = cleanRecovery(raw);
  if (code.length !== 10) return false;
  const used = await db()`update public.mfa_recovery_codes set used_at = now() where user_id = ${userId} and code_hash = ${fingerprint(userId, code)} and used_at is null returning id`;
  return used.length > 0;
}

export async function recoveryCodesLeft(userId: string): Promise<number> {
  const [row] = await db()`select count(*)::int n from public.mfa_recovery_codes where user_id = ${userId} and used_at is null`;
  return Number(row?.n ?? 0);
}

export async function clearRecoveryCodes(userId: string) {
  await db()`delete from public.mfa_recovery_codes where user_id = ${userId}`;
}

/* ─── Notices sent to an address that's no longer the account's ─────────────── */

/** After the sign-in email changes, the old address is told (it no longer gets the account's emails). */
export async function sendEmailChangedNotice(oldEmail: string, newEmail: string, firstName: string) {
  const name = firstName || "there";
  const help = `${resetOrigin() ?? SITE.url}/forgot-password`;
  const masked = maskEmail(newEmail);
  await sendEmail({
    to: oldEmail,
    subject: `Your ${SITE.name} sign-in email was changed`,
    text: `Hi ${name},\n\nThe sign-in email for your ${SITE.name} account was just changed from this address to ${masked}. Emails about your account now go there.\n\nIf this wasn't you, reset your password straight away (${help}) and contact us through the site.\n\n— ${SITE.name}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px"><p>Hi ${escapeHtml(name)},</p><p>The sign-in email for your ${escapeHtml(SITE.name)} account was just changed from this address to <b>${escapeHtml(masked)}</b>. Emails about your account now go there.</p><p>If this wasn't you, <a href="${escapeHtml(help)}">reset your password straight away</a> and contact us through the site.</p><p style="color:#888;font-size:12px">— ${escapeHtml(SITE.name)}</p></div>`,
  });
}
