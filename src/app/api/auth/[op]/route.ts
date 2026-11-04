import { NextResponse, after } from "next/server";
import { z } from "zod";
import type { Provider } from "@supabase/supabase-js";
import { auditDirect, enabledProviders, ensureAccount, notifyDirect, recordFailedLogin, recordLogin, safePath, setMfaFlag, siteOrigin } from "@/server/auth";
import { hasPermission } from "@/lib/permissions";
import { sendConsentRequest } from "@/server/consent";
import { backendStatus } from "@/server/env";
import { clientIp, json, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/server/http";
import { accountById, currentSession, hasVerifiedFactor } from "@/server/session";
import { buildState } from "@/server/snapshot";
import { contactIn, NAME_RULE } from "@/lib/domain/contact";
import { isPostalCode, POSTAL_CODE, postalError } from "@/lib/postal";
import { isCountryCode } from "@/lib/location";
import { db } from "@/server/db";
import { emailReady } from "@/server/email";
import { cleanCode, isCodeShape } from "@/server/email-codes";
import { sendVerificationCode, verifyEmailCode } from "@/server/email-verification";
import { checkResetToken, exchangeResetCode, finishPasswordReset, RESET_MINUTES, resetOrigin, sendPasswordChangedEmail, startPasswordReset } from "@/server/password-reset";
import { supabaseAdmin, supabaseForRequest } from "@/server/supabase";

/*
 * Sign-in and account security, backed by Supabase Auth. Passwords never touch our database —
 * Supabase stores and checks them; the session lives in Supabase's HTTP cookies.
 *
 *   POST /api/auth/sign-in    { email, password }
 *   POST /api/auth/sign-up    { role, firstName, lastName, email, password, zip?, ageBand?, parentEmail?, next? }
 *                             → creates the account unconfirmed and emails a 6-digit code (verifyBy "code"); without the site's
 *                               own email, Supabase emails a confirmation link instead (verifyBy "link")
 *   POST /api/auth/verify-email { email, code }        → checks the code, then confirms the email (no sign-in; same answer for every failure)
 *   POST /api/auth/sign-out
 *   POST /api/auth/forgot     { email }                 → emails a 15-minute, single-use reset code + link (same answer for unknown emails)
 *   POST /api/auth/reset-code { email, code }           → swaps the emailed 6-digit code for a link token (same answer for every failure)
 *   POST /api/auth/reset-check { token }                → whether a reset link still works
 *   POST /api/auth/reset      { token, password }       → sets the new password from a reset link
 *   POST /api/auth/password   { current, next }         → change password while signed in
 *   POST /api/auth/resend     { email }                 → a new sign-up code (or confirmation link) for an unconfirmed account
 *   POST /api/auth/consent    → re-send the parental-consent email (13–17 students)
 *   POST /api/auth/mfa-enroll → start two-step login (staff): QR code + secret for an authenticator app
 *   POST /api/auth/mfa-verify { code, factorId? } → finish setup, or enter the code after the password
 *   POST /api/auth/mfa-disable { code } → turn two-step login off
 *   POST /api/auth/mfa-reset  { userId } → an administrator clears another staff member's two-step login
 *   GET  /api/auth/providers  → the social sign-ins switched on in Supabase
 *   GET  /api/auth/oauth?provider=google&next=/dashboard → redirect to the provider
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ op: string }> };

const email = z.string().trim().toLowerCase().email().max(200);
const password = z.string().min(10, "Use at least 10 characters for your password.").max(200);
/** A reset link's token: 32 random bytes, base64url. */
const resetToken = z.string().min(20).max(200).regex(/^[A-Za-z0-9_-]+$/);
const zone = z.string().max(60).optional();

const signUpSchema = z.object({
  role: z.enum(["student", "parent", "tutor"]),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email,
  password,
  country: z.string().refine((v) => isCountryCode(v), "Choose your country.").optional(),
  zip: z.union([z.string().trim().regex(POSTAL_CODE), z.literal("")]).optional(),
  ageBand: z.enum(["18+", "13-17", "under13"]).optional(),
  parentEmail: z.union([email, z.literal("")]).optional(),
  timezone: zone,
  next: z.string().max(300).optional(),
});

const fail = (error: string, status = 400, extra?: Record<string, unknown>) => json({ ok: false, error, ...extra }, { status });

export async function POST(request: Request, ctx: Ctx) {
  const { op } = await ctx.params;
  if (!sameOrigin(request)) return fail("This request came from another site.", 403);
  const status = backendStatus();
  if (!status.auth || !status.database) return fail("Sign-in isn't connected yet. Add the Supabase settings (see docs/SUPABASE_SETUP.md).", 503, { notConfigured: true });
  const ip = clientIp(request);
  try {
    const supabase = await supabaseForRequest();
    const body = (await readJson<Record<string, unknown>>(request, 20_000)) ?? {};

    switch (op) {
      case "sign-in": {
        const parsed = z.object({ email, password: z.string().min(1).max(200) }).safeParse(body);
        if (!parsed.success) return fail("Enter your email and password.");
        const limit = rateLimit(`signin:${ip}:${parsed.data.email}`, 8, 10 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
        const confirmFirst = emailReady() ? "Please confirm your email address first: enter the 6-digit code we emailed you." : "Please confirm your email address first — use the link we sent you.";
        if (error || !data.user) {
          if (error?.code === "email_not_confirmed") return fail(confirmFirst, 400, { code: "email_not_confirmed" });
          await recordFailedLogin(parsed.data.email, request);
          // Same message for unknown email and wrong password, so accounts can't be discovered.
          return fail("Email or password is incorrect.", 401);
        }
        // The right password isn't enough until the email is confirmed (even if Supabase's own "Confirm email" setting is off).
        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          return fail(confirmFirst, 400, { code: "email_not_confirmed" });
        }
        const user = await ensureAccount(data.user);
        if (!user || user.status === "suspended") {
          await supabase.auth.signOut();
          return fail(user ? "This account is suspended. Contact support for help." : "We couldn't find your account. Contact support for help.", 403);
        }
        await recordLogin(user.id, true, request);
        const mfa = hasVerifiedFactor(data.user);
        await setMfaFlag(user.id, mfa);
        // With two-step login on, the password alone isn't enough: the session stays limited until the code is entered.
        if (mfa) return json({ ok: true, mfaRequired: true, user: { firstName: user.firstName, role: user.role } });
        return json({ ok: true, user: { firstName: user.firstName, role: user.role }, state: await buildState(user.id) });
      }

      case "mfa-verify": {
        const parsed = z.object({ code: z.string().trim().regex(/^\d{6}$/), factorId: z.string().max(100).optional() }).safeParse(body);
        if (!parsed.success) return fail("Enter the 6-digit code from your authenticator app.");
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return fail("Please sign in again.", 401);
        const limit = rateLimit(`mfa:${u.user.id}`, 8, 10 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const factors = (u.user.factors ?? []).filter((f) => f.factor_type === "totp");
        const factor = parsed.data.factorId ? factors.find((f) => f.id === parsed.data.factorId) : factors.find((f) => f.status === "verified");
        if (!factor) return fail("Two-step login isn't set up on this account.");
        const enrolling = factor.status !== "verified";
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
        if (error) return fail("That code isn't right. Check the time on your phone and try the newest code.");
        const user = await accountById(u.user.id);
        if (!user || user.status === "suspended") {
          await supabase.auth.signOut();
          return fail("This account is suspended. Contact support for help.", 403);
        }
        if (enrolling) {
          await setMfaFlag(user.id, true);
          await auditDirect(user.id, "security.mfa_on", "user", user.id);
          await notifyDirect(user.id, { title: "Two-step login is on", body: "You'll enter a code from your authenticator app each time you sign in.", href: "/admin/security" }, siteOrigin(request));
        }
        return json({ ok: true, user: { firstName: user.firstName, role: user.role }, state: await buildState(user.id) });
      }

      case "mfa-enroll": {
        const session = await currentSession();
        if (!session) return fail("Please sign in again.", 401);
        if (session.user.role !== "admin" && session.user.role !== "support") return fail("Two-step login is available for staff accounts.", 403);
        if (hasVerifiedFactor(session.authUser)) return fail("Two-step login is already on.");
        for (const f of session.authUser.factors ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `TutorLink ${Date.now().toString(36)}`, issuer: "TutorLink" });
        if (error || !data || data.type !== "totp") return fail("We couldn't start two-step login. Please try again.");
        return json({ ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      }

      case "mfa-disable": {
        const parsed = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).safeParse(body);
        if (!parsed.success) return fail("Enter the 6-digit code from your authenticator app.");
        const session = await currentSession();
        if (!session) return fail("Please sign in again.", 401);
        const limit = rateLimit(`mfa:${session.user.id}`, 8, 10 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const factor = (session.authUser.factors ?? []).find((f) => f.status === "verified" && f.factor_type === "totp");
        if (!factor) return fail("Two-step login is already off.");
        const check = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
        if (check.error) return fail("That code isn't right. Check the time on your phone and try the newest code.");
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) return fail("We couldn't turn it off. Please try again.");
        await setMfaFlag(session.user.id, false);
        await auditDirect(session.user.id, "security.mfa_off", "user", session.user.id);
        await notifyDirect(session.user.id, { title: "Two-step login was turned off", body: "If this wasn't you, change your password and contact an administrator.", href: "/admin/security" }, siteOrigin(request));
        return json({ ok: true, state: await buildState(session.user.id) });
      }

      case "mfa-reset": {
        const parsed = z.object({ userId: z.string().min(1).max(120) }).safeParse(body);
        if (!parsed.success) return fail("Choose an account.");
        const session = await currentSession();
        if (!session || session.user.role !== "admin" || !hasPermission(session.user, "users.write")) return fail("Only an administrator with users.write can reset two-step login.", 403);
        if (parsed.data.userId === session.user.id) return fail("Turn your own two-step login off from Security.");
        const target = await accountById(parsed.data.userId);
        if (!target) return fail("Account not found.", 404);
        const admin = supabaseAdmin();
        const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: target.id });
        if (error) return fail("We couldn't reach the sign-in service. Please try again.");
        for (const f of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: target.id });
        await setMfaFlag(target.id, false);
        await auditDirect(session.user.id, "user.mfa_reset", "user", target.id);
        await notifyDirect(target.id, { title: "Your two-step login was reset", body: "An administrator removed your authenticator app. Set it up again in Security.", href: "/admin/security" }, siteOrigin(request));
        return json({ ok: true, state: await buildState(session.user.id) });
      }

      case "sign-up": {
        const limit = rateLimit(`signup:${ip}`, 6, 60 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const parsed = signUpSchema.safeParse(body);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
        const input = parsed.data;
        if (contactIn(input.firstName, input.lastName).found) return fail(NAME_RULE);
        if (input.role === "student" && input.ageBand === "under13") return fail("Students under 13 can't create an account. A parent can sign up and add them as a child.");
        const teen = input.role === "student" && input.ageBand === "13-17";
        if (teen && !input.parentEmail) return fail("Students under 18 need a parent or guardian's email.");
        if (teen && input.parentEmail === input.email) return fail("Use your parent or guardian's own email address.");
        if (input.zip && !isPostalCode(input.zip, input.country ?? "US")) return fail(postalError(input.country ?? "US"));
        const origin = siteOrigin(request);
        const meta = {
          role: input.role, first_name: input.firstName, last_name: input.lastName, country: input.country ?? "US", zip: input.zip ?? "", timezone: input.timezone ?? "",
          age_band: input.role === "student" ? (input.ageBand ?? "18+") : undefined, parent_email: teen ? input.parentEmail : undefined,
        };
        if (emailReady()) {
          // The site confirms the email itself with a 6-digit code (Supabase sends nothing): the account is
          // created unconfirmed, and sign-in is refused until the code is entered (verify-email).
          const admin = supabaseAdmin();
          const created = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: false, user_metadata: meta });
          if (created.error || !created.data.user) {
            const err = created.error;
            if (err?.code === "email_exists" || /already (been )?registered|already exists/i.test(err?.message ?? "")) {
              // An earlier sign-up that was never confirmed gets a new code; a confirmed account is told to sign in.
              const [existing] = await db()`select id, email_verified from public.users where lower(email) = ${input.email} limit 1`;
              if (existing && !existing.email_verified) {
                after(() => sendVerificationCode(input.email).catch((e) => console.error("[verify] send", e)));
                return json({ ok: true, needsConfirmation: true, verifyBy: "code", email: input.email });
              }
              return fail("An account with this email already exists. Try signing in.", 409);
            }
            if (err?.code === "weak_password") return fail("Choose a stronger password — longer is better.");
            console.error("[auth] sign-up failed", err?.code, err?.message);
            return fail("We couldn't create your account. Please try again.");
          }
          let consent: { sent: boolean; error?: string } | undefined;
          if (teen) {
            const r = await sendConsentRequest(created.data.user.id, origin);
            consent = r.ok ? { sent: true } : { sent: false, error: r.error };
          }
          after(() => sendVerificationCode(input.email).catch((e) => console.error("[verify] send", e)));
          return json({ ok: true, needsConfirmation: true, verifyBy: "code", email: input.email, consent });
        }
        // Without the site's own email, Supabase sends its confirmation link (configure its SMTP).
        const next = safePath(input.next, input.role === "tutor" ? "/onboarding/tutor" : input.role === "student" ? "/onboarding/student" : "/dashboard");
        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
            data: meta,
          },
        });
        if (error) {
          if (error.code === "user_already_exists" || /already registered/i.test(error.message)) return fail("An account with this email already exists. Try signing in.", 409);
          if (error.code === "weak_password") return fail("Choose a stronger password — longer is better.");
          if (error.code === "over_email_send_rate_limit") return fail("We've sent too many emails just now. Please try again in a few minutes.", 429);
          console.error("[auth] sign-up failed", error.code, error.message);
          return fail("We couldn't create your account. Please try again.");
        }
        // Supabase answers an existing, confirmed email with a user that has no identities.
        if (data.user && (data.user.identities?.length ?? 0) === 0) return fail("An account with this email already exists. Try signing in.", 409);
        if (!data.user) return fail("We couldn't create your account. Please try again.");
        let consent: { sent: boolean; error?: string } | undefined;
        if (teen) {
          const r = await sendConsentRequest(data.user.id, origin);
          consent = r.ok ? { sent: true } : { sent: false, error: r.error };
        }
        if (data.session) {
          await recordLogin(data.user.id, true, request);
          return json({ ok: true, needsConfirmation: false, consent, state: await buildState(data.user.id) });
        }
        return json({ ok: true, needsConfirmation: true, verifyBy: "link", email: input.email, consent });
      }

      case "verify-email": {
        const parsed = z.object({ email, code: z.string().max(40).transform(cleanCode) }).safeParse(body);
        if (!parsed.success || !isCodeShape(parsed.data.code)) return fail("Enter the 6-digit code from the email.");
        const limit = rateLimit(`verify-email:${ip}`, 10, 15 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const result = await verifyEmailCode(parsed.data.email, parsed.data.code);
        return result.ok ? json({ ok: true }) : fail(result.error);
      }

      case "sign-out": {
        await supabase.auth.signOut({ scope: body.scope === "global" ? "global" : "local" });
        return json({ ok: true, state: await buildState(null) });
      }

      case "forgot": {
        const parsed = z.object({ email }).safeParse(body);
        if (!parsed.success) return fail("Enter a valid email address.");
        const limit = rateLimit(`forgot:${ip}`, 5, 15 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        // Links point only at the configured https:// site address (never this request's Host header).
        const origin = resetOrigin();
        if (!origin) console.error("[reset] NEXT_PUBLIC_SITE_URL must be the site's https:// address (http:// only for localhost); no reset email sent");
        if (!emailReady() || !origin) return fail("Password reset emails can't be sent right now. Please try again later or contact support.", 503);
        // A few links per address per hour (the database also caps it per account); extra requests get the same answer.
        const perEmail = rateLimit(`forgot:${parsed.data.email.toLowerCase()}`, 3, 60 * 60_000);
        // The email goes out after the answer, so the answer looks and takes the same whether or not the account exists.
        if (perEmail.ok) after(() => startPasswordReset(parsed.data.email, origin).catch((e) => console.error("[reset] start", e)));
        return json({ ok: true, minutes: RESET_MINUTES });
      }

      case "reset-code": {
        const parsed = z.object({ email, code: z.string().max(40).transform(cleanCode) }).safeParse(body);
        if (!parsed.success || !isCodeShape(parsed.data.code)) return fail("Enter the 6-digit code from the email.");
        const limit = rateLimit(`reset-code:${ip}`, 10, 15 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const result = await exchangeResetCode(parsed.data.email, parsed.data.code);
        return result.ok ? json({ ok: true, token: result.token }) : fail(result.error);
      }

      case "reset-check": {
        const parsed = z.object({ token: resetToken }).safeParse(body);
        if (!parsed.success) {
          console.info("[reset] reset page opened with a broken link");
          return json({ ok: true, status: "invalid" });
        }
        const limit = rateLimit(`reset-check:${ip}`, 30, 15 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const linkStatus = await checkResetToken(parsed.data.token);
        console.info(`[reset] reset page opened with a ${linkStatus} link`);
        return json({ ok: true, status: linkStatus });
      }

      case "reset": {
        const parsed = z.object({ token: resetToken, password }).safeParse(body);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return fail(issue?.path[0] === "token" ? "This reset link isn't valid. Request a new one." : (issue?.message ?? "Use at least 10 characters."));
        }
        const limit = rateLimit(`reset:${ip}`, 10, 15 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const result = await finishPasswordReset(parsed.data.token, parsed.data.password);
        if (!result.ok) return json({ ok: false, error: result.error, code: result.status }, { status: result.status === "rejected" ? 400 : 410 });
        // This browser starts signed out too; the person signs in with the new password.
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        after(() => sendPasswordChangedEmail(result.email, result.firstName).catch((e) => console.error("[reset] notice", e)));
        return json({ ok: true, state: await buildState(null) });
      }

      case "password": {
        const parsed = z.object({ current: z.string().min(1).max(200), next: password }).safeParse(body);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Use at least 10 characters.");
        const session = await currentSession();
        if (!session?.authUser.email) return fail("Please sign in again.", 401);
        const limit = rateLimit(`password:${session.user.id}`, 6, 15 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        const check = await supabase.auth.signInWithPassword({ email: session.authUser.email, password: parsed.data.current });
        if (check.error) return fail("Current password is incorrect.");
        const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
        if (error) return fail(error.code === "same_password" ? "Choose a password you haven't used before." : "We couldn't change your password. Please try again.");
        return json({ ok: true });
      }

      case "resend": {
        const parsed = z.object({ email }).safeParse(body);
        if (!parsed.success) return fail("Enter a valid email address.");
        const limit = rateLimit(`resend:${ip}`, 4, 15 * 60_000);
        if (!limit.ok) return tooMany(limit.retryAfterSec);
        if (emailReady()) {
          // A new 6-digit code (same answer whether or not the address needs one).
          after(() => sendVerificationCode(parsed.data.email).catch((e) => console.error("[verify] send", e)));
          return json({ ok: true });
        }
        const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: `${siteOrigin(request)}/auth/callback` } });
        if (error?.code === "over_email_send_rate_limit") return fail("We've sent too many emails just now. Please try again in a few minutes.", 429);
        return json({ ok: true });
      }

      case "consent": {
        const session = await currentSession();
        if (!session) return fail("Please sign in to continue.", 401);
        const r = await sendConsentRequest(session.user.id, siteOrigin(request));
        return r.ok ? json({ ok: true }) : fail(r.error);
      }

      default:
        return fail("Not found.", 404);
    }
  } catch (e) {
    return serverError(e, `auth:${op}`);
  }
}

export async function GET(request: Request, ctx: Ctx) {
  const { op } = await ctx.params;
  const url = new URL(request.url);
  try {
    if (op === "providers") return json({ providers: await enabledProviders() });
    if (op === "oauth") {
      const provider = url.searchParams.get("provider") ?? "";
      const next = safePath(url.searchParams.get("next"));
      if (!(await enabledProviders()).includes(provider)) return NextResponse.redirect(new URL(`/login?error=provider`, siteOrigin(request)));
      const supabase = await supabaseForRequest();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: { redirectTo: `${siteOrigin(request)}/auth/callback?next=${encodeURIComponent(next)}`, skipBrowserRedirect: true },
      });
      if (error || !data.url) return NextResponse.redirect(new URL(`/login?error=provider`, siteOrigin(request)));
      return NextResponse.redirect(data.url);
    }
    return json({ ok: false, error: "Not found." }, { status: 404 });
  } catch (e) {
    return serverError(e, `auth:${op}`);
  }
}
