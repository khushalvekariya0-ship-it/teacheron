#!/usr/bin/env node
/*
 * Checks the site's email settings in .env.local (SMTP_* or RESEND_API_KEY, and EMAIL_FROM) without
 * printing any secret.
 *
 *   npm run email:check                     log in to the mail server, send nothing
 *   npm run email:check -- you@example.com  also send a test email to that address
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));

const { SMTP_HOST = "", SMTP_PORT = "465", SMTP_USER = "", SMTP_PASS = "", EMAIL_FROM = "", RESEND_API_KEY = "" } = process.env;
const to = process.argv[2];
const show = (v) => (v ? "set" : "MISSING");

console.log(`EMAIL_FROM: ${show(EMAIL_FROM)}`);
if (!EMAIL_FROM) console.log('  Add it, e.g. EMAIL_FROM="TutorLink <yourname@gmail.com>"');

if (SMTP_HOST) {
  const port = Number(SMTP_PORT) || 465;
  console.log(`SMTP: ${SMTP_HOST}:${port} · user ${show(SMTP_USER)} · password ${show(SMTP_PASS)}`);
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined, connectionTimeout: 15_000 });
  try {
    await transport.verify();
    console.log("Login to the mail server: OK");
  } catch (e) {
    console.error(`Login to the mail server FAILED: ${e.message}`);
    if (/Username and Password not accepted|535|Invalid login/i.test(e.message)) {
      console.error("  For Gmail, SMTP_PASS must be a 16-letter App Password (Google Account → Security → App passwords), not your normal password.");
    }
    process.exit(1);
  }
  if (to) {
    await transport.sendMail({ from: EMAIL_FROM, to, subject: "TutorLink test email", text: "Email from your TutorLink site works. You can delete this message." });
    console.log(`Test email sent to ${to.replace(/^(..)[^@]*@/, "$1***@")}. Check the inbox (and spam).`);
  }
} else if (RESEND_API_KEY) {
  console.log("Resend API key: set (SMTP not set, so Resend is used).");
  if (to) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject: "TutorLink test email", text: "Email from your TutorLink site works." }),
    });
    console.log(res.ok ? "Test email accepted by Resend." : `Resend refused it: ${res.status} ${await res.text()}`);
  }
} else {
  console.log("No email service is set. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM to .env.local (see docs/SUPABASE_SETUP.md, step 7).");
  process.exit(1);
}
