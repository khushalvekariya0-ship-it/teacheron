import "server-only";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { User } from "@/lib/types";
import { db } from "./db";
import { env } from "./env";
import { after } from "next/server";
import { emailNotifications } from "./notify-email";
import { accountById } from "./session";

/** Where emailed links (confirmation, password reset, consent) should point. */
export function siteOrigin(request: Request): string {
  return env.siteUrl || new URL(request.url).origin;
}

/** Only same-site paths are followed after sign-in ("/dashboard", not "https://…" or "//…"). */
export function safePath(raw: unknown, fallback = "/dashboard"): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

/**
 * The account row for a Supabase sign-in. The database trigger creates it at sign-up; this covers
 * sign-ins that predate the trigger (same rules: only learner and tutor roles can be self-assigned).
 */
export async function ensureAccount(au: AuthUser): Promise<User | null> {
  const existing = await accountById(au.id);
  if (existing) return existing;
  const meta = (au.user_metadata ?? {}) as Record<string, unknown>;
  const role = ["student", "parent", "tutor"].includes(String(meta.role)) ? String(meta.role) : "student";
  const full = String(meta.full_name ?? meta.name ?? "").trim();
  const first = String(meta.first_name ?? full.split(" ")[0] ?? "").slice(0, 60);
  const last = String(meta.last_name ?? full.split(" ").slice(1).join(" ") ?? "").slice(0, 60);
  await db()`
    insert into public.users (id, role, first_name, last_name, email, email_verified)
    values (${au.id}, ${role}, ${first}, ${last}, ${(au.email ?? "").toLowerCase()}, ${!!au.email_confirmed_at})
    on conflict (id) do nothing`;
  return accountById(au.id);
}

export function deviceLabel(request: Request): string {
  const ua = request.headers.get("user-agent") ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export async function recordLogin(userId: string, success: boolean, request: Request) {
  const id = `le_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db()`insert into public.login_events (id, user_id, device, success) values (${id}, ${userId}, ${deviceLabel(request)}, ${success})`;
  if (success) await db()`update public.users set last_login_at = now() where id = ${userId}`;
}

export async function recordFailedLogin(email: string, request: Request) {
  const [u] = await db()`select id from public.users where lower(email) = ${email.toLowerCase()}`;
  if (u) await recordLogin(String(u.id), false, request);
}

/** Sign-in providers switched on in the Supabase dashboard (Authentication → Providers). */
let providerCache: { at: number; list: string[] } | null = null;
export async function enabledProviders(): Promise<string[]> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return [];
  if (providerCache && Date.now() - providerCache.at < 5 * 60_000) return providerCache.list;
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabaseAnonKey }, cache: "no-store" });
    const body = (await res.json()) as { external?: Record<string, boolean> };
    const list = ["google", "facebook", "apple", "azure"].filter((p) => body.external?.[p]);
    providerCache = { at: Date.now(), list };
    return list;
  } catch {
    return [];
  }
}

const rid = (prefix: string) => `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

/** An audit-log entry for account-security events handled outside the domain actions. */
export async function auditDirect(actorId: string, action: string, targetType: string, targetId: string, meta?: Record<string, unknown>) {
  await db()`insert into public.audit_logs (id, actor_id, action, target_type, target_id, meta, created_at)
             values (${rid("aud")}, ${actorId}, ${action}, ${targetType}, ${targetId}, ${meta ? db().json(meta as never) : null}, now())`;
}

/** A security notice (in-app and by email), for account events handled outside the domain actions. Route handlers only. */
export async function notifyDirect(userId: string, n: { title: string; body: string; href?: string }, origin?: string) {
  const id = rid("ntf");
  await db()`insert into public.notifications (id, user_id, type, title, body, href, created_at, read)
             values (${id}, ${userId}, 'security', ${n.title}, ${n.body}, ${n.href ?? null}, now(), false)`;
  after(() => emailNotifications([{ id, userId, type: "security", title: n.title, body: n.body, href: n.href, createdAt: new Date().toISOString(), read: false }], origin));
}

export async function setMfaFlag(userId: string, on: boolean) {
  await db()`update public.users set mfa_enabled = ${on} where id = ${userId} and mfa_enabled is distinct from ${on}`;
}
