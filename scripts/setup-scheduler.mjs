#!/usr/bin/env node
/*
 * Calls the site's scheduled jobs (GET /api/cron: lesson reminders, finishing past lessons, expiring
 * unanswered requests, closing finished classrooms, refund retries) every 10 minutes from the Supabase
 * database itself, with Supabase's pg_cron and pg_net. They then run on time even when nobody is on the
 * site and the host allows only one cron a day (Vercel's free plan). The regular calls also keep a free
 * Supabase project from being paused for inactivity.
 *
 *   npm run db:scheduler -- https://your-site.com     switch on, or update the address / secret
 *   npm run db:scheduler -- --status                  the job, its last runs and the site's answers
 *   npm run db:scheduler -- --off                     switch off
 *
 * Uses SUPABASE_DB_URL and CRON_SECRET from .env.local. CRON_SECRET must be the same value the site has
 * (on Vercel: Settings → Environment Variables). The site address and the secret are kept in Supabase
 * Vault, not in the job's text. Run it again after changing the site's address or CRON_SECRET.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));

const JOB = "tutorlink-scheduler";
const EVERY = "*/10 * * * *";
const URL_SECRET = "tutorlink_site_url";
const CRON_SECRET_NAME = "tutorlink_cron_secret";
// The job reads the address and the secret from Vault each time it runs.
const COMMAND = `select net.http_get(
  url := (select decrypted_secret from vault.decrypted_secrets where name = '${URL_SECRET}') || '/api/cron',
  headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '${CRON_SECRET_NAME}')),
  timeout_milliseconds := 60000
)`;

const args = process.argv.slice(2);
const mode = args.includes("--off") ? "off" : args.includes("--status") ? "status" : "on";
const siteArg = args.find((a) => !a.startsWith("--"));

if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL is not set. Add your Supabase connection string to .env.local (see docs/SUPABASE_SETUP.md).");
  process.exit(1);
}
let site = "";
if (mode === "on") {
  try {
    const u = new URL(siteArg ?? "");
    const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw new Error("https only");
    site = u.origin;
  } catch {
    console.error("Usage: npm run db:scheduler -- https://your-site.com   (the site's own address, https)");
    process.exit(1);
  }
  if ((process.env.CRON_SECRET ?? "").length < 16) {
    console.error("CRON_SECRET in .env.local is missing or shorter than 16 characters. Set it (the same value as on your host), then run this again.");
    process.exit(1);
  }
}

// Encrypted unless the database is on this computer.
const ssl = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(process.env.SUPABASE_DB_URL).hostname) ? false : "require";
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, ssl, prepare: false, onnotice: () => {} });

async function putSecret(name, value, description) {
  const [row] = await sql`select id from vault.secrets where name = ${name}`;
  if (row) await sql`select vault.update_secret(${row.id}::uuid, ${value})`;
  else await sql`select vault.create_secret(${value}, ${name}, ${description})`;
}

async function status() {
  const [job] = await sql`select jobid, schedule, active from cron.job where jobname = ${JOB}`.catch(() => []);
  if (!job) {
    console.log("The scheduler job is not set up (switched off).");
    return;
  }
  console.log(`Job "${JOB}": every 10 minutes (${job.schedule}), ${job.active ? "active" : "paused"}.`);
  const runs = await sql`select status, start_time, return_message from cron.job_run_details where jobid = ${job.jobid} order by start_time desc limit 5`;
  for (const r of runs) console.log("  run", r.start_time.toISOString(), r.status, r.status === "succeeded" ? "" : String(r.return_message ?? "").slice(0, 160));
  const answers = await sql`select status_code, error_msg, created from net._http_response order by created desc limit 5`.catch(() => []);
  for (const a of answers) console.log("  site answered", a.created.toISOString(), a.status_code ?? "-", a.error_msg ? String(a.error_msg).slice(0, 160) : "");
}

try {
  if (mode === "status") {
    await status();
  } else if (mode === "off") {
    const [job] = await sql`select jobid from cron.job where jobname = ${JOB}`.catch(() => []);
    if (job) await sql`select cron.unschedule(${JOB})`;
    console.log(job ? "Switched off: the database no longer calls the site's scheduled jobs." : "It was already off.");
  } else {
    await sql`create extension if not exists pg_net with schema extensions`;
    await sql`create extension if not exists pg_cron`;
    await putSecret(URL_SECRET, site, "TutorLink: the site address the scheduler calls");
    await putSecret(CRON_SECRET_NAME, process.env.CRON_SECRET, "TutorLink: CRON_SECRET for /api/cron");
    await sql`select cron.schedule(${JOB}, ${EVERY}, ${COMMAND})`;
    console.log(`Switched on: every 10 minutes the database calls ${site}/api/cron.`);
    // One call now, to check the site accepts the secret.
    const [{ id }] = await sql`select net.http_get(
      url := ${site + "/api/cron"},
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = ${CRON_SECRET_NAME})),
      timeout_milliseconds := 60000
    ) as id`;
    let answer;
    for (let i = 0; i < 40 && !answer; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      [answer] = await sql`select status_code, error_msg from net._http_response where id = ${id}`;
    }
    if (!answer) console.log("Test call: no answer yet (the site may be slow to start). Check later with --status.");
    else if (answer.status_code === 200) console.log("Test call: the site ran its scheduled jobs (200 OK).");
    else if (answer.status_code === 401) console.log("Test call: the site refused the secret (401). CRON_SECRET in .env.local must match the site's.");
    else console.log(`Test call: the site answered ${answer.status_code ?? "nothing"}${answer.error_msg ? ` (${String(answer.error_msg).slice(0, 160)})` : ""}.`);
  }
} catch (e) {
  console.error("Failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
