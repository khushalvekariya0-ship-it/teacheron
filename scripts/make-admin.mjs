#!/usr/bin/env node
/*
 * Gives an existing account staff access. Sign up on the site first (any role), confirm the email,
 * then run:
 *
 *   npm run db:make-admin -- you@example.com              administrator, every permission
 *   npm run db:make-admin -- helper@example.com --support support staff (users, bookings, reports, disputes, payments read-only)
 *   npm run db:make-admin -- someone@example.com --revoke back to a student account, no permissions
 *   npm run db:make-admin -- you@example.com --reset-mfa  remove two-step login (lost phone, no other admin to help)
 *
 * Staff roles can't be chosen at sign-up (the database trigger only allows student, parent and tutor),
 * so this script — run with the database URL from .env.local — is how the first administrator is made.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));

// Keep in sync with ALL_PERMISSIONS / SUPPORT_PERMISSIONS in src/lib/data/users.ts.
const ALL = ["users.read", "users.write", "tutors.verify", "bookings.manage", "payments.read", "payments.refund", "disputes.manage", "reports.moderate", "conversations.read_flagged", "content.manage", "settings.manage", "flags.manage", "audit.read"];
const SUPPORT = ["users.read", "bookings.manage", "reports.moderate", "disputes.manage", "payments.read"];

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
const mode = args.includes("--reset-mfa") ? "reset-mfa" : args.includes("--revoke") ? "revoke" : args.includes("--support") ? "support" : "admin";
if (!email) {
  console.error("Usage: npm run db:make-admin -- you@example.com [--support | --revoke | --reset-mfa]");
  process.exit(1);
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL is not set. Add your Supabase connection string to .env.local (see docs/SUPABASE_SETUP.md).");
  process.exit(1);
}

// Encrypted unless the database is on this computer.
const ssl = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(process.env.SUPABASE_DB_URL).hostname) ? false : "require";
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, ssl, prepare: false, onnotice: () => {} });
try {
  const [user] = await sql`select id, role, first_name, last_name, tutor_id from public.users where lower(email) = ${email}`;
  if (!user) {
    console.error(`No account with the email ${email}. Sign up on the site first, then run this again.`);
    process.exitCode = 1;
  } else if (mode === "reset-mfa") {
    // Supabase keeps authenticator apps in auth.mfa_factors; removing them turns two-step login off.
    await sql.begin(async (tx) => {
      const removed = await tx`delete from auth.mfa_factors where user_id = ${user.id}::uuid returning id`;
      await tx`update public.users set mfa_enabled = false where id = ${user.id}`;
      await tx`insert into public.audit_logs (id, actor_id, action, target_type, target_id, meta, created_at)
               values (${`aud_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`}, 'system', 'user.mfa_reset', 'user', ${user.id}, ${sql.json({ via: "make-admin script", factors: removed.length })}, now())`;
      console.log(removed.length ? `Two-step login removed for ${email}. Sign in with your password, then set it up again in Admin → Security.` : `${email} didn't have two-step login set up.`);
    });
  } else if (user.tutor_id && mode !== "revoke") {
    console.error(`${email} has a tutor profile. Use a separate email for your staff account.`);
    process.exitCode = 1;
  } else {
    const role = mode === "revoke" ? "student" : mode;
    const permissions = mode === "admin" ? ALL : mode === "support" ? SUPPORT : [];
    await sql.begin(async (tx) => {
      await tx`update public.users set role = ${role}, permissions = ${permissions}, status = 'active' where id = ${user.id}`;
      await tx`insert into public.audit_logs (id, actor_id, action, target_type, target_id, meta, created_at)
               values (${`aud_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`}, 'system', ${`user.role.${role}`}, 'user', ${user.id}, ${sql.json({ via: "make-admin script", permissions: permissions.length })}, now())`;
    });
    console.log(`${user.first_name} ${user.last_name} <${email}> is now ${role === "admin" ? "an administrator" : role === "support" ? "support staff" : "a student account"} (${permissions.length} permissions).`);
    if (role !== "student") console.log("Sign out and back in, then open /admin.");
  }
} catch (e) {
  console.error(`Failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
