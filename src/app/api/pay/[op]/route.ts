import { after } from "next/server";
import { siteOrigin } from "@/server/auth";
import { CHECKOUT_KINDS, finishCheckout, startCheckout, type CheckoutKind } from "@/server/checkout";
import { backendStatus } from "@/server/env";
import { clientIp, json, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/server/http";
import { emailNotifications } from "@/server/notify-email";
import { parseArgs } from "@/server/schemas";
import { authState } from "@/server/session";
import { buildState } from "@/server/snapshot";

/*
 * Paying with Razorpay Checkout (src/server/checkout.ts):
 *   POST /api/pay/start  { kind, payload } → the Razorpay order to open Checkout with (or { free: true })
 *     kind "booking":       payload = the same input as the createBooking action (payWith "card" | "upi")
 *     kind "booking_retry": { bookingId }  (a lesson whose payment failed)
 *     kind "study_credits": { packId, method }
 *     kind "lead_credits":  { packId }
 *     kind "plan":          { plan }
 *   POST /api/pay/finish { orderId, paymentId, signature } → does what was paid for; answers like /api/actions
 * Razorpay's webhook (/api/pay/webhook) finishes orders whose browser closed before /finish.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ op: string }> };
const fail = (error: string, status = 400) => json({ result: { ok: false, error } }, { status });
const ID = /^[A-Za-z0-9_]{6,64}$/;

export async function POST(request: Request, ctx: Ctx) {
  const { op } = await ctx.params;
  if (!sameOrigin(request)) return fail("This request came from another site.", 403);
  if (!backendStatus().database) return fail("The database isn't connected yet.", 503);
  try {
    const { session, mfaPending, linkPending } = await authState();
    if (linkPending || mfaPending) return fail("Finish signing in first.", 401);
    if (!session || session.user.needsRole) return fail("Please sign in to continue.", 401);
    const me = session.user;
    const limit = rateLimit(`pay:${me.id}:${clientIp(request)}`, 30, 10 * 60_000);
    if (!limit.ok) return tooMany(limit.retryAfterSec);
    const body = (await readJson<Record<string, unknown>>(request, 20_000)) ?? {};

    if (op === "start") {
      const kind = String(body.kind ?? "") as CheckoutKind;
      if (!CHECKOUT_KINDS.includes(kind)) return fail("Choose what to pay for.");
      let payload = body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {};
      if (kind === "booking") {
        // Exactly what createBooking accepts (unknown fields dropped).
        const parsed = parseArgs("createBooking", [payload]);
        if (!parsed.ok) return fail(parsed.error);
        payload = parsed.args[0] as Record<string, unknown>;
        if (payload.payWith === "wallet") return fail("Study Credits don't need a card payment.");
      }
      const r = await startCheckout(me, kind, payload);
      return json({ result: r });
    }

    if (op === "finish") {
      const orderId = String(body.orderId ?? "");
      const paymentId = String(body.paymentId ?? "");
      const signature = String(body.signature ?? "");
      if (!ID.test(orderId) || !ID.test(paymentId) || !/^[0-9a-f]{64}$/i.test(signature)) return fail("That payment confirmation isn't valid.");
      const origin = siteOrigin(request);
      const r = await finishCheckout(orderId, paymentId, { userId: me.id, signature, onNotified: (created) => after(() => emailNotifications(created, origin)) });
      return json({ result: r, state: await buildState(me.id) });
    }

    return fail("Not found.", 404);
  } catch (e) {
    return serverError(e, `pay:${op}`);
  }
}
