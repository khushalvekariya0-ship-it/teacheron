import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureAccount, recordLogin, safePath, siteOrigin } from "@/server/auth";
import { checkSocialSignIn } from "@/server/social";
import { supabaseForRequest } from "@/server/supabase";

/*
 * GET /auth/callback?code=…&next=/…
 * Where Supabase sends people back after confirming their email, following a password-reset link,
 * or signing in with Google / Apple / Facebook. The one-time code is exchanged for a session cookie
 * (PKCE: only the browser that started the sign-in holds the matching verifier). Then:
 *   - a social sign-in Supabase attached to an existing account waits for an email code (/login);
 *   - a brand-new social account chooses Student, Parent or Tutor (/welcome);
 *   - everyone else continues to where they were going.
 * Provider tokens are never logged or passed on.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const next = safePath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const store = await cookies();
  const provider = store.get("tl_oauth")?.value ?? null;
  if (provider) store.delete("tl_oauth");
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));
  const failed = (reason: string) => go(`/login?error=${reason}${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`);

  const error = url.searchParams.get("error");
  if (error) {
    const desc = (url.searchParams.get("error_description") ?? "").toLowerCase();
    console.info("[auth/callback] sign-in came back with", error, provider ? `(${provider})` : "");
    if (error === "access_denied" && provider) return failed("cancelled");
    if (/email/.test(desc) && /(get user email|no email|missing|not provided|provide an email)/.test(desc)) return failed("no_email");
    if (/saving new user|already (been )?registered|already exists/.test(desc)) return failed("account_exists");
    return failed(provider ? "provider" : "link");
  }
  if (!code) return failed(provider ? "provider" : "link");
  try {
    const supabase = await supabaseForRequest();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError || !data.user) {
      console.info("[auth/callback] code exchange refused:", exchangeError?.code ?? exchangeError?.message ?? "no user");
      return failed(next === "/reset-password" ? "reset" : provider ? "expired" : "link");
    }
    const user = await ensureAccount(data.user);
    if (!user || user.status === "suspended") {
      await supabase.auth.signOut();
      return failed("suspended");
    }
    // A social sign-in attached to an existing account: the owner confirms it with an emailed code first.
    if ((await checkSocialSignIn(data.user, provider)) === "pending") return go(`/login?link=1${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`);
    await recordLogin(user.id, true, request);
    if (user.needsRole) {
      const hint = url.searchParams.get("role");
      const q = new URLSearchParams();
      if (hint && ["student", "parent", "tutor"].includes(hint)) q.set("role", hint);
      if (next !== "/dashboard") q.set("next", next);
      return go(`/welcome${q.size ? `?${q}` : ""}`);
    }
    const staff = user.role === "admin" || user.role === "support";
    return go(staff && next.startsWith("/dashboard") ? "/admin" : next);
  } catch (e) {
    console.error("[auth/callback]", (e as Error)?.message ?? e);
    return failed(provider ? "provider" : "link");
  }
}
