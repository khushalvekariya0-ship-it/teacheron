import type { User } from "@/lib/types";
import { hasPermission, isStaff } from "@/lib/permissions";
import { auditDirect } from "@/server/auth";
import { db } from "@/server/db";
import { json, serverError } from "@/server/http";
import { isOwnPrivatePath, signedDownload, storageReady } from "@/server/media";
import { currentSession } from "@/server/session";

/*
 * GET /api/files?path=<kind>/<owner>/<file> → redirect to a 2-minute signed download link.
 * The uploader can always open their file; others only when they can see the record it belongs to
 * (the other person in the conversation or lesson, or staff whose permissions cover it).
 */
export const dynamic = "force-dynamic";

async function mayOpen(me: User, path: string): Promise<boolean> {
  if (isOwnPrivatePath(path, me.id)) return true;
  const kind = path.split("/")[0];
  const sql = db();
  const isParty = (userId: unknown, tutorId: unknown) => userId === me.id || (!!me.tutorId && tutorId === me.tutorId);
  switch (kind) {
    case "verification":
      return hasPermission(me, "tutors.verify");
    case "messages": {
      if (hasPermission(me, "conversations.read_flagged")) return true;
      const rows = await sql`select c.user_id, c.tutor_id from public.messages m join public.conversations c on c.id = m.conversation_id where m.attachment ->> 'path' = ${path}`;
      return rows.some((r) => isParty(r.user_id, r.tutor_id));
    }
    case "disputes": {
      if (hasPermission(me, "disputes.manage")) return true;
      const rows = await sql`select b.booker_id, b.tutor_id from public.disputes d join public.bookings b on b.id = d.booking_id where d.evidence @> ${sql.json([{ path }])}`;
      return rows.some((r) => isParty(r.booker_id, r.tutor_id));
    }
    case "homework": {
      // The learner (or their parent) who handed it in, and the tutor who set it.
      const rows = await sql`select h.learner_id, h.tutor_id, c.parent_id from public.homework h left join public.children c on c.id = h.learner_id where h.submission ->> 'filePath' = ${path}`;
      return rows.some((r) => r.learner_id === me.id || r.parent_id === me.id || (!!me.tutorId && r.tutor_id === me.tutorId));
    }
    case "requirements":
      // Job attachments are private to the family that posted the job (tutors only see that files exist).
      return hasPermission(me, "users.read");
    default:
      return false;
  }
}

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!storageReady()) return json({ ok: false, error: "File storage isn't connected yet." }, { status: 503 });
  if (!/^[\w-]+\/[\w-]+\/[\w.-]+$/.test(path)) return json({ ok: false, error: "File not found." }, { status: 404 });
  try {
    const session = await currentSession();
    if (!session) return json({ ok: false, error: "Please sign in to open this file." }, { status: 401 });
    if (!(await mayOpen(session.user, path))) return json({ ok: false, error: "You don't have access to this file." }, { status: 403 });
    // Staff opening someone else's private file (ID documents, evidence, attachments) is always on record.
    if (isStaff(session.user) && !isOwnPrivatePath(path, session.user.id)) await auditDirect(session.user.id, "file.view", "file", path, { kind: path.split("/")[0] });
    return Response.redirect(await signedDownload(path), 302);
  } catch (e) {
    return serverError(e, "files");
  }
}
