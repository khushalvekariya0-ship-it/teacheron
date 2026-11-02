import "server-only";
import type { User } from "@/lib/types";
import { emptyData, type Collection, type Data } from "@/lib/domain/data";
import { DEFAULT_FLAGS, DEFAULT_POLICY } from "@/lib/data/platform";
import { SITE } from "@/lib/site";
import type { Tx } from "./db";
import { SPECS, keyOf, type Row, type TableSpec } from "./tables";

/*
 * Loads the rows a request needs into a `Data` object. Collections that hold lists are merged by
 * primary key, so loading the same row through two routes (a booking seen as the booker's and as
 * the tutor's) keeps one copy.
 */

type Id = string | null | undefined;
const ids = (list: Id[]) => [...new Set(list.filter((x): x is string => !!x))];

const SPEC_BY_TABLE = new Map(SPECS.map((s) => [s.table, s]));
const spec = (table: string) => SPEC_BY_TABLE.get(table)!;

export class Loader {
  readonly data: Data;
  private worldUsers = new Set<string>();
  private worldTutors = new Set<string>();

  constructor(private readonly tx: Tx) {
    this.data = emptyData({ flags: [], policy: DEFAULT_POLICY, platformFeeBps: SITE.platformFeeBps, catalog: { categories: [], subjects: [] } });
  }

  /** Raw rows of one table. `where` uses $1, $2 … for `params`; table and column names are constants. */
  async select(table: string, where: string, params: unknown[] = [], limit?: number): Promise<Row[]> {
    const s = spec(table);
    const text = `select * from public.${table} where ${where} order by ${s.order}${limit ? ` limit ${Math.floor(limit)}` : ""}`;
    return (await this.tx.unsafe(text, params as never[])) as unknown as Row[];
  }

  /** A query whose rows aren't a domain collection (e.g. sign-in history). */
  async raw(text: string, params: unknown[] = []): Promise<Row[]> {
    return (await this.tx.unsafe(text, params as never[])) as unknown as Row[];
  }

  /** Adds rows to their collection (merging by key). */
  add(table: string, rows: Row[]) {
    const s = spec(table);
    const d = this.data as unknown as Record<Collection, unknown>;
    if (s.assemble) {
      d[s.collection] = { ...(d[s.collection] as object), ...(s.assemble(rows) as object) };
      return;
    }
    if (s.collection === "catalog") {
      const part = table === "subjects" ? "subjects" : "categories";
      this.data.catalog = { ...this.data.catalog, [part]: mergeByKey(this.data.catalog[part] as never[], rows.map(s.fromRow!) as never[], s, part) };
      return;
    }
    d[s.collection] = mergeByKey(d[s.collection] as never[], rows.map(s.fromRow!) as never[], s, s.collection);
  }

  async load(table: string, where: string, params: unknown[] = [], limit?: number): Promise<Row[]> {
    const rows = await this.select(table, where, params, limit);
    this.add(table, rows);
    return rows;
  }

  /** Feature flags, booking policy, platform fee and the subject catalog — needed by almost every action. */
  async globals() {
    const [flags, settings] = await Promise.all([
      this.select("feature_flags", "true"),
      this.select("platform_settings", "key = any($1)", [["booking_policy", "platform_fee_bps"]]),
      this.load("subject_categories", "true"),
      this.load("subjects", "true"),
    ]);
    const fromDb = flags.map((r) => spec("feature_flags").fromRow!(r)) as Data["flags"];
    // Flags added in code after the database was seeded show up with their defaults.
    this.data.flags = [...fromDb, ...DEFAULT_FLAGS.filter((f) => !fromDb.some((x) => x.key === f.key))];
    const setting = (key: string) => settings.find((r) => r.key === key)?.value;
    this.data.policy = { ...DEFAULT_POLICY, ...((setting("booking_policy") as object) ?? {}) };
    const fee = setting("platform_fee_bps");
    this.data.platformFeeBps = typeof fee === "number" ? fee : SITE.platformFeeBps;
  }

  async users(userIds: Id[]) {
    const list = ids(userIds);
    if (list.length) await this.load("users", "id = any($1)", [list]);
  }
  async usersByTutor(tutorIds: Id[]) {
    const list = ids(tutorIds);
    if (list.length) await this.load("users", "tutor_id = any($1)", [list]);
  }
  async tutors(tutorIds: Id[]) {
    const list = ids(tutorIds);
    if (list.length) await this.load("tutors", "id = any($1)", [list]);
  }
  async byId(table: string, list: Id[], column = "id"): Promise<Row[]> {
    const l = ids(list);
    return l.length ? this.load(table, `${column} = any($1)`, [l]) : [];
  }

  /**
   * Everything that belongs to these accounts and tutor profiles: their bookings (both sides),
   * conversations, requirements and applications, learning records, money ledgers, drafts and
   * preferences. Messages, notifications and the audit log are loaded separately when needed.
   */
  async world(userIdsIn: Id[], tutorIdsIn: Id[] = []) {
    const userIds = ids(userIdsIn).filter((x) => !this.worldUsers.has(x));
    const tutorIds = ids(tutorIdsIn).filter((x) => !this.worldTutors.has(x));
    if (!userIds.length && !tutorIds.length) return;
    // Accounts first: a tutor's account brings in its profile and vice versa.
    const people = await this.load("users", "id = any($1) or tutor_id = any($2)", [userIds, tutorIds]);
    const u = ids([...userIds, ...people.map((p) => p.id as string)]);
    const t = ids([...tutorIds, ...people.map((p) => p.tutor_id as string | null)]);
    u.forEach((x) => this.worldUsers.add(x));
    t.forEach((x) => this.worldTutors.add(x));

    const [children, requirements, bookings] = await Promise.all([
      this.load("children", "parent_id = any($1)", [u]),
      this.load("requirements", "owner_id = any($1)", [u]),
      this.load("bookings", "booker_id = any($1) or tutor_id = any($2)", [u, t]),
      this.load("tutors", "id = any($1)", [t]),
      this.load("student_profiles", "user_id = any($1)", [u]),
      this.load("notification_prefs", "user_id = any($1)", [u]),
      this.load("onboarding_drafts", "user_id = any($1)", [u]),
      this.load("favorites", "user_id = any($1)", [u]),
      this.load("saved_jobs", "user_id = any($1)", [u]),
      this.load("saved_searches", "user_id = any($1)", [u]),
      this.load("subscriptions", "tutor_id = any($1)", [t]),
      this.load("lead_transactions", "tutor_id = any($1)", [t]),
      this.load("verification_requests", "tutor_id = any($1)", [t]),
      this.load("payouts", "tutor_id = any($1)", [t]),
      this.load("conversations", "user_id = any($1) or tutor_id = any($2)", [u, t]),
      this.load("wallet_transactions", "user_id = any($1)", [u]),
      this.load("reports", "reporter_id = any($1)", [u]),
    ]);
    const learners = ids([...u, ...children.map((c) => c.id as string)]);
    const reqIds = requirements.map((r) => r.id as string);
    const bookingIds = bookings.map((b) => b.id as string);
    await Promise.all([
      this.load("applications", "tutor_id = any($1) or requirement_id = any($2)", [t, reqIds]),
      this.load("reviews", "tutor_id = any($1) or booking_id = any($2)", [t, bookingIds]),
      this.load("disputes", "booking_id = any($1) or opened_by = any($2)", [bookingIds, u]),
      this.load("payments", "user_id = any($1) or booking_id = any($2)", [u, bookingIds]),
      this.load("learning_goals", "tutor_id = any($1) or learner_id = any($2)", [t, learners]),
      this.load("progress_notes", "tutor_id = any($1) or learner_id = any($2)", [t, learners]),
      this.load("homework", "tutor_id = any($1) or learner_id = any($2)", [t, learners]),
    ]);
  }

  /** The signed-in account's own world. */
  async self(me: User | null) {
    if (me) await this.world([me.id], [me.tutorId]);
  }

  /** A booking plus the worlds of both people in it. */
  async bookingParticipants(bookingId: Id, me: User | null) {
    const [b] = await this.byId("bookings", [bookingId]);
    await this.world([me?.id, b?.booker_id as string], [me?.tutorId, b?.tutor_id as string]);
  }
}

function mergeByKey<T>(current: T[], incoming: T[], s: TableSpec, label: string): T[] {
  if (!incoming.length) return current;
  const keyFields = s.key.map((k) => Object.entries(s.cols).find(([, [col]]) => col === k)?.[0] ?? k);
  const k = (x: T) => keyFields.map((f) => String((x as Record<string, unknown>)[f])).join("\u0000");
  const seen = new Set(current.map(k));
  const out = [...current];
  for (const x of incoming) {
    const key = k(x);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(x);
    }
  }
  void label;
  return out;
}

export { keyOf };
