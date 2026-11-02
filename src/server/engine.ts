import "server-only";
import { createActions, type ActionName, type DomainActions, type DomainState } from "@/lib/domain/actions";
import { fail, type Data, type Result } from "@/lib/domain/data";
import type { AppNotification } from "@/lib/types";
import { buildCatalog, setLiveCatalog } from "@/lib/data/catalog";
import { transaction, type Tx } from "./db";
import { env } from "./env";
import { Loader } from "./load";
import { PLANS } from "./plan";
import { SPECS, WRITE_ORDER, keyOf, type Row, type TableSpec } from "./tables";

/*
 * Runs one domain action as a unit of work:
 *   1. load the rows the action needs (./plan.ts) inside a SERIALIZABLE transaction,
 *   2. run the action (src/lib/domain/actions.ts) against them as the signed-in account,
 *   3. compare every collection before and after, and write only the rows that changed.
 * A conflicting concurrent request makes Postgres abort one of the two transactions; it is retried
 * from step 1 against fresh rows (src/server/db.ts).
 */

export interface Actor {
  /** The signed-in account (public.users.id); null for the scheduler and public links. */
  userId: string | null;
}

type Snapshot = Map<TableSpec, Map<string, string>>;

function snapshot(data: Data): { rows: Map<TableSpec, Map<string, Row>>; json: Snapshot } {
  const rows = new Map<TableSpec, Map<string, Row>>();
  const json: Snapshot = new Map();
  for (const spec of SPECS) {
    const byKey = new Map<string, Row>();
    const j = new Map<string, string>();
    for (const row of spec.rowsOf(data)) {
      const k = keyOf(spec, row);
      byKey.set(k, row);
      j.set(k, JSON.stringify(row));
    }
    rows.set(spec, byKey);
    json.set(spec, j);
  }
  return { rows, json };
}

const tableRank = (t: string) => {
  const i = WRITE_ORDER.indexOf(t);
  return i < 0 ? WRITE_ORDER.length : i;
};

async function persist(tx: Tx, before: Snapshot, data: Data) {
  const after = snapshot(data);
  const specs = [...SPECS].sort((a, b) => tableRank(a.table) - tableRank(b.table));
  // Deletes children-first, then inserts/updates parents-first, so foreign keys always hold.
  for (const spec of [...specs].reverse()) {
    const gone = [...before.get(spec)!.keys()].filter((k) => !after.rows.get(spec)!.has(k));
    if (!gone.length) continue;
    const keys = gone.map((k) => k.split("\u0000"));
    const cond = spec.key.map((col, i) => `${col} = any($${i + 1})`).join(" and ");
    // Composite keys are matched pairwise via unnest to avoid deleting cross-combinations.
    if (spec.key.length === 1) await tx.unsafe(`delete from public.${spec.table} where ${cond}`, [keys.map((k) => k[0])]);
    else {
      const cols = spec.key.map((c, i) => `$${i + 1}::text[]`).join(", ");
      await tx.unsafe(
        `delete from public.${spec.table} t using unnest(${cols}) as d(${spec.key.join(", ")}) where ${spec.key.map((c) => `t.${c} = d.${c}`).join(" and ")}`,
        spec.key.map((_, i) => keys.map((k) => k[i])) as never[],
      );
    }
  }
  for (const spec of specs) {
    const prev = before.get(spec)!;
    const changed = [...after.rows.get(spec)!.entries()].filter(([k]) => prev.get(k) !== after.json.get(spec)!.get(k)).map(([, row]) => row);
    if (!changed.length) continue;
    const cols = Object.keys(changed[0]);
    const updatable = cols.filter((c) => !spec.key.includes(c) && !spec.insertOnly?.includes(c));
    for (let start = 0; start < changed.length; start += 200) {
      const batch = changed.slice(start, start + 200);
      const values = batch.map((_, i) => `(${cols.map((__, j) => `$${i * cols.length + j + 1}`).join(", ")})`).join(", ");
      const params = batch.flatMap((r) => cols.map((c) => r[c] ?? null));
      const onConflict = updatable.length ? `do update set ${updatable.map((c) => `${c} = excluded.${c}`).join(", ")}` : "do nothing";
      await tx.unsafe(`insert into public.${spec.table} (${cols.join(", ")}) values ${values} on conflict (${spec.key.join(", ")}) ${onConflict}`, params as never[]);
    }
  }
}

/** Database errors that mean "someone else got there first" or a broken rule, with a message people can act on. */
function friendly(e: unknown): string | null {
  const err = e as { code?: string; constraint_name?: string; constraint?: string };
  const constraint = err.constraint_name ?? err.constraint ?? "";
  if (err.code === "23P01") return "That time was just booked. Please choose another slot.";
  if (err.code === "23505") {
    if (constraint.includes("one_trial")) return "You've already had a trial with this tutor. Book a regular lesson instead.";
    if (constraint.includes("one_open_per_booking")) return "There's already an open dispute for this lesson.";
    if (constraint.includes("one_active_per_tutor")) return "You've already applied to this job.";
    if (constraint.includes("idempotency")) return "This booking was already made.";
    if (constraint.includes("name_key")) return "Something with that name already exists.";
    return "That was just changed by someone else. Please refresh and try again.";
  }
  if (err.code === "23503") return "Something this change depends on no longer exists. Please refresh and try again.";
  if (err.code === "23514") return "Some of the values aren't allowed. Check the form and try again.";
  return null;
}

/**
 * `onNotified` receives the notifications the action created, once they're saved (for email copies).
 */
export async function runAction(name: ActionName, args: unknown[], actor: Actor, onNotified?: (list: AppNotification[]) => void): Promise<Result<unknown>> {
  const plan = PLANS[name];
  if (!plan) return fail("Unknown action.");
  try {
    const { result, created } = await transaction(async (tx) => {
      const L = new Loader(tx);
      await L.globals();
      if (actor.userId) await L.users([actor.userId]);
      const me = actor.userId ? (L.data.users.find((u) => u.id === actor.userId) ?? null) : null;
      if (actor.userId && !me) return { result: fail("Your account isn't set up yet. Please sign out and sign in again."), created: [] };
      await plan(L, me, args);
      const data = L.data;
      data.sessionUserId = me?.id ?? null;
      setLiveCatalog(buildCatalog(data.catalog.categories, data.catalog.subjects));

      const before = snapshot(data).json;
      const known = new Set(data.notifications.map((n) => n.id));
      const state = data as DomainState;
      const set = (partial: Partial<Data> | ((s: DomainState) => Partial<Data>)) => {
        Object.assign(state, typeof partial === "function" ? partial(state) : partial);
      };
      const actions = createActions(() => state, set, { paymentsEnabled: env.paymentsEnabled });
      Object.assign(state, actions);
      const run = actions[name] as (...a: unknown[]) => Result<unknown>;
      const result = run(...args);
      await persist(tx, before, data);
      return { result, created: result.ok ? data.notifications.filter((n) => !known.has(n.id)) : [] };
    });
    if (created.length) onNotified?.(created);
    return result;
  } catch (e) {
    const message = friendly(e);
    if (message) return fail(message);
    throw e;
  }
}

export type { ActionName, DomainActions };
