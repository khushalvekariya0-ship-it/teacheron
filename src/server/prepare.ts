import "server-only";
import type { ContactFlag, User } from "@/lib/types";
import type { ActionName } from "@/lib/domain/actions";
import { blockedMessage, scanContact, type ContactKind } from "@/lib/domain/contact";
import { isOwnPrivatePath, isOwnPublicFile, storageReady, storeTutorPhoto, UploadError } from "./media";
import { checkImageBytes, checkStoredFile, removePrivateFile } from "./scan";

/*
 * Server-side preparation of action arguments that involve files:
 *  • a tutor photo sent as a data URL is checked for contact details (OCR), stored in Supabase Storage
 *    and replaced by its public URL;
 *  • links to uploaded files must point at the caller's own folder;
 *  • files the other person will be able to open (chat attachments, homework) are read and checked for
 *    contact details (src/server/scan.ts); a file that has them is refused and deleted, and the attempt is
 *    returned as `flag` so the caller can log it for Trust & Safety. Dispute evidence that shows contact
 *    details is kept for staff but hidden from the other person (`staffOnly`);
 *  • videos that only ever lived in one browser ("device-video:" from before uploads existed) are refused.
 */

export type FlagInput = { channel: ContactFlag["channel"]; contextId?: string; kinds: ContactKind[]; fileName?: string };
type Prepared = { ok: true; args: unknown[] } | { ok: false; error: string; flag?: FlagInput };

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

/** Reads an uploaded file; null when it's fine to share, otherwise the refusal (the file is deleted if it shows contact details). */
async function screenFile(path: string, fileName: string, channel: FlagInput["channel"], contextId: string): Promise<Prepared | null> {
  const verdict = await checkStoredFile(path);
  if (verdict.ok) return null;
  if (verdict.reason === "unchecked") return { ok: false, error: verdict.error };
  await removePrivateFile(path);
  return { ok: false, error: blockedMessage(verdict.kinds, "file"), flag: { channel, contextId, kinds: verdict.kinds, fileName } };
}

const PHOTO = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/** A new profile photo with a phone number, email or handle written on it is refused. */
async function screenPhoto(value: unknown, me: User): Promise<Prepared | null> {
  const m = typeof value === "string" ? PHOTO.exec(value) : null;
  if (!m) return null;
  const verdict = await checkImageBytes(Buffer.from(m[2], "base64"));
  if (verdict.ok) return null;
  if (verdict.reason === "unchecked") return { ok: false, error: verdict.error };
  return {
    ok: false,
    error: `This photo wasn't saved because it looks like it shows ${verdict.kinds.includes("email") ? "an email address" : verdict.kinds.includes("phone") ? "a phone number" : "a social media or messaging app contact"}. Choose a photo without contact details.`,
    flag: { channel: "profile", contextId: me.tutorId, kinds: verdict.kinds, fileName: "Profile photo" },
  };
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

const paused = (me: User) => !!me.chatModeration?.restrictedUntil && new Date(me.chatModeration.restrictedUntil).getTime() > Date.now();

export async function prepareArgs(name: ActionName, args: unknown[], me: User): Promise<Prepared> {
  try {
    switch (name) {
      case "updateTutorProfile": {
        const patch = { ...(args[0] as Record<string, unknown>) };
        const bad = video(patch.introVideoUrl, me);
        if (bad) return { ok: false, error: bad };
        const blocked = await screenPhoto(patch.photoUrl, me);
        if (blocked) return blocked;
        if ("photoUrl" in patch) patch.photoUrl = await photo(patch.photoUrl, me);
        return { ok: true, args: [patch] };
      }
      case "saveOnboarding": {
        const data = { ...(args[1] as Record<string, unknown>) };
        const bad = video(data.introVideoUrl, me);
        if (bad) return { ok: false, error: bad };
        const blocked = await screenPhoto(data.photoDataUrl, me);
        if (blocked) return blocked;
        if ("photoDataUrl" in data) data.photoDataUrl = await photo(data.photoDataUrl, me);
        if (data.idDocument && (typeof data.idDocumentPath !== "string" || !isOwnPrivatePath(data.idDocumentPath, me.id))) return { ok: false, error: FILE_MISSING };
        return { ok: true, args: [args[0], data] };
      }
      case "submitHomework": {
        const path = args[3];
        if (path !== undefined && (typeof path !== "string" || !isOwnPrivatePath(path, me.id))) return { ok: false, error: FILE_MISSING };
        // A note with contact details is refused by the action itself, so the file isn't read first.
        if (typeof path === "string" && !scanContact(String(args[1] ?? ""), "chat").found) {
          const blocked = await screenFile(path, String(args[2] ?? "file"), "homework", String(args[0]));
          if (blocked) return blocked;
        }
        return { ok: true, args };
      }
      case "sendMessage": {
        const bad = checkFiles(args[2], me);
        if (bad) return { ok: false, error: bad };
        const att = args[2] as { name: string; path: string } | undefined;
        // Text with contact details (or a paused account) is refused by the action itself.
        if (att && !paused(me) && !scanContact(String(args[1] ?? ""), "chat").found) {
          const blocked = await screenFile(att.path, att.name, "chat", String(args[0]));
          if (blocked) return blocked;
        }
        return { ok: true, args };
      }
      case "submitVerification": {
        const bad = checkFiles(args[1], me);
        return bad ? { ok: false, error: bad } : { ok: true, args };
      }
      case "openDispute": {
        const files = args[3] as { name: string; sizeKb: number; path?: string }[];
        const bad = files.length ? checkFiles(files, me) : null;
        if (bad) return { ok: false, error: bad };
        // Evidence stays available to Trust & Safety; files that show contact details are hidden from the other person.
        const evidence: { name: string; sizeKb: number; path?: string; staffOnly?: boolean }[] = [];
        for (const f of files) {
          const verdict = await checkStoredFile(f.path!);
          if (!verdict.ok && verdict.reason === "unchecked") return { ok: false, error: `${f.name}: ${verdict.error}` };
          evidence.push(verdict.ok ? f : { ...f, staffOnly: true });
        }
        return { ok: true, args: [args[0], args[1], args[2], evidence] };
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
