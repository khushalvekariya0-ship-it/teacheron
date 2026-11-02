import { NextResponse } from "next/server";
import { ensureAccount, recordLogin, safePath, siteOrigin } from "@/server/auth";
import { supabaseForRequest } from "@/server/supabase";

/*
 * GET /auth/callback?code=…&next=/…
 * Where Supabase sends people back after confirming their email, following a password-reset link,
 * or signing in with Google / Apple / Facebook. The one-time code is exchanged for a session cookie.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const next = safePath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const failed = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}${next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : ""}`, origin));
  if (url.searchParams.get("error")) return failed("link");
  if (!code) return failed("link");
  try {
    const supabase = await supabaseForRequest();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return failed(next === "/reset-password" ? "reset" : "link");
    const user = await ensureAccount(data.user);
    if (!user || user.status === "suspended") {
      await supabase.auth.signOut();
      return failed("suspended");
    }
    await recordLogin(user.id, true, request);
    return NextResponse.redirect(new URL(next, origin));
  } catch (e) {
    console.error("[auth/callback]", e);
    return failed("link");
  }
}
