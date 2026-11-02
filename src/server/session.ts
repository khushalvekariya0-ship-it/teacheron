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

/** The request's sign-in, including whether it still owes a two-step code. */
export async function authState(): Promise<{ session: Session | null; mfaPending: boolean }> {
  if (!env.supabaseUrl || !env.supabaseAnonKey || !env.dbUrl) return { session: null, mfaPending: false };
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { session: null, mfaPending: false };
  if (hasVerifiedFactor(data.user)) {
    const { data: s } = await supabase.auth.getSession();
    if (tokenAal(s.session?.access_token) !== "aal2") return { session: null, mfaPending: true };
  }
  const user = await accountById(data.user.id);
  return { session: user ? { authUser: data.user, user } : null, mfaPending: false };
}

/** The signed-in account, or null when signed out, still owing a two-step code, or not configured. */
export async function currentSession(): Promise<Session | null> {
  return (await authState()).session;
}
