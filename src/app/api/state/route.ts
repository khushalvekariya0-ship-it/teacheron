import { after } from "next/server";
import { backendStatus } from "@/server/env";
import { json, serverError } from "@/server/http";
import { clientConfig, offlineState } from "@/server/offline";
import { maybeRunScheduler } from "@/server/scheduler";
import { authState } from "@/server/session";
import { buildState } from "@/server/snapshot";

/*
 * GET /api/state — everything the signed-in viewer (or a visitor) may see, in the shape the
 * browser store uses. Called on page load, after sign-in/out and when a tab regains focus.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!backendStatus().database) return json({ state: offlineState(), config: clientConfig() });
  try {
    const { session, mfaPending } = await authState();
    const state = await buildState(session?.user.id ?? null);
    after(maybeRunScheduler);
    return json({ state, config: clientConfig(), mfaRequired: mfaPending });
  } catch (e) {
    return serverError(e, "state");
  }
}
