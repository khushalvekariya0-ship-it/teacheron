import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { ensureAccount, recordLogin, safePath, siteOrigin } from "@/server/auth";
import { supabaseForRequest } from "@/server/supabase";

/*
 * GET /auth/confirm?token_hash=…&type=signup|recovery|email_change|magiclink&next=/…
 * For email templates that link straight here with {{ .TokenHash }} (recommended in
 * docs/SUPABASE_SETUP.md): the link then works even when opened on another device.
 */
export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["signup", "recovery", "email_change", "magiclink", "invite", "email"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const tokenHash = url.searchParams.get("token_hash");
  const asked = url.searchParams.get("next");
  if (!tokenHash || !type || !TYPES.includes(type)) return NextResponse.redirect(new URL("/login?error=link", origin));
  try {
    const supabase = await supabaseForRequest();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error || !data.user) return NextResponse.redirect(new URL(`/login?error=${type === "recovery" ? "reset" : "link"}`, origin));
    const user = await ensureAccount(data.user);
    if (!user || user.status === "suspended") {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=suspended", origin));
    }
    await recordLogin(user.id, true, request);
    // Without an explicit `next`, a fresh sign-up continues to its setup step.
    const fallback = type === "recovery" ? "/reset-password" : user.role === "tutor" && !user.tutorId ? "/onboarding/tutor" : user.role === "student" ? "/onboarding/student" : "/dashboard";
    return NextResponse.redirect(new URL(asked ? safePath(asked, fallback) : fallback, origin));
  } catch (e) {
    console.error("[auth/confirm]", e);
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }
}
