"use client";

import * as React from "react";
import { Flag, Loader2, ShieldCheck, X } from "lucide-react";
import { RoomEvent, Track, type Participant, type Room } from "livekit-client";
import { LIVE_STRIKE_LIMIT, TOPIC, type SafetyMessage } from "@/lib/classroom";
import { maskMatches, scanContact, type ContactKind } from "@/lib/domain/contact";
import { cn } from "@/lib/utils";

/*
 * Keeping contact details out of the live class (the server side is in src/server/classroom.ts):
 *  - speech (computers): while someone's microphone is on, their own browser's speech recognition listens; a phone
 *    number, email or social media handle in what they say is reported (only the masked words);
 *  - whiteboard: what each person draws is read on the server every few seconds (see MeetingWhiteboard);
 *  - shared screen: a frame of the shared screen is read on the server every few seconds;
 *  - the person's own browser shows the warning from the server's answer and tells the others at once;
 *    the server tells the room too (a few seconds later) and removes a person the LIVE_STRIKE_LIMIT-th
 *    time, when their own browser also leaves;
 *  - a banner says so, and Report sends the other side of the lesson to Admin → Reports.
 */

export type SafetyResult = { found: boolean; kinds?: ContactKind[]; strikes?: number; removed?: boolean };

/** Sends one safety check to the server. Guests (no account) and network trouble return null. */
export async function sendSafety(bookingId: string, body: { source: "speech" | "board" | "screen"; kinds?: ContactKind[]; excerpt?: string; image?: string }): Promise<SafetyResult | null> {
  try {
    const res = await fetch("/api/classroom/safety", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bookingId, ...body }) });
    if (!res.ok) return null;
    return (await res.json()) as SafetyResult;
  } catch {
    return null;
  }
}

/**
 * Checks one finished sentence the person said. A bare number needs 10 or more digits to count as a
 * phone number in speech (lessons are full of numbers: answers, years, prices).
 */
export function speechContact(said: string): { kinds: ContactKind[]; masked: string } | null {
  const found = scanContact(said, "chat");
  if (!found.found) return null;
  const kinds = found.kinds.filter((k) => k !== "phone" || (said.match(/\d/g) ?? []).length >= 10 || /whats ?app|call me|my (number|phone|mobile)/i.test(said));
  if (!kinds.length) return null;
  return { kinds, masked: maskMatches(said, found.matches) };
}

const WHERE: Record<SafetyMessage["source"], string> = { speech: "said out loud", board: "written on the whiteboard", screen: "shown on a shared screen" };
const WHAT: Record<ContactKind, string> = { phone: "a phone number", email: "an email address", social: "a social media or messaging app", link: "an outside link" };

/**
 * Warnings when contact details are caught in this class. They come from the server, or from a person's
 * own browser about that person (no one can send one about someone else), and each is shown once.
 * `caught` is what this person's own checks call with the server's answer; at the LIVE_STRIKE_LIMIT-th
 * time `onRemoved` runs (the page leaves the class).
 */
export function useSafetyAlerts(room: Room, me: { identity: string; name: string }, onRemoved: () => void) {
  const [alert, setAlert] = React.useState<{ id: number; text: string; mine: boolean } | null>(null);
  const seq = React.useRef(0);
  const seen = React.useRef(new Set<string>());
  const onRemovedRef = React.useRef(onRemoved);
  React.useEffect(() => {
    onRemovedRef.current = onRemoved;
  }, [onRemoved]);

  const show = React.useCallback(
    (msg: SafetyMessage) => {
      const key = `${msg.identity}:${msg.source}:${msg.strikes}:${msg.removed}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const mine = msg.identity === me.identity;
      const what = msg.kinds.map((k) => WHAT[k]).join(" and ");
      const text = msg.removed
        ? mine
          ? "You were removed from this class: contact details were shared too many times."
          : `${msg.name} was removed from the class for sharing contact details. Our team has been told.`
        : mine
          ? `Sharing ${what} isn't allowed on TutorLink (${WHERE[msg.source]}). It was blocked and recorded: ${msg.strikes} of ${LIVE_STRIKE_LIMIT}. At ${LIVE_STRIKE_LIMIT} you're removed from the class.`
          : `${msg.name} tried to share ${what} (${WHERE[msg.source]}). It was blocked and reported. Keep contact and payments on TutorLink.`;
      const id = ++seq.current;
      setAlert({ id, text, mine });
      if (!mine) window.setTimeout(() => setAlert((a) => (a?.id === id ? null : a)), 9000);
      if (mine && msg.removed) onRemovedRef.current();
    },
    [me.identity],
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
      const msg: SafetyMessage = { type: TOPIC.safety, name: me.name, identity: me.identity, source, kinds: res.kinds, strikes: res.strikes ?? 0, removed: res.removed === true };
      // The others hear it from this browser now; the server's own message follows and isn't shown twice.
      room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true, topic: TOPIC.safety }).catch(() => {});
      show(msg);
    },
    [room, me.name, me.identity, show],
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

/** Shown when the class opens: what isn't allowed and that it's checked. */
export function SafetyBanner({ onReport }: { onReport?: () => void }) {
  const [open, setOpen] = React.useState(true);
  if (!open) return null;
  return (
    <div className="flex items-start gap-2.5 border-b border-line bg-sunken px-3 py-2 text-[12.5px] leading-snug text-ink-2 md:px-4" role="note" data-safety-banner="">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-live" aria-hidden />
      <p className="flex-1">
        <span className="font-semibold text-ink">Keep it on TutorLink.</span> Phone numbers, emails and social media aren&apos;t allowed in class. They&apos;re checked automatically in what you say (on a computer
        while your microphone is on, by your browser&apos;s speech recognition), on the whiteboard and on shared screens. 3 times and you&apos;re removed from the class.
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
 * While this person shares their screen, a frame is read on the server every 12 seconds (only when it
 * changed). Contact details on it stop the share.
 */
export function useScreenShareCheck({ room, bookingId, sharing, onFound }: { room: Room; bookingId: string; sharing: boolean; onFound: (res: SafetyResult) => void }) {
  const onFoundRef = React.useRef(onFound);
  React.useEffect(() => {
    onFoundRef.current = onFound;
  }, [onFound]);
  React.useEffect(() => {
    if (!sharing) return;
    const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack;
    if (!track) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([track]);
    void video.play().catch(() => {});
    let last = "";
    let busy = false;
    const tick = async () => {
      if (busy || !video.videoWidth) return;
      // A tiny grey thumbnail tells whether anything changed since the last frame that was read.
      const thumb = document.createElement("canvas");
      thumb.width = 48;
      thumb.height = 27;
      const t = thumb.getContext("2d", { willReadFrequently: true });
      if (!t) return;
      t.drawImage(video, 0, 0, 48, 27);
      const px = t.getImageData(0, 0, 48, 27).data;
      let sig = "";
      for (let i = 0; i < px.length; i += 16) sig += String.fromCharCode(48 + (((px[i] + px[i + 1] + px[i + 2]) / 3) >> 5));
      if (sig === last) return;
      last = sig;
      const scale = Math.min(1, 1600 / video.videoWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(video.videoWidth * scale);
      c.height = Math.round(video.videoHeight * scale);
      c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
      busy = true;
      const res = await sendSafety(bookingId, { source: "screen", image: c.toDataURL("image/jpeg", 0.8) });
      busy = false;
      if (res?.found) onFoundRef.current(res);
    };
    const first = window.setTimeout(() => void tick(), 2500);
    const every = window.setInterval(() => void tick(), 12_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      video.srcObject = null;
    };
  }, [room, bookingId, sharing]);
}
