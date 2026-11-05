import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, NotConfiguredError } from "./env";

/**
 * Supabase client bound to this request's auth cookies (route handlers only). It signs people in and
 * out, and refreshed tokens are written back to the response cookies.
 */
export async function supabaseForRequest(): Promise<SupabaseClient> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) throw new NotConfiguredError("Sign-in");
  const store = await cookies();
  // The session (and the PKCE verifier of a sign-in in progress) is only ever read by the server, so the
  // cookies are HTTP-only (no script can read them), SameSite=Lax, and HTTPS-only on an https site.
  const secure = env.siteUrl.startsWith("https://");
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure });
      },
    },
  });
}

/**
 * Service-role client for server-only work that bypasses Supabase's policies: deleting a sign-in
 * when an account is removed, and issuing signed upload/download links for storage. Never imported
 * by client code (this module is `server-only`).
 */
export function supabaseAdmin(): SupabaseClient {
  if (!env.supabaseUrl || !env.serviceRoleKey) throw new NotConfiguredError("File storage");
  return createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
