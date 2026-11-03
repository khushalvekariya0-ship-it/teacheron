import "server-only";
import postgres from "postgres";
import { env, NotConfiguredError } from "./env";

/*
 * One connection pool per server instance, through Supabase's connection pooler (SUPABASE_DB_URL).
 * `prepare: false` keeps it compatible with the pooler's transaction mode.
 */

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

const cache = globalThis as unknown as { __tutorlinkSql?: Sql };

/** Supabase is reached over the internet, so the connection is always encrypted; a database on this computer isn't. */
const sslFor = (url: string) => (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname) ? false : ("require" as const));

export function db(): Sql {
  if (!env.dbUrl) throw new NotConfiguredError("The database");
  cache.__tutorlinkSql ??= postgres(env.dbUrl, {
    max: env.dbPoolMax,
    ssl: sslFor(env.dbUrl),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: "tutorlink-web" },
  });
  return cache.__tutorlinkSql;
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
