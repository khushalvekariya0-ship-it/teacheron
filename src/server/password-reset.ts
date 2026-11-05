import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SITE } from "@/lib/site";
import { isLocalOrigin, resetLinkOrigin } from "@/lib/site-url";
import { db } from "./db";
import { cancelCodes, CODE_MINUTES, consumeCode, issueCode, MAX_CODE_TRIES } from "./email-codes";
import { escapeHtml, sendEmail } from "./email";
import { env } from "./env";
import { rateLimit } from "./http";
import { supabaseAdmin } from "./supabase";

/** Where reset links point: the configured https:// site address (http only for localhost), or null. */
export const resetOrigin = () => resetLinkOrigin(env.siteUrl);

/*
 * Password reset by email, done by the site itself:
 *   1. startPasswordReset makes a random 256-bit link token (password_resets) and a 6-digit code with the
 *      purpose "password_reset" (email_codes, see email-codes.ts), stores only SHA-256 fingerprints with a
 *      15-minute expiry (cancelling any older link and code for that account) and emails both;
 *   2. checkResetToken tells the reset page whether a link still works; exchangeResetCode turns the code,
 *      typed on the "Forgot password" page, into a fresh link token (for when the emailed link can't be
 *      opened, e.g. Gmail won't open links to a site on http://localhost). Five wrong codes cancel the email;
 *   3. finishPasswordReset sets the new password through Supabase Auth (which hashes it with bcrypt, as
 *      for every password), marks the link used and signs the account out everywhere else.
 * Nothing here tells the caller whether an email address has an account (only the mailbox's owner finds
 * out, from the email). Server logs name the account id and what happened, never the email address, link or code.
 */

export const RESET_MINUTES = CODE_MINUTES;
const MAX_LINKS_PER_HOUR = 3;

const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");

export type ResetStatus = "valid" | "expired" | "used" | "replaced" | "invalid";

/** Most "no account" / "suspended" notices the whole site sends in an hour, so the form can't be used to spam people. */
const MAX_NOTICES_PER_HOUR = 50;

const noticeHtml = (paragraphs: string[]) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px">${paragraphs.map((p) => `<p>${p}</p>`).join("")}<p style="color:#888;font-size:12px">— ${escapeHtml(SITE.name)}</p></div>`;

/**
 * Every address typed into "Forgot password" gets an email, so people know the request arrived. The page
 * shows the same thing in every case, so only the mailbox's owner learns whether there's an account:
 *   - an active account: a 6-digit code and a link (below);
 *   - no account: an email saying so, with a link to sign up (no code);
 *   - a suspended account: an email saying its password can't be reset (no code).
 * The route allows 3 requests an hour per address; notices are also capped site-wide.
 */
export async function startPasswordReset(email: string, origin: string): Promise<void> {
  const sql = db();
  const address = email.trim();
  const [user] = await sql`select id, first_name, email, status from public.users where lower(email) = lower(${address}) limit 1`;
  if (!user || user.status === "suspended") {
    if (!rateLimit("reset-notice:all", MAX_NOTICES_PER_HOUR, 60 * 60_000).ok) {
      return console.warn(`[reset] more than ${MAX_NOTICES_PER_HOUR} 'no account' notices this hour; nothing sent`);
    }
    const res = !user
      ? await sendEmail({
          to: address,
          subject: `No ${SITE.name} account for this email`,
          text: `Hi,\n\nSomeone (hopefully you) asked to reset the ${SITE.name} password for ${address}, but there's no ${SITE.name} account with this email address.\n\nIf it was you: you may have signed up with a different email address, so try that one on the Forgot password page. Or create an account here:\n${origin}/register\n\nIf you didn't ask for this, you can ignore this email.\n\n— ${SITE.name}`,
          html: noticeHtml([
            "Hi,",
            `Someone (hopefully you) asked to reset the ${escapeHtml(SITE.name)} password for <b>${escapeHtml(address)}</b>, but there's no ${escapeHtml(SITE.name)} account with this email address.`,
            `If it was you: you may have signed up with a different email address, so try that one on the Forgot password page. Or <a href="${escapeHtml(`${origin}/register`)}" style="color:#b83a19">create an account</a>.`,
            `<span style="color:#555;font-size:13px">If you didn't ask for this, you can ignore this email.</span>`,
          ]),
        })
      : await sendEmail({
          to: String(user.email),
          subject: `About your ${SITE.name} password reset`,
          text: `Hi ${user.first_name || "there"},\n\nSomeone (hopefully you) asked to reset the password for your ${SITE.name} account, but the account is suspended, so its password can't be reset. If you think this is a mistake, reply to this email.\n\n— ${SITE.name}`,
          html: noticeHtml([
            `Hi ${escapeHtml(String(user.first_name || "there"))},`,
            `Someone (hopefully you) asked to reset the password for your ${escapeHtml(SITE.name)} account, but the account is suspended, so its password can't be reset.`,
            "If you think this is a mistake, reply to this email.",
          ]),
        });
    const what = user ? `suspended account ${user.id}` : "an address with no account";
    return res.ok ? console.info(`[reset] reset asked for ${what}; sent a notice (no code)`) : console.error(`[reset] couldn't email the notice for ${what}`);
  }
  const [{ n }] = await sql`select count(*)::int n from public.password_resets where user_id = ${user.id} and created_at > now() - interval '1 hour'`;
  if (n >= MAX_LINKS_PER_HOUR) return console.info("[reset] account", user.id, `already got ${MAX_LINKS_PER_HOUR} reset emails this hour; nothing sent`);
  const token = randomBytes(32).toString("base64url");
  const id = `pwr_${randomBytes(9).toString("hex")}`;
  const code = await sql.begin(async (tx) => {
    // Only the newest email works (issueCode also cancels the older reset codes).
    await tx`update public.password_resets set used_at = now(), replaced_at = now() where user_id = ${user.id} and used_at is null`;
    await tx`insert into public.password_resets (id, user_id, token_hash, expires_at)
             values (${id}, ${user.id}, ${fingerprint(token)}, now() + make_interval(mins => ${RESET_MINUTES}))`;
    return issueCode(tx, String(user.id), "password_reset", id);
  });
  const link = `${origin}/reset-password?token=${token}`;
  const name = String(user.first_name || "there");
  // A site still running on its own computer has a "localhost" address. Gmail and most mail apps won't
  // open those links, so the email says to type the code instead.
  const local = isLocalOrigin(origin);
  const localNote = "This site is running on your own computer (localhost), so email apps like Gmail won't open the button. Type the code above on the Forgot password page instead.";
  const res = await sendEmail({
    to: String(user.email),
    subject: `Reset your ${SITE.name} password`,
    text: `Hi ${name},\n\nSomeone (hopefully you) asked to reset the password for your ${SITE.name} account.\n\nYour reset code: ${code}\n\nType it on the Forgot password page where you asked for this email.\n\n${local ? `${localNote}\n\n` : ""}Or choose a new password here:\n${link}\n\nThe code and the link work once and expire in ${RESET_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password stays the same.\n\n— ${SITE.name}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px">
<p>Hi ${escapeHtml(name)},</p>
<p>Someone (hopefully you) asked to reset the password for your ${escapeHtml(SITE.name)} account.</p>
<p style="margin:24px 0 6px;color:#555;font-size:13px">Your reset code</p>
<p style="margin:0 0 8px;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a1a">${code}</p>
<p style="margin-top:0">Type it on the <b>Forgot password</b> page where you asked for this email.</p>
${local ? `<p style="background:#fff4e5;border:1px solid #f0c48a;padding:12px 14px;font-size:14px">${escapeHtml(localNote)}</p>` : ""}
<p style="margin:24px 0 8px;color:#555;font-size:13px">Or open the reset page:</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="background:#b83a19;color:#ffffff;text-decoration:none;padding:12px 22px;font-weight:bold;display:inline-block">Choose a new password</a></p>
<p style="color:#555;font-size:13px;margin-bottom:6px">If the button doesn't work, copy this link into your browser:</p>
<p style="font-family:Consolas,Menlo,monospace;font-size:13px;background:#f4f1ec;border:1px solid #d9d4cc;padding:10px 12px;margin-top:0;word-break:break-all">${escapeHtml(link)}</p>
<p style="color:#555;font-size:13px">The code and the link work once and expire in ${RESET_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password stays the same.</p>
<p style="color:#888;font-size:12px">— ${escapeHtml(SITE.name)}</p>
</div>`,
  });
  if (res.ok) console.info("[reset] reset email sent for account", user.id);
  else console.error("[reset] couldn't email the reset link for account", user.id);
}

/** Whether a reset link can still be used. */
export async function checkResetToken(token: string): Promise<ResetStatus> {
  const [row] = await db()`select used_at, replaced_at, expires_at <= now() as expired from public.password_resets where token_hash = ${fingerprint(token)}`;
  if (!row) return "invalid";
  if (row.replaced_at) return "replaced";
  if (row.used_at) return "used";
  return row.expired ? "expired" : "valid";
}

const WRONG_CODE = "That code isn't right or has expired. Use the code in the newest email, or request a new one.";

/**
 * The 6-digit code from the email, typed on the "Forgot password" page, swapped for a fresh link token that
 * opens the reset page. The code works once; the emailed link is replaced by the new token. Every failure
 * gives the same answer (no account, wrong code, expired, too many tries), and the fifth wrong code cancels
 * that email.
 */
export async function exchangeResetCode(email: string, code: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  return db().begin(async (tx): Promise<{ ok: true; token: string } | { ok: false; error: string }> => {
    const check = await consumeCode(tx, email, "password_reset", code);
    if (!check.ok) {
      if (check.reason === "no_code") console.info("[reset] code entered, but there's no open reset code for that address");
      else console.info("[reset] wrong reset code for account", check.userId, check.reason === "too_many" ? `(${MAX_CODE_TRIES} wrong tries; email cancelled)` : "");
      // Too many wrong codes cancel the whole email, link included.
      if (check.reason === "too_many" && check.resetId) await tx`update public.password_resets set used_at = now() where id = ${check.resetId} and used_at is null`;
      return { ok: false, error: WRONG_CODE };
    }
    // The code unlocks its own email's link, if that link is still open.
    const token = randomBytes(32).toString("base64url");
    const swapped = await tx`update public.password_resets set token_hash = ${fingerprint(token)}
                             where id = ${check.resetId} and used_at is null and expires_at > now() returning id`;
    if (!swapped.length) return { ok: false, error: WRONG_CODE };
    console.info("[reset] reset code accepted for account", check.userId);
    return { ok: true, token };
  });
}

export type ResetResult = { ok: true; userId: string; email: string; firstName: string } | { ok: false; status: Exclude<ResetStatus, "valid"> | "rejected"; error: string };

const STATUS_ERROR: Record<Exclude<ResetStatus, "valid">, string> = {
  expired: `This reset link has expired (links last ${RESET_MINUTES} minutes). Request a new one.`,
  used: "This reset link was already used. Request a new one if you still need to change your password.",
  replaced: "A newer reset email was sent, so this link no longer works. Use the newest email.",
  invalid: "This reset link isn't valid. Request a new one.",
};

/** Sets the new password if the link still works. The link can't be used again afterwards. */
export async function finishPasswordReset(token: string, password: string): Promise<ResetResult> {
  const result = await db().begin(async (tx): Promise<ResetResult> => {
    // Locked, so the same link can't be used twice at the same moment.
    const [row] = await tx`select id, user_id, used_at, replaced_at, expires_at <= now() as expired from public.password_resets where token_hash = ${fingerprint(token)} for update`;
    const status: ResetStatus = !row ? "invalid" : row.replaced_at ? "replaced" : row.used_at ? "used" : row.expired ? "expired" : "valid";
    if (status !== "valid") return { ok: false, status, error: STATUS_ERROR[status] };
    // Supabase Auth hashes and stores it; reaching this page also proves the person owns the email.
    const { error } = await supabaseAdmin().auth.admin.updateUserById(String(row.user_id), { password, email_confirm: true });
    if (error) {
      console.error("[reset] Supabase didn't accept the new password for account", row.user_id, "-", error.code ?? "", error.message);
      const weak = error.code === "weak_password" || /weak|short|characters/i.test(error.message);
      return { ok: false, status: "rejected", error: weak ? "Choose a stronger password: at least 10 characters, not a common one." : "We couldn't change your password. Please try again." };
    }
    await tx`update public.password_resets set used_at = now() where user_id = ${row.user_id} and used_at is null`;
    await cancelCodes(tx, String(row.user_id), "password_reset");
    const [u] = await tx`select email, first_name from public.users where id = ${row.user_id}`;
    return { ok: true, userId: String(row.user_id), email: String(u?.email ?? ""), firstName: String(u?.first_name ?? "") };
  });
  if (result.ok) {
    console.info("[reset] new password saved for account", result.userId);
    // Anyone signed in with the old password is signed out everywhere.
    try {
      await db()`delete from auth.sessions where user_id = ${result.userId}::uuid`;
    } catch (e) {
      console.warn("[reset] couldn't end the other sessions", (e as Error)?.message);
    }
  } else {
    console.info("[reset] new password not saved:", result.status);
  }
  return result;
}

/**
 * A short "your password was changed" notice, so the owner hears about a change they didn't make.
 * "set": an account made with Google / Facebook / Apple added its first password.
 */
export async function sendPasswordChangedEmail(to: string, firstName: string, kind: "reset" | "changed" | "set" = "reset"): Promise<void> {
  const name = firstName || "there";
  const help = `${resetOrigin() ?? ""}/forgot-password`;
  const what =
    kind === "set"
      ? `A password was just added to your ${SITE.name} account, so it can now also be signed in to with this email and that password. You were signed out on other devices.`
      : `The password for your ${SITE.name} account was just changed, and you were signed out on other devices.`;
  await sendEmail({
    to,
    subject: kind === "set" ? `A password was added to your ${SITE.name} account` : `Your ${SITE.name} password was changed`,
    text: `Hi ${name},\n\n${what}\n\nIf this wasn't you, reset your password straight away: ${help}\n\n— ${SITE.name}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px"><p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(what)}</p><p>If this wasn't you, <a href="${escapeHtml(help)}">reset your password straight away</a>.</p><p style="color:#888;font-size:12px">— ${escapeHtml(SITE.name)}</p></div>`,
  });
}
