import "server-only";
import postgres from "postgres";
import { getDeadline, waitUntil } from "@vercel/functions";
import { env, NotConfiguredError } from "./env";

/*
 * One connection pool per server instance, through Supabase's connection pooler (SUPABASE_DB_URL).
 * `prepare: false` keeps it compatible with the pooler's transaction mode.
 *
 * On Vercel, a server copy is put to sleep (frozen) right after it answers. A frozen copy can't run
 * its idle timers, so its open database connections would stay open while it sleeps (up to ~30 min),
 * each one holding one of the pooler's few slots (15 on Supabase's smallest plan). Enough sleeping
 * copies (every deploy starts new ones) fill every slot and new requests — sign-in first — fail with
 * "max clients reached". So on Vercel, idle connections close after a few seconds, and each request
 * keeps its copy awake (waitUntil) until the pool has closed them.
 */

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

/** Vercel sets both while serving requests (not during the build). */
const ON_VERCEL = !!process.env.VERCEL_URL && !!process.env.VERCEL_REGION;
const IDLE_SECONDS = ON_VERCEL ? 3 : 20;
/** Never keep a copy awake longer than this for its connections (or past the request's own deadline). */
const MAX_HOLD_MS = 45_000;

const cache = globalThis as unknown as { __tutorlinkSql?: Sql; __tutorlinkDrain?: Promise<void>; __tutorlinkLastUse?: number };

/** Supabase is reached over the internet, so the connection is always encrypted; a database on this computer isn't. */
const sslFor = (url: string) => (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname) ? false : ("require" as const));

export function db(): Sql {
  if (!env.dbUrl) throw new NotConfiguredError("The database");
  cache.__tutorlinkSql ??= postgres(env.dbUrl, {
    max: env.dbPoolMax,
    ssl: sslFor(env.dbUrl),
    prepare: false,
    idle_timeout: IDLE_SECONDS,
    ...(ON_VERCEL ? { max_lifetime: 120 } : {}),
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: "tutorlink-web" },
  });
  if (ON_VERCEL) stayAwakeUntilClosed(cache.__tutorlinkSql);
  return cache.__tutorlinkSql;
}

/**
 * Keeps the current request's server copy awake until every database connection it opened has been
 * closed by the idle timeout, so a sleeping copy never holds a pooler slot.
 */
function stayAwakeUntilClosed(sql: Sql) {
  cache.__tutorlinkLastUse = Date.now();
  if (!cache.__tutorlinkDrain) {
    const deadline = getDeadline()?.getTime();
    const stopAt = Math.min(Date.now() + MAX_HOLD_MS, deadline ? deadline - 1_000 : Infinity);
    cache.__tutorlinkDrain = (async () => {
      for (;;) {
        await new Promise((r) => setTimeout(r, 250));
        const s = (sql as unknown as { stats?: { connections: number; opening: number; waiting: number } }).stats;
        const quiet = Date.now() - (cache.__tutorlinkLastUse ?? 0) > 1_000;
        if (!s || (quiet && s.connections === 0 && s.opening === 0 && s.waiting === 0) || Date.now() >= stopAt) return;
      }
    })().finally(() => {
      cache.__tutorlinkDrain = undefined;
    });
  }
  try {
    waitUntil(cache.__tutorlinkDrain);
  } catch {
    // Outside a request (nothing to keep awake).
  }
}

const RETRYABLE = new Set(["40001", "40P01"]); // serialization failure, deadlock

/**
 * Runs `fn` in a SERIALIZABLE transaction and retries it when Postgres reports a conflict with a
 * concurrent transaction, so two requests can never act on a stale view of the same rows
 * (e.g. both booking the last open slot).
 */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return (await db().begin("isolation level serializable", fn)) as T;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code && RETRYABLE.has(code) && i < attempts) {
        await new Promise((r) => setTimeout(r, 15 * i + Math.random() * 40));
        continue;
      }
      throw e;
    }
  }
}
