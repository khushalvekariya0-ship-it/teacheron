import "server-only";
import type { User } from "@/lib/types";
import type { ActionName } from "@/lib/domain/actions";
import { isOwnPrivatePath, isOwnPublicFile, storageReady, storeTutorPhoto, UploadError } from "./media";

/*
 * Server-side preparation of action arguments that involve files:
 *  • a tutor photo sent as a data URL is stored in Supabase Storage and replaced by its public URL;
 *  • links to uploaded files must point at the caller's own folder;
 *  • videos that only ever lived in one browser ("device-video:" from before uploads existed) are refused.
 */

type Prepared = { ok: true; args: unknown[] } | { ok: false; error: string };

const DEVICE_VIDEO = "That video was only saved in your browser. Upload it again so students can watch it.";
const FILE_MISSING = "Upload the file again — we couldn't find it.";

function checkFiles(list: unknown, me: User): string | null {
  if (list === undefined) return null;
  for (const f of Array.isArray(list) ? list : [list]) {
    const path = (f as { path?: unknown } | null)?.path;
    if (typeof path !== "string" || !isOwnPrivatePath(path, me.id)) return FILE_MISSING;
  }
  return null;
}

async function photo(value: unknown, me: User): Promise<string | null | undefined> {
  if (typeof value !== "string" || value === "") return value as undefined;
  if (value.startsWith("data:")) return storageReady() ? storeTutorPhoto(me.id, value) : value;
  if (isOwnPublicFile(value, "tutors", me.id)) return value;
  throw new UploadError("Upload a PNG, JPG or WebP photo.");
}

function video(value: unknown, me: User): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("device-video:")) return DEVICE_VIDEO;
  if (value.includes("/storage/v1/object/public/") && !isOwnPublicFile(value, "videos", me.id)) return "Upload your own video, or paste a YouTube or Vimeo link.";
  return null;
}

export async function prepareArgs(name: ActionName, args: unknown[], me: User): Promise<Prepared> {
  try {
    switch (name) {
      case "updateTutorProfile": {
        const patch = { ...(args[0] as Record<string, unknown>) };
        const bad = video(patch.introVideoUrl, me);
        if (bad) return { ok: false, error: bad };
        if ("photoUrl" in patch) patch.photoUrl = await photo(patch.photoUrl, me);
        return { ok: true, args: [patch] };
      }
      case "saveOnboarding": {
        const data = { ...(args[1] as Record<string, unknown>) };
        const bad = video(data.introVideoUrl, me);
        if (bad) return { ok: false, error: bad };
        if ("photoDataUrl" in data) data.photoDataUrl = await photo(data.photoDataUrl, me);
        if (data.idDocument && (typeof data.idDocumentPath !== "string" || !isOwnPrivatePath(data.idDocumentPath, me.id))) return { ok: false, error: FILE_MISSING };
        return { ok: true, args: [args[0], data] };
      }
      case "submitHomework": {
        const path = args[3];
        if (path !== undefined && (typeof path !== "string" || !isOwnPrivatePath(path, me.id))) return { ok: false, error: FILE_MISSING };
        return { ok: true, args };
      }
      case "sendMessage": {
        const bad = checkFiles(args[2], me);
        return bad ? { ok: false, error: bad } : { ok: true, args };
      }
      case "submitVerification": {
        const bad = checkFiles(args[1], me);
        return bad ? { ok: false, error: bad } : { ok: true, args };
      }
      case "openDispute": {
        const bad = (args[3] as unknown[]).length ? checkFiles(args[3], me) : null;
        return bad ? { ok: false, error: bad } : { ok: true, args };
      }
      case "saveRequirementDraft": {
        const atts = (args[0] as { attachments?: unknown[] }).attachments;
        const bad = atts?.length ? checkFiles(atts, me) : null;
        return bad ? { ok: false, error: bad } : { ok: true, args };
      }
      default:
        return { ok: true, args };
    }
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    throw e;
  }
}
