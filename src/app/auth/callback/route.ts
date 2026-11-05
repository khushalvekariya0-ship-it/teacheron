import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auditDirect, ensureAccount, notifyDirect, recordLogin, safePath, siteOrigin } from "@/server/auth";
import { hasVerifiedFactor } from "@/server/session";
import { checkSocialSignIn, providerLabel } from "@/server/social";
import { supabaseForRequest } from "@/server/supabase";

/*
 * GET /auth/callback?code=…&next=/…
 * Where Supabase sends people back after confirming their email, following a password-reset link,
 * or signing in with Google / Apple / Facebook. The one-time code is exchanged for a session cookie
 * (PKCE: only the browser that started the sign-in holds the matching verifier). Then:
 *   - a social sign-in Supabase attached to an existing account waits for an email code (/login);
 *   - a brand-new social account chooses Student, Parent or Tutor (/welcome);
 *   - an account with two-step login enters its app's code (/login);
 *   - everyone else continues to where they were going.
 * "Connect Google" from Settings comes back here too (cookie `link:<provider>:<account>`): that sign-in
 * method is trusted straight away, because the signed-in owner started it.
 * Provider tokens are never logged or passed on.
 */
export const dynamic = "force-dynamic";

const SETTINGS_SECURITY = "/dashboard/settings?tab=security";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const next = safePath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const store = await cookies();
  const marker = store.get("tl_oauth")?.value ?? null;
  if (marker) store.delete("tl_oauth");
  const linking = marker?.startsWith("link:") ? { provider: marker.split(":")[1] ?? "", userId: marker.split(":")[2] ?? "" } : null;
  const provider = linking ? linking.provider : marker;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));
  const failed = (reason: string) =>
    linking ? go(`${SETTINGS_SECURITY}&linkError=${reason}`) : go(`/login?error=${reason}${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`);

  const error = url.searchParams.get("error");
  if (error) {
    const desc = (url.searchParams.get("error_description") ?? "").toLowerCase();
    const errorCode = url.searchParams.get("error_code") ?? "";
    console.info("[auth/callback] sign-in came back with", error, errorCode, provider ? `(${provider}${linking ? ", connecting" : ""})` : "");
    if (error === "access_denied" && provider) return failed("cancelled");
    if (linking) return failed(errorCode === "identity_already_exists" || /already linked|already exists/.test(desc) ? "taken" : "failed");
    if (/email/.test(desc) && /(get user email|no email|missing|not provided|provide an email)/.test(desc)) return failed("no_email");
    if (/saving new user|already (been )?registered|already exists/.test(desc)) return failed("account_exists");
    return failed(provider ? "provider" : "link");
  }
  if (!code) return failed(provider ? (linking ? "failed" : "provider") : "link");
  try {
    const supabase = await supabaseForRequest();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError || !data.user) {
      console.info("[auth/callback] code exchange refused:", exchangeError?.code ?? exchangeError?.message ?? "no user");
      return failed(linking ? "failed" : next === "/reset-password" ? "reset" : provider ? "expired" : "link");
    }
    const user = await ensureAccount(data.user);
    if (!user || user.status === "suspended") {
      await supabase.auth.signOut();
      return go("/login?error=suspended");
    }
    const connectedBy = linking && linking.userId === data.user.id ? linking.userId : null;
    // A social sign-in attached to an existing account: the owner confirms it with an emailed code first.
    if ((await checkSocialSignIn(data.user, provider, connectedBy)) === "pending") return go(`/login?link=1${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`);
    if (connectedBy && provider) {
      const label = providerLabel(provider);
      await auditDirect(user.id, "security.sign_in_linked", "user", user.id, { provider, from: "settings" });
      await notifyDirect(user.id, { title: `${label} sign-in connected`, body: `You can now sign in with ${label} too. If this wasn't you, change your password and contact us.`, href: SETTINGS_SECURITY }, origin);
    }
    await recordLogin(user.id, true, request);
    // Two-step login: the app's code comes next (the sign-in page asks for it, then continues to `next`).
    if (hasVerifiedFactor(data.user)) return go(`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`);
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
    return failed(provider ? (linking ? "failed" : "provider") : "link");
  }
}
