import { z } from "zod";
import { backendStatus } from "@/server/env";
import { json, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/server/http";
import { signedUpload, storageReady, UploadError, type UploadKind } from "@/server/media";
import { currentSession } from "@/server/session";

/*
 * POST /api/uploads { kind, name, type, size } → { bucket, path, token, publicUrl }
 * Issues a one-time upload URL for Supabase Storage after checking the file type, size and whether
 * this account may upload that kind of file. The browser then uploads straight to Storage.
 */
export const dynamic = "force-dynamic";

const WHO: Record<UploadKind, string[]> = {
  video: ["tutor"],
  verification: ["tutor"],
  messages: ["student", "parent", "tutor"],
  disputes: ["student", "parent", "tutor"],
  requirements: ["student", "parent"],
  homework: ["student", "parent", "tutor"],
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ ok: false, error: "This request came from another site." }, { status: 403 });
  if (!backendStatus().database || !storageReady()) return json({ ok: false, error: "File uploads aren't connected yet." }, { status: 503 });
  const parsed = z
    .object({ kind: z.enum(["video", "verification", "messages", "disputes", "requirements", "homework"]), name: z.string().min(1).max(200), type: z.string().max(120), size: z.number().int().positive() })
    .safeParse(await readJson(request, 5_000));
  if (!parsed.success) return json({ ok: false, error: "Choose a file to upload." }, { status: 400 });
  try {
    const session = await currentSession();
    if (!session) return json({ ok: false, error: "Please sign in to continue." }, { status: 401 });
    if (session.user.status === "suspended") return json({ ok: false, error: "Your account is suspended." }, { status: 403 });
    if (!WHO[parsed.data.kind].includes(session.user.role)) return json({ ok: false, error: "Your account type can't upload this kind of file." }, { status: 403 });
    const limit = rateLimit(`upload:${session.user.id}`, 40, 10 * 60_000);
    if (!limit.ok) return tooMany(limit.retryAfterSec);
    const ticket = await signedUpload(parsed.data.kind, session.user.id, parsed.data);
    return json({ ok: true, ...ticket });
  } catch (e) {
    if (e instanceof UploadError) return json({ ok: false, error: e.message }, { status: 400 });
    return serverError(e, "uploads");
  }
}
