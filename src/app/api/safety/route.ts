import { APPEAL_REASON, SAFETY_CATEGORIES, safetySchema } from "@/components/content/safety-schema";
import { db } from "@/server/db";
import { clientIp, json, rateLimit, sameOrigin, tooMany } from "@/server/http";
import { alertStaff } from "@/server/staff-alerts";

/*
 * POST /api/safety — the Trust & safety page's form (no login needed).
 *   { kind: "report", email, category, who?, what }  a concern, filed in Admin → Reports from a "guest"
 *   { kind: "appeal", email, what }                  a suspended account asks to be looked at again
 * An appeal is filed only for an email that belongs to a suspended account with no open appeal, but the answer
 * is always the same, so the form can't be used to find out which emails have accounts.
 */
export const dynamic = "force-dynamic";

const reportId = () => `rpt_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ ok: false, error: "Please send the form from the TutorLink website." }, { status: 403 });
  const limit = rateLimit(`safety-form:${clientIp(request)}`, 5, 60 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec);
  const parsed = safetySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: "Check the form and try again." }, { status: 400 });
  const v = parsed.data;
  if (v.website) return json({ ok: true }); // the hidden field was filled: a bot

  try {
    if (v.kind === "report") {
      const label = SAFETY_CATEGORIES.find((c) => c.value === v.category)?.label ?? "Something else";
      // A tutor's profile link names the tutor; anything else is kept as written in the details.
      const slug = /\/tutors\/([a-z0-9-]{2,120})/i.exec(v.who ?? "")?.[1];
      const [tutor] = slug ? await db()`select id from public.tutors where slug = ${slug.toLowerCase()}` : [];
      const details = [
        "Sent from the Trust & safety page by someone who wasn't logged in.",
        `Reply to: ${v.email}`,
        v.who ? `About: ${v.who}` : null,
        "",
        v.what,
      ].filter((x) => x !== null).join("\n");
      const id = reportId();
      await db()`insert into public.reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
                 values (${id}, 'guest', ${tutor ? "tutor" : "user"}, ${tutor ? (tutor.id as string) : "unspecified"}, ${label}, ${details}, 'open', now())`;
      await alertStaff("reports.moderate", { title: "New report from a visitor", body: label, href: `/admin/reports?id=${id}` });
    } else {
      const [u] = await db()`select id, status from public.users where lower(email) = ${v.email.toLowerCase()}`;
      if (u?.status === "suspended") {
        const [open] = await db()`select 1 from public.reports where reporter_id = ${u.id} and reason = ${APPEAL_REASON} and status in ('open', 'reviewing') limit 1`;
        if (!open) {
          const id = reportId();
          const details = `Sent from the Trust & safety page (the account's email: ${v.email}).\n\n${v.what}`;
          await db()`insert into public.reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
                     values (${id}, ${u.id}, 'user', ${u.id}, ${APPEAL_REASON}, ${details}, 'open', now())`;
          await alertStaff("reports.moderate", { title: "New appeal against a suspension", body: "A suspended account asked to be looked at again.", href: `/admin/reports?id=${id}` });
        }
      }
    }
  } catch (e) {
    console.error("[safety] form", e);
    return json({ ok: false, error: "We couldn't send it just now. Please try again in a minute." }, { status: 500 });
  }
  return json({ ok: true });
}
