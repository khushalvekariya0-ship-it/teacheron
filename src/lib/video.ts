/**
 * Tutor intro videos. A video is either a link (YouTube, Vimeo or a direct MP4/WebM/MOV file) or a
 * file the tutor uploaded, which is stored in Supabase Storage and referenced by its public URL.
 */

/** Matches the public-media bucket's file size limit (Supabase's free plan allows up to 50 MB per file). */
export const MAX_VIDEO_MB = 50;
export const MAX_VIDEO_SECONDS = 180;

export type IntroVideoSource =
  | { kind: "youtube"; id: string; embedUrl: string }
  | { kind: "vimeo"; id: string; embedUrl: string }
  | { kind: "file"; url: string };

/** What a stored intro-video value points at, or null when it isn't one we can play. */
export function parseIntroVideo(value: string | null | undefined): IntroVideoSource | null {
  const v = value?.trim();
  if (!v) return null;
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
  // Files must be served over HTTPS — except from this machine (a local Supabase runs on http://127.0.0.1).
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((url.protocol === "https:" || local) && /\.(mp4|webm|mov)$/i.test(url.pathname)) return { kind: "file", url: url.toString() };
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
