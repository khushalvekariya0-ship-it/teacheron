"use client";

import * as React from "react";
import { Flag, Loader2, ShieldCheck, X } from "lucide-react";
import { RoomEvent, Track, type Participant, type Room } from "livekit-client";
import { TOPIC, type SafetyMessage } from "@/lib/classroom";
import jsQR from "jsqr";
import { scanContact, type ContactKind } from "@/lib/domain/contact";
import { qrKinds } from "@/lib/domain/qr";
import { readTextHere, warmLocalOcr } from "./localOcr";
import { handwrittenContactsInPicture, judge, numbersInPicture } from "@/lib/handwriting/digits";
import { cn } from "@/lib/utils";

/*
 * Keeping contact details out of the live class (the server side is in src/server/classroom.ts):
 *  - speech (computers): while someone's microphone is on, their own browser's speech recognition listens; a phone
 *    number, email or social media handle in what they say is reported (only the masked words);
 *  - whiteboard: what each person draws is read on the server every few seconds (see MeetingWhiteboard);
 *  - shared screen and camera: a frame is read on the server every few seconds (when it changed);
 *  - speech is checked one sentence at a time and over the last minute (a number said in pieces), in
 *    the class language the host sets (speechContact / speechSplitContact in src/lib/domain/contact.ts);
 *  - the person's own browser shows the warning from the server's answer and tells the others at once;
 *    the server tells the room too (a few seconds later); repeated tries pause the person's audio for the
 *    others (enforced by LiveKit), and removal is only when switched on in the settings;
 *  - a banner says so, and Report sends the other side of the lesson to Admin → Reports.
 */

export type SafetyResult = { found: boolean; kinds?: ContactKind[]; strikes?: number; removed?: boolean; suspended?: boolean; level?: SafetyMessage["level"]; mutedUntil?: string; blockedUntil?: string };

/** Sends one safety check to the server. Guests (no account) and network trouble return null. */
export async function sendSafety(
  bookingId: string,
  body: { source: SafetyMessage["source"]; kinds?: ContactKind[]; excerpt?: string; image?: string; qr?: string; text?: string },
  timeoutMs = 30_000,
): Promise<SafetyResult | null> {
  const stop = new AbortController();
  const t = window.setTimeout(() => stop.abort(), timeoutMs);
  try {
    const res = await fetch("/api/classroom/safety", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bookingId, ...body }), signal: stop.signal });
    if (!res.ok) return null;
    return (await res.json()) as SafetyResult;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

const WHERE: Record<SafetyMessage["source"], string> = { speech: "said out loud", board: "written on the whiteboard", screen: "shown on a shared screen", camera: "shown on camera" };
const WHAT: Record<ContactKind, string> = { phone: "a phone number", email: "an email address", social: "a social media or messaging app", link: "an outside link", request: "an invitation to talk or pay outside TutorLink", address: "a home or postal address" };

/**
 * Warnings when contact details are caught in this class. They come from the server, or from a person's
 * own browser about that person (no one can send one about someone else), and each is shown once.
 * `caught` is what this person's own checks call with the server's answer; when removed
 * time `onRemoved` runs (the page leaves the class).
 */
export function useSafetyAlerts(
  room: Room,
  me: { identity: string; name: string },
  ladder: { muteAt: number; muteMinutes: number },
  onRemoved: (suspended: boolean) => void,
  onPaused: (until: number) => void,
) {
  const [alert, setAlert] = React.useState<{ id: number; text: string; mine: boolean } | null>(null);
  const seq = React.useRef(0);
  const seen = React.useRef(new Set<string>());
  const onRemovedRef = React.useRef(onRemoved);
  const onPausedRef = React.useRef(onPaused);
  React.useEffect(() => {
    onRemovedRef.current = onRemoved;
    onPausedRef.current = onPaused;
  }, [onRemoved, onPaused]);

  const show = React.useCallback(
    (msg: SafetyMessage) => {
      const key = `${msg.identity}:${msg.source}:${msg.strikes}:${msg.removed}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const mine = msg.identity === me.identity;
      const what = msg.kinds.map((k) => WHAT[k]).join(" and ");
      const level = msg.level ?? (msg.removed ? "removed" : "warning");
      const muteAt = msg.muteAt ?? ladder.muteAt;
      const minutes = msg.muteMinutes ?? ladder.muteMinutes;
      const until = msg.mutedUntil ? new Date(msg.mutedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
      const next = muteAt > msg.strikes ? ` ${msg.strikes} of ${muteAt}. At ${muteAt} your audio is paused for the others for ${minutes} minutes.` : "";
      const text =
        level === "removed"
          ? mine
            ? "You were removed from this class: contact details were shared too many times."
            : `${msg.name} was removed from the class for sharing contact details. Our team has been told.`
          : level === "muted"
            ? mine
              ? `Your audio is paused for the others until ${until}: contact details were shared ${msg.strikes} times. You can still hear, see and use the chat.`
              : `${msg.name}'s audio is paused for ${minutes} minutes: contact details were shared again. Our team has been told.`
            : mine
              ? level === "strong"
                ? `Second warning: sharing ${what} isn't allowed on TutorLink (${WHERE[msg.source]}). It was blocked, and our team has been told.${next}`
                : `Sharing ${what} isn't allowed on TutorLink (${WHERE[msg.source]}). It was blocked and recorded.${next}`
              : `${msg.name} tried to share ${what} (${WHERE[msg.source]}). It was blocked and reported. Keep contact and payments on TutorLink.`;
      const id = ++seq.current;
      setAlert({ id, text, mine });
      if (!mine) window.setTimeout(() => setAlert((a) => (a?.id === id ? null : a)), 9000);
      if (mine && level === "removed") onRemovedRef.current(false);
      if (mine && level === "muted" && msg.mutedUntil) onPausedRef.current(Date.parse(msg.mutedUntil));
    },
    [me.identity, ladder.muteAt, ladder.muteMinutes],
  );

  React.useEffect(() => {
    const handler = (payload: Uint8Array, participant?: Participant) => {
      let msg: Partial<SafetyMessage>;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload)) as Partial<SafetyMessage>;
      } catch {
        return;
      }
      if (msg.type !== TOPIC.safety || !msg.identity || !msg.source || !(msg.source in WHERE)) return;
      if (!Array.isArray(msg.kinds) || !msg.kinds.length || !msg.kinds.every((k) => k in WHAT)) return;
      // From the server (no participant), or a person's own browser telling on itself.
      if (participant && participant.identity !== msg.identity) return;
      show({
        type: TOPIC.safety,
        identity: msg.identity,
        name: (participant?.name || msg.name || "Someone").slice(0, 60),
        source: msg.source,
        kinds: msg.kinds,
        strikes: Number(msg.strikes) || 0,
        removed: msg.removed === true,
        level: msg.level === "strong" || msg.level === "muted" || msg.level === "removed" ? msg.level : "warning",
        mutedUntil: typeof msg.mutedUntil === "string" && !Number.isNaN(Date.parse(msg.mutedUntil)) ? msg.mutedUntil : undefined,
        muteAt: Number(msg.muteAt) || undefined,
        muteMinutes: Number(msg.muteMinutes) || undefined,
      });
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room, show]);

  const caught = React.useCallback(
    (source: SafetyMessage["source"], res: SafetyResult | null) => {
      if (!res?.found || !res.kinds?.length) return;
      const msg: SafetyMessage = {
        type: TOPIC.safety, name: me.name, identity: me.identity, source, kinds: res.kinds, strikes: res.strikes ?? 0, removed: res.removed === true,
        level: res.level, mutedUntil: res.mutedUntil, muteAt: ladder.muteAt, muteMinutes: ladder.muteMinutes,
      };
      // The others hear it from this browser now; the server's own message follows and isn't shown twice.
      room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true, topic: TOPIC.safety }).catch(() => {});
      show(msg);
      // A second removal pauses the account (only the server's answer says so).
      if (res.removed && res.suspended) onRemovedRef.current(true);
    },
    [room, me.name, me.identity, show, ladder.muteAt, ladder.muteMinutes],
  );

  return { alert, dismiss: () => setAlert(null), caught };
}

export function SafetyAlert({ alert, onDismiss }: { alert: { text: string; mine: boolean } | null; onDismiss: () => void }) {
  if (!alert) return null;
  return (
    <div className="absolute inset-x-0 top-14 z-[57] flex justify-center px-3" role="alert">
      <div className={cn("flex max-w-2xl items-start gap-3 px-4 py-3 text-sm font-medium shadow-2xl", alert.mine ? "bg-danger text-white" : "bg-warning text-black")}>
        <span className="flex-1">{alert.text}</span>
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-80 hover:opacity-100" aria-label="Dismiss the warning">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Why speech is (or isn't) being checked for this person right now. */
export type SpeechState = "on" | "off" | "phone" | "unsupported" | "mic-off" | "blocked" | "guest" | "muted";

const SPEECH_TEXT: Record<SpeechState, string> = {
  on: "What you say is checked (your browser's speech recognition: Chrome sends the audio to Google, Edge to Microsoft, only to turn it into text).",
  off: "Speech isn't checked in this class (switched off by TutorLink).",
  phone: "Speech isn't checked on phones; the whiteboard, shared screens, camera and chat still are.",
  unsupported: "Speech can't be checked in this browser (use Chrome or Edge on a computer); the rest still is.",
  "mic-off": "Speech is checked while your microphone is on.",
  blocked: "Speech can't be checked: the microphone is blocked for speech recognition in this browser.",
  guest: "Guests aren't checked.",
  muted: "Your audio is paused for the others for now.",
};

/** "Protected": what is checked for this person in this class, and why something isn't. */
export function SafetyStatus({ speech, checks }: { speech: SpeechState; checks: { label: string; on: boolean }[] }) {
  const [open, setOpen] = React.useState(false);
  const full = speech === "on" || speech === "mic-off";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("flex h-9 items-center gap-1.5 px-2 text-xs font-semibold", full ? "text-live" : "text-warning", "hover:bg-sunken")}
        aria-expanded={open}
        aria-label="Protection status"
        data-safety-status={speech}
      >
        <ShieldCheck className="size-4" aria-hidden />
        <span className="hidden sm:inline">{full ? "Protected" : "Partly protected"}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-[58] w-72 border border-line bg-surface p-3 text-[12.5px] leading-snug text-ink-2 shadow-2xl" role="dialog" aria-label="What is checked in this class">
          <p className="mb-2 font-semibold text-ink">Checked for contact details</p>
          <ul className="space-y-1.5">
            <li className="flex gap-2">
              <span className={cn("mt-1 size-2 shrink-0 rounded-full", speech === "on" ? "bg-live" : speech === "mic-off" ? "bg-subtle" : "bg-warning")} aria-hidden />
              <span>{SPEECH_TEXT[speech]}</span>
            </li>
            {checks.map((c) => (
              <li key={c.label} className="flex gap-2">
                <span className={cn("mt-1 size-2 shrink-0 rounded-full", c.on ? "bg-live" : "bg-warning")} aria-hidden />
                <span>
                  {c.label}: {c.on ? "checked" : "not checked"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-muted">Only a masked note is kept when something is caught: never the audio, and never the number or email itself.</p>
        </div>
      )}
    </div>
  );
}

/** While this person's audio is paused: until when, and "Ask for a review" (the pause was a mistake). */
export function AudioPausedBar({ bookingId, until }: { bookingId: string; until: number }) {
  const [asking, setAsking] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const at = new Date(until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const send = async () => {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/classroom/appeal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bookingId, note }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setState("idle");
        return setError(data.error ?? "That didn't send. Try again.");
      }
      setState("sent");
      setAsking(false);
    } catch {
      setState("idle");
      setError("Couldn't reach the server. Try again.");
    }
  };
  return (
    <div className="border-b border-danger/40 bg-danger/15 px-3 py-2 text-[12.5px] leading-snug text-ink md:px-4" role="status" data-audio-paused="">
      <p>
        <span className="font-semibold">Your audio is paused for the others until {at}</span> because contact details were shared in this class. You can still hear,
        see, use the whiteboard and the chat.{" "}
        {state === "sent" ? (
          <span className="font-semibold">Review asked: our team will look at it.</span>
        ) : (
          <button type="button" onClick={() => setAsking((v) => !v)} className="font-semibold underline underline-offset-2">
            Ask for a review
          </button>
        )}
      </p>
      {asking && state !== "sent" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="appeal-note" className="sr-only">
            Why was it a mistake?
          </label>
          <input id="appeal-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Why was it a mistake? (optional)" className="min-w-0 flex-1 border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-ink" />
          <button type="button" onClick={() => void send()} disabled={state === "sending"} className="bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-on-ink disabled:opacity-60">
            Send
          </button>
          {error && <span className="text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}

/** Shown when the class opens: what isn't allowed and that it's checked. */
export function SafetyBanner({ onReport }: { onReport?: () => void }) {
  const [open, setOpen] = React.useState(true);
  if (!open) return null;
  return (
    <div className="flex items-start gap-2.5 border-b border-line bg-sunken px-3 py-2 text-[12.5px] leading-snug text-ink-2 md:px-4" role="note" data-safety-banner="">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-live" aria-hidden />
      <p className="flex-1">
        <span className="font-semibold text-ink">Keep it on TutorLink.</span> Phone numbers, emails and social media aren&apos;t allowed in class. They&apos;re checked automatically in what you say (on a computer
        while your microphone is on, by your browser&apos;s speech recognition, which sends the audio to Google in Chrome or Microsoft in Edge to turn it into text), on the whiteboard, on shared screens and on camera. Repeated tries pause your audio for the others, and our team is told.
        {onReport && (
          <>
            {" "}
            <button type="button" onClick={onReport} className="font-semibold text-ink underline underline-offset-2">
              Report a problem
            </button>
          </>
        )}
      </p>
      <button type="button" onClick={() => setOpen(false)} className="shrink-0 text-muted hover:text-ink" aria-label="Hide this notice">
        <X className="size-4" />
      </button>
    </div>
  );
}

const REASONS = [
  { value: "asked_contact", label: "Asked for my phone number, email or social media" },
  { value: "shared_contact", label: "Shared their own contact details" },
  { value: "pay_outside", label: "Asked to pay or meet outside TutorLink" },
  { value: "other", label: "Something else" },
] as const;

/** "Report": sends the other side of the lesson to TutorLink's team. */
export function ReportDialog({ bookingId, open, onClose, onSent }: { bookingId: string; open: boolean; onClose: () => void; onSent: (msg: string) => void }) {
  const [reason, setReason] = React.useState<(typeof REASONS)[number]["value"]>("asked_contact");
  const [details, setDetails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!open) return null;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/classroom/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bookingId, reason, details }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) return setError(data.error ?? "That didn't send. Try again.");
      setDetails("");
      onSent("Thanks. Your report was sent to TutorLink's team.");
      onClose();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <form onSubmit={send} className="w-full max-w-md border border-line bg-surface p-5 shadow-2xl">
        <h2 id="report-title" className="flex items-center gap-2 text-base font-semibold">
          <Flag className="size-4 text-danger" aria-hidden /> Report a problem in this lesson
        </h2>
        <p className="mt-1 text-[13px] text-muted">Only TutorLink&apos;s team sees this. The other person isn&apos;t told who reported it.</p>
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">What happened</legend>
          {REASONS.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="mt-0.5 accent-[var(--color-brand,#e5582f)]" />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label className="mt-4 block text-sm font-medium" htmlFor="report-details">
          Anything else? <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={3} className="mt-1.5 w-full border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-ink" />
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-ink">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="flex items-center gap-2 bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Send report
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * While this person shares their screen (or has their camera on), a frame is read on the server every few
 * seconds, only when the picture changed enough (a camera always changes a little). Contact details on it
 * stop the share / turn the camera off (`onFound`).
 */
export function useVideoCheck({
  room, bookingId, source, on, everyMs, onFound, onSpotted, localEveryMs = 3000,
}: {
  room: Room; bookingId: string; source: "screen" | "camera"; on: boolean; everyMs: number; onFound: (res: SafetyResult) => void;
  /** This browser read contact details on the picture itself: called at once, before the server answers. */
  onSpotted?: (kinds: ContactKind[]) => void;
  /** How often this browser reads the picture itself (handwritten and printed numbers, emails, usernames). */
  localEveryMs?: number;
}) {
  const onFoundRef = React.useRef(onFound);
  const onSpottedRef = React.useRef(onSpotted);
  React.useEffect(() => {
    onFoundRef.current = onFound;
    onSpottedRef.current = onSpotted;
  }, [onFound, onSpotted]);
  React.useEffect(() => {
    if (!on) return;
    const track = room.localParticipant.getTrackPublication(source === "screen" ? Track.Source.ScreenShare : Track.Source.Camera)?.track?.mediaStreamTrack;
    if (!track) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([track]);
    void video.play().catch(() => {});
    let last: number[] | null = null;
    let busy = false;
    const tick = async () => {
      if (busy || !video.videoWidth) return;
      // A tiny grey thumbnail tells whether the picture changed enough since the last frame that was read.
      const thumb = document.createElement("canvas");
      thumb.width = 48;
      thumb.height = 27;
      const t = thumb.getContext("2d", { willReadFrequently: true });
      if (!t) return;
      t.drawImage(video, 0, 0, 48, 27);
      const px = t.getImageData(0, 0, 48, 27).data;
      const grey: number[] = [];
      for (let i = 0; i < px.length; i += 4) grey.push(((px[i] + px[i + 1] + px[i + 2]) / 3) >> 4);
      const changed = last ? grey.filter((g, i) => Math.abs(g - last![i]) >= 2).length / grey.length : 1;
      if (changed < 0.04) return;
      last = grey;
      const scale = Math.min(1, (source === "screen" ? 1600 : 1280) / video.videoWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(video.videoWidth * scale);
      c.height = Math.round(video.videoHeight * scale);
      c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
      busy = true;
      const res = await sendSafety(bookingId, { source, image: c.toDataURL("image/jpeg", source === "screen" ? 0.8 : 0.85) });
      busy = false;
      if (res?.found) onFoundRef.current(res);
    };
    // Read in this browser every few seconds when the picture changed: a number or an email written on paper
    // or shown on a phone held up to the camera (or on a shared screen) is caught within seconds.
    let lastLocal: number[] | null = null;
    let reading = false;
    let lastTextKey = "";
    let lastTextCheck = 0;
    // Once something was spotted here the camera is going off: nothing more to read.
    let spotted = false;
    // The in-browser text reader is loaded as soon as the camera is on, so it's ready when needed.
    if (source === "camera") void warmLocalOcr();
    const readHere = async () => {
      // (Independent of the 20-second server check: a slow server answer never pauses this one.)
      if (reading || spotted || !video.videoWidth) return;
      const thumb = document.createElement("canvas");
      thumb.width = 48;
      thumb.height = 27;
      const t = thumb.getContext("2d", { willReadFrequently: true });
      if (!t) return;
      t.drawImage(video, 0, 0, 48, 27);
      const px = t.getImageData(0, 0, 48, 27).data;
      const grey: number[] = [];
      for (let i = 0; i < px.length; i += 4) grey.push(((px[i] + px[i + 1] + px[i + 2]) / 3) >> 4);
      const changed = lastLocal ? grey.filter((g, i) => Math.abs(g - lastLocal![i]) >= 1).length / grey.length : 1;
      if (changed < 0.01) return;
      lastLocal = grey;
      const scale = Math.min(1, (source === "camera" ? 960 : 1280) / video.videoWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(video.videoWidth * scale);
      c.height = Math.round(video.videoHeight * scale);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, c.width, c.height);
      reading = true;
      try {
        const frame = ctx.getImageData(0, 0, c.width, c.height);
        // A QR code held up to the camera (a WhatsApp, UPI or contact code on a phone): what it holds.
        const code = source === "camera" ? jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" }) : null;
        const qrHit = code?.data ? qrKinds(code.data) : [];
        // Acted on at once (the camera goes off); the server records it (its own rules decide on what was
        // read here) and tells the class.
        const report = async (kinds: ContactKind[], extra: { excerpt?: string; qr?: string; text?: string }) => {
          spotted = true;
          const image = c.toDataURL("image/jpeg", 0.75);
          onSpottedRef.current?.(kinds);
          const res = await sendSafety(bookingId, { source, image, kinds, ...extra });
          if (res?.found) onFoundRef.current(res);
        };
        if (code?.data && qrHit.length) return void (await report(qrHit, { qr: code.data.slice(0, 2000) }));
        const phone = (await numbersInPicture(frame)).find((n) => judge(n) === "phone");
        if (phone) return void (await report(["phone"], { excerpt: phone.digits }));
        // Emails, usernames, UPI IDs and links written by hand: "riley@gmail.com", "insta riley_draws".
        const lines: string[] = [];
        const written = (await handwrittenContactsInPicture(frame, 22, lines)).filter((x) => x.verdict === "contact");
        if (written.length) return void (await report([...new Set(written.map((x) => x.kind))], {}));
        // Printed writing held up to the camera (a phone screen, a printout): read here by the in-browser text
        // reader with the same rules as chat (WhatsApp / Instagram / Facebook IDs, links, UPI, emails, numbers).
        const textKey = lines.map((l) => l.replace(/\s/g, "").length).filter((n) => n >= 5).map((n) => Math.round(n / 4)).sort().join(",");
        if (source !== "camera" || !textKey) {
          lastTextKey = "";
          return;
        }
        const text = await readTextHere(c);
        if (text !== null) {
          const kinds = scanContact(text, "file").kinds;
          if (kinds.length) await report(kinds, { text: text.slice(0, 2000) });
          return;
        }
        // The in-browser reader couldn't load: the server reads the picture as soon as new writing appears.
        if (textKey !== lastTextKey && Date.now() - lastTextCheck > 4000) {
          lastTextKey = textKey;
          lastTextCheck = Date.now();
          const res = await sendSafety(bookingId, { source, image: c.toDataURL("image/jpeg", 0.85) });
          if (res?.found) onFoundRef.current(res);
        }
      } catch (e) {
        console.warn("[safety] reading the shared screen", e);
      } finally {
        reading = false;
      }
    };
    const first = window.setTimeout(() => void tick(), 2500);
    const every = window.setInterval(() => void tick(), everyMs);
    const here = window.setInterval(() => void readHere(), localEveryMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.clearInterval(here);
      video.srcObject = null;
    };
  }, [room, bookingId, source, on, everyMs, localEveryMs]);
}
