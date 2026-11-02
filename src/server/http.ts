import "server-only";
import { NotConfiguredError } from "./env";

/** JSON response that is never cached (it carries per-account data). */
export function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { "Cache-Control": "private, no-store", ...init?.headers } });
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Requests that change data must come from this site. Auth cookies are SameSite=Lax already; this is
 * a second check against cross-site form posts.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}

/* In-memory sliding-window limiter, per server instance. */
const store = globalThis as unknown as { __tutorlinkRate?: Map<string, number[]> };
const hits = (store.__tutorlinkRate ??= new Map<string, number[]>());

export function rateLimit(key: string, max: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
  return { ok: true };
}

export function tooMany(retryAfterSec: number) {
  return json({ ok: false, error: "Too many attempts. Please wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
}

export async function readJson<T = unknown>(request: Request, maxBytes = 3_000_000): Promise<T | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Turns unexpected errors into a safe response; details go to the server log only. */
export function serverError(e: unknown, where: string) {
  if (e instanceof NotConfiguredError) return json({ ok: false, error: e.message, notConfigured: true }, { status: 503 });
  console.error(`[${where}]`, e);
  return json({ ok: false, error: "Something went wrong on our side. Please try again." }, { status: 500 });
}
