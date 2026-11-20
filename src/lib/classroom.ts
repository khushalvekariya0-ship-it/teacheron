import type { Booking } from "./types";

/*
 * The live classroom's shared rules — used by the server (who may get a media token, and when) and by
 * the pages (what button to show), so the two can never disagree.
 *
 * A lesson's room opens EARLY_MINUTES before it starts and closes GRACE_MINUTES after it ends, or as
 * soon as the host presses "End class". Only confirmed / running lessons have a room.
 */

export const EARLY_MINUTES = 15;
export const GRACE_MINUTES = 30;

/** LiveKit room for a lesson. */
export const roomFor = (bookingId: string) => `lesson-${bookingId}`;
export const bookingOfRoom = (room: string) => (/^lesson-([\w-]{3,80})$/.exec(room)?.[1] ?? null);

export type ClassState = "upcoming" | "open" | "ended" | "closed";

export interface ClassWindow {
  state: ClassState;
  canJoin: boolean;
  opensAt: number;
  closesAt: number;
  /** Minutes until the lesson starts (negative once it has). */
  minutesUntil: number;
  label: string;
}

const LIVE_STATUSES = new Set(["confirmed", "in_progress", "completed"]);

export function classWindow(b: Pick<Booking, "startUtc" | "durationMin" | "status" | "mode">, endedAt: string | null | undefined, now: number): ClassWindow {
  const start = Date.parse(b.startUtc);
  const end = start + b.durationMin * 60_000;
  const opensAt = start - EARLY_MINUTES * 60_000;
  const closesAt = end + GRACE_MINUTES * 60_000;
  const minutesUntil = Math.round((start - now) / 60_000);
  const base = { opensAt, closesAt, minutesUntil };
  if (b.mode !== "online" || !LIVE_STATUSES.has(b.status) || (b.status === "completed" && now > closesAt)) {
    return { ...base, state: "closed", canJoin: false, label: b.mode !== "online" ? "In person" : "Not taking place" };
  }
  if (endedAt) return { ...base, state: "ended", canJoin: false, label: "Ended" };
  if (now < opensAt) return { ...base, state: "upcoming", canJoin: false, label: countdown(minutesUntil) };
  if (now > closesAt) return { ...base, state: "ended", canJoin: false, label: "Ended" };
  return { ...base, state: "open", canJoin: true, label: minutesUntil > 0 ? `Starts in ${minutesUntil} min` : "Live now" };
}

export function countdown(minutes: number): string {
  if (minutes < 60) return `Opens ${EARLY_MINUTES} min before · starts in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Starts in ${hours} hr${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `Starts in ${days} day${days === 1 ? "" : "s"}`;
}

/** What a participant's LiveKit metadata says about them (minted by the server into their token). */
export interface ParticipantMeta {
  name: string;
  role: "Tutor" | "Student" | "Parent" | "Staff" | "Guest";
  isHost: boolean;
}

export function readMeta(metadata: string | undefined | null): ParticipantMeta | null {
  try {
    const m = JSON.parse(metadata || "{}") as Partial<ParticipantMeta>;
    return typeof m.name === "string" ? { name: m.name, role: (m.role ?? "Student") as ParticipantMeta["role"], isHost: !!m.isHost } : null;
  } catch {
    return null;
  }
}

/** What GET /api/classroom/join (and the guest poll) hands the browser. */
export interface JoinTicket {
  /** Set when this person's audio is paused in this class (contact details were shared): until when, in ms. */
  audioPausedUntil?: number;
  token: string;
  wsUrl: string;
  room: string;
  identity: string;
  me: ParticipantMeta;
  startMuted: boolean;
  /** Epoch ms the room closes (the host can end it sooner). */
  closesAt: number;
}

/*
 * Data-channel topics. Whiteboard strokes and chat pings travel peer to peer through the media server;
 * nothing in them is trusted beyond what a receiver can check (host-ness comes from server-minted metadata).
 */
export const TOPIC = {
  board: "wb", // full board from the host (chunked when large)
  stroke: "wb-stroke", // one appended stroke
  sync: "wb-sync", // "someone send me the board"
  grant: "wb-grant", // host hands drawing rights to identities
  clear: "wb-clear", // host wiped the board
  update: "wb-update", // one image moved / resized
  remove: "wb-delete", // one stroke removed
  chat: "chat-ping", // "a new message is saved, refresh" (the message itself goes through the moderated inbox)
  caption: "caption", // one finished caption line
  safety: "safety", // contact details were caught (from the server, or the person's own browser about itself)
  lang: "class-lang", // the host sets the language speech is checked (and captioned) in
} as const;

/** What the server tells everyone in the room when contact details are caught in class. */
export interface SafetyMessage {
  type: typeof TOPIC.safety;
  /** The person's name and room identity. */
  name: string;
  identity: string;
  source: "speech" | "board" | "screen" | "camera";
  kinds: ("phone" | "email" | "social" | "link" | "request" | "address")[];
  /** How many times in this lesson, and where that is on the ladder (Admin → Chat safety → Settings). */
  strikes: number;
  removed: boolean;
  level?: "warning" | "strong" | "muted" | "removed";
  /** With level "muted": until when the person's audio doesn't reach the others. */
  mutedUntil?: string;
  muteAt?: number;
  muteMinutes?: number;
}

/** Times contact details may be caught in one lesson before the person is removed from the class. */
export const LIVE_STRIKE_LIMIT = 3;

/** Lessons someone may be removed from (within LIVE_REMOVAL_DAYS) before their account is paused for review. */
export const LIVE_REMOVALS_TO_SUSPEND = 2;
export const LIVE_REMOVAL_DAYS = 90;
