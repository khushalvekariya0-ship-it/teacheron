/*
 * Zoom / Google Meet links for online lessons. The tutor makes the meeting in their own Zoom (or Google
 * Meet) and pastes its invite link on the lesson; the student and tutor then get a "Join Zoom" button.
 * Only real meeting links are accepted: an https Zoom or Google Meet address in a known shape, with
 * anything extra (tracking, host tokens) removed. Pure functions, used by the form and by the server.
 */

export type VideoProvider = "zoom" | "meet";

export interface VideoLink {
  /** The cleaned link that is saved and opened. */
  url: string;
  provider: VideoProvider;
  /** "850 1234 5678" for a Zoom meeting, "abc-defg-hij" for Google Meet, when the link shows it. */
  meetingId?: string;
}

export const VIDEO_PROVIDER_LABEL: Record<VideoProvider, string> = { zoom: "Zoom", meet: "Google Meet" };
export const MAX_PASSCODE = 10;

const isZoomHost = (h: string) => h === "zoom.us" || h.endsWith(".zoom.us") || h === "zoom.com" || h.endsWith(".zoom.com");

/** Zoom meeting numbers are shown in groups: 850 1234 5678. */
export function formatZoomId(digits: string): string {
  return digits.length === 11 ? `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}` : digits.length === 10 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : digits;
}

function toUrl(raw: string): URL | null {
  const v = raw.trim();
  if (!v || v.length > 500 || /\s/.test(v)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

export function parseVideoLink(raw: string): { ok: true; link: VideoLink } | { ok: false; error: string } {
  const url = toUrl(raw);
  if (!url) return { ok: false, error: "Paste the meeting's invite link, for example https://zoom.us/j/85012345678." };
  const host = url.hostname.toLowerCase();
  if (isZoomHost(host)) {
    const path = url.pathname.replace(/\/+$/, "");
    if (/^\/s\/\d+/.test(path)) return { ok: false, error: "That's your Zoom start link, which would let others start the meeting as you. Copy the invite link instead (Zoom → Meetings → Copy invitation)." };
    const join = path.match(/^\/(?:j|w|wc\/join)\/(\d{9,11})$/);
    const personal = path.match(/^\/my\/([A-Za-z0-9.]{3,40})$/);
    if (!join && !personal) return { ok: false, error: "That doesn't look like a Zoom meeting link. It should look like https://zoom.us/j/85012345678." };
    // Keep only the meeting passcode token; drop anything else (tracking, names, host tokens).
    const pwd = url.searchParams.get("pwd");
    const clean = `https://${host}${join ? `/j/${join[1]}` : `/my/${personal![1]}`}${pwd && /^[A-Za-z0-9._-]{1,120}$/.test(pwd) ? `?pwd=${pwd}` : ""}`;
    return { ok: true, link: { url: clean, provider: "zoom", meetingId: join ? formatZoomId(join[1]) : undefined } };
  }
  if (host === "meet.google.com") {
    const code = url.pathname.match(/^\/([a-z]{3}-[a-z]{4}-[a-z]{3})\/?$/i)?.[1]?.toLowerCase();
    if (!code) return { ok: false, error: "That doesn't look like a Google Meet link. It should look like https://meet.google.com/abc-defg-hij." };
    return { ok: true, link: { url: `https://meet.google.com/${code}`, provider: "meet", meetingId: code } };
  }
  return { ok: false, error: "Use a Zoom or Google Meet meeting link." };
}

/** A Zoom passcode: up to 10 letters, numbers or @ - _ *. Empty means none. */
export function checkPasscode(raw: string | undefined): { ok: true; passcode?: string } | { ok: false; error: string } {
  const v = (raw ?? "").trim();
  if (!v) return { ok: true };
  if (!new RegExp(`^[A-Za-z0-9@*_-]{1,${MAX_PASSCODE}}$`).test(v)) return { ok: false, error: `A passcode is up to ${MAX_PASSCODE} letters or numbers.` };
  return { ok: true, passcode: v };
}

/** A lesson recording: a Zoom cloud recording or a Google Drive file. */
export function parseRecordingLink(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const url = toUrl(raw);
  const bad = { ok: false as const, error: "Paste a Zoom cloud recording link (https://zoom.us/rec/…) or a Google Drive file link." };
  if (!url) return bad;
  const host = url.hostname.toLowerCase();
  if (isZoomHost(host) && /^\/rec\/(share|play)\/[A-Za-z0-9._-]+$/.test(url.pathname.replace(/\/+$/, ""))) {
    const pwd = url.searchParams.get("pwd");
    return { ok: true, url: `https://${host}${url.pathname.replace(/\/+$/, "")}${pwd && /^[A-Za-z0-9._-]{1,120}$/.test(pwd) ? `?pwd=${pwd}` : ""}` };
  }
  const drive = host === "drive.google.com" && url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,})/)?.[1];
  if (drive) return { ok: true, url: `https://drive.google.com/file/d/${drive}/view` };
  return bad;
}

/** Which service a saved link belongs to (for labels and icons). */
export function videoProvider(url: string | undefined): VideoProvider | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return isZoomHost(h) ? "zoom" : h === "meet.google.com" ? "meet" : null;
  } catch {
    return null;
  }
}

/** The meeting ID shown next to a saved link. */
export function videoMeetingId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const p = parseVideoLink(url);
  return p.ok ? p.link.meetingId : undefined;
}
