import "server-only";
import { env } from "./env";

/*
 * Transactional email that isn't part of Supabase Auth (Auth sends its own sign-up, magic-link and
 * password-reset emails). Sent through Resend's HTTP API when RESEND_API_KEY and EMAIL_FROM are set.
 */

export type EmailMessage = { to: string; subject: string; text: string; html: string };

export const emailReady = () => !!(env.resendKey && env.emailFrom);

export async function sendEmail(message: EmailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailReady()) return { ok: false, error: "Email sending isn't set up yet." };
  try {
    const res = await fetch(`${env.resendUrl}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!res.ok) {
      console.error("[email] Resend responded", res.status, await res.text().catch(() => ""));
      return { ok: false, error: "We couldn't send the email. Please try again later." };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email]", e);
    return { ok: false, error: "We couldn't send the email. Please try again later." };
  }
}

/** Many emails at once through Resend's batch endpoint (100 per request). Returns how many were accepted. */
export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  if (!emailReady() || !messages.length) return 0;
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(`${env.resendUrl}/emails/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((m) => ({ from: env.emailFrom, to: [m.to], subject: m.subject, text: m.text, html: m.html }))),
      });
      if (res.ok) sent += chunk.length;
      else console.error("[email] Resend batch responded", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("[email] batch", e);
    }
  }
  return sent;
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
