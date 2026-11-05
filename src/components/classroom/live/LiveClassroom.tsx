"use client";

import * as React from "react";
import {
  isTrackReference, LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useParticipants, useRoomContext, useTracks, VideoTrack, type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { DisconnectReason, MediaDeviceFailure, RoomEvent, Track, type Participant } from "livekit-client";
import {
  AlertTriangle, Camera, Check, Copy, FileText, LayoutGrid, Link2, Loader2, Maximize2, MessageSquare, Mic, MicOff, Minimize2, MonitorUp, PenLine, PhoneOff,
  RefreshCw, User as UserIcon, Users, Video, VideoOff,
} from "lucide-react";
import { readMeta, TOPIC, type JoinTicket } from "@/lib/classroom";
import { maskMatches, scanContact } from "@/lib/domain/contact";
import { cn } from "@/lib/utils";
import { ChatPanel, type ChatLine } from "../ChatPanel";
import { MeetingWhiteboard } from "./MeetingWhiteboard";
import { downloadTranscriptPdf, type Snapshot } from "./transcriptPdf";

/*
 * The live classroom: video, audio, screen share, whiteboard, chat, people, captions and a transcript,
 * through LiveKit. The token comes from /api/classroom/join (or the guest waiting room); host-ness is in
 * the server-signed token, so the host controls here are only conveniences: the server and the other
 * browsers check it again.
 */

export interface ClassChat {
  lines: ChatLine[];
  onSend: (body: string) => string | null | Promise<string | null>;
  disabledReason?: string;
  note: string;
  peerName: string;
}

interface Props {
  bookingId: string;
  title: string;
  /** A guest's ticket from the waiting room; members fetch their own. */
  ticket?: JoinTicket;
  /** The lesson's chat (the tutor–family conversation). Guests have none. */
  chat?: ClassChat;
  /** Called when the other side says a new chat message is saved. */
  onRefresh?: () => void;
  onLeave: () => void;
}

const LANGUAGES = [
  ["en-US", "English (US)"], ["en-GB", "English (UK)"], ["en-IN", "English (India)"], ["hi-IN", "Hindi"], ["gu-IN", "Gujarati"], ["mr-IN", "Marathi"], ["ta-IN", "Tamil"],
  ["te-IN", "Telugu"], ["kn-IN", "Kannada"], ["ml-IN", "Malayalam"], ["bn-BD", "Bengali"], ["pa-IN", "Punjabi"], ["ur-PK", "Urdu"], ["es-ES", "Spanish"], ["fr-FR", "French"],
  ["de-DE", "German"], ["it-IT", "Italian"], ["pt-BR", "Portuguese"], ["ru-RU", "Russian"], ["ar-SA", "Arabic"], ["zh-CN", "Chinese (Simplified)"], ["zh-TW", "Chinese (Traditional)"],
  ["ja-JP", "Japanese"], ["ko-KR", "Korean"], ["tr-TR", "Turkish"], ["nl-NL", "Dutch"], ["pl-PL", "Polish"], ["sv-SE", "Swedish"], ["id-ID", "Indonesian"], ["ms-MY", "Malay"],
  ["th-TH", "Thai"], ["vi-VN", "Vietnamese"], ["uk-UA", "Ukrainian"], ["el-GR", "Greek"], ["he-IL", "Hebrew"], ["fa-IR", "Persian"], ["sw-KE", "Swahili"],
] as const;

/* Minimal Web Speech API types (Chrome / Edge). */
interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface SpeechEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const nameOf = (p: Participant | undefined, fallback = "Participant") => readMeta(p?.metadata)?.name ?? (p?.name || fallback);
const mask = (text: string) => {
  const found = scanContact(text, "chat");
  return found.found ? maskMatches(text, found.matches) : text;
};
const clock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const timeLabel = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function useNarrow() {
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

/* ─── Outer: the ticket, the connection and what happens when it ends ─────── */

export function LiveClassroom(props: Props) {
  const [attempt, setAttempt] = React.useState(0);
  return <Joiner key={attempt} {...props} onRetry={() => setAttempt((a) => a + 1)} />;
}

function Joiner({ bookingId, title, ticket: given, chat, onRefresh, onLeave, onRetry }: Props & { onRetry: () => void }) {
  const [state, setState] = React.useState<{ ticket?: JoinTicket; error?: string }>(given ? { ticket: given } : {});
  const [roomError, setRoomError] = React.useState<{ title: string; message: string } | null>(null);
  const [ended, setEnded] = React.useState<{ title: string; message: string; rejoin: boolean } | null>(null);
  const leavingRef = React.useRef(false);
  const connectedRef = React.useRef(false);

  React.useEffect(() => {
    if (given) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/classroom/join?id=${encodeURIComponent(bookingId)}`);
        const data = (await res.json().catch(() => ({}))) as { ticket?: JoinTicket; error?: string };
        if (cancelled) return;
        setState(res.ok && data.ticket ? { ticket: data.ticket } : { error: data.error ?? `We couldn't open the classroom (${res.status}).` });
      } catch {
        if (!cancelled) setState({ error: "You seem to be offline. Check your connection and try again." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, given]);

  const shell = (children: React.ReactNode) => <div className="dark fixed inset-0 z-50 grid place-items-center bg-page p-4 text-ink">{children}</div>;

  if (ended) {
    return shell(
      <div className="w-full max-w-md border border-line bg-surface p-8 text-center" role="status">
        <span className="mx-auto mb-4 grid size-14 place-items-center bg-brand-soft text-brand">
          <PhoneOff className="size-6" aria-hidden />
        </span>
        <p className="font-heading text-[1.6rem] leading-tight">{ended.title}</p>
        <p className="mt-2 text-[14.5px] text-muted">{ended.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          {ended.rejoin && (
            <button type="button" onClick={onRetry} className="flex items-center gap-2 bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover">
              <RefreshCw className="size-4" aria-hidden /> Rejoin
            </button>
          )}
          <button type="button" onClick={onLeave} className="border border-line-strong px-5 py-2.5 text-sm font-semibold hover:bg-sunken">
            Back to the lesson
          </button>
        </div>
      </div>,
    );
  }
  if (state.error) {
    return shell(
      <div className="w-full max-w-md border border-line bg-surface p-8 text-center" role="alert">
        <span className="mx-auto mb-4 grid size-14 place-items-center bg-danger/15 text-danger">
          <PhoneOff className="size-6" aria-hidden />
        </span>
        <p className="font-heading text-[1.6rem] leading-tight">Can&apos;t join this class</p>
        <p className="mt-2 text-[14.5px] text-muted">{state.error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={onRetry} className="bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover">
            Try again
          </button>
          <button type="button" onClick={onLeave} className="border border-line-strong px-5 py-2.5 text-sm font-semibold hover:bg-sunken">
            Close
          </button>
        </div>
      </div>,
    );
  }
  if (!state.ticket) {
    return shell(
      <div className="text-center" role="status">
        <Loader2 className="mx-auto mb-4 size-9 animate-spin text-brand" aria-hidden />
        <p className="text-lg">Joining the class…</p>
        <p className="mt-1 text-sm text-muted">{title}</p>
      </div>,
    );
  }
  const ticket = state.ticket;
  return (
    <div className="dark">
      {roomError && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 text-ink">
          <div className="max-w-md border border-line bg-surface p-8 text-center" role="alert">
            <span className="mx-auto mb-4 grid size-14 place-items-center bg-warning/15 text-warning">
              <AlertTriangle className="size-6" aria-hidden />
            </span>
            <p className="text-lg font-semibold">{roomError.title}</p>
            <p className="mt-2 text-sm text-muted">{roomError.message}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={onRetry} className="bg-brand px-5 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover">
                Rejoin
              </button>
              <button type="button" onClick={() => setRoomError(null)} className="border border-line-strong px-5 py-2 text-sm font-semibold hover:bg-sunken">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      <LiveKitRoom
        token={ticket.token}
        serverUrl={ticket.wsUrl}
        connect
        video={!ticket.startMuted}
        audio={!ticket.startMuted}
        options={{ adaptiveStream: true, dynacast: true }}
        onError={(e) => setRoomError({ title: "Connection problem", message: e?.message || "We couldn't reach the class server. Check your internet and try again." })}
        onMediaDeviceFailure={(failure) =>
          setRoomError({
            title: "Camera or microphone blocked",
            message:
              failure === MediaDeviceFailure.PermissionDenied
                ? "Allow the camera and microphone for this site (the icon in the address bar), then rejoin. You can still see, hear and use the whiteboard."
                : failure === MediaDeviceFailure.DeviceInUse
                  ? "Another app is using your camera or microphone. Close it, then rejoin."
                  : "We couldn't start your camera or microphone. You can still see, hear and use the whiteboard.",
          })
        }
        onConnected={() => {
          connectedRef.current = true;
          setRoomError(null);
        }}
        onDisconnected={(reason) => {
          if (leavingRef.current) return;
          if (!connectedRef.current) {
            setEnded({ title: "Couldn't connect to the class", message: "We couldn't reach the video server. Check your internet connection and try again.", rejoin: true });
            return;
          }
          if (reason === DisconnectReason.ROOM_DELETED) setEnded({ title: "The class has ended", message: "The tutor ended the class for everyone. Notes and shared boards are on the lesson page.", rejoin: false });
          else if (reason === DisconnectReason.PARTICIPANT_REMOVED) setEnded({ title: "You were removed", message: "The tutor removed you from the class.", rejoin: false });
          else if (reason === DisconnectReason.DUPLICATE_IDENTITY) setEnded({ title: "Opened somewhere else", message: "You joined this class from another tab or device, so this one was closed.", rejoin: true });
          else setEnded({ title: "You left the class", message: "The connection closed. You can rejoin while the lesson is on.", rejoin: true });
        }}
        style={{ position: "fixed", inset: 0, zIndex: 50 }}
      >
        <MeetingRoom bookingId={bookingId} title={title} ticket={ticket} chat={chat} onRefresh={onRefresh} leavingRef={leavingRef} onLeave={onLeave} />
      </LiveKitRoom>
    </div>
  );
}

/* ─── Inner: the room ────────────────────────────────────────────────────── */

function MeetingRoom({
  bookingId, title, ticket, chat, onRefresh, leavingRef, onLeave,
}: {
  bookingId: string;
  title: string;
  ticket: JoinTicket;
  chat?: ClassChat;
  onRefresh?: () => void;
  leavingRef: React.RefObject<boolean>;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const isHost = ticket.me.isHost;
  const isNarrow = useNarrow();

  const [panel, setPanel] = React.useState<"people" | "chat" | "transcript" | null>(null);
  const [showBoard, setShowBoard] = React.useState(false);
  const [boardFull, setBoardFull] = React.useState(true);
  const [boardCanDraw, setBoardCanDraw] = React.useState(false);
  const [gridView, setGridView] = React.useState(true);
  const [pinned, setPinned] = React.useState<string | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [now, setNow] = React.useState(0);
  const [leaving, setLeaving] = React.useState(false);
  const [confirmEnd, setConfirmEnd] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [lobby, setLobby] = React.useState<{ id: string; name: string }[]>([]);
  const [transcript, setTranscript] = React.useState("");
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [seenChat, setSeenChat] = React.useState(chat?.lines.length ?? 0);
  // Captions
  const [captionsOn, setCaptionsOn] = React.useState(false);
  const [captionStatus, setCaptionStatus] = React.useState<"idle" | "listening" | "error">("idle");
  const [interim, setInterim] = React.useState("");
  const [lines, setLines] = React.useState<{ id: number; speaker: string; text: string }[]>([]);
  const [lang, setLang] = React.useState("en-US");
  const [langOpen, setLangOpen] = React.useState(false);
  const [langSearch, setLangSearch] = React.useState("");
  const captionsOnRef = React.useRef(false);
  const recRef = React.useRef<Recognition | null>(null);
  const langRef = React.useRef(lang);
  const lineSeq = React.useRef(0);

  const say = React.useCallback((msg: string, ms = 4000) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((m) => (m === msg ? null : m)), ms);
  }, []);

  // Timer, and the clock used for "the room closes soon".
  React.useEffect(() => {
    const t0 = Date.now();
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - t0) / 1000));
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(t);
  }, []);
  const closesInMin = now ? Math.ceil((ticket.closesAt - now) / 60_000) : null;

  // The host sees who is waiting in the lobby.
  React.useEffect(() => {
    if (!isHost) return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/classroom/guests?id=${encodeURIComponent(bookingId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { waiting?: { id: string; name: string }[] };
        if (!stop) setLobby(data.waiting ?? []);
      } catch {
        // try again on the next tick
      }
    };
    void poll();
    const t = window.setInterval(poll, 5000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [isHost, bookingId]);

  const decideGuest = async (guestId: string, admit: boolean) => {
    setLobby((l) => l.filter((g) => g.id !== guestId));
    try {
      const res = await fetch("/api/classroom/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bookingId, guestId, admit }) });
      if (!res.ok) say(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That request has expired.");
    } catch {
      say("Couldn't reach the server. Try again.");
    }
  };

  /* ── data channel: captions and chat pings ── */

  React.useEffect(() => {
    const handler = (payload: Uint8Array, participant?: Participant) => {
      let msg: { type?: string; speaker?: string; text?: string };
      try {
        msg = JSON.parse(new TextDecoder().decode(payload)) as typeof msg;
      } catch {
        return;
      }
      if (msg.type === TOPIC.chat) {
        onRefresh?.();
        return;
      }
      if (msg.type !== TOPIC.caption || typeof msg.text !== "string") return;
      const text = mask(msg.text.slice(0, 500));
      const speaker = nameOf(participant, "Guest");
      const id = ++lineSeq.current;
      setLines((prev) => [...prev.slice(-2), { id, speaker, text }]);
      setTranscript((prev) => `${prev}[${timeLabel()}] ${speaker}: ${text}\n`);
      window.setTimeout(() => setLines((prev) => prev.filter((l) => l.id !== id)), 5000);
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room, onRefresh]);

  const sendChat = async (body: string) => {
    if (!chat) return "Chat isn't available here.";
    const err = await chat.onSend(body);
    if (!err) {
      try {
        void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: TOPIC.chat })), { reliable: true });
      } catch {
        // the other side still sees it on its next refresh
      }
    }
    return err;
  };

  /* ── live captions (Web Speech API) ── */

  const stopRecognition = React.useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    rec.onend = null;
    rec.onerror = null;
    rec.onresult = null;
    try {
      rec.abort();
    } catch {
      // already stopped
    }
  }, []);

  const startCaptions = React.useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setCaptionStatus("error");
      say("Live captions need Chrome or Edge.");
      return;
    }
    stopRecognition();
    const me = ticket.me.name;
    const create = (): Recognition => {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = langRef.current;
      rec.onstart = () => setCaptionStatus("listening");
      rec.onresult = (e) => {
        let pending = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const said = e.results[i][0].transcript;
          if (!e.results[i].isFinal) {
            pending += said;
            continue;
          }
          const text = mask(said.trim());
          if (!text) continue;
          const id = ++lineSeq.current;
          setLines((prev) => [...prev.slice(-2), { id, speaker: me, text }]);
          setTranscript((prev) => `${prev}[${timeLabel()}] ${me}: ${text}\n`);
          window.setTimeout(() => setLines((prev) => prev.filter((l) => l.id !== id)), 5000);
          try {
            // Captions may be dropped rather than stall the room.
            void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: TOPIC.caption, text: text.slice(0, 500) })), { reliable: false });
          } catch {
            // fine
          }
        }
        setInterim(pending);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          captionsOnRef.current = false;
          setCaptionsOn(false);
          setCaptionStatus("error");
          say("The microphone is blocked, so captions are off. Allow it in your browser to use them.");
          stopRecognition();
        } else if (e.error === "network") setCaptionStatus("error");
      };
      rec.onend = () => {
        setInterim("");
        if (!captionsOnRef.current) {
          setCaptionStatus("idle");
          return;
        }
        window.setTimeout(() => {
          if (!captionsOnRef.current) return;
          try {
            const next = create();
            next.start();
            recRef.current = next;
          } catch {
            setCaptionStatus("error");
          }
        }, 300);
      };
      return rec;
    };
    try {
      const rec = create();
      rec.start();
      recRef.current = rec;
    } catch {
      setCaptionStatus("error");
    }
  }, [room, ticket.me.name, say, stopRecognition]);

  // Leaving switches the microphone off for good.
  React.useEffect(
    () => () => {
      captionsOnRef.current = false;
      stopRecognition();
    },
    [stopRecognition],
  );

  const toggleCaptions = () => {
    if (!captionsOn) {
      setPanel("transcript");
      captionsOnRef.current = true;
      setCaptionsOn(true);
      setCaptionStatus("idle");
      startCaptions();
    } else {
      captionsOnRef.current = false;
      setCaptionsOn(false);
      setCaptionStatus("idle");
      stopRecognition();
      setInterim("");
      setLines([]);
    }
  };

  const pickLang = (code: string) => {
    setLang(code);
    langRef.current = code;
    setLangOpen(false);
    setLangSearch("");
    if (captionsOnRef.current) window.setTimeout(startCaptions, 200);
  };

  /* ── devices ── */

  const toggle = async (what: "mic" | "cam" | "screen") => {
    try {
      if (what === "mic") await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      else if (what === "cam") await localParticipant.setCameraEnabled(!isCameraEnabled);
      else await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, { audio: false });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (what === "screen" && name === "NotAllowedError") return; // the picker was cancelled
      say(name === "NotAllowedError" ? `Your browser is blocking the ${what === "cam" ? "camera" : what === "mic" ? "microphone" : "screen"}. Allow it from the address bar.` : `The ${what === "cam" ? "camera" : what === "mic" ? "microphone" : "screen share"} couldn't start.`);
    }
  };

  /* ── snapshots (host) ── */

  const captureSnapshot = async () => {
    if (!isHost) return;
    let captured = false;
    if (showBoard) {
      const board = document.querySelector<HTMLCanvasElement>("canvas[data-board-canvas]");
      if (board && board.width > 1) {
        const flat = document.createElement("canvas");
        flat.width = board.width;
        flat.height = board.height;
        const ctx = flat.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, flat.width, flat.height);
        try {
          ctx.drawImage(board, 0, 0);
          setSnapshots((s) => [...s, { at: timeLabel(), title: "Whiteboard", image: flat.toDataURL("image/jpeg", 0.6) }].slice(-20));
          captured = true;
        } catch {
          // a picture on the board that the browser won't let us read
        }
      }
    }
    const share = [room.localParticipant, ...room.remoteParticipants.values()]
      .map((p) => p.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack)
      .find((t): t is MediaStreamTrack => !!t);
    if (share) {
      try {
        const video = document.createElement("video");
        video.srcObject = new MediaStream([share]);
        video.muted = true;
        video.playsInline = true;
        await video.play();
        await new Promise((r) => window.setTimeout(r, 600));
        const c = document.createElement("canvas");
        c.width = video.videoWidth || 1280;
        c.height = video.videoHeight || 720;
        c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
        video.pause();
        video.srcObject = null;
        setSnapshots((s) => [...s, { at: timeLabel(), title: "Screen share", image: c.toDataURL("image/jpeg", 0.6) }].slice(-20));
        captured = true;
      } catch {
        // skip
      }
    }
    say(captured ? "Snapshot added to the transcript" : "Open the whiteboard or share a screen to take a snapshot.", 2500);
  };

  /* ── leaving ── */

  const leave = async (endForEveryone: boolean) => {
    setLeaving(true);
    leavingRef.current = true;
    if (isHost && endForEveryone) {
      try {
        await fetch("/api/classroom/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bookingId }) });
      } catch {
        // the room still closes when the lesson's time is up
      }
    }
    if (isHost && (transcript.trim() || snapshots.length)) {
      try {
        await fetch("/api/classroom/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: bookingId, transcript, snapshots: snapshots.map((s) => ({ title: s.title, at: s.at, image: s.image })) }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        // the transcript is also downloadable as a PDF
      }
    }
    captionsOnRef.current = false;
    stopRecognition();
    await room.disconnect();
    onLeave();
  };

  /* ── tracks and layout ── */

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const screenTracks = tracks.filter((t) => t.source === Track.Source.ScreenShare && isTrackReference(t));
  const camTracks = tracks.filter((t) => t.source !== Track.Source.ScreenShare);
  const pinnedTrack = pinned ? camTracks.find((t) => t.participant.identity === pinned) : undefined;
  const others = React.useMemo(() => participants.filter((p) => p.identity !== localParticipant.identity).map((p) => ({ id: p.identity, name: nameOf(p) })), [participants, localParticipant.identity]);
  const chatUnread = chat ? Math.max(0, chat.lines.length - seenChat) : 0;
  if (panel === "chat" && chat && seenChat !== chat.lines.length) setSeenChat(chat.lines.length);

  const tile = (t: TrackReferenceOrPlaceholder, small = false) => {
    const self = t.participant.identity === localParticipant.identity;
    const label = nameOf(t.participant);
    return (
      <div
        key={`${t.participant.identity}-${t.source}`}
        className={cn("group relative overflow-hidden bg-sunken", small ? "w-32 shrink-0" : "min-h-[120px]", !gridView && !small && "cursor-pointer")}
        onClick={() => !gridView && setPinned(t.participant.identity)}
      >
        {isTrackReference(t) && t.publication.track && !t.publication.isMuted ? (
          <VideoTrack trackRef={t} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center">
            <span className={cn("grid place-items-center rounded-full bg-brand font-semibold text-on-brand", small ? "size-10 text-lg" : "size-16 text-2xl")}>{label.charAt(0).toUpperCase() || "?"}</span>
          </div>
        )}
        <span className="absolute bottom-1.5 left-1.5 max-w-[85%] truncate bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {self ? `${label} (you)` : label}
          {!t.participant.isMicrophoneEnabled && <MicOff className="ml-1 inline size-3 text-red-300" aria-label="muted" />}
        </span>
      </div>
    );
  };

  const control = (on: boolean, danger: boolean) => cn("grid size-12 place-items-center rounded-full transition-colors", danger ? "bg-danger text-white hover:bg-danger/85" : on ? "bg-brand text-on-brand hover:bg-brand-hover" : "bg-sunken text-ink hover:bg-line");
  const side = (key: "people" | "chat" | "transcript") => setPanel((p) => (p === key ? null : key));

  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col bg-page text-ink" data-classroom-room="">
      {/* Waiting room (host) */}
      {isHost && lobby.length > 0 && (
        <div className="absolute right-4 top-16 z-[55] w-72 border border-line bg-surface p-3 shadow-2xl" role="region" aria-label="Waiting to join">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-warning">Waiting to join ({lobby.length})</p>
          <div className="space-y-2">
            {lobby.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-warning/20 text-xs font-bold text-warning">{g.name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{g.name}</span>
                <button type="button" onClick={() => void decideGuest(g.id, true)} className="bg-live px-2 py-1 text-xs font-semibold text-white hover:opacity-90">
                  Admit
                </button>
                <button type="button" onClick={() => void decideGuest(g.id, false)} className="bg-sunken px-2 py-1 text-xs font-semibold text-ink hover:bg-line">
                  Deny
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 md:px-4">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <span className="grid size-8 shrink-0 place-items-center bg-brand font-heading text-lg text-on-brand">T</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="font-mono text-xs text-muted" role="timer">{clock(elapsed)}</p>
          </div>
          {isHost && <span className="shrink-0 bg-brand px-2 py-0.5 text-xs font-semibold text-on-brand">Host</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          {closesInMin !== null && closesInMin <= 10 && closesInMin > 0 && <span className="hidden bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning sm:inline">Room closes in {closesInMin} min</span>}
          <button type="button" onClick={() => setGridView((v) => !v)} className="grid size-9 place-items-center text-muted hover:bg-sunken hover:text-ink" title={gridView ? "Speaker view" : "Grid view"} aria-label={gridView ? "Speaker view" : "Grid view"}>
            {gridView ? <UserIcon className="size-[18px]" /> : <LayoutGrid className="size-[18px]" />}
          </button>
          <span className="flex items-center gap-1 text-sm text-muted" aria-label={`${participants.length} in the class`}>
            <Users className="size-4" aria-hidden /> {participants.length}
          </span>
        </div>
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className={cn("flex flex-col gap-2 overflow-hidden p-2", showBoard ? (boardFull ? "hidden" : "hidden md:flex md:w-1/2") : "flex-1")}>
          {screenTracks.length > 0 ? (
            <>
              <div className="relative flex-1 overflow-hidden bg-black">
                {isTrackReference(screenTracks[0]) && <VideoTrack trackRef={screenTracks[0]} className="size-full object-contain" />}
                <span className="absolute left-2 top-2 flex items-center gap-1 bg-brand px-2 py-1 text-xs font-semibold text-on-brand">
                  <MonitorUp className="size-3.5" aria-hidden /> {nameOf(screenTracks[0].participant)} is sharing their screen
                </span>
              </div>
              {camTracks.length > 0 && <div className="flex h-24 shrink-0 gap-2 overflow-x-auto">{camTracks.map((t) => tile(t, true))}</div>}
            </>
          ) : !gridView && pinnedTrack ? (
            <>
              <div className="relative flex-1 cursor-pointer overflow-hidden bg-sunken" onClick={() => setPinned(null)}>
                {tile(pinnedTrack)}
              </div>
              <div className="flex h-28 shrink-0 gap-2 overflow-x-auto">{camTracks.filter((t) => t.participant.identity !== pinned).map((t) => tile(t, true))}</div>
            </>
          ) : (
            <div
              className="grid flex-1 gap-2"
              style={{
                gridTemplateColumns: isNarrow ? (camTracks.length <= 2 ? "1fr" : "repeat(2,1fr)") : camTracks.length <= 1 ? "1fr" : camTracks.length <= 4 ? "repeat(2,1fr)" : "repeat(3,1fr)",
                gridAutoRows: "1fr",
              }}
            >
              {camTracks.map((t) => tile(t))}
            </div>
          )}
        </div>

        {/* Whiteboard: mounted for the whole class (strokes live here, and someone must answer a late joiner); closing only hides it. */}
        <div className={cn(showBoard ? cn("absolute inset-0 z-30 flex w-full flex-col md:relative md:inset-auto md:z-auto", boardFull ? "md:w-full" : "md:w-1/2") : "hidden", "border-l border-line")}>
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-1.5">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <PenLine className="size-4 shrink-0" aria-hidden /> <span className="truncate">Whiteboard</span>
              {!boardCanDraw && <span className="shrink-0 text-xs font-normal text-warning">View only</span>}
              {boardCanDraw && !isHost && <span className="shrink-0 text-xs font-normal text-live">You can draw</span>}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setBoardFull((v) => !v)} className="hidden items-center gap-1.5 px-2 py-1 text-xs text-muted hover:bg-sunken hover:text-ink md:flex">
                {boardFull ? <Minimize2 className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
                {boardFull ? "Split view" : "Full screen"}
              </button>
              <button type="button" onClick={() => setShowBoard(false)} className="px-2 py-1 text-xs text-muted hover:bg-sunken hover:text-ink">
                Close
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <MeetingWhiteboard isHost={isHost} bookingId={bookingId} title={title} participants={others} onCanDrawChange={setBoardCanDraw} />
          </div>
        </div>

        {/* Side panel */}
        {panel && (
          <div className="absolute inset-0 z-30 flex w-full flex-col border-l border-line bg-surface md:relative md:inset-auto md:z-auto md:w-80">
            <div className="flex border-b border-line">
              {(["people", "chat", "transcript"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setPanel(k)} className={cn("flex-1 py-3 text-sm font-semibold transition-colors", panel === k ? "border-b-2 border-brand text-ink" : "text-muted hover:text-ink")}>
                  {k === "people" ? `People (${participants.length})` : k === "chat" ? "Chat" : "Transcript"}
                </button>
              ))}
              <button type="button" onClick={() => setPanel(null)} className="px-3 text-muted hover:text-ink md:hidden" aria-label="Close the panel">
                ✕
              </button>
            </div>

            {panel === "people" && (
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {participants.map((p) => {
                  const meta = readMeta(p.metadata);
                  const self = p.identity === localParticipant.identity;
                  return (
                    <div key={p.identity} className="flex items-center gap-3 p-2 hover:bg-sunken">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold", meta?.isHost ? "bg-brand text-on-brand" : "bg-line-strong text-ink")}>{nameOf(p).charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {nameOf(p)} {self && <span className="text-xs text-muted">(you)</span>}
                        </p>
                        <span className={cn("mt-0.5 inline-block px-1.5 py-0.5 text-[11px] font-semibold", meta?.isHost ? "bg-brand text-on-brand" : "bg-sunken text-ink-2")}>{meta?.isHost ? `Host · ${meta.role}` : (meta?.role ?? "Guest")}</span>
                      </div>
                      <div className="flex gap-1">
                        {!p.isMicrophoneEnabled && <MicOff className="size-3.5 text-red-300" aria-label="microphone off" />}
                        {!p.isCameraEnabled && <VideoOff className="size-3.5 text-red-300" aria-label="camera off" />}
                      </div>
                    </div>
                  );
                })}
                {isHost && <GuestLinkBox bookingId={bookingId} />}
              </div>
            )}

            {panel === "chat" &&
              (chat ? (
                <ChatPanel lines={chat.lines} onSend={sendChat} disabledReason={chat.disabledReason} peerName={chat.peerName} note={chat.note} className="flex min-h-0 flex-1" />
              ) : (
                <p className="p-4 text-sm text-muted">The lesson chat is for the student and the tutor. Use your microphone to talk.</p>
              ))}

            {panel === "transcript" && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="size-4 text-brand" aria-hidden /> Live transcript
                  </p>
                  <button
                    type="button"
                    onClick={() => (transcript ? void downloadTranscriptPdf({ title, transcript, snapshots }) : say("Nothing has been captioned yet. Turn on CC first."))}
                    className="bg-brand px-2 py-1 text-xs font-semibold text-on-brand hover:bg-brand-hover"
                  >
                    Download PDF
                  </button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
                  {transcript ? (
                    transcript
                      .split("\n")
                      .filter(Boolean)
                      .map((line, i) => {
                        const m = /^\[(.*?)\] (.*?): (.*)$/.exec(line);
                        return m ? (
                          <div key={i}>
                            <p className="text-xs">
                              <span className="font-semibold text-brand">{m[2]}</span> <span className="font-mono text-muted">{m[1]}</span>
                            </p>
                            <p className="mt-0.5 text-ink-2">{m[3]}</p>
                          </div>
                        ) : null;
                      })
                  ) : (
                    <p className="py-8 text-center text-muted">The transcript appears here once someone speaks with captions (CC) on.</p>
                  )}
                  {snapshots.length > 0 && <p className="text-xs text-muted">{snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"} will be saved with it.</p>}
                </div>
                {isHost && <p className="border-t border-line px-3 py-2 text-[11.5px] text-muted">When you leave, the transcript and snapshots are saved to the lesson page (contact details hidden).</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Captions */}
      {captionsOn && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="flex min-h-[56px] w-full max-w-2xl flex-col justify-center bg-black/80 px-5 py-3 text-white" aria-live="polite">
            {lines.length || interim ? (
              <>
                {lines.map((l) => (
                  <p key={l.id} className="text-lg">
                    <span className="font-semibold text-brand">{l.speaker}:</span> {l.text}
                  </p>
                ))}
                {interim && (
                  <p className="text-lg text-white/60">
                    <span className="font-semibold">{ticket.me.name}:</span> {interim}
                  </p>
                )}
              </>
            ) : (
              <p className="flex items-center justify-center gap-2 text-sm italic text-white/60">
                <span className="size-2 animate-pulse rounded-full bg-live" /> {captionStatus === "listening" ? "Listening…" : captionStatus === "error" ? "Captions couldn't start" : "Starting captions…"}
              </p>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-[56] flex justify-center px-4">
          <p className="bg-night px-4 py-2 text-sm text-white shadow-xl" role="status">
            {notice}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col-reverse gap-2 border-t border-line px-2 py-2 md:flex-row md:items-center md:justify-between md:gap-0 md:px-6 md:py-3">
        <div className="hidden w-40 font-mono text-sm text-muted md:block">{clock(elapsed)}</div>
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
          <button type="button" onClick={() => void toggle("mic")} className={control(false, !isMicrophoneEnabled)} aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"} title={isMicrophoneEnabled ? "Mute" : "Unmute"}>
            {isMicrophoneEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>
          <button type="button" onClick={() => void toggle("cam")} className={control(false, !isCameraEnabled)} aria-label={isCameraEnabled ? "Turn off camera" : "Turn on camera"} title={isCameraEnabled ? "Turn off camera" : "Turn on camera"}>
            {isCameraEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </button>
          <button type="button" onClick={() => void toggle("screen")} className={control(isScreenShareEnabled, false)} aria-label={isScreenShareEnabled ? "Stop sharing" : "Share screen"} title={isScreenShareEnabled ? "Stop sharing" : "Share screen"}>
            <MonitorUp className="size-5" />
          </button>
          <button type="button" onClick={() => setShowBoard((v) => !v)} className={control(showBoard, false)} aria-label="Whiteboard" title="Whiteboard" aria-pressed={showBoard}>
            <PenLine className="size-5" />
          </button>
          <button type="button" onClick={() => void leave(false)} disabled={leaving} className="flex h-12 items-center gap-2 rounded-full bg-danger px-5 text-sm font-semibold text-white hover:bg-danger/85 disabled:opacity-60 md:px-7">
            {leaving ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <PhoneOff className="size-5" aria-hidden />}
            {leaving ? "Leaving…" : "Leave"}
          </button>
          {isHost &&
            (confirmEnd ? (
              <span className="flex items-center gap-2 border border-danger/50 px-3 py-2 text-sm">
                End for everyone?
                <button type="button" onClick={() => void leave(true)} disabled={leaving} className="bg-danger px-3 py-1 text-xs font-semibold text-white">
                  End class
                </button>
                <button type="button" onClick={() => setConfirmEnd(false)} className="px-2 py-1 text-xs text-muted hover:text-ink">
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmEnd(true)} disabled={leaving} className="h-12 rounded-full border border-danger/50 px-4 text-sm font-semibold text-red-300 hover:bg-danger/15 disabled:opacity-60" title="End the class for everyone">
                <span className="md:hidden">End</span>
                <span className="hidden md:inline">End class</span>
              </button>
            ))}
        </div>
        <div className="flex w-full items-center justify-center gap-2 overflow-x-auto pb-0.5 md:w-auto md:justify-end">
          <button type="button" onClick={toggleCaptions} className={cn("relative h-10 border px-3 text-sm font-bold", captionsOn ? "border-brand bg-brand text-on-brand" : "border-line bg-sunken hover:bg-line")} aria-pressed={captionsOn} title="Live captions (CC)">
            CC
            {captionsOn && <span className={cn("absolute -right-1 -top-1 size-3 rounded-full border-2 border-page", captionStatus === "listening" ? "animate-pulse bg-live" : captionStatus === "error" ? "bg-danger" : "bg-warning")} />}
          </button>
          {captionsOn && (
            <div className="relative">
              <button type="button" onClick={() => setLangOpen((v) => !v)} className="flex h-10 max-w-[9rem] items-center gap-1 border border-line bg-sunken px-3 text-xs hover:bg-line" aria-label="Caption language">
                <span className="truncate">{LANGUAGES.find(([c]) => c === lang)?.[1]}</span> ▾
              </button>
              {langOpen && (
                <div className="absolute bottom-12 right-0 z-50 w-56 border border-line bg-surface shadow-2xl">
                  <input autoFocus value={langSearch} onChange={(e) => setLangSearch(e.target.value)} placeholder="Search language…" aria-label="Search language" className="w-full border-b border-line bg-canvas px-3 py-2 text-sm text-ink outline-none" />
                  <div className="max-h-52 overflow-y-auto">
                    {LANGUAGES.filter(([, label]) => label.toLowerCase().includes(langSearch.toLowerCase())).map(([code, label]) => (
                      <button key={code} type="button" onClick={() => pickLang(code)} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sunken", lang === code && "text-brand")}>
                        {label}
                        {lang === code && <Check className="ml-auto size-3.5" aria-hidden />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={() => side("people")} className={control(panel === "people", false)} aria-label="People" title="People">
            <Users className="size-[18px]" />
          </button>
          {isHost && (
            <button type="button" onClick={() => void captureSnapshot()} className={control(false, false)} aria-label="Take a snapshot for the transcript" title="Snapshot of the board or shared screen">
              <Camera className="size-[18px]" />
            </button>
          )}
          <button type="button" onClick={() => side("transcript")} className={control(panel === "transcript", false)} aria-label="Transcript" title="Transcript">
            <FileText className="size-[18px]" />
          </button>
          <button type="button" onClick={() => side("chat")} className={cn(control(panel === "chat", false), "relative")} aria-label={chatUnread ? `Chat, ${chatUnread} new` : "Chat"} title="Chat">
            <MessageSquare className="size-[18px]" />
            {chatUnread > 0 && panel !== "chat" && <span className="absolute right-1 top-1 size-2.5 rounded-full bg-brand" />}
          </button>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

/** Host: turn the guest link on, copy it, or make a new one (the old one stops working). */
export function GuestLinkBox({ bookingId }: { bookingId: string }) {
  const [link, setLink] = React.useState<string | null | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch(`/api/classroom/info?id=${encodeURIComponent(bookingId)}`)
      .then((r) => r.json())
      .then((d: { guestLink?: string | null }) => !cancelled && setLink(d.guestLink ?? null))
      .catch(() => !cancelled && setLink(null));
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const set = async (enabled: boolean, rotate = false) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/classroom/guest-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bookingId, enabled, rotate }) });
      const d = (await res.json().catch(() => ({}))) as { guestLink?: string | null; error?: string };
      if (!res.ok) setError(d.error ?? "Couldn't change the guest link.");
      else setLink(d.guestLink ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border border-line p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        <Link2 className="size-3.5" aria-hidden /> Guest link
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted">For someone without an account (for example another parent). They wait until you admit them, and only during this lesson.</p>
      {link === undefined ? (
        <p className="mt-2 text-xs text-muted">Loading…</p>
      ) : link ? (
        <>
          <code className="mt-2 block truncate bg-night px-2 py-1 font-mono text-[11px] text-ink-2" title={link}>
            {link}
          </code>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1 bg-brand px-2.5 py-1 text-xs font-semibold text-on-brand"
            >
              {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />} {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" disabled={busy} onClick={() => void set(true, true)} className="border border-line-strong px-2.5 py-1 text-xs font-semibold hover:bg-sunken">
              New link
            </button>
            <button type="button" disabled={busy} onClick={() => void set(false)} className="px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink">
              Turn off
            </button>
          </div>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => void set(true)} className="mt-2 border border-line-strong px-2.5 py-1 text-xs font-semibold hover:bg-sunken">
          Turn on the guest link
        </button>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
