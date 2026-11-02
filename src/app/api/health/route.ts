import { db } from "@/server/db";
import { backendStatus } from "@/server/env";
import { json } from "@/server/http";

/*
 * GET /api/health — which backend services are connected, and whether the database answers and
 * has the migrations applied. Shows names of missing settings only, never their values.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const status = backendStatus();
  let database: { ok: boolean; migrations?: string[]; error?: string } = { ok: false, error: "SUPABASE_DB_URL is not set" };
  if (status.database) {
    try {
      const rows = await db()`select version from public.schema_migrations order by version`;
      database = { ok: true, migrations: rows.map((r) => String(r.version)) };
    } catch (e) {
      const msg = (e as Error).message ?? "";
      database = { ok: false, error: /schema_migrations/.test(msg) ? "Connected, but migrations haven't been applied — run npm run db:migrate" : "Can't connect — check SUPABASE_DB_URL" };
    }
  }
  return json({
    ok: database.ok && status.auth && status.storage,
    database,
    auth: status.auth,
    storage: status.storage,
    email: status.email,
    payments: status.payments,
    missing: status.missing,
  });
}
