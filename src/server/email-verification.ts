import "server-only";
import { SITE } from "@/lib/site";
import { resetLinkOrigin } from "@/lib/site-url";
import { db } from "./db";
import { CODE_MINUTES, codesThisHour, consumeCode, issueCode, MAX_CODE_TRIES } from "./email-codes";
import { escapeHtml, sendEmail } from "./email";
import { env } from "./env";
import { supabaseAdmin } from "./supabase";

/*
 * First-time email verification with a 6-digit code (purpose "verify_email" in email_codes):
 *   1. after sign-up (and on "Send a new code") sendVerificationCode emails a code to an account whose email
 *      isn't confirmed yet;
 *   2. verifyEmailCode checks the typed code on the server and only then confirms the email in Supabase
 *      Auth (the database trigger mirrors it to users.email_verified). It doesn't sign anyone in: the person
 *      signs in with their password as usual, so sign-in checks and two-step login all still apply.
 * Until the email is confirmed, sign-in is refused (/api/auth/sign-in). Every failure gives the same
 * answer, so the form can't be used to find out who has an account. Logs show account ids only.
 */

const MAX_CODES_PER_HOUR = 5;
const WRONG_CODE = "That code isn't right or has expired. Use the code in the newest email, or ask for a new one.";

class ConfirmFailed extends Error {}

/** Emails a verification code if the address belongs to an account that still needs one. Quietly does nothing otherwise. */
export async function sendVerificationCode(email: string): Promise<void> {
  const sql = db();
  const [user] = await sql`select id, first_name, email, status, email_verified from public.users where lower(email) = lower(${email.trim()}) limit 1`;
  if (!user) return console.info("[verify] code asked for an address with no account; nothing sent");
  if (user.email_verified) return console.info("[verify] account", user.id, "is already verified; nothing sent");
  if (user.status === "suspended") return console.info("[verify] account", user.id, "is suspended; nothing sent");
  const code = await sql.begin(async (tx) => ((await codesThisHour(tx, String(user.id), "verify_email")) >= MAX_CODES_PER_HOUR ? null : issueCode(tx, String(user.id), "verify_email")));
  if (!code) return console.info("[verify] account", user.id, `already got ${MAX_CODES_PER_HOUR} codes this hour; nothing sent`);
  const name = String(user.first_name || "there");
  const origin = resetLinkOrigin(env.siteUrl);
  const page = origin ? `${origin}/verify-email` : null;
  const res = await sendEmail({
    to: String(user.email),
    subject: `Confirm your email for ${SITE.name}`,
    text: `Hi ${name},\n\nWelcome to ${SITE.name}. Your verification code: ${code}\n\nType it on the ${SITE.name} page where you signed up${page ? ` (or at ${page})` : ""} to confirm your email address. The code works once and expires in ${CODE_MINUTES} minutes.\n\nIf you didn't create a ${SITE.name} account, you can ignore this email.\n\n— ${SITE.name}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px">
<p>Hi ${escapeHtml(name)},</p>
<p>Welcome to ${escapeHtml(SITE.name)}. Use this code to confirm your email address:</p>
<p style="margin:24px 0 6px;color:#555;font-size:13px">Your verification code</p>
<p style="margin:0 0 8px;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a1a">${code}</p>
<p style="margin-top:0">Type it on the ${escapeHtml(SITE.name)} page where you signed up${page ? ` (or at <a href="${escapeHtml(page)}" style="color:#b83a19">${escapeHtml(page)}</a>)` : ""}.</p>
<p style="color:#555;font-size:13px">The code works once and expires in ${CODE_MINUTES} minutes. If you didn't create a ${escapeHtml(SITE.name)} account, you can ignore this email.</p>
<p style="color:#888;font-size:12px">— ${escapeHtml(SITE.name)}</p>
</div>`,
  });
  if (res.ok) console.info("[verify] verification code sent for account", user.id);
  else console.error("[verify] couldn't email the verification code for account", user.id);
}

/** Checks the typed code and, only if it's right, confirms the account's email. */
export async function verifyEmailCode(email: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await db().begin(async (tx): Promise<{ ok: true } | { ok: false; error: string }> => {
      const check = await consumeCode(tx, email, "verify_email", code);
      if (!check.ok) {
        if (check.reason === "no_code") console.info("[verify] code entered, but there's no open verification code for that address");
        else console.info("[verify] wrong verification code for account", check.userId, check.reason === "too_many" ? `(${MAX_CODE_TRIES} wrong tries; code cancelled)` : "");
        return { ok: false, error: WRONG_CODE };
      }
      const { error } = await supabaseAdmin().auth.admin.updateUserById(check.userId, { email_confirm: true });
      if (error) {
        console.error("[verify] Supabase didn't confirm the email for account", check.userId, "-", error.code ?? "", error.message);
        throw new ConfirmFailed(); // rolls back, so the code still works for another try
      }
      console.info("[verify] email confirmed for account", check.userId);
      return { ok: true };
    });
  } catch (e) {
    if (e instanceof ConfirmFailed) return { ok: false, error: "We couldn't confirm your email just now. Please try again." };
    throw e;
  }
}
