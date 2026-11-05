import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { classWindow, roomFor, type ClassWindow, type JoinTicket, type ParticipantMeta } from "@/lib/classroom";
import { blockedMessage, maskMatches, NAME_RULE, scanContact, type ContactKind } from "@/lib/domain/contact";
import { hasPermission } from "@/lib/permissions";
import type { Booking, User } from "@/lib/types";
import { auditDirect, notifyDirect } from "./auth";
import { db } from "./db";
import { env, liveVideoReady } from "./env";
import { closeRoom, mintToken } from "./livekit";
import { fileStamp, signedDownload, storePrivateBytes } from "./media";
import { checkImageBytes } from "./scan";

/*
 * The live classroom's server rules (see src/lib/classroom.ts for the time window and
 * src/server/livekit.ts for the media server). Every check happens here, before a token or file
 * leaves the server:
 *   - who may join a lesson's room: its tutor (host), the person who booked it, staff with
 *     bookings.manage (host, audited), and guests the host admitted from the guest link;
 *   - when: from 15 minutes before the start until 30 minutes after the end, unless the host ended it;
 *   - images put on the whiteboard and boards shared out of the class are read for contact details
 *     (the same check as message attachments) and refused if they carry any;
 *   - transcripts are stored with contact details masked.
 */

export class ClassError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface Lesson {
  booking: Pick<Booking, "id" | "tutorId" | "bookerId" | "childId" | "subject" | "status" | "startUtc" | "durationMin" | "mode">;
  tutorUserId: string | null;
  tutorName: string;
  bookerName: string;
  bookerRole: "student" | "parent";
  session: { startedAt: string | null; endedAt: string | null; guestCode: string | null } | null;
}

export type Role = "tutor" | "booker" | "staff";

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const GUEST_HOURS = 6;
const MAX_PUSHES_PER_CODE = 400;

export async function loadLesson(bookingId: string): Promise<Lesson | null> {
  if (!/^[\w-]{3,80}$/.test(bookingId)) return null;
  const sql = db();
  const [b] = await sql`select id, tutor_id, booker_id, child_id, subject, status, start_utc, duration_min, mode from public.bookings where id = ${bookingId}`;
  if (!b) return null;
  const [[tutor], [booker], [child], [cs]] = await Promise.all([
    sql`select id, first_name, last_name from public.users where tutor_id = ${b.tutor_id} limit 1`,
    sql`select first_name, last_name, role from public.users where id = ${b.booker_id}`,
    b.child_id ? sql`select first_name from public.children where id = ${b.child_id}` : Promise.resolve([]),
    sql`select started_at, ended_at, guest_code from public.class_sessions where booking_id = ${bookingId}`,
  ]);
  const bookerName = booker ? `${booker.first_name} ${String(booker.last_name ?? "").charAt(0)}.`.trim() : "Student";
  return {
    booking: {
      id: b.id, tutorId: b.tutor_id, bookerId: b.booker_id, childId: b.child_id ?? undefined, subject: b.subject, status: b.status,
      startUtc: iso(b.start_utc)!, durationMin: Number(b.duration_min), mode: b.mode,
    },
    tutorUserId: tutor?.id ?? null,
    tutorName: tutor ? `${tutor.first_name} ${tutor.last_name}`.trim() : "Tutor",
    bookerName: child?.first_name ? `${child.first_name} (with ${bookerName})` : bookerName,
    bookerRole: booker?.role === "parent" ? "parent" : "student",
    session: cs ? { startedAt: iso(cs.started_at), endedAt: iso(cs.ended_at), guestCode: cs.guest_code ?? null } : null,
  };
}

export function roleOf(user: User, lesson: Lesson): Role | null {
  if (user.tutorId && user.tutorId === lesson.booking.tutorId) return "tutor";
  if (user.id === lesson.booking.bookerId) return "booker";
  if (hasPermission(user, "bookings.manage")) return "staff";
  return null;
}

export const isHostRole = (r: Role | null) => r === "tutor" || r === "staff";
export const windowOf = (lesson: Lesson, now = Date.now()): ClassWindow => classWindow(lesson.booking, lesson.session?.endedAt, now);

function requireRole(user: User, lesson: Lesson, host = false): Role {
  const role = roleOf(user, lesson);
  if (!role) throw new ClassError("This lesson belongs to a different account.", 403);
  if (host && !isHostRole(role)) throw new ClassError("Only the tutor can do this.", 403);
  return role;
}

function notReady(): never {
  throw new ClassError("Live video for lessons isn't set up yet. Add the LiveKit settings (see docs/SUPABASE_SETUP.md, step 9).", 503);
}

function windowError(w: ClassWindow): never {
  if (w.state === "upcoming") throw new ClassError(`The classroom isn't open yet. ${w.label}.`, 403);
  if (w.state === "ended") throw new ClassError("This lesson has ended.", 403);
  throw new ClassError("This lesson isn't taking place, so its classroom is closed.", 403);
}

function metaFor(user: User, lesson: Lesson, role: Role): ParticipantMeta {
  if (role === "tutor") return { name: lesson.tutorName, role: "Tutor", isHost: true };
  if (role === "staff") return { name: `${user.firstName} (TutorLink staff)`, role: "Staff", isHost: true };
  return { name: lesson.bookerName, role: lesson.bookerRole === "parent" ? "Parent" : "Student", isHost: false };
}

/* ─── Joining ──────────────────────────────────────────────────────────────── */

export async function joinTicket(user: User, lesson: Lesson): Promise<JoinTicket> {
  if (!liveVideoReady()) notReady();
  const role = requireRole(user, lesson);
  const w = windowOf(lesson);
  if (!w.canJoin) windowError(w);
  const meta = metaFor(user, lesson, role);
  const room = roomFor(lesson.booking.id);
  if (meta.isHost) {
    // A host arriving is the class starting (first time only).
    await db()`insert into public.class_sessions (booking_id, started_at, started_by) values (${lesson.booking.id}, now(), ${user.id})
      on conflict (booking_id) do update set started_at = coalesce(public.class_sessions.started_at, now()), started_by = coalesce(public.class_sessions.started_by, excluded.started_by), updated_at = now()`;
  }
  if (role === "staff") await auditDirect(user.id, "classroom.staff_join", "booking", lesson.booking.id);
  const ttl = Math.ceil((w.closesAt - Date.now()) / 1000) + 600;
  const identity = `u-${user.id}`;
  return { token: await mintToken({ room, identity, meta, ttlSeconds: ttl }), wsUrl: env.livekitWsUrl, room, identity, me: meta, startMuted: false, closesAt: w.closesAt };
}

/** The host pressed "End class": nobody can join again, and everyone is disconnected. */
export async function endClass(user: User, lesson: Lesson): Promise<{ disconnected: boolean }> {
  requireRole(user, lesson, true);
  await db()`insert into public.class_sessions (booking_id, ended_at, ended_by) values (${lesson.booking.id}, now(), ${user.id})
    on conflict (booking_id) do update set ended_at = coalesce(public.class_sessions.ended_at, now()), ended_by = coalesce(public.class_sessions.ended_by, excluded.ended_by), updated_at = now()`;
  await auditDirect(user.id, "classroom.end", "booking", lesson.booking.id);
  return { disconnected: await closeRoom(roomFor(lesson.booking.id)) };
}

/** Rooms of lessons whose window is over are closed (people can't keep a free room open after the lesson). */
export async function closeFinishedClassrooms(): Promise<number> {
  const rows = await db()`
    update public.class_sessions cs set ended_at = now(), ended_by = 'system', updated_at = now()
    from public.bookings b
    where b.id = cs.booking_id and cs.started_at is not null and cs.ended_at is null
      and b.start_utc + make_interval(mins => b.duration_min + ${30}) < now()
    returning cs.booking_id`;
  for (const r of rows) await closeRoom(roomFor(r.booking_id));
  return rows.length;
}

/* ─── What the classroom and lesson pages show ─────────────────────────────── */

export async function classInfo(user: User, lesson: Lesson, origin: string) {
  const role = requireRole(user, lesson);
  const host = isHostRole(role);
  const w = windowOf(lesson);
  const [recap] = await db()`select (transcript is not null or summary is not null or jsonb_array_length(snapshots) > 0) as has from public.class_sessions where booking_id = ${lesson.booking.id}`;
  const [{ n: boards }] = await db()`select count(*)::int n from public.class_boards where booking_id = ${lesson.booking.id}`;
  const code = lesson.session?.guestCode ?? null;
  return {
    ready: liveVideoReady(),
    role,
    isHost: host,
    window: w,
    startedAt: lesson.session?.startedAt ?? null,
    endedAt: lesson.session?.endedAt ?? null,
    guestLink: host ? (code ? `${origin}/classroom/${lesson.booking.id}?g=${code}` : null) : undefined,
    hasRecap: !!recap?.has,
    boards,
  };
}

/* ─── Guests and the waiting room ──────────────────────────────────────────── */

export async function setGuestLink(user: User, lesson: Lesson, enabled: boolean, rotate: boolean): Promise<string | null> {
  requireRole(user, lesson, true);
  const current = lesson.session?.guestCode ?? null;
  const code = enabled ? (current && !rotate ? current : randomBytes(5).toString("hex")) : null;
  await db()`insert into public.class_sessions (booking_id, guest_code) values (${lesson.booking.id}, ${code})
    on conflict (booking_id) do update set guest_code = excluded.guest_code, updated_at = now()`;
  if (!enabled) await db()`update public.class_guests set status = 'denied', decided_by = ${user.id}, decided_at = now() where booking_id = ${lesson.booking.id} and status = 'pending'`;
  await auditDirect(user.id, enabled ? (rotate ? "classroom.guest_link_new" : "classroom.guest_link_on") : "classroom.guest_link_off", "booking", lesson.booking.id);
  return code;
}

const claimHash = (claimId: string) => createHash("sha256").update(`class-guest:${claimId}`).digest("hex");

/** A guest knocks. They get a claim secret to poll with, never a token, until the host admits them. */
export async function knock(lesson: Lesson, code: string, rawName: string): Promise<string> {
  if (!liveVideoReady()) notReady();
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) throw new ClassError("Please enter your name.");
  if (scanContact(name, "chat").found) throw new ClassError(NAME_RULE);
  const guestCode = lesson.session?.guestCode;
  if (!guestCode) throw new ClassError("Guest access is turned off for this lesson. Ask the tutor for a new link.", 403);
  if (guestCode !== code) throw new ClassError("This guest link has expired: the tutor made a newer one. Ask them for the current link.", 403);
  const w = windowOf(lesson);
  if (!w.canJoin) windowError(w);
  const [{ n }] = await db()`select count(*)::int n from public.class_guests where booking_id = ${lesson.booking.id} and status = 'pending' and created_at > now() - make_interval(hours => ${GUEST_HOURS})`;
  if (n >= 20) throw new ClassError("Too many people are waiting to join. Please try again in a few minutes.", 429);
  const claimId = randomBytes(18).toString("hex");
  await db()`insert into public.class_guests (booking_id, name, claim_hash) values (${lesson.booking.id}, ${name}, ${claimHash(claimId)})`;
  return claimId;
}

export type GuestPoll = { status: "pending" | "denied" | "expired" } | { status: "approved"; ticket: JoinTicket };

export async function pollGuest(claimId: string): Promise<GuestPoll> {
  if (!/^[a-f0-9]{36}$/.test(claimId)) return { status: "expired" };
  const [g] = await db()`select id, booking_id, name, status from public.class_guests where claim_hash = ${claimHash(claimId)} and created_at > now() - make_interval(hours => ${GUEST_HOURS})`;
  if (!g) return { status: "expired" };
  if (g.status !== "approved") return { status: g.status };
  const lesson = await loadLesson(g.booking_id);
  if (!lesson || !lesson.session?.guestCode) return { status: "expired" };
  const w = windowOf(lesson);
  if (!w.canJoin) return { status: "expired" };
  if (!liveVideoReady()) notReady();
  const room = roomFor(lesson.booking.id);
  const identity = `guest-${String(g.id).replace(/-/g, "").slice(0, 12)}`;
  const me: ParticipantMeta = { name: `${g.name} (guest)`, role: "Guest", isHost: false };
  const ttl = Math.ceil((w.closesAt - Date.now()) / 1000) + 600;
  return { status: "approved", ticket: { token: await mintToken({ room, identity, meta: me, ttlSeconds: ttl }), wsUrl: env.livekitWsUrl, room, identity, me, startMuted: false, closesAt: w.closesAt } };
}

export async function waitingGuests(user: User, lesson: Lesson) {
  requireRole(user, lesson, true);
  const rows = await db()`select id, name, created_at from public.class_guests where booking_id = ${lesson.booking.id} and status = 'pending' and created_at > now() - make_interval(hours => ${GUEST_HOURS}) order by created_at limit 50`;
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, since: iso(r.created_at)! }));
}

export async function decideGuest(user: User, lesson: Lesson, guestId: string, admit: boolean) {
  requireRole(user, lesson, true);
  if (!/^[0-9a-f-]{36}$/.test(guestId)) throw new ClassError("That request has expired.", 404);
  const rows = await db()`update public.class_guests set status = ${admit ? "approved" : "denied"}, decided_by = ${user.id}, decided_at = now()
    where id = ${guestId} and booking_id = ${lesson.booking.id} and status = 'pending' returning name`;
  if (!rows.length) throw new ClassError("That request has expired.", 404);
  await auditDirect(user.id, admit ? "classroom.guest_admit" : "classroom.guest_deny", "booking", lesson.booking.id, { guest: rows[0].name });
}

/* ─── Whiteboard images, shared boards and the snipping helper ─────────────── */

function decodeImage(dataUrl: string, maxBytes: number): { bytes: Buffer; type: string; ext: string } {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ClassError("That isn't an image.");
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length) throw new ClassError("That image is empty.");
  if (bytes.length > maxBytes) throw new ClassError("That image is too large. Try a smaller area.", 413);
  return { bytes, type: m[1], ext: m[1] === "image/jpeg" ? "jpg" : m[1].slice(6) };
}

async function flagLesson(userId: string, lesson: Lesson, kinds: ContactKind[], what: string) {
  const recipient = userId === lesson.booking.bookerId ? lesson.tutorUserId : lesson.booking.bookerId;
  await db()`insert into public.contact_flags (id, user_id, channel, source, context_id, recipient_id, kinds, excerpt, file_name)
    values (${`cfl_${randomBytes(6).toString("hex")}`}, ${userId}, 'lesson', 'file', ${lesson.booking.id}, ${recipient}, ${kinds}, ${`[${what} in the live classroom]`}, ${what})`.catch((e) =>
    console.error("[classroom] couldn't record a contact flag", (e as Error)?.message),
  );
}

/** Reads an image for contact details (OCR) and refuses it if it has any. */
async function checkImage(userId: string | null, lesson: Lesson, bytes: Buffer, what: string) {
  const check = await checkImageBytes(bytes);
  if (check.ok) return;
  if (check.reason === "contact") {
    if (userId) await flagLesson(userId, lesson, check.kinds, what);
    throw new ClassError(blockedMessage(check.kinds, "file"), 422);
  }
  throw new ClassError(check.error, 422);
}

/** How long a whiteboard image link stays valid: until the room closes, plus an hour. */
const linkSeconds = (lesson: Lesson) => Math.max(600, Math.min(12 * 3600, Math.ceil((windowOf(lesson).closesAt - Date.now()) / 1000) + 3600));

export async function storeBoardImage(user: User, lesson: Lesson, dataUrl: string): Promise<string> {
  requireRole(user, lesson, true);
  const img = decodeImage(dataUrl, 6 * 1024 * 1024);
  await checkImage(user.id, lesson, img.bytes, "whiteboard image");
  const path = `classroom/${lesson.booking.id}/paste-${fileStamp()}.${img.ext}`;
  await storePrivateBytes(path, img.bytes, img.type);
  return signedDownload(path, linkSeconds(lesson));
}

export async function shareBoard(user: User, lesson: Lesson, input: { title: string; image: string; recipients: string[] }) {
  requireRole(user, lesson, true);
  const img = decodeImage(input.image, 8 * 1024 * 1024);
  await checkImage(user.id, lesson, img.bytes, "shared whiteboard");
  const title = input.title.trim().slice(0, 120) || "Class whiteboard";
  if (scanContact(title, "chat").found) throw new ClassError(blockedMessage(scanContact(title, "chat").kinds, "note"), 422);
  const path = `classroom/${lesson.booking.id}/board-${fileStamp()}.${img.ext}`;
  await storePrivateBytes(path, img.bytes, img.type);
  const recipients = input.recipients.filter((r) => /^[\w-]{1,80}$/.test(r)).slice(0, 50);
  const [row] = await db()`insert into public.class_boards (booking_id, title, image_path, shared_by, shared_by_name, recipients)
    values (${lesson.booking.id}, ${title}, ${path}, ${user.id}, ${user.firstName}, ${recipients}) returning id, created_at`;
  if (user.id !== lesson.booking.bookerId) {
    await notifyDirect(lesson.booking.bookerId, { title: "A whiteboard from your lesson", body: `${user.firstName} shared "${title}" with you.`, href: `/dashboard/bookings/${lesson.booking.id}` });
  }
  return { id: row.id as string, title, createdAt: iso(row.created_at)! };
}

export async function listBoards(user: User, lesson: Lesson) {
  requireRole(user, lesson);
  const rows = await db()`select id, title, image_path, shared_by_name, created_at from public.class_boards where booking_id = ${lesson.booking.id} order by created_at desc limit 100`;
  return Promise.all(rows.map(async (r) => ({ id: r.id as string, title: r.title as string, sharedBy: r.shared_by_name as string, createdAt: iso(r.created_at)!, url: await signedDownload(r.image_path, 3600) })));
}

export async function deleteBoard(user: User, lesson: Lesson, id: string) {
  requireRole(user, lesson, true);
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new ClassError("That board doesn't exist.", 404);
  const rows = await db()`delete from public.class_boards where id = ${id} and booking_id = ${lesson.booking.id} returning id`;
  if (!rows.length) throw new ClassError("That board doesn't exist.", 404);
}

// No O/0 or I/1: the code is read off a screen and typed.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newPushCode() {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length] + (i === 3 ? "-" : "");
  return out;
}

/** The code the desktop snipping helper uses for this lesson's board. Re-opening the panel returns the same one. */
export async function pushCode(user: User, lesson: Lesson): Promise<{ code: string; expiresAt: string }> {
  requireRole(user, lesson, true);
  const w = windowOf(lesson);
  if (!w.canJoin) windowError(w);
  const [existing] = await db()`select code, expires_at from public.board_push_codes where booking_id = ${lesson.booking.id} and owner_id = ${user.id} and expires_at > now() order by expires_at desc limit 1`;
  if (existing) return { code: existing.code, expiresAt: iso(existing.expires_at)! };
  const expires = new Date(Math.min(Date.now() + 12 * 3600_000, w.closesAt + 30 * 60_000));
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPushCode();
    const rows = await db()`insert into public.board_push_codes (code, booking_id, owner_id, expires_at) values (${code}, ${lesson.booking.id}, ${user.id}, ${expires}) on conflict do nothing returning code`;
    if (rows.length) return { code, expiresAt: expires.toISOString() };
  }
  throw new ClassError("Couldn't make a code. Please try again.", 503);
}

export const validPushCode = (code: string) => /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code);

/** The helper (no session; the code is its only credential) posts one image. */
export async function acceptPush(code: string, dataUrl: string): Promise<void> {
  if (!validPushCode(code)) throw new ClassError("That code doesn't look right.", 400);
  const img = decodeImage(dataUrl, 8 * 1024 * 1024);
  // Claim a slot and check the code in one step, so parallel requests can't pass the cap.
  const [linked] = await db()`update public.board_push_codes set used = used + 1 where code = ${code} and expires_at > now() and used < ${MAX_PUSHES_PER_CODE} returning booking_id, owner_id`;
  if (!linked) throw new ClassError("That code isn't valid any more. Open the Snip panel in the classroom for a new one.", 403);
  const lesson = await loadLesson(linked.booking_id);
  if (!lesson) throw new ClassError("That lesson doesn't exist any more.", 404);
  await checkImage(linked.owner_id, lesson, img.bytes, "snip from the desktop helper");
  const path = `classroom/${lesson.booking.id}/snip-${fileStamp()}.${img.ext}`;
  await storePrivateBytes(path, img.bytes, img.type);
  await db()`insert into public.board_pushes (code, image_path) values (${code}, ${path})`;
}

/** The host's board collects what the helper sent (needs the host's own session, so a leaked code can't read). */
export async function collectPushes(user: User, code: string): Promise<{ id: string; url: string }[]> {
  if (!validPushCode(code)) throw new ClassError("That code doesn't look right.");
  const [linked] = await db()`select booking_id from public.board_push_codes where code = ${code} and owner_id = ${user.id}`;
  if (!linked) throw new ClassError("That isn't your code.", 403);
  const lesson = await loadLesson(linked.booking_id);
  if (!lesson) return [];
  const rows = await db()`update public.board_pushes set consumed = true where id in (
      select id from public.board_pushes where code = ${code} and consumed = false order by created_at limit 10 for update skip locked)
    returning id, image_path, created_at`;
  const sorted = [...rows].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  return Promise.all(sorted.map(async (r) => ({ id: r.id as string, url: await signedDownload(r.image_path, linkSeconds(lesson)) })));
}

export async function pushCodeLesson(code: string): Promise<boolean> {
  if (!validPushCode(code)) return false;
  const [row] = await db()`select 1 from public.board_push_codes where code = ${code} and expires_at > now()`;
  return !!row;
}

/* ─── Transcript, snapshots and the recap ──────────────────────────────────── */

const maskText = (text: string) => {
  const found = scanContact(text, "chat");
  return found.found ? maskMatches(text, found.matches) : text;
};

/** Saves the host's transcript (contact details masked). Snapshots and the AI recap are done afterwards. */
export async function saveTranscript(user: User, lesson: Lesson, transcript: string): Promise<void> {
  requireRole(user, lesson, true);
  const masked = transcript
    .split("\n")
    .map((line) => maskText(line))
    .join("\n")
    .slice(0, 200_000);
  await db()`insert into public.class_sessions (booking_id, transcript) values (${lesson.booking.id}, ${masked || null})
    on conflict (booking_id) do update set transcript = coalesce(nullif(${masked}, ''), public.class_sessions.transcript), updated_at = now()`;
}

/** Stores snapshot images (each read for contact details first) next to the transcript. Runs after the response. */
export async function saveSnapshots(user: User, lesson: Lesson, snapshots: { title: string; image: string; at: string }[]): Promise<number> {
  const kept: { path: string; title: string; at: string }[] = [];
  for (const s of snapshots.slice(0, 20)) {
    try {
      const img = decodeImage(s.image, 4 * 1024 * 1024);
      const check = await checkImageBytes(img.bytes);
      if (!check.ok) {
        if (check.reason === "contact") await flagLesson(user.id, lesson, check.kinds, "class snapshot");
        continue;
      }
      const path = `classroom/${lesson.booking.id}/snap-${fileStamp()}.${img.ext}`;
      await storePrivateBytes(path, img.bytes, img.type);
      kept.push({ path, title: s.title.slice(0, 80), at: s.at.slice(0, 40) });
    } catch (e) {
      console.warn("[classroom] snapshot skipped:", (e as Error)?.message);
    }
  }
  if (kept.length) {
    await db()`update public.class_sessions set snapshots = snapshots || ${db().json(kept)}::jsonb, updated_at = now() where booking_id = ${lesson.booking.id}`;
  }
  return kept.length;
}

/** An optional AI recap of the (masked) transcript. Only with GEMINI_API_KEY; nothing is sent anywhere otherwise. */
export async function summarise(lesson: Lesson): Promise<void> {
  const [row] = await db()`select transcript from public.class_sessions where booking_id = ${lesson.booking.id}`;
  const transcript = (row?.transcript as string | null) ?? "";
  if (!env.geminiKey || transcript.trim().length < 40) return;
  const prompt = `You help a tutor review an online lesson. From the transcript below (one line per caption, "[time] Speaker: text"), write a short recap in plain English with these headings:
1. Summary (2-3 sentences)
2. What was taught (bullet points)
3. Homework and next steps (who does what)
4. Topics, in order (with the time they started, when shown)
Do not include phone numbers, email addresses or social media handles.

Transcript:
${transcript.slice(0, 15_000)}`;
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("[classroom] AI recap failed:", res.status);
      return;
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (text) await db()`update public.class_sessions set summary = ${maskText(text).slice(0, 20_000)}, summary_at = now(), updated_at = now() where booking_id = ${lesson.booking.id}`;
  } catch (e) {
    console.error("[classroom] AI recap failed:", (e as Error)?.message);
  }
}

export async function recapFor(user: User, lesson: Lesson) {
  requireRole(user, lesson);
  const [row] = await db()`select transcript, summary, summary_at, snapshots from public.class_sessions where booking_id = ${lesson.booking.id}`;
  if (!row) return { transcript: null, summary: null, summaryAt: null, snapshots: [], aiRecap: !!env.geminiKey };
  const snaps = Array.isArray(row.snapshots) ? (row.snapshots as { path: string; title: string; at: string }[]) : [];
  return {
    transcript: (row.transcript as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    summaryAt: iso(row.summary_at),
    snapshots: await Promise.all(snaps.map(async (s) => ({ title: s.title, at: s.at, url: await signedDownload(s.path, 3600) }))),
    aiRecap: !!env.geminiKey,
  };
}

export async function deleteRecap(user: User, lesson: Lesson) {
  requireRole(user, lesson, true);
  await db()`update public.class_sessions set transcript = null, summary = null, summary_at = null, snapshots = '[]'::jsonb, updated_at = now() where booking_id = ${lesson.booking.id}`;
}
