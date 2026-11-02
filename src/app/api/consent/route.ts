import { z } from "zod";
import { siteOrigin } from "@/server/auth";
import { confirmConsent, lookupConsent } from "@/server/consent";
import { backendStatus } from "@/server/env";
import { clientIp, json, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/server/http";

/*
 * Parental consent link (emailed to the parent of a 13–17 student).
 *   GET  /api/consent?token=…            → the student's first name and whether it's already approved
 *   POST /api/consent { token, email }   → approve (the email must match the one the student gave)
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!backendStatus().database) return json({ ok: false, error: "Not connected yet." }, { status: 503 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const found = await lookupConsent(token);
    return found ? json({ ok: true, student: found }) : json({ ok: false, error: "This approval link isn't valid." }, { status: 404 });
  } catch (e) {
    return serverError(e, "consent");
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ ok: false, error: "This request came from another site." }, { status: 403 });
  if (!backendStatus().database) return json({ ok: false, error: "Not connected yet." }, { status: 503 });
  const limit = rateLimit(`consent:${clientIp(request)}`, 10, 15 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec);
  const parsed = z.object({ token: z.string().min(10).max(200), email: z.string().trim().email().max(200) }).safeParse(await readJson(request, 5_000));
  if (!parsed.success) return json({ ok: false, error: "Enter your email address." }, { status: 400 });
  try {
    const r = await confirmConsent(parsed.data.token, parsed.data.email, siteOrigin(request));
    return r.ok ? json({ ok: true }) : json({ ok: false, error: r.error }, { status: 400 });
  } catch (e) {
    return serverError(e, "consent");
  }
}
