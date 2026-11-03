import "server-only";
import { env } from "./env";
import { supabaseAdmin } from "./supabase";

/*
 * Files in Supabase Storage.
 *   public-media   tutors/<user>/…  profile photos   ·  videos/<user>/…  intro videos   (public URLs)
 *   private-files  <kind>/<user>/…  verification documents, message attachments, dispute evidence,
 *                  requirement attachments                                             (signed links only)
 * Uploads use short-lived signed upload URLs issued here after checking who is uploading what; the
 * path always contains the uploader's account id, which is how ownership is checked later.
 */

export const PUBLIC_BUCKET = "public-media";
export const PRIVATE_BUCKET = "private-files";

export const PRIVATE_KINDS = ["verification", "messages", "disputes", "requirements", "homework"] as const;
export type PrivateKind = (typeof PRIVATE_KINDS)[number];

export const UPLOAD_RULES = {
  video: { bucket: PUBLIC_BUCKET, folder: "videos", maxBytes: 50 * 1024 * 1024, types: ["video/mp4", "video/webm", "video/quicktime"] },
  verification: { bucket: PRIVATE_BUCKET, folder: "verification", maxBytes: 15 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"] },
  // Files the other person can open are checked for contact details (src/server/scan.ts), so only types that can be read are allowed.
  messages: { bucket: PRIVATE_BUCKET, folder: "messages", maxBytes: 10 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  disputes: { bucket: PRIVATE_BUCKET, folder: "disputes", maxBytes: 10 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  requirements: { bucket: PRIVATE_BUCKET, folder: "requirements", maxBytes: 10 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  homework: { bucket: PRIVATE_BUCKET, folder: "homework", maxBytes: 10 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
} as const;
export type UploadKind = keyof typeof UPLOAD_RULES;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "application/pdf": "pdf", "text/plain": "txt", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const stamp = () => `${Date.now().toString(36)}${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

export const storageReady = () => !!(env.supabaseUrl && env.serviceRoleKey);

export function publicUrl(path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
}

/** Whether a URL is a file this account uploaded into a public-media folder. */
export function isOwnPublicFile(url: string, folder: "tutors" | "videos", userId: string): boolean {
  return !!env.supabaseUrl && url.startsWith(publicUrl(`${folder}/${userId}/`)) && !url.includes("..");
}

/** Whether a private-files path belongs to this account (`<kind>/<user>/<file>`). */
export function isOwnPrivatePath(path: string, userId: string): boolean {
  const [kind, owner, ...rest] = path.split("/");
  return (PRIVATE_KINDS as readonly string[]).includes(kind) && owner === userId && rest.length === 1 && /^[\w.-]+$/.test(rest[0]);
}

/** Stores a profile photo sent as a data URL and returns its public URL. */
export async function storeTutorPhoto(userId: string, dataUrl: string): Promise<string> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new UploadError("Upload a PNG, JPG or WebP photo.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 2 * 1024 * 1024) throw new UploadError("That photo is too large. Choose one under 2 MB.");
  const path = `tutors/${userId}/photo-${stamp()}.${EXT[m[1]]}`;
  const { error } = await supabaseAdmin().storage.from(PUBLIC_BUCKET).upload(path, bytes, { contentType: m[1], upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return publicUrl(path);
}

export class UploadError extends Error {}

/** A one-time URL the browser uploads a file to directly (files never pass through this server). */
export async function signedUpload(kind: UploadKind, userId: string, file: { name: string; type: string; size: number }) {
  const rule = UPLOAD_RULES[kind];
  if (!(rule.types as readonly string[]).includes(file.type)) {
    throw new UploadError(kind === "video" ? "Upload an MP4, WebM or MOV video." : kind === "messages" || kind === "homework" || kind === "disputes" ? "Attach a PDF, image (PNG, JPG, WebP), Word (.docx) or text file." : "That file type isn't supported.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new UploadError("That file is empty.");
  if (file.size > rule.maxBytes) throw new UploadError(`Files must be ${Math.round(rule.maxBytes / 1024 / 1024)} MB or smaller.`);
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  const path = `${rule.folder}/${userId}/${stamp()}-${base}.${EXT[file.type]}`;
  const { data, error } = await supabaseAdmin().storage.from(rule.bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Couldn't prepare the upload: ${error?.message}`);
  return { bucket: rule.bucket, path, token: data.token, publicUrl: rule.bucket === PUBLIC_BUCKET ? publicUrl(path) : null };
}

/** A short-lived download link for a private file. */
export async function signedDownload(path: string, seconds = 120): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from(PRIVATE_BUCKET).createSignedUrl(path, seconds);
  if (error || !data) throw new Error(`Couldn't sign the download: ${error?.message}`);
  return data.signedUrl;
}

/** Removes a file this account replaced (old photo or video). Failures are logged, not thrown. */
export async function removePublicFile(url: string | undefined) {
  if (!url || !env.supabaseUrl || !url.startsWith(publicUrl(""))) return;
  const path = url.slice(publicUrl("").length);
  const { error } = await supabaseAdmin().storage.from(PUBLIC_BUCKET).remove([path]);
  if (error) console.warn("[media] couldn't remove", path, error.message);
}
