import "server-only";
import type { SupabaseClient, User as AuthUser, UserIdentity } from "@supabase/supabase-js";
import { SITE } from "@/lib/site";
import { isCountryCode } from "@/lib/location";
import { isPostalCode, postalError, postalRequired } from "@/lib/postal";
import { db } from "./db";
import { CODE_MINUTES, codesThisHour, consumeCodeForUser, issueCode, MAX_CODE_TRIES } from "./email-codes";
import { escapeHtml, sendEmail } from "./email";
import { supabaseAdmin } from "./supabase";

/*
 * Google / Facebook / Apple sign-in, on top of Supabase Auth (which runs the OAuth / OpenID Connect flow
 * with PKCE and state, and checks the providers' tokens). What the site adds:
 *
 *   - A first-time social sign-in creates the account with `needs_role`: it chooses Student, Parent or Tutor
 *     once (completeSignup), and gets no data access before that.
 *   - Supabase attaches a social sign-in to an existing account with the same verified email. The site then
 *     locks that account (`pending_link`) until the 6-digit code sent to the account's email is entered,
 *     so the owner confirms it before the new sign-in method works. Confirmed methods are remembered in
 *     `trusted_identities`. (An account whose email was never confirmed is handled by Supabase itself:
 *     it removes that account's unconfirmed password and sign-in methods before attaching the new one,
 *     which stops "sign up first with someone else's email" takeovers.)
 *   - A provider that gives no email: the account adds one and confirms it with a code (add_email).
 * Provider secrets live in the Supabase dashboard; tokens never reach the browser or the logs.
 */

export const PROVIDER_LABEL: Record<string, string> = { google: "Google", facebook: "Facebook", apple: "Apple", azure: "Microsoft" };
export const providerLabel = (p: string) => PROVIDER_LABEL[p] ?? p;

const idOf = (i: UserIdentity) => String(i.identity_id ?? i.id);
const when = (i: UserIdentity) => Date.parse(i.last_sign_in_at ?? i.updated_at ?? i.created_at ?? "") || 0;
const WRONG = "That code isn't right or has expired. Use the code in the newest email, or ask for a new one.";

/** The social sign-in used just now (the provider asked for, else the most recent social identity). */
export function socialIdentity(au: AuthUser, provider: string | null): UserIdentity | null {
  const social = (au.identities ?? []).filter((i) => i.provider !== "email" && i.provider !== "phone" && (!provider || i.provider === provider));
  return social.sort((a, b) => when(b) - when(a))[0] ?? null;
}

/** "ab***@gmail.com" */
export const maskEmail = (e: string) => e.replace(/^(.{1,2})[^@]*@/, "$1***@");

async function emailLinkCode(userId: string): Promise<boolean> {
  const [u] = await db()`select first_name, email, pending_link from public.users where id = ${userId}`;
  const pending = u?.pending_link as { provider?: string } | null;
  if (!u?.email || !pending) return false;
  const code = await db().begin(async (tx) => ((await codesThisHour(tx, userId, "link_account")) >= 5 ? null : issueCode(tx, userId, "link_account")));
  if (!code) return false;
  const name = providerLabel(String(pending.provider ?? ""));
  const res = await sendEmail({
    to: String(u.email),
    subject: `Confirm signing in to ${SITE.name} with ${name}`,
    text: `Hi ${u.first_name || "there"},\n\nSomeone (hopefully you) just signed in to ${SITE.name} with ${name} using this email address. To connect ${name} to your existing account, enter this code on the sign-in page:\n\n${code}\n\nThe code works once and expires in ${CODE_MINUTES} minutes. If this wasn't you, don't share the code: ${name} won't be connected. Consider changing your password.\n\n— ${SITE.name}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px">
<p>Hi ${escapeHtml(String(u.first_name || "there"))},</p>
<p>Someone (hopefully you) just signed in to ${escapeHtml(SITE.name)} with <b>${escapeHtml(name)}</b> using this email address. To connect ${escapeHtml(name)} to your existing account, enter this code on the sign-in page:</p>
<p style="margin:20px 0 8px;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p>
<p style="color:#555;font-size:13px">The code works once and expires in ${CODE_MINUTES} minutes. If this wasn't you, don't share the code: ${escapeHtml(name)} won't be connected. Consider changing your password.</p>
<p style="color:#888;font-size:12px">— ${escapeHtml(SITE.name)}</p></div>`,
  });
  if (!res.ok) console.error("[social] couldn't email the link code for account", userId);
  return res.ok;
}

/**
 * Right after a social sign-in. A brand-new account trusts its first sign-in method; a method Supabase
 * attached to an existing account waits for the email code ("pending").
 */
export async function checkSocialSignIn(au: AuthUser, provider: string | null): Promise<"ok" | "pending"> {
  const used = socialIdentity(au, provider);
  if (!used) return "ok";
  const identityId = idOf(used);
  const [row] = await db()`select trusted_identities, pending_link from public.users where id = ${au.id}`;
  if (!row) return "ok";
  const trusted = (row.trusted_identities as string[] | null) ?? [];
  if (trusted.includes(identityId)) return row.pending_link ? "pending" : "ok";
  const others = (au.identities ?? []).filter((i) => idOf(i) !== identityId);
  if (!others.length) {
    await db()`update public.users set trusted_identities = array_append(trusted_identities, ${identityId}) where id = ${au.id} and not (${identityId} = any(trusted_identities))`;
    console.info("[social] new account via", used.provider, au.id);
    return "ok";
  }
  const pending = row.pending_link as { identityId?: string } | null;
  if (pending?.identityId !== identityId) {
    await db()`update public.users set pending_link = ${db().json({ provider: used.provider, identityId, at: new Date().toISOString() })} where id = ${au.id}`;
    await emailLinkCode(au.id);
    console.info("[social]", used.provider, "sign-in attached to existing account", au.id, "; waiting for the email code");
  }
  return "pending";
}

export const resendLinkCode = (userId: string) => emailLinkCode(userId);

/** The owner entered the email code: the new sign-in method is trusted and the account unlocks. */
export async function verifyLinkCode(userId: string, code: string): Promise<{ ok: true; provider: string } | { ok: false; error: string }> {
  const out = await db().begin(async (tx): Promise<{ ok: true; provider: string } | { ok: false; error: string }> => {
    const [u] = await tx`select pending_link from public.users where id = ${userId} for update`;
    const pending = u?.pending_link as { provider?: string; identityId?: string } | null;
    if (!pending?.identityId) return { ok: false, error: "There's nothing waiting to be confirmed." };
    const check = await consumeCodeForUser(tx, userId, "link_account", code);
    if (!check.ok) return { ok: false, error: check.reason === "too_many" ? `Too many wrong codes (${MAX_CODE_TRIES}). Ask for a new code.` : WRONG };
    await tx`update public.users set pending_link = null, trusted_identities = array_append(trusted_identities, ${pending.identityId}) where id = ${userId}`;
    return { ok: true, provider: String(pending.provider ?? "") };
  });
  if (!out.ok) return out;
  console.info("[social]", out.provider, "connected to account", userId);
  return { ok: true, provider: out.provider };
}

/** "Not me / cancel": the waiting sign-in method is removed again and the browser signed out. */
export async function cancelLink(supabase: SupabaseClient, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [u] = await db()`select pending_link from public.users where id = ${userId}`;
  const pending = u?.pending_link as { identityId?: string } | null;
  if (!pending?.identityId) return { ok: true };
  const { data } = await supabase.auth.getUser();
  const identity = data.user?.identities?.find((i) => idOf(i) === pending.identityId);
  if (identity) {
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) {
      console.error("[social] couldn't remove the waiting sign-in for account", userId, error.message);
      return { ok: false, error: "We couldn't remove that sign-in method. Please try again." };
    }
  }
  await db()`update public.users set pending_link = null where id = ${userId}`;
  await db()`update public.email_codes set used_at = now() where user_id = ${userId} and purpose = 'link_account' and used_at is null`;
  console.info("[social] waiting sign-in removed for account", userId);
  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAKEN = "That email can't be used here. If it's yours, sign in with it instead.";

/** A social account without an email: send a code to the address it wants to use. */
export async function startAddEmail(userId: string, raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: "Enter a valid email address." };
  const [taken] = await db()`select 1 from public.users where lower(email) = ${email} and id <> ${userId}`;
  if (taken) return { ok: false, error: TAKEN };
  const code = await db().begin(async (tx) => ((await codesThisHour(tx, userId, "add_email")) >= 5 ? null : issueCode(tx, userId, "add_email", undefined, email)));
  if (!code) return { ok: false, error: "Too many codes this hour. Please try again later." };
  const res = await sendEmail({
    to: email,
    subject: `Your ${SITE.name} code: confirm this email`,
    text: `Your code to add this email to your ${SITE.name} account: ${code}\n\nIt works once and expires in ${CODE_MINUTES} minutes. If you didn't ask for this, ignore this email.\n\n— ${SITE.name}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px"><p>Your code to add this email to your ${escapeHtml(SITE.name)} account:</p><p style="margin:20px 0 8px;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p><p style="color:#555;font-size:13px">It works once and expires in ${CODE_MINUTES} minutes. If you didn't ask for this, ignore this email.</p><p style="color:#888;font-size:12px">— ${escapeHtml(SITE.name)}</p></div>`,
  });
  return res.ok ? { ok: true } : { ok: false, error: "We couldn't send the email. Please try again later." };
}

/** The code was right: the address becomes the account's (confirmed) email. */
export async function finishAddEmail(userId: string, code: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const check = await db().begin((tx) => consumeCodeForUser(tx, userId, "add_email", code));
  if (!check.ok || !check.targetEmail) return { ok: false, error: !check.ok && check.reason === "too_many" ? "Too many wrong codes. Ask for a new code." : WRONG };
  const email = check.targetEmail;
  const [taken] = await db()`select 1 from public.users where lower(email) = ${email} and id <> ${userId}`;
  if (taken) return { ok: false, error: TAKEN };
  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) {
    console.error("[social] couldn't set the added email for account", userId, error.message);
    return { ok: false, error: /already|exists|registered/i.test(error.message) ? TAKEN : "We couldn't save that email. Please try again." };
  }
  // The database trigger copies it to users.email; make sure this request sees it too.
  await db()`update public.users set email = ${email}, email_verified = true where id = ${userId}`;
  return { ok: true, email };
}

export interface SignupChoice {
  role: "student" | "parent" | "tutor";
  ageBand?: "18+" | "13-17" | "under13";
  parentEmail?: string;
  country: string;
  zip?: string;
  timezone?: string;
}

/**
 * A first-time social account chooses its role — once. Same rules as signing up with a password:
 * students say their age (under 13 can't have an account; 13–17 need a parent's approval).
 */
export async function completeSignup(userId: string, c: SignupChoice): Promise<{ ok: true; role: SignupChoice["role"]; teen: boolean } | { ok: false; error: string; deleted?: boolean }> {
  const [u] = await db()`select needs_role, email from public.users where id = ${userId}`;
  if (!u) return { ok: false, error: "Account not found." };
  if (!u.needs_role) return { ok: false, error: "Your account is already set up." };
  if (!u.email) return { ok: false, error: "Add your email address first." };
  if (!["student", "parent", "tutor"].includes(c.role)) return { ok: false, error: "Choose Student, Parent or Tutor." };
  if (c.role === "student" && !c.ageBand) return { ok: false, error: "Tell us your age range." };
  if (c.role === "student" && c.ageBand === "under13") {
    // Children under 13 can't have their own account (COPPA): nothing is kept.
    await supabaseAdmin().auth.admin.deleteUser(userId).catch(() => {});
    await db()`delete from public.users where id = ${userId}`;
    return { ok: false, deleted: true, error: "Students under 13 can't create an account. A parent can sign up and add them as a child." };
  }
  const teen = c.role === "student" && c.ageBand === "13-17";
  const parentEmail = (c.parentEmail ?? "").trim().toLowerCase();
  if (teen && !EMAIL_RE.test(parentEmail)) return { ok: false, error: "Students under 18 need a parent or guardian's email." };
  if (teen && parentEmail === String(u.email).toLowerCase()) return { ok: false, error: "Use your parent or guardian's own email address." };
  if (!isCountryCode(c.country)) return { ok: false, error: "Choose your country." };
  const zip = (c.zip ?? "").trim();
  if (zip ? !isPostalCode(zip, c.country) : postalRequired(c.country)) return { ok: false, error: postalError(c.country) };
  const done = await db()`
    update public.users set role = ${c.role}, needs_role = false, country = ${c.country}, zip = ${zip || null},
      parental_consent = ${teen ? db().json({ parentEmail, status: "pending" }) : null}
    where id = ${userId} and needs_role
    returning id`;
  if (!done.length) return { ok: false, error: "Your account is already set up." };
  if (c.timezone) await db()`update public.users set timezone = ${c.timezone} where id = ${userId} and exists (select 1 from pg_catalog.pg_timezone_names where name = ${c.timezone})`;
  console.info("[social] account", userId, "chose role", c.role);
  return { ok: true, role: c.role, teen };
}
