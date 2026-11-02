import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { json, serverError } from "@/server/http";
import { runScheduler } from "@/server/scheduler";

/*
 * GET /api/cron — runs the booking lifecycle jobs (expire unanswered requests, auto-complete
 * finished lessons). Call it on a schedule with `Authorization: Bearer <CRON_SECRET>`; Vercel Cron
 * sends that header automatically when CRON_SECRET is set (see vercel.json).
 */
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  if (!env.cronSecret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ ok: false, error: "Unauthorized." }, { status: 401 });
  try {
    return json({ ok: true, processed: await runScheduler() });
  } catch (e) {
    return serverError(e, "cron");
  }
}
