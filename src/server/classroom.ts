import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { classWindow, LIVE_REMOVAL_DAYS, roomFor, TOPIC, type ClassWindow, type JoinTicket, type ParticipantMeta, type SafetyMessage } from "@/lib/classroom";
import { blockedMessage, maskMatches, NAME_RULE, scanContact, speechContact, type ContactKind } from "@/lib/domain/contact";
import { hasPermission, isStaff } from "@/lib/permissions";
import { SITE } from "@/lib/site";
import type { Booking, User } from "@/lib/types";
import { auditDirect, notifyDirect } from "./auth";
import { db } from "./db";
import { env, liveVideoReady } from "./env";
import { broadcastToRoom, closeRoom, mintToken, removeFromRoom, setAudioAllowed } from "./livekit";
import { contactSafety } from "./safety-settings";
import { fileStamp, signedDownload, storePrivateBytes } from "./media";
import { checkImageBytes, checkScreenFrame } from "./scan";
import { readTextWithAI } from "./ai-read";
import { emailReady, escapeHtml, sendEmail } from "./email";
import { alertStaff, shortName } from "./staff-alerts";

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
  const safety = await contactSafety();
  if (role !== "staff" && safety.removeAt > 0 && (await liveStrikes(user.id, lesson.booking.id)) >= safety.removeAt) {
    throw new ClassError("You were removed from this class because contact details were shared in it. Our team will review it.", 403);
  }
  // A paused person who rejoins gets a pass without the microphone, so leaving doesn't undo the pause.
  const paused = role !== "staff" ? await activeRestriction(user.id, lesson.booking.id) : null;
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
  return {
    token: await mintToken({ room, identity, meta, ttlSeconds: ttl, noMicrophone: !!paused }), wsUrl: env.livekitWsUrl, room, identity, me: meta, startMuted: false, closesAt: w.closesAt,
    ...(paused ? { audioPausedUntil: Date.parse(paused.endsAt) } : {}),
  };
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
  const [u] = await db()`select first_name, last_name from public.users where id = ${userId}`.catch(() => []);
  await alertStaff("reports.moderate", { title: `Contact details blocked: ${shortName(u?.first_name, u?.last_name)}`, body: `A picture put on the class whiteboard (${what}).`, href: `/admin/chat-safety?user=${userId}` });
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

/* ─── Keeping contact details out of the live class ───────────────────────────
 * Each person's own browser checks what they say (speech recognition, while their microphone is on),
 * what they draw on the whiteboard and what they share on screen (pictures read here with OCR). When
 * contact details are found, it's recorded like a blocked message (Admin → Chat safety), everyone in
 * the room is told, and the ladder in caughtInClass applies (warning, stronger warning, audio pause; removal
 * and pausing the account only when switched on in Admin → Chat safety → Settings).
 */

type LiveSource = "speech" | "board" | "screen" | "camera";
const LIVE_WHERE: Record<LiveSource, string> = { speech: "Said out loud in class", board: "Written on the class whiteboard", screen: "Shown on a shared screen in class", camera: "Shown on camera in class" };

/** How many times this person's contact details were caught in this lesson's class (dismissed ones don't count). */
export async function liveStrikes(userId: string, bookingId: string): Promise<number> {
  const [{ n }] = await db()`select count(*)::int n from public.contact_flags
    where channel = 'lesson' and context_id = ${bookingId} and user_id = ${userId} and source in ('speech', 'board', 'screen', 'camera') and status <> 'dismissed'`;
  return Number(n);
}

/**
 * Until when this person can't share their screen / draw on the whiteboard in this lesson: from the
 * shareBlockAt-th catch there, for shareBlockMinutes after the last one (Admin → Chat safety → Settings).
 * Worked out from the catches, so dismissing a wrong catch in Chat safety lifts it.
 */
export async function sharingBlockedUntil(userId: string, bookingId: string, source: "screen" | "board"): Promise<string | null> {
  const s = await contactSafety();
  if (!s.shareBlockAt) return null;
  const [r] = await db()`select count(*)::int n, max(created_at) last from public.contact_flags
    where channel = 'lesson' and context_id = ${bookingId} and user_id = ${userId} and source = ${source} and status <> 'dismissed'`;
  if (!r || Number(r.n) < s.shareBlockAt || !r.last) return null;
  const until = new Date(new Date(r.last as string).getTime() + s.shareBlockMinutes * 60_000);
  return until.getTime() > Date.now() ? until.toISOString() : null;
}

/** This person's current audio pause in this lesson, if any. */
export async function activeRestriction(userId: string, bookingId: string): Promise<{ id: string; endsAt: string } | null> {
  const [r] = await db()`select id, ends_at from public.class_restrictions
    where booking_id = ${bookingId} and user_id = ${userId} and lifted_at is null and ends_at > now() order by ends_at desc limit 1`;
  return r ? { id: String(r.id), endsAt: new Date(r.ends_at as string).toISOString() } : null;
}

/** In-app and email alert to everyone who moderates chat safety. */
async function alertModerators(n: { title: string; body: string; href: string }, origin: string) {
  const mods = await db()`select id from public.users where status = 'active' and role in ('admin', 'support') and 'reports.moderate' = any(permissions)`;
  for (const m of mods) await notifyDirect(String(m.id), n, origin).catch(() => {});
}

const clockUtc = (iso: string) => new Date(iso).toISOString().slice(11, 16) + " UTC";

/**
 * Contact details caught in class. The ladder (Admin → Chat safety → Settings): a warning; from
 * strongWarningAt a stronger one and moderators are told; from muteAt the person's audio doesn't reach the
 * others for muteMinutes (LiveKit enforces it, and a rejoin gets a pass without the microphone); removal
 * (removeAt) and pausing the account (pauseAccountAfterRemovals) only when switched on.
 */
async function caughtInClass(user: User, lesson: Lesson, source: LiveSource, kinds: ContactKind[], excerpt: string, origin: string, detector: "speech" | "ocr" | "qr" | "ai") {
  const s = await contactSafety();
  const recipient = user.id === lesson.booking.bookerId ? lesson.tutorUserId : lesson.booking.bookerId;
  await db()`insert into public.contact_flags (id, user_id, channel, source, context_id, recipient_id, kinds, excerpt, detector)
    values (${`cfl_${randomBytes(6).toString("hex")}`}, ${user.id}, 'lesson', ${source}, ${lesson.booking.id}, ${recipient}, ${kinds}, ${excerpt.slice(0, 300)}, ${detector})`;
  const strikes = await liveStrikes(user.id, lesson.booking.id);
  const level: SafetyMessage["level"] =
    s.removeAt > 0 && strikes >= s.removeAt ? "removed" : s.muteAt > 0 && strikes >= s.muteAt ? "muted" : strikes >= s.strongWarningAt ? "strong" : "warning";
  const removed = level === "removed";
  // For the server log (no names or words): which check caught what, and where the ladder is.
  console.info(`[class-safety] ${source} caught ${kinds.join("+")} · ${strikes} (${level}) · ${lesson.booking.id}`);
  const role = roleOf(user, lesson);
  const name = role ? metaFor(user, lesson, role).name : user.firstName;
  const identity = `u-${user.id}`;
  const room = roomFor(lesson.booking.id);
  let mutedUntil: string | undefined;
  if (level === "muted") {
    const until = new Date(Date.now() + s.muteMinutes * 60_000);
    const current = await activeRestriction(user.id, lesson.booking.id);
    if (current && new Date(current.endsAt) >= until) mutedUntil = current.endsAt;
    else if (current) {
      await db()`update public.class_restrictions set ends_at = ${until} where id = ${current.id}`;
      mutedUntil = until.toISOString();
    } else {
      await db()`insert into public.class_restrictions (id, booking_id, user_id, kind, reason, ends_at)
        values (${`crs_${randomBytes(6).toString("hex")}`}, ${lesson.booking.id}, ${user.id}, 'audio', ${`Contact details caught ${strikes} times (${LIVE_WHERE[source].toLowerCase()})`}, ${until})`;
      mutedUntil = until.toISOString();
    }
  }
  const message: SafetyMessage = { type: TOPIC.safety, name, identity, source, kinds, strikes, removed, level, mutedUntil, muteAt: s.muteAt, muteMinutes: s.muteMinutes };
  // LiveKit Cloud can take several seconds for a room people are in, so the room is told (and the audio
  // paused, or the person removed) after this answer goes back; the person's own page shows the warning
  // from the answer and tells the others itself straight away.
  after(async () => {
    await broadcastToRoom(room, message);
    if (level === "muted") await setAudioAllowed(room, identity, false);
    if (!removed) return;
    // Their own page leaves by itself 1.5 s after the answer and shows why; this is for a page that doesn't.
    await new Promise((done) => setTimeout(done, 3000));
    await removeFromRoom(room, identity);
  });
  const who = shortName(user.firstName, user.lastName);
  await alertStaff("reports.moderate", {
    title: removed ? `Removed from a lesson: ${who}` : level === "muted" ? `Audio paused in a lesson: ${who}` : `Contact details blocked: ${who}`,
    body: `${LIVE_WHERE[source]} (${kinds.join(", ")}). ${strikes} in this lesson${mutedUntil ? `; audio paused until ${clockUtc(mutedUntil)}` : ""}.`,
    href: `/admin/chat-safety?user=${user.id}`,
  });
  if (level === "strong" && strikes === s.strongWarningAt) {
    await alertModerators({ title: "Contact details shared again in a lesson", body: `${name} tried to share contact details ${strikes} times in a lesson (${LIVE_WHERE[source].toLowerCase()}). Review it in Chat safety.`, href: `/admin/chat-safety?user=${user.id}` }, origin);
  }
  if (level === "muted") {
    await notifyDirect(
      user.id,
      { title: "Your audio was paused in a lesson", body: `Contact details were caught ${strikes} times, so the others can't hear you until ${clockUtc(mutedUntil!)}. If this was a mistake, use "Ask for a review" in the class.`, href: `/dashboard/bookings/${lesson.booking.id}` },
      origin,
    );
    await alertModerators({ title: "Audio paused in a lesson", body: `${name}'s audio was paused for ${s.muteMinutes} minutes after contact details were caught ${strikes} times (${LIVE_WHERE[source].toLowerCase()}). You can lift it in Chat safety.`, href: `/admin/chat-safety?user=${user.id}` }, origin);
  }
  if (removed) {
    const until = new Date(Date.now() + 24 * 3_600_000).toISOString();
    await db()`update public.users set chat_moderation = coalesce(chat_moderation, '{}'::jsonb) || ${db().json({ restrictedUntil: until, restrictionReason: "Shared contact details in a lesson", restrictedBy: "system" })} where id = ${user.id}`;
    await notifyDirect(
      user.id,
      { title: "Removed from a lesson", body: `Contact details were caught ${strikes} times in your lesson, so you were removed from the class and your messaging is paused for 24 hours. Keep lessons, contact and payments on TutorLink.`, href: "/dashboard/messages" },
      origin,
    );
    await alertModerators({ title: "Contact details shared in a lesson", body: `${name} was removed from a lesson after contact details were caught ${strikes} times (${LIVE_WHERE[source].toLowerCase()}). Review it in Chat safety.`, href: "/admin/chat-safety" }, origin);
  }
  const suspended = removed && s.pauseAccountAfterRemovals > 0 && !isStaff(user) ? await pauseRepeatOffender(user, name, origin, s.pauseAccountAfterRemovals, s.removeAt) : false;
  return { strikes, level, removed, suspended, mutedUntil };
}

/**
 * Removed from `limit` lessons within LIVE_REMOVAL_DAYS (only when switched on in the settings): the account
 * is paused (suspended) until staff review it in Admin → Users. The person is emailed first.
 */
async function pauseRepeatOffender(user: User, name: string, origin: string, limit: number, removeAt: number): Promise<boolean> {
  const [{ n }] = await db()`select count(*)::int n from (
      select context_id from public.contact_flags
       where user_id = ${user.id} and channel = 'lesson' and source in ('speech', 'board', 'screen', 'camera') and status <> 'dismissed'
         and created_at > now() - make_interval(days => ${LIVE_REMOVAL_DAYS})
       group by context_id having count(*) >= ${removeAt}) removals`;
  const lessons = Number(n);
  if (lessons < limit) return false;
  if (emailReady() && user.email) {
    const text = `Hi ${user.firstName},\n\nYou were removed from ${lessons} lessons for sharing contact details, so your ${SITE.name} account is paused until our team reviews it. We'll email you when it's done. Phone numbers, emails, social media and payments outside ${SITE.name} aren't allowed in lessons or messages.\n\n— ${SITE.name}`;
    await sendEmail({ to: user.email, subject: `Your ${SITE.name} account is paused for review`, text, html: text.split("\n\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("") }).catch(() => {});
  }
  await db()`update public.users set status = 'suspended' where id = ${user.id} and status = 'active'`;
  await auditDirect(user.id, "user.suspend", "user", user.id, { reason: `Automatic: removed from ${lessons} lessons for sharing contact details` });
  await alertModerators({ title: "Account paused for review", body: `${name} was removed from ${lessons} lessons for sharing contact details, so their account was paused. Reactivate it or keep it suspended in Admin → Users.`, href: `/admin/users?id=${user.id}` }, origin);
  return true;
}

/** The person's own browser heard contact details in what they said. Only the masked text is sent. */
export async function reportSpeech(user: User, lesson: Lesson, kinds: ContactKind[], excerpt: string, origin: string) {
  requireRole(user, lesson);
  if (!windowOf(lesson).canJoin) throw new ClassError("This class isn't open.", 403);
  if (!kinds.length) throw new ClassError("Nothing to record.");
  const s = await contactSafety();
  if (!s.voice) return { found: false as const };
  // While their audio is paused nobody hears them, so nothing was shared.
  if (await activeRestriction(user.id, lesson.booking.id)) return { found: false as const, paused: true };
  const clean = (speechContact(excerpt)?.masked ?? excerpt).trim().slice(0, 200);
  return { found: true as const, kinds, ...(await caughtInClass(user, lesson, "speech", kinds, `${LIVE_WHERE.speech}: "${clean}"`, origin, "speech")) };
}

/** The person's own page when their pause is over: their audio may reach the others again. */
export async function endOwnPause(user: User, lesson: Lesson) {
  requireRole(user, lesson);
  const [r] = await db()`select id, ends_at from public.class_restrictions where booking_id = ${lesson.booking.id} and user_id = ${user.id} and lifted_at is null order by ends_at desc limit 1`;
  if (r && new Date(r.ends_at as string).getTime() > Date.now()) return { paused: true as const, until: new Date(r.ends_at as string).toISOString() };
  if (r) await db()`update public.class_restrictions set lifted_at = now(), lifted_by = 'system' where id = ${r.id} and lifted_at is null`;
  const room = roomFor(lesson.booking.id);
  after(() => setAudioAllowed(room, `u-${user.id}`, true));
  return { paused: false as const };
}

/** Staff end a pause early (Admin → Chat safety); an open appeal about it is answered. */
export async function liftRestriction(staff: User, restrictionId: string, note: string, origin: string) {
  if (!hasPermission(staff, "reports.moderate")) throw new ClassError("You don't have permission to lift class restrictions.", 403);
  const [r] = await db()`update public.class_restrictions set lifted_at = now(), lifted_by = ${staff.id} where id = ${restrictionId} and lifted_at is null returning booking_id, user_id`;
  if (!r) throw new ClassError("That restriction has already ended.", 404);
  const bookingId = String(r.booking_id), userId = String(r.user_id);
  after(() => setAudioAllowed(roomFor(bookingId), `u-${userId}`, true));
  const clean = maskText(note.trim()).slice(0, 500);
  await db()`update public.safety_appeals set status = 'accepted', decided_by = ${staff.id}, decided_at = now(), decision_note = ${clean || null} where restriction_id = ${restrictionId} and status = 'open'`;
  await auditDirect(staff.id, "classroom.restriction_lift", "user", userId, { restrictionId, ...(clean ? { note: clean } : {}) });
  await notifyDirect(userId, { title: "Your audio is back in the lesson", body: "TutorLink's team reviewed it and lifted the pause.", href: `/dashboard/bookings/${bookingId}` }, origin);
}

/** Pauses whose time is up (the scheduler; the person's own page normally lifts its pause first). */
export async function liftExpiredRestrictions(): Promise<number> {
  const rows = await db()`update public.class_restrictions set lifted_at = now(), lifted_by = 'system' where lifted_at is null and ends_at <= now() returning booking_id, user_id`;
  for (const r of rows) await setAudioAllowed(roomFor(String(r.booking_id)), `u-${r.user_id}`, true);
  return rows.length;
}

/** "Ask for a review" in the class: an appeal against this lesson's audio pause (moderators are told). */
export async function appealFromClass(user: User, lesson: Lesson, note: string, origin: string) {
  requireRole(user, lesson);
  const [r] = await db()`select id from public.class_restrictions where booking_id = ${lesson.booking.id} and user_id = ${user.id} order by created_at desc limit 1`;
  if (!r) throw new ClassError("There's nothing to review in this class.");
  const [open] = await db()`select id from public.safety_appeals where restriction_id = ${r.id} and status = 'open'`;
  if (open) throw new ClassError("You've already asked for a review. Our team will look at it.");
  const clean = maskText(note.trim()).slice(0, 1000);
  await db()`insert into public.safety_appeals (id, user_id, restriction_id, note) values (${`apl_${randomBytes(6).toString("hex")}`}, ${user.id}, ${r.id}, ${clean})`;
  await alertModerators({ title: "Review asked: audio pause in a lesson", body: `${shortName(user.firstName, user.lastName)} says the pause was a mistake${clean ? `: "${clean.slice(0, 160)}"` : "."} Review it in Chat safety.`, href: `/admin/chat-safety?user=${user.id}` }, origin);
}

/** Deletes protection records older than the retention period (Admin → Chat safety → Settings). */
export async function forgetOldSafetyRecords(): Promise<number> {
  const s = await contactSafety();
  const days = s.retentionDays;
  const appeals = await db()`delete from public.safety_appeals where status <> 'open' and created_at < now() - make_interval(days => ${days}) returning id`;
  const restrictions = await db()`delete from public.class_restrictions where lifted_at is not null and created_at < now() - make_interval(days => ${days}) returning id`;
  const flags = await db()`delete from public.contact_flags where status <> 'open' and created_at < now() - make_interval(days => ${days}) returning id`;
  return appeals.length + restrictions.length + flags.length;
}

/**
 * Contact details in a picture from the class: read by the built-in OCR and, when GEMINI_API_KEY is set,
 * by Gemini too (handwriting, Gujarati / Hindi digits); TutorLink's own rules decide on what was read.
 * An unreadable picture is let through: the check must never block the lesson itself.
 */
async function readClassPicture(bytes: Buffer, mimeType: string, aiReading: boolean, aiKey?: string): Promise<{ kinds: ContactKind[]; detector: "ocr" | "qr" | "ai" }> {
  // Gemini gets 6 s: the whiteboard waits for this answer before others see a drawing.
  const [ocr, ai] = await Promise.all([checkImageBytes(bytes), aiReading ? readTextWithAI(bytes, mimeType, { key: aiKey, timeoutMs: 6_000 }) : Promise.resolve(null)]);
  const kinds = new Set<ContactKind>(!ocr.ok && ocr.reason === "contact" ? ocr.kinds : []);
  let detector: "ocr" | "qr" | "ai" = !ocr.ok && ocr.reason === "contact" && ocr.via === "qr" ? "qr" : "ocr";
  if (ai) {
    const fromAi = scanContact(ai, "file").kinds;
    if (fromAi.length && !kinds.size) detector = "ai";
    for (const k of fromAi) kinds.add(k);
  }
  return { kinds: [...kinds], detector };
}

/** A picture of what the person drew on the whiteboard, a frame of their shared screen or of their camera. */
export async function checkClassImage(user: User, lesson: Lesson, source: "board" | "screen" | "camera", dataUrl: string, origin: string, handwriting = "", written: ("email" | "social")[] = []) {
  requireRole(user, lesson);
  if (!windowOf(lesson).canJoin) throw new ClassError("This class isn't open.", 403);
  const s = await contactSafety();
  if (source === "camera" ? !s.camera : !s.images) return { found: false as const };
  if (source === "board" && !s.whiteboard) return { found: false as const };
  // Drawing is blocked for now after repeated catches on the whiteboard: the drawing isn't shown.
  if (source === "board") {
    const blockedUntil = await sharingBlockedUntil(user.id, lesson.booking.id, "board");
    if (blockedUntil) return { found: false as const, blockedUntil };
  }
  const img = decodeImage(dataUrl, 3 * 1024 * 1024);
  const read = await readClassPicture(img.bytes, img.type, s.aiReading, `${lesson.booking.id}:${source}`);
  // Digits the person's own browser read in their handwriting (whiteboard, shared screen): TutorLink's rules decide on them too.
  const digits = handwriting.replace(/\?/g, "");
  for (const k of written) if (!read.kinds.includes(k)) read.kinds.push(k);
  if (digits.length >= 10) {
    for (const k of scanContact(digits, "file").kinds) if (!read.kinds.includes(k)) read.kinds.push(k);
  }
  if (!read.kinds.length) return { found: false as const };
  const caught = await caughtInClass(user, lesson, source, read.kinds, `[${LIVE_WHERE[source]}]`, origin, read.detector);
  const blockedUntil = source === "board" ? await sharingBlockedUntil(user.id, lesson.booking.id, "board") : null;
  return { found: true as const, kinds: read.kinds, ...caught, ...(blockedUntil ? { blockedUntil } : {}) };
}

/**
 * One frame of a shared screen, checked BEFORE anyone else sees it: the sharer's page sends out only frames
 * this says are clean, or frames whose contact details it blacked out at `boxes` and had checked again.
 * Digits the sharer's own browser read in handwriting on the frame count too; they have no place to black
 * out, so the page pauses the share instead (`maskable` false). `record`: the first catch while sharing is
 * recorded like any other catch (warnings, the ladder); the frames after it aren't counted again.
 * Nothing read from the frame is stored.
 */
export async function checkSharedScreenFrame(user: User, lesson: Lesson, dataUrl: string, origin: string, record: boolean, handwriting = "") {
  requireRole(user, lesson);
  if (!windowOf(lesson).canJoin) throw new ClassError("This class isn't open.", 403);
  const s = await contactSafety();
  if (!s.images || !s.screenShare) return { checked: false as const, found: false as const };
  // Sharing is blocked for now after repeated catches on this person's screen: the page stops the share.
  const blocked = await sharingBlockedUntil(user.id, lesson.booking.id, "screen");
  if (blocked) return { checked: true as const, found: false as const, blockedUntil: blocked };
  const img = decodeImage(dataUrl, 4 * 1024 * 1024);
  const frame = await checkScreenFrame(img.bytes, s.qr);
  const kinds = new Set<ContactKind>(frame.kinds);
  let maskable = frame.maskable;
  const digits = handwriting.replace(/\?/g, "");
  if (digits.length >= 10) {
    const written = scanContact(digits, "file").kinds;
    for (const k of written) kinds.add(k);
    if (written.length) maskable = false;
  }
  // Nothing found, though a long number may still need hiding while it's typed (not a catch).
  if (!kinds.size) return { checked: true as const, found: false as const, boxes: frame.boxes, maskable: true };
  const caught = record ? await caughtInClass(user, lesson, "screen", [...kinds], `[${LIVE_WHERE.screen}]`, origin, "ocr") : {};
  const blockedUntil = record ? await sharingBlockedUntil(user.id, lesson.booking.id, "screen") : null;
  return { checked: true as const, found: true as const, kinds: [...kinds], boxes: frame.boxes, maskable, ...caught, ...(blockedUntil ? { blockedUntil } : {}) };
}

/**
 * A long handwritten number that might have been maths, shown on the whiteboard after the writer said it was:
 * a note in Admin → Reports with the number masked (first and last two digits), so moderators can look.
 */
export async function boardMaybeShown(user: User, lesson: Lesson, digits: string) {
  requireRole(user, lesson);
  const d = digits.slice(0, 20);
  const masked = d.length > 4 ? `${d.slice(0, 2)}${"•".repeat(d.length - 4)}${d.slice(-2)}` : "••••";
  const who = shortName(user.firstName, user.lastName);
  await db()`insert into public.reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
    values (${`rep_${randomBytes(6).toString("hex")}`}, ${user.id}, 'user', ${user.id}, 'Possible contact details shown on the whiteboard',
      ${`In the live class of lesson ${lesson.booking.id}, ${who} wrote something that looked like contact details (${masked}) and chose "It's fine, show it".`}, 'open', now())`;
  await alertStaff("reports.moderate", { title: `Possible contact details on the whiteboard: ${who}`, body: `${masked}, shown after they said it was fine.`, href: "/admin/reports" });
}

export const CLASS_REPORT_REASONS = {
  asked_contact: "Asked for my phone number, email or social media",
  shared_contact: "Shared their own contact details",
  pay_outside: "Asked to pay or meet outside TutorLink",
  other: "Something else",
} as const;

/** "Report" in the class: the other side of the lesson, to Admin → Reports. */
export async function reportFromClass(user: User, lesson: Lesson, reason: keyof typeof CLASS_REPORT_REASONS, details: string, origin: string) {
  const role = requireRole(user, lesson);
  if (role === "staff") throw new ClassError("Staff can act on the lesson directly from Admin → Bookings.");
  const target = role === "tutor" ? lesson.booking.bookerId : lesson.tutorUserId;
  if (!target) throw new ClassError("There's no one to report in this lesson.");
  const found = scanContact(details, "chat");
  const note = (found.found ? maskMatches(details, found.matches) : details).trim().slice(0, 2000);
  await db()`insert into public.reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
    values (${`rep_${randomBytes(6).toString("hex")}`}, ${user.id}, 'user', ${target}, ${CLASS_REPORT_REASONS[reason]}, ${`From the live class of lesson ${lesson.booking.id}.${note ? ` ${note}` : ""}`}, 'open', now())`;
  await alertModerators({ title: "New report from a lesson", body: `${CLASS_REPORT_REASONS[reason]}. Review it in Reports.`, href: "/admin/reports" }, origin);
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
    const res = await fetch(`${env.geminiUrl}/v1/models/gemini-2.5-flash:generateContent`, {
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
