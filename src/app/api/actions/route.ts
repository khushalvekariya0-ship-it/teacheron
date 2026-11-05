import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ActionName } from "@/lib/domain/actions";
import { fail } from "@/lib/domain/data";
import { siteOrigin } from "@/server/auth";
import { runAction } from "@/server/engine";
import { backendStatus } from "@/server/env";
import { clientIp, json, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/server/http";
import { removePublicFile } from "@/server/media";
import { clientConfig } from "@/server/offline";
import { prepareArgs } from "@/server/prepare";
import { ACTION_ARGS, parseArgs } from "@/server/schemas";
import { accountById, authState } from "@/server/session";
import { buildState } from "@/server/snapshot";
import { supabaseAdmin, supabaseForRequest } from "@/server/supabase";
import { db } from "@/server/db";
import { emailNotifications } from "@/server/notify-email";
import { placeTutor } from "@/server/geocode";

/*
 * POST /api/actions  { action, args } → { result, state }
 *
 * Runs one domain action as the signed-in account (see src/server/engine.ts) and returns the result
 * together with the viewer's refreshed state. The action name must be one the browser is allowed to
 * call (src/server/schemas.ts), and its arguments must match their schema.
 */
export const dynamic = "force-dynamic";

/**
 * Actions that change what public, server-rendered pages show (tutor profiles, subjects, jobs,
 * reviews, the blog and FAQs, platform settings). Those pages are cached for a minute; after one of
 * these succeeds they are rebuilt on their next visit instead.
 */
const PUBLIC_CHANGES = new Set<ActionName>([
  "submitOnboarding", "updateTutorProfile", "setAvailability", "setExceptions", "setBookingRules", "setTrial", "deleteMyAccount",
  "publishRequirement", "setRequirementStatus", "deleteRequirement", "saveRequirementDraft", "submitReview", "respondToReview",
  "reviewVerification", "setUserStatus", "moderateReview", "setFlag", "updatePolicy", "setPlatformFee", "setTutorListing", "takeDownRequirement", "deleteAccount",
  "saveSubjectArea", "deleteSubjectArea", "saveSubject", "deleteSubject", "moveCatalogItem", "loadStarterCatalog",
  "saveBlogPost", "deleteBlogPost", "saveFaq", "deleteFaq", "moveFaq", "saveTestimonial", "deleteTestimonial",
]);

function refreshPublicPages() {
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ result: fail("This request came from another site.") }, { status: 403 });
  if (!backendStatus().database) return json({ result: fail("The database isn't connected yet, so changes can't be saved."), config: clientConfig() }, { status: 503 });
  const body = await readJson<{ action?: unknown; args?: unknown }>(request);
  const action = typeof body?.action === "string" ? (body.action as ActionName) : null;
  if (!action || !(action in ACTION_ARGS)) return json({ result: fail("Unknown action.") }, { status: 400 });
  try {
    const { session, mfaPending, linkPending } = await authState();
    if (linkPending) return json({ result: fail("Enter the code we emailed you to confirm your new sign-in method."), linkRequired: linkPending }, { status: 401 });
    if (mfaPending) return json({ result: fail("Enter the 6-digit code from your authenticator app to continue."), mfaRequired: true }, { status: 401 });
    if (session?.user.needsRole) return json({ result: fail("Finish creating your account first: choose Student, Parent or Tutor."), needsRole: true }, { status: 403 });
    const limit = rateLimit(`act:${session?.user.id ?? clientIp(request)}`, 120, 60_000);
    if (!limit.ok) return tooMany(limit.retryAfterSec);
    if (!session) return json({ result: fail("Please sign in to continue."), state: await buildState(null) });
    const me = session.user;

    const parsed = parseArgs(action, body!.args);
    if (!parsed.ok) return json({ result: fail(parsed.error) }, { status: 400 });
    const prepared = await prepareArgs(action, parsed.args, me);
    if (!prepared.ok) {
      let error = prepared.error;
      // A file or photo stopped for showing contact details is logged for Trust & Safety (never the file itself).
      if (prepared.flag) {
        const logged = await runAction("recordContactFlag", [prepared.flag], { userId: me.id });
        if (logged.ok && (logged.data as { paused?: boolean }).paused) error += " Messaging is paused for 1 hour because of repeated attempts to share contact details.";
      }
      return json({ result: fail(error, prepared.flag ? "contact_blocked" : undefined), state: await buildState(me.id) });
    }

    // Remember the media a tutor is replacing, so the old file can be removed once the change is saved.
    const replacing = action === "updateTutorProfile" && me.tutorId ? await currentMedia(me.tutorId, prepared.args[0] as Record<string, unknown>) : [];

    const origin = siteOrigin(request);
    // Email copies go out after the response, so a slow mail service never delays the page.
    const result = await runAction(action, prepared.args, { userId: me.id }, (created) => after(() => emailNotifications(created, origin)));
    if (result.ok && PUBLIC_CHANGES.has(action)) refreshPublicPages();

    if (result.ok && action === "deleteMyAccount") {
      const { error } = await supabaseAdmin().auth.admin.deleteUser(session.authUser.id);
      if (error) console.error("[actions] couldn't delete the sign-in for", me.id, error.message);
      await (await supabaseForRequest()).auth.signOut().catch(() => {});
      return json({ result, state: await buildState(null) });
    }
    if (result.ok && action === "deleteAccount") {
      const { error } = await supabaseAdmin().auth.admin.deleteUser(String(prepared.args[0]));
      if (error) console.error("[actions] couldn't delete the sign-in for", prepared.args[0], error.message);
    }
    if (result.ok && replacing.length) {
      const now = me.tutorId ? await currentMedia(me.tutorId, prepared.args[0] as Record<string, unknown>) : [];
      for (const old of replacing) if (!now.includes(old)) await removePublicFile(old);
    }
    // A tutor outside the US gets their city's map position for distance search, after the answer (saves stay fast).
    if (result.ok && (action === "submitOnboarding" || action === "updateTutorProfile")) {
      after(async () => {
        const [row] = await db()`select tutor_id from public.users where id = ${me.id}`;
        if (row?.tutor_id) await placeTutor(row.tutor_id).catch(() => false);
      });
    }
    // A suspended or deleted account sees the public view.
    const still = await accountById(me.id);
    return json({ result, state: await buildState(still && still.status !== "suspended" ? me.id : null) });
  } catch (e) {
    return serverError(e, `actions:${action}`);
  }
}

async function currentMedia(tutorId: string, patch: Record<string, unknown>): Promise<string[]> {
  if (!("photoUrl" in patch) && !("introVideoUrl" in patch)) return [];
  const [row] = await db()`select photo_url, intro_video_url from public.tutors where id = ${tutorId}`;
  return [row?.photo_url, row?.intro_video_url].filter((x): x is string => typeof x === "string" && x.length > 0);
}
