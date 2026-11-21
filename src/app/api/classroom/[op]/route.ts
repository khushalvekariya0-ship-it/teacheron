import { after } from "next/server";
import { z } from "zod";
import { siteOrigin } from "@/server/auth";
import { helperScript } from "@/server/board-helper";
import {
  acceptPush, appealFromClass, boardMaybeShown, cameraBack, checkClassImage, checkSharedScreenFrame, endOwnPause, liftRestriction, classInfo, ClassError, CLASS_REPORT_REASONS, collectPushes, decideGuest, deleteBoard, deleteRecap, endClass, joinTicket, knock, listBoards, loadLesson,
  pollGuest, pushCode, pushCodeLesson, recapFor, reportFromClass, reportSpeech, saveSnapshots, saveTranscript, setGuestLink, shareBoard, storeBoardImage, summarise, waitingGuests,
  validPushCode, type Lesson,
} from "@/server/classroom";
import { backendStatus } from "@/server/env";
import { clientIp, json, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/server/http";
import { storageReady } from "@/server/media";
import { currentSession } from "@/server/session";
import { subjectName } from "@/lib/data/catalog";
import type { User } from "@/lib/types";

/*
 * The live classroom API (rules in src/server/classroom.ts).
 *
 *   GET  /api/classroom/info?id=         the room's state for this viewer (and the guest link for the host)
 *   GET  /api/classroom/join?id=         a LiveKit join token (participants, inside the lesson's window)
 *   POST /api/classroom/end              { id }  host: end the class for everyone
 *   POST /api/classroom/guest-link       { id, enabled, rotate? }  host: guest link on / off / new code
 *   POST /api/classroom/knock            { id, code, name }  guest (no account): ask to join → { claim }
 *   GET  /api/classroom/guest?claim=     guest polls: a token only once the host admitted them
 *   GET  /api/classroom/guests?id=       host: people waiting
 *   POST /api/classroom/decide           { id, guestId, admit }  host
 *   POST /api/classroom/screen-frame     { id, image, record?, excerpt? }  a shared-screen frame, checked before
 *                                        others see it → { checked, found, kinds, boxes, maskable }
 *   POST /api/classroom/board-image      { id, image }  host: a picture for the whiteboard (checked) → { url }
 *   POST /api/classroom/share-board      { id, title, image, recipients }  host: save + share the board
 *   GET  /api/classroom/boards?id=       boards shared from this lesson
 *   POST /api/classroom/delete-board     { id, boardId }  host
 *   POST /api/classroom/push-code        { id }  host: code for the desktop snipping helper
 *   GET  /api/classroom/helper?code=     the helper script (public; the code is its only credential)
 *   POST /api/classroom/push             { code, image }  the helper posts a snip
 *   GET  /api/classroom/push?code=       host: collect the helper's snips
 *   POST /api/classroom/transcript       { id, transcript, snapshots }  host, when leaving
 *   GET  /api/classroom/recap?id=        transcript, snapshots and AI recap (tutor, student, staff)
 *   POST /api/classroom/delete-recap     { id }  host
 */
export const dynamic = "force-dynamic";

const id = z.string().min(3).max(80);
const dataUrl = z.string().max(12_000_000);

async function signedIn(): Promise<User> {
  const session = await currentSession();
  if (!session) throw new ClassError("Please sign in to continue.", 401);
  if (session.user.status === "suspended") throw new ClassError("Your account is suspended.", 403);
  return session.user;
}

async function lessonOf(raw: unknown): Promise<Lesson> {
  const parsed = id.safeParse(raw);
  const lesson = parsed.success ? await loadLesson(parsed.data) : null;
  if (!lesson) throw new ClassError("We couldn't find that lesson.", 404);
  return lesson;
}

function limited(key: string, max: number, minutes: number) {
  const r = rateLimit(key, max, minutes * 60_000);
  return r.ok ? null : tooMany(r.retryAfterSec);
}

function fail(e: unknown, where: string) {
  if (e instanceof ClassError) return json({ ok: false, error: e.message }, { status: e.status });
  return serverError(e, `classroom/${where}`);
}

const notConnected = () => json({ ok: false, error: "The classroom isn't connected yet." }, { status: 503 });

export async function GET(request: Request, ctx: RouteContext<"/api/classroom/[op]">) {
  const { op } = await ctx.params;
  if (!backendStatus().database) return notConnected();
  const q = new URL(request.url).searchParams;
  const ip = clientIp(request);
  try {
    switch (op) {
      case "info": {
        const user = await signedIn();
        return json({ ok: true, ...(await classInfo(user, await lessonOf(q.get("id")), siteOrigin(request))) });
      }
      case "join": {
        const user = await signedIn();
        const stop = limited(`class-join:${user.id}`, 30, 10);
        if (stop) return stop;
        const lesson = await lessonOf(q.get("id"));
        return json({ ok: true, ticket: await joinTicket(user, lesson), title: `${subjectName(lesson.booking.subject)} lesson` });
      }
      case "guest": {
        const stop = limited(`class-guest-poll:${ip}`, 400, 10);
        if (stop) return stop;
        return json({ ok: true, ...(await pollGuest(String(q.get("claim") ?? ""))) });
      }
      case "guests": {
        const user = await signedIn();
        return json({ ok: true, waiting: await waitingGuests(user, await lessonOf(q.get("id"))) });
      }
      case "boards": {
        const user = await signedIn();
        if (!storageReady()) return json({ ok: true, boards: [] });
        return json({ ok: true, boards: await listBoards(user, await lessonOf(q.get("id"))) });
      }
      case "recap": {
        const user = await signedIn();
        return json({ ok: true, recap: await recapFor(user, await lessonOf(q.get("id"))) });
      }
      case "push": {
        const user = await signedIn();
        const stop = limited(`class-push-collect:${user.id}`, 600, 10);
        if (stop) return stop;
        return json({ ok: true, pushes: await collectPushes(user, String(q.get("code") ?? "").toUpperCase()) });
      }
      case "helper": {
        // Fetched by a PowerShell window, which has no session: the short-lived code is the credential.
        const code = String(q.get("code") ?? "").trim().toUpperCase();
        const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
        if (!validPushCode(code)) return text("Write-Host 'That snip code does not look right.' -ForegroundColor Red", 400);
        const stop = limited(`class-helper:${ip}`, 30, 10);
        if (stop) return text("Write-Host 'Too many tries. Wait a minute and run it again.' -ForegroundColor Red", 429);
        if (!(await pushCodeLesson(code))) return text("Write-Host 'That snip code has expired. Open the Snip panel in the classroom for a new one.' -ForegroundColor Red", 404);
        return text(helperScript(code, `${siteOrigin(request)}/api/classroom/push`, "TutorLink lesson"));
      }
      default:
        return json({ ok: false, error: "Not found" }, { status: 404 });
    }
  } catch (e) {
    return fail(e, op);
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/classroom/[op]">) {
  const { op } = await ctx.params;
  // The desktop helper isn't a browser page; every other change must come from this site.
  if (op !== "push" && !sameOrigin(request)) return json({ ok: false, error: "This request came from another site." }, { status: 403 });
  if (!backendStatus().database) return notConnected();
  const ip = clientIp(request);
  const body = await readJson<Record<string, unknown>>(request, op === "transcript" ? 25_000_000 : 12_500_000);
  if (!body) return json({ ok: false, error: "That request was empty or too large." }, { status: 400 });
  try {
    switch (op) {
      case "end": {
        const user = await signedIn();
        return json({ ok: true, ...(await endClass(user, await lessonOf(body.id))) });
      }
      case "guest-link": {
        const user = await signedIn();
        const stop = limited(`class-guest-link:${user.id}`, 20, 10);
        if (stop) return stop;
        const v = z.object({ id, enabled: z.boolean(), rotate: z.boolean().optional() }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "Choose whether guests may join." }, { status: 400 });
        const lesson = await lessonOf(v.data.id);
        const code = await setGuestLink(user, lesson, v.data.enabled, !!v.data.rotate);
        return json({ ok: true, guestLink: code ? `${siteOrigin(request)}/classroom/${lesson.booking.id}?g=${code}` : null });
      }
      case "knock": {
        const stop = limited(`class-knock:${ip}`, 10, 10);
        if (stop) return stop;
        const v = z.object({ id, code: z.string().max(20), name: z.string().max(200) }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "Please enter your name." }, { status: 400 });
        return json({ ok: true, claim: await knock(await lessonOf(v.data.id), v.data.code, v.data.name) });
      }
      case "safety": {
        // Contact details found by the person's own browser (speech), or a picture of their whiteboard
        // drawing / shared screen to read with OCR.
        const user = await signedIn();
        const v = z
          .object({
            id, source: z.enum(["speech", "board", "screen", "camera"]), kinds: z.array(z.enum(["phone", "email", "social", "link", "request", "address"])).max(6).optional(),
            excerpt: z.string().max(600).optional(), image: z.string().max(4_500_000).optional(), qr: z.string().max(2000).optional(), text: z.string().max(4000).optional(),
          })
          .safeParse(body);
        if (!v.success) return json({ ok: false, error: "That safety check wasn't valid." }, { status: 400 });
        const lesson = await lessonOf(v.data.id);
        if (v.data.source === "speech") {
          const stop = limited(`class-safety-speech:${user.id}`, 30, 10);
          if (stop) return stop;
          return json({ ok: true, ...(await reportSpeech(user, lesson, v.data.kinds ?? [], v.data.excerpt ?? "", siteOrigin(request))) });
        }
        // The whiteboard is checked each time someone stops drawing (before others see it), so it gets more room.
        const stop = limited(`class-safety-${v.data.source}:${user.id}`, v.data.source === "board" ? 600 : 150, 10);
        if (stop) return stop;
        if (!v.data.image) return json({ ok: false, error: "No picture to check." }, { status: 400 });
        // A handwritten number the person's own browser read (on their drawing or shared screen): the site's rules decide.
        const handwriting = (v.data.excerpt ?? "").replace(/[^0-9?]/g, "").slice(0, 40);
        // An email, username or link the browser read in the person's handwriting, and what a QR code the browser
        // read holds (judged here by the site's own rules): they can only make things stricter.
        const written = (v.data.kinds ?? []).filter((k): k is "email" | "social" | "link" => k === "email" || k === "social" || k === "link");
        return json({ ok: true, ...(await checkClassImage(user, lesson, v.data.source, v.data.image, siteOrigin(request), handwriting, written, v.data.qr ?? "", v.data.text ?? "")) });
      }
      case "screen-frame": {
        // One frame of the person's shared screen, checked before the others see it (the page sends out only
        // frames this says are clean, or with the contact details blacked out and checked again).
        const user = await signedIn();
        const stop = limited(`class-screen-frame:${user.id}`, 1500, 10);
        if (stop) return stop;
        const v = z.object({ id, image: z.string().max(5_600_000), record: z.boolean().optional(), excerpt: z.string().max(80).optional() }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "That frame wasn't valid." }, { status: 400 });
        const handwriting = (v.data.excerpt ?? "").replace(/[^0-9?]/g, "").slice(0, 40);
        return json({ ok: true, ...(await checkSharedScreenFrame(user, await lessonOf(v.data.id), v.data.image, siteOrigin(request), !!v.data.record, handwriting)) });
      }
      case "camera-back": {
        // The person's own page when their camera's time off is over (the server checks the time).
        const user = await signedIn();
        const v = z.object({ id }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "Which lesson?" }, { status: 400 });
        return json({ ok: true, ...(await cameraBack(user, await lessonOf(v.data.id))) });
      }
      case "unpause": {
        // The person's own page when their audio pause is over (the server checks the time).
        const user = await signedIn();
        const v = z.object({ id }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "Which lesson?" }, { status: 400 });
        return json({ ok: true, ...(await endOwnPause(user, await lessonOf(v.data.id))) });
      }
      case "board-maybe": {
        // A long handwritten number the writer said was maths and showed: a note for the moderators.
        const user = await signedIn();
        const stop = limited(`class-board-maybe:${user.id}`, 20, 10);
        if (stop) return stop;
        const v = z.object({ id, digits: z.string().max(40) }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "That request wasn't valid." }, { status: 400 });
        await boardMaybeShown(user, await lessonOf(v.data.id), v.data.digits.replace(/[^0-9a-z?@ ]/gi, ""));
        return json({ ok: true });
      }
      case "appeal": {
        // "Ask for a review" in the class: the audio pause was a mistake.
        const user = await signedIn();
        const stop = limited(`class-appeal:${user.id}`, 5, 10);
        if (stop) return stop;
        const v = z.object({ id, note: z.string().max(1000).optional() }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "That request wasn't valid." }, { status: 400 });
        await appealFromClass(user, await lessonOf(v.data.id), v.data.note ?? "", siteOrigin(request));
        return json({ ok: true });
      }
      case "lift": {
        // Staff end an audio pause early (Admin → Chat safety).
        const user = await signedIn();
        const v = z.object({ restrictionId: z.string().min(3).max(80), note: z.string().max(500).optional() }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "Which restriction?" }, { status: 400 });
        await liftRestriction(user, v.data.restrictionId, v.data.note ?? "", siteOrigin(request));
        return json({ ok: true });
      }
      case "report": {
        const user = await signedIn();
        const stop = limited(`class-report:${user.id}`, 5, 10);
        if (stop) return stop;
        const v = z.object({ id, reason: z.enum(Object.keys(CLASS_REPORT_REASONS) as [keyof typeof CLASS_REPORT_REASONS]), details: z.string().max(2000).optional() }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "Choose what happened." }, { status: 400 });
        await reportFromClass(user, await lessonOf(v.data.id), v.data.reason, v.data.details ?? "", siteOrigin(request));
        return json({ ok: true });
      }
      case "decide": {
        const user = await signedIn();
        const v = z.object({ id, guestId: z.string().max(40), admit: z.boolean() }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "Choose Admit or Deny." }, { status: 400 });
        await decideGuest(user, await lessonOf(v.data.id), v.data.guestId, v.data.admit);
        return json({ ok: true });
      }
      case "board-image": {
        const user = await signedIn();
        if (!storageReady()) return json({ ok: false, error: "File storage isn't connected yet." }, { status: 503 });
        const stop = limited(`class-board-image:${user.id}`, 60, 10);
        if (stop) return stop;
        const v = z.object({ id, image: dataUrl }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "That isn't an image." }, { status: 400 });
        return json({ ok: true, url: await storeBoardImage(user, await lessonOf(v.data.id), v.data.image) });
      }
      case "share-board": {
        const user = await signedIn();
        if (!storageReady()) return json({ ok: false, error: "File storage isn't connected yet." }, { status: 503 });
        const stop = limited(`class-share:${user.id}`, 20, 10);
        if (stop) return stop;
        const v = z.object({ id, title: z.string().max(200), image: dataUrl, recipients: z.array(z.string().max(80)).max(50) }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "There's no board to share." }, { status: 400 });
        return json({ ok: true, board: await shareBoard(user, await lessonOf(v.data.id), v.data) });
      }
      case "delete-board": {
        const user = await signedIn();
        const v = z.object({ id, boardId: z.string().max(40) }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "Choose a board." }, { status: 400 });
        await deleteBoard(user, await lessonOf(v.data.id), v.data.boardId);
        return json({ ok: true });
      }
      case "push-code": {
        const user = await signedIn();
        const stop = limited(`class-push-code:${user.id}`, 20, 10);
        if (stop) return stop;
        const lesson = await lessonOf(body.id);
        const { code, expiresAt } = await pushCode(user, lesson);
        const origin = siteOrigin(request);
        return json({ ok: true, code, expiresAt, command: `irm "${origin}/api/classroom/helper?code=${code}" | iex` });
      }
      case "push": {
        if (!storageReady()) return json({ ok: false, error: "File storage isn't connected yet." }, { status: 503 });
        const stop = limited(`class-push:${ip}`, 60, 1);
        if (stop) return stop;
        const v = z.object({ code: z.string().max(20), image: dataUrl }).safeParse(body);
        if (!v.success) return json({ ok: false, error: "That isn't an image." }, { status: 400 });
        await acceptPush(v.data.code.trim().toUpperCase(), v.data.image);
        return json({ ok: true }, { status: 201 });
      }
      case "transcript": {
        const user = await signedIn();
        const stop = limited(`class-transcript:${user.id}`, 10, 10);
        if (stop) return stop;
        const v = z
          .object({ id, transcript: z.string().max(400_000), snapshots: z.array(z.object({ title: z.string().max(200), image: z.string().max(6_000_000), at: z.string().max(60) })).max(20) })
          .safeParse(body);
        if (!v.success) return json({ ok: false, error: "There's nothing to save." }, { status: 400 });
        const lesson = await lessonOf(v.data.id);
        await saveTranscript(user, lesson, v.data.transcript);
        // Snapshots are read for contact details and the AI recap can take a while: both run after the answer.
        after(async () => {
          if (v.data.snapshots.length && storageReady()) await saveSnapshots(user, lesson, v.data.snapshots);
          await summarise(lesson);
        });
        return json({ ok: true });
      }
      case "delete-recap": {
        const user = await signedIn();
        await deleteRecap(user, await lessonOf(body.id));
        return json({ ok: true });
      }
      default:
        return json({ ok: false, error: "Not found" }, { status: 404 });
    }
  } catch (e) {
    return fail(e, op);
  }
}
