import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import { env } from "./env";

/*
 * Email the site sends itself: password reset links, parental consent and copies of notifications.
 * Goes through an SMTP mailbox (SMTP_HOST/PORT/USER/PASS, e.g. Gmail with an app password) when one is
 * set, otherwise through Resend's HTTP API (RESEND_API_KEY). Credentials live in server environment
 * variables only and never reach the browser.
 */

export type EmailMessage = { to: string; subject: string; text: string; html: string };

const smtpReady = () => !!(env.smtpHost && env.emailFrom);
const resendReady = () => !!(env.resendKey && env.emailFrom);
export const emailReady = () => smtpReady() || resendReady();

/*
 * The mail server's address is looked up the way the operating system does it (like a browser), IPv4
 * first, and remembered for a few minutes. nodemailer's own lookup waits for both an IPv4 and an IPv6
 * answer from the DNS servers and gives up if either is slow, which some home connections cause.
 */
let address: { ip: string; until: number } | null = null;
async function smtpAddress(): Promise<string> {
  if (isIP(env.smtpHost)) return env.smtpHost;
  if (address && address.until > Date.now()) return address.ip;
  const find = async () => {
    try {
      return (await lookup(env.smtpHost, { family: 4 })).address;
    } catch {
      return (await lookup(env.smtpHost)).address;
    }
  };
  const ip = await Promise.race([find(), new Promise<never>((_, fail) => setTimeout(() => fail(new Error(`DNS lookup for ${env.smtpHost} timed out`)), 8_000))]);
  address = { ip, until: Date.now() + 5 * 60_000 };
  return ip;
}

const transports = new Map<string, ReturnType<typeof nodemailer.createTransport>>();
async function smtp() {
  const ip = await smtpAddress();
  let t = transports.get(ip);
  if (!t) {
    t = nodemailer.createTransport({
      host: ip,
      // The real name, so the TLS certificate is checked against it.
      servername: isIP(env.smtpHost) ? undefined : env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465, // 465 = SSL from the start; 587 upgrades with STARTTLS
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    transports.set(ip, t);
  }
  return t;
}

const FAILED = "We couldn't send the email. Please try again later.";
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
/** Login refused or a bad address: trying again won't help. */
const permanent = (e: unknown) => {
  const code = Number((e as { responseCode?: number })?.responseCode ?? 0);
  return code >= 500 || (e as { code?: string })?.code === "EAUTH" || (e as { code?: string })?.code === "EENVELOPE";
};

export async function sendEmail(message: EmailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailReady()) return { ok: false, error: "Email sending isn't set up yet." };
  if (smtpReady()) {
    // Network hiccups (slow DNS, a dropped connection) are retried a few times.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await (await smtp()).sendMail({ from: env.emailFrom, to: message.to, subject: message.subject, text: message.text, html: message.html });
        if (attempt > 1) console.info(`[email] sent on attempt ${attempt}`);
        return { ok: true };
      } catch (e) {
        console.error(`[email] SMTP attempt ${attempt}:`, (e as Error)?.message ?? e);
        address = null;
        transports.clear();
        if (permanent(e) || attempt === 3) break;
        await wait(attempt * 2_000);
      }
    }
    return { ok: false, error: FAILED };
  }
  try {
    const res = await fetch(`${env.resendUrl}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!res.ok) {
      console.error("[email] Resend responded", res.status, await res.text().catch(() => ""));
      return { ok: false, error: FAILED };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email]", e);
    return { ok: false, error: FAILED };
  }
}

/** Many emails at once (Resend's batch endpoint takes 100 per request). Returns how many were accepted. */
export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  if (!emailReady() || !messages.length) return 0;
  if (smtpReady()) {
    let sent = 0;
    for (const m of messages) if ((await sendEmail(m)).ok) sent++;
    return sent;
  }
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

/** Checks the SMTP mailbox accepts the login, without sending anything (used by scripts/check-email). */
export async function verifyEmailService(): Promise<{ ok: boolean; via: "smtp" | "resend" | "none"; error?: string }> {
  if (smtpReady()) {
    try {
      await (await smtp()).verify();
      return { ok: true, via: "smtp" };
    } catch (e) {
      return { ok: false, via: "smtp", error: (e as Error)?.message ?? String(e) };
    }
  }
  return { ok: resendReady(), via: resendReady() ? "resend" : "none" };
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
