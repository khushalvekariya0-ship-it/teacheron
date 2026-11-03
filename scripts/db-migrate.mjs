#!/usr/bin/env node
/*
 * Applies supabase/migrations/*.sql to the database in SUPABASE_DB_URL (read from .env.local),
 * in file-name order, each in its own transaction. Applied files are recorded in
 * public.schema_migrations, so running it again only applies new files.
 *
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --check list applied / pending without changing anything
 *
 * Afterwards it checks that every table in the public schema has Row Level Security enabled.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Add your Supabase connection string to .env.local (see docs/SUPABASE_SETUP.md).");
  process.exit(1);
}
const checkOnly = process.argv.includes("--check");
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

// Encrypted unless the database is on this computer.
const ssl = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname) ? false : "require";
const sql = postgres(url, { max: 1, ssl, prepare: false, onnotice: () => {}, connect_timeout: 15 });
try {
  await sql`create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())`;
  await sql`alter table public.schema_migrations enable row level security`;
  const applied = new Set((await sql`select version from public.schema_migrations`).map((r) => r.version));
  const pending = files.filter((f) => !applied.has(f));
  for (const f of files) console.log(`${applied.has(f) ? "applied " : "pending "} ${f}`);
  if (checkOnly) process.exit(0);
  for (const f of pending) {
    const text = readFileSync(join(dir, f), "utf8");
    process.stdout.write(`Applying ${f} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into public.schema_migrations (version) values (${f})`;
    });
    console.log("done");
  }
  if (!pending.length) console.log("Nothing to apply — the database is up to date.");
  const open = await sql`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`;
  if (open.length) {
    console.warn(`WARNING: Row Level Security is OFF on: ${open.map((r) => r.tablename).join(", ")}. Enable it before going live.`);
    process.exitCode = 2;
  } else {
    console.log("Row Level Security is on for every public table.");
  }
} catch (e) {
  console.error(`\nMigration failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
