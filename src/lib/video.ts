/**
 * Tutor intro videos. A video is either a link (YouTube, Vimeo or a direct MP4/WebM/MOV file) or a file
 * the tutor uploaded from their device. Until file storage is connected, an uploaded file is kept in
 * this browser (IndexedDB) and referenced as "device-video:<key>"; production uploads it to object
 * storage instead and stores the returned URL.
 */

export const DEVICE_VIDEO_PREFIX = "device-video:";
export const MAX_VIDEO_MB = 100;
export const MAX_VIDEO_SECONDS = 180;

export type IntroVideoSource =
  | { kind: "youtube"; id: string; embedUrl: string }
  | { kind: "vimeo"; id: string; embedUrl: string }
  | { kind: "file"; url: string }
  | { kind: "device"; key: string };

/** What a stored intro-video value points at, or null when it isn't one we can play. */
export function parseIntroVideo(value: string | null | undefined): IntroVideoSource | null {
  const v = value?.trim();
  if (!v) return null;
  if (v.startsWith(DEVICE_VIDEO_PREFIX)) {
    const key = v.slice(DEVICE_VIDEO_PREFIX.length);
    return /^[\w-]{1,120}$/.test(key) ? { kind: "device", key } : null;
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = host === "youtu.be" ? url.pathname.slice(1) : (url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? "");
    return /^[\w-]{11}$/.test(id) ? { kind: "youtube", id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/)?.[1];
    return id ? { kind: "vimeo", id, embedUrl: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (url.protocol === "https:" && /\.(mp4|webm|mov)$/i.test(url.pathname)) return { kind: "file", url: url.toString() };
  return null;
}

/** An error message for a picked file, or null when it can be used. */
export function checkVideoFile(file: File): string | null {
  if (!/^video\/(mp4|webm|quicktime)$/.test(file.type) && !/\.(mp4|webm|mov)$/i.test(file.name)) return "Choose an MP4, WebM or MOV video.";
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) return `Choose a video under ${MAX_VIDEO_MB} MB.`;
  return null;
}

/** Length of a video file in seconds (NaN when the browser can't read it). */
export function videoDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(n);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(Number.NaN);
    el.src = url;
  });
}

/* ─── Files kept in this browser ─────────────────────────────────────────────── */

const DB_NAME = "tutorlink-media";
const STORE = "videos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Saves an uploaded video in this browser and returns the value to store on the profile. */
export async function saveDeviceVideo(ownerId: string, file: Blob): Promise<string> {
  const key = `intro-${ownerId.replace(/[^\w-]/g, "")}-${Date.now().toString(36)}`;
  await run("readwrite", (s) => s.put(file, key));
  return DEVICE_VIDEO_PREFIX + key;
}

export async function loadDeviceVideo(key: string): Promise<Blob | null> {
  try {
    return (await run<Blob | undefined>("readonly", (s) => s.get(key))) ?? null;
  } catch {
    return null;
  }
}

/** Removes an uploaded file when its value is replaced or cleared (links are left alone). */
export async function discardIntroVideo(value: string | null | undefined): Promise<void> {
  const src = parseIntroVideo(value);
  if (src?.kind !== "device") return;
  try {
    await run("readwrite", (s) => s.delete(src.key));
  } catch {
    // Nothing to clean up.
  }
}
