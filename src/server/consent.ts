import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { fail, ok, type Result } from "@/lib/domain/data";
import { SITE } from "@/lib/site";
import { db } from "./db";
import { escapeHtml, sendEmail } from "./email";
import { runAction } from "./engine";
import { emailNotifications } from "./notify-email";

/*
 * Parental consent for students aged 13–17: the parent gets an emailed link with a random token
 * (only its SHA-256 is stored), valid for 14 days and usable once.
 */

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function sendConsentRequest(userId: string, origin: string): Promise<Result<{ emailed: boolean }>> {
  const [u] = await db()`select first_name, last_name, parental_consent from public.users where id = ${userId}`;
  const consent = u?.parental_consent as { parentEmail?: string; status?: string } | null;
  if (!u || !consent?.parentEmail) return fail("This account doesn't need a parent's approval.");
  if (consent.status === "granted") return fail("Your parent has already approved your account.");
  const recent = await db()`select 1 from public.parental_consent_tokens where user_id = ${userId} and created_at > now() - interval '2 minutes'`;
  if (recent.length) return fail("We just sent an approval email. Please wait a couple of minutes before sending another.");
  const token = randomBytes(32).toString("base64url");
  await db()`insert into public.parental_consent_tokens (token_hash, user_id, parent_email, expires_at) values (${hash(token)}, ${userId}, ${consent.parentEmail}, now() + interval '14 days')`;
  const link = `${origin}/consent?token=${token}`;
  const name = `${u.first_name} ${String(u.last_name).charAt(0)}.`;
  const sent = await sendEmail({
    to: consent.parentEmail,
    subject: `Approve ${u.first_name}'s ${SITE.name} account`,
    text: `${name} signed up for ${SITE.name} as a student and listed you as their parent or guardian.\n\nStudents under 18 need a parent's approval before they can message tutors or book lessons. To approve, open this link (valid for 14 days):\n${link}\n\nIf you don't recognize this request, ignore this email — the account stays restricted.`,
    html: `<p>${escapeHtml(name)} signed up for ${SITE.name} as a student and listed you as their parent or guardian.</p><p>Students under 18 need a parent's approval before they can message tutors or book lessons.</p><p><a href="${escapeHtml(link)}">Review and approve the account</a> (valid for 14 days)</p><p>If you don't recognize this request, ignore this email — the account stays restricted.</p>`,
  });
  if (!sent.ok) return fail(sent.error);
  return ok({ emailed: true });
}

export async function lookupConsent(token: string): Promise<{ firstName: string; lastInitial: string; status: "pending" | "granted" } | null> {
  if (!token || token.length > 200) return null;
  const [row] = await db()`
    select u.first_name, u.last_name, u.parental_consent, t.used_at, t.expires_at
      from public.parental_consent_tokens t join public.users u on u.id = t.user_id
     where t.token_hash = ${hash(token)}`;
  if (!row) return null;
  const status = (row.parental_consent as { status?: string } | null)?.status === "granted" ? "granted" : "pending";
  if (status === "pending" && (row.used_at || new Date(row.expires_at as Date).getTime() < Date.now())) return null;
  return { firstName: String(row.first_name), lastInitial: String(row.last_name).charAt(0), status };
}

export async function confirmConsent(token: string, parentEmail: string, origin?: string): Promise<Result> {
  const [row] = await db()`select user_id, used_at, expires_at from public.parental_consent_tokens where token_hash = ${hash(token)}`;
  if (!row || row.used_at || new Date(row.expires_at as Date).getTime() < Date.now()) return fail("This approval link isn't valid. Ask your student to send a new request from their account.");
  let emails: Promise<number> = Promise.resolve(0);
  const r = await runAction("confirmParentalConsent", [String(row.user_id), parentEmail], { userId: null }, (created) => (emails = emailNotifications(created, origin)));
  if (!r.ok) return r;
  await emails;
  await db()`update public.parental_consent_tokens set used_at = now() where token_hash = ${hash(token)}`;
  return ok(undefined);
}
