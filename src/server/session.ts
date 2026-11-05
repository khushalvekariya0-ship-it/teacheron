import "server-only";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { User } from "@/lib/types";
import { db } from "./db";
import { env } from "./env";
import { supabaseForRequest } from "./supabase";
import { fromRowWith } from "./tables";
import { SPECS } from "./tables";

/*
 * Who is making this request. The Supabase session cookie is verified with Supabase Auth on every
 * call (getUser asks the auth server, so a revoked or expired session is rejected), then mapped to
 * the account row in public.users.
 *
 * Two-step login: an account with a verified authenticator app counts as signed in only once the
 * session has been upgraded with a code (assurance level aal2). Until then it gets no data and can
 * run no actions — only the code check in /api/auth/mfa-verify.
 */

export interface Session {
  authUser: AuthUser;
  user: User;
}

const USER_COLS = SPECS.find((s) => s.table === "users")!.cols;

export async function accountById(id: string): Promise<User | null> {
  const [row] = await db()`select * from public.users where id = ${id}`;
  return row ? fromRowWith<User>(USER_COLS, row) : null;
}

/** Reads the assurance level from an access token that Supabase Auth has just accepted. */
function tokenAal(token: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8")) as { aal?: string };
    return payload.aal ?? null;
  } catch {
    return null;
  }
}

export const hasVerifiedFactor = (u: AuthUser) => (u.factors ?? []).some((f) => f.status === "verified");

/** A Google / Facebook / Apple sign-in attached to this account, waiting for the email code. */
export interface LinkPending {
  provider: string;
  email: string;
}

export interface AuthState {
  session: Session | null;
  mfaPending: boolean;
  linkPending: LinkPending | null;
}

/**
 * The request's sign-in, including whether it still owes a two-step code or the code that confirms a
 * newly attached social sign-in. Either way the account counts as signed out until then.
 */
export async function authState(): Promise<AuthState> {
  const out: AuthState = { session: null, mfaPending: false, linkPending: null };
  if (!env.supabaseUrl || !env.supabaseAnonKey || !env.dbUrl) return out;
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return out;
  const [lock] = await db()`select pending_link, email from public.users where id = ${data.user.id}`;
  const pending = lock?.pending_link as { provider?: string } | null;
  if (pending) return { ...out, linkPending: { provider: String(pending.provider ?? ""), email: String(lock.email ?? "").replace(/^(.{1,2})[^@]*@/, "$1***@") } };
  if (hasVerifiedFactor(data.user)) {
    const { data: s } = await supabase.auth.getSession();
    if (tokenAal(s.session?.access_token) !== "aal2") return { ...out, mfaPending: true };
  }
  const user = await accountById(data.user.id);
  return { ...out, session: user ? { authUser: data.user, user } : null };
}

/**
 * The signed-in account, or null when signed out, still owing a code, not configured — or a first-time
 * social account that hasn't chosen its role yet (it can only finish signing up).
 */
export async function currentSession(): Promise<Session | null> {
  const { session } = await authState();
  return session && !session.user.needsRole ? session : null;
}
