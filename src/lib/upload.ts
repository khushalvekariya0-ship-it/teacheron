"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * File uploads from the browser. The server checks who is uploading what and returns a one-time
 * signed URL (POST /api/uploads); the file then goes straight to Supabase Storage with the public
 * key — no secret ever reaches the browser, and the signed URL only allows that one file.
 */

export type UploadKind = "video" | "verification" | "messages" | "disputes" | "requirements" | "homework";

export interface UploadedFile {
  name: string;
  sizeKb: number;
  /** Where the file lives in private storage (open it with fileUrl). */
  path: string;
  /** Public URL, for intro videos. */
  publicUrl: string | null;
}

let client: SupabaseClient | null = null;
function storageClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return client;
}

const TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", heic: "image/heic", txt: "text/plain",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};

export function fileType(file: File): string {
  return file.type || TYPE_BY_EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] || "application/octet-stream";
}

export async function uploadFile(kind: UploadKind, file: File): Promise<{ ok: true; file: UploadedFile } | { ok: false; error: string }> {
  const storage = storageClient();
  if (!storage) return { ok: false, error: "File uploads aren't connected yet." };
  const type = fileType(file);
  let ticket: { ok?: boolean; error?: string; bucket?: string; path?: string; token?: string; publicUrl?: string | null } | null = null;
  try {
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ kind, name: file.name, type, size: file.size }),
    });
    ticket = await res.json().catch(() => null);
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your connection and try again." };
  }
  if (!ticket?.ok || !ticket.bucket || !ticket.path || !ticket.token) return { ok: false, error: ticket?.error ?? "The upload couldn't start. Please try again." };
  const { error } = await storage.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: type });
  if (error) return { ok: false, error: "The upload didn't finish. Check your connection and try again." };
  return { ok: true, file: { name: file.name, sizeKb: Math.max(1, Math.ceil(file.size / 1024)), path: ticket.path, publicUrl: ticket.publicUrl ?? null } };
}

/** Link that opens a private file (the server checks access, then redirects to a short-lived signed URL). */
export function fileUrl(path: string | undefined): string | undefined {
  return path ? `/api/files?path=${encodeURIComponent(path)}` : undefined;
}

/** Uploads picked files (in order) and returns what to save with the record: name, size and storage path. */
export async function uploadAll(kind: UploadKind, picked: { name: string; sizeKb: number; file?: File; path?: string }[]): Promise<{ ok: true; files: { name: string; sizeKb: number; path: string }[] } | { ok: false; error: string }> {
  const files: { name: string; sizeKb: number; path: string }[] = [];
  for (const p of picked) {
    if (p.path) {
      files.push({ name: p.name, sizeKb: p.sizeKb, path: p.path });
      continue;
    }
    if (!p.file) return { ok: false, error: `Choose ${p.name} again so it can be uploaded.` };
    const up = await uploadFile(kind, p.file);
    if (!up.ok) return { ok: false, error: `${p.name}: ${up.error}` };
    files.push({ name: up.file.name, sizeKb: up.file.sizeKb, path: up.file.path });
  }
  return { ok: true, files };
}
