"use client";

import * as React from "react";
import { RoomEvent, Track, type Participant, type Room } from "livekit-client";
import { readMeta, TOPIC } from "@/lib/classroom";

/*
 * Recording the class, on the recorder's own device. Whoever wants a recording presses Record; nothing is
 * uploaded anywhere: the video is put together in this browser (the shared screen or the whiteboard, everyone's
 * camera, and all the voices) and saved to this device as a file when the recording stops. Everyone in the class
 * sees who is recording (each recorder's page says so every few seconds), and the server notes when a
 * recording started and stopped (the audit log; never the recording itself).
 */

const FPS = 15;
/** How often a recorder says so again (late joiners hear it), and when the others stop showing it without news. */
export const REC_EVERY_MS = 8000;
const REC_STALE_MS = 20_000;

const MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1,mp4a", "video/mp4"];

/** Whether this browser can record the class (MediaRecorder, a canvas stream and Web Audio). */
export function canRecordClass(): boolean {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") return false;
  if (typeof HTMLCanvasElement.prototype.captureStream !== "function") return false;
  return MIME_TYPES.some((t) => MediaRecorder.isTypeSupported(t));
}

export interface ClassRecording {
  startedAt: number;
  /** Stops and hands back the file (null when nothing was recorded). */
  stop(): Promise<{ blob: Blob; name: string } | null>;
}

const nameOf = (p: Participant) => readMeta(p.metadata)?.name ?? (p.name || "Participant");

/** A <video> for a track (kept off-screen; the composite draws it). */
function videoFor(track: MediaStreamTrack, box: HTMLElement): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.srcObject = new MediaStream([track]);
  box.appendChild(v);
  void v.play().catch(() => {});
  return v;
}

/** Draws `src` (w × h) to fill or fit the box. */
function drawFit(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, x: number, y: number, w: number, h: number, cover: boolean) {
  if (!sw || !sh) return;
  const scale = cover ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/**
 * Starts recording what the class shows. `boardShown` says whether the whiteboard is open on this screen (then
 * it's the main picture unless someone shares their screen).
 */
export async function startClassRecording(room: Room, opts: { title: string; small?: boolean; boardShown: () => boolean }): Promise<ClassRecording> {
  const W = opts.small ? 960 : 1280;
  const H = opts.small ? 540 : 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;left:-10px;top:-10px;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none";
  document.body.appendChild(box);
  const videos = new Map<string, HTMLVideoElement>();
  const video = (t: MediaStreamTrack) => {
    let v = videos.get(t.id);
    if (!v) videos.set(t.id, (v = videoFor(t, box)));
    return v;
  };

  // All the voices: this person's (what the others hear) and everyone else's.
  const audio = new AudioContext();
  void audio.resume().catch(() => {});
  const dest = audio.createMediaStreamDestination();
  const sources = new Map<string, MediaStreamAudioSourceNode>();
  const syncAudio = () => {
    const want = new Map<string, MediaStreamTrack>();
    for (const p of [room.localParticipant, ...room.remoteParticipants.values()]) {
      const t = p.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
      if (t && t.readyState === "live") want.set(t.id, t);
    }
    for (const [id, node] of sources) {
      if (want.has(id)) continue;
      node.disconnect();
      sources.delete(id);
    }
    for (const [id, t] of want) {
      if (sources.has(id)) continue;
      try {
        const node = audio.createMediaStreamSource(new MediaStream([t]));
        node.connect(dest);
        sources.set(id, node);
      } catch {
        // a track that just ended
      }
    }
  };

  const started = Date.now();
  const draw = () => {
    ctx.fillStyle = "#16130f";
    ctx.fillRect(0, 0, W, H);
    const people = [room.localParticipant, ...room.remoteParticipants.values()];
    const cams = people.map((p) => {
      const pub = p.getTrackPublication(Track.Source.Camera);
      const t = pub && !pub.isMuted ? pub.track?.mediaStreamTrack : undefined;
      return { name: nameOf(p), track: t && t.readyState === "live" ? t : undefined };
    });
    const screenPub = people.map((p) => p.getTrackPublication(Track.Source.ScreenShare)).find((pub) => pub?.track && !pub.isMuted);
    const screen = screenPub?.track?.mediaStreamTrack;
    const board = opts.boardShown() ? document.querySelector<HTMLCanvasElement>("[data-board-canvas]") : null;
    const tile = (c: { name: string; track?: MediaStreamTrack }, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = "#26221c";
      ctx.fillRect(x, y, w, h);
      const v = c.track ? video(c.track) : null;
      if (v && v.readyState >= 2) drawFit(ctx, v, v.videoWidth, v.videoHeight, x, y, w, h, true);
      else {
        const r = Math.min(w, h) * 0.16;
        ctx.fillStyle = "#e5582f";
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = `600 ${Math.round(r)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(c.name.charAt(0).toUpperCase() || "?", x + w / 2, y + h / 2);
        ctx.textAlign = "start";
      }
      const fs = Math.max(11, Math.round(h / 14));
      ctx.font = `500 ${fs}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      const label = c.name.slice(0, 40);
      const lw = ctx.measureText(label).width + 12;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x + 6, y + h - fs - 12, lw, fs + 6);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x + 12, y + h - fs / 2 - 9);
    };
    const gap = 6;
    if (screen || board) {
      const side = Math.round(W * 0.22);
      const mw = W - side - gap;
      if (screen) {
        const v = video(screen);
        if (v.readyState >= 2) drawFit(ctx, v, v.videoWidth, v.videoHeight, 0, 0, mw, H, false);
      } else if (board) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, mw, H);
        drawFit(ctx, board, board.width, board.height, 0, 0, mw, H, false);
      }
      const shown = cams.slice(0, 4);
      const th = Math.min(Math.round((side * 9) / 16), Math.floor((H - gap * (shown.length - 1)) / Math.max(1, shown.length)));
      shown.forEach((c, i) => tile(c, mw + gap, i * (th + gap), side, th));
    } else {
      const n = Math.max(1, cams.length);
      const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
      const rows = Math.ceil(n / cols);
      const tw = (W - gap * (cols - 1)) / cols;
      const th = (H - gap * (rows - 1)) / rows;
      cams.forEach((c, i) => tile(c, (i % cols) * (tw + gap), Math.floor(i / cols) * (th + gap), tw, th));
    }
    // "● REC 00:12:34" in the corner.
    const s = Math.floor((Date.now() - started) / 1000);
    const time = `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(10, 10, 132, 28);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(26, 24, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(`REC ${time}`, 38, 25);
    // Videos of people who left aren't kept.
    const live = new Set([...cams.map((c) => c.track?.id), screen?.id].filter(Boolean));
    for (const [id, v] of videos) {
      if (live.has(id)) continue;
      v.srcObject = null;
      v.remove();
      videos.delete(id);
    }
  };

  draw();
  syncAudio();
  const drawTimer = window.setInterval(draw, 1000 / FPS);
  const audioTimer = window.setInterval(syncAudio, 1000);
  room.on(RoomEvent.TrackSubscribed, syncAudio);

  const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: opts.small ? 900_000 : 1_600_000, audioBitsPerSecond: 96_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start(2000);

  let stopping: Promise<{ blob: Blob; name: string } | null> | null = null;
  const cleanup = () => {
    window.clearInterval(drawTimer);
    window.clearInterval(audioTimer);
    room.off(RoomEvent.TrackSubscribed, syncAudio);
    for (const node of sources.values()) node.disconnect();
    sources.clear();
    void audio.close().catch(() => {});
    for (const t of stream.getTracks()) t.stop();
    for (const v of videos.values()) v.srcObject = null;
    videos.clear();
    box.remove();
  };
  return {
    startedAt: started,
    stop: () =>
      (stopping ??= new Promise((resolve) => {
        recorder.onstop = () => {
          cleanup();
          if (!chunks.length) return resolve(null);
          const type = recorder.mimeType || mimeType || "video/webm";
          const ext = type.includes("mp4") ? "mp4" : "webm";
          const d = new Date(started);
          const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
          const title = opts.title.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "Class";
          resolve({ blob: new Blob(chunks, { type }), name: `TutorLink ${title} ${stamp}.${ext}` });
        };
        try {
          recorder.stop();
        } catch {
          cleanup();
          resolve(null);
        }
      })),
  };
}

/** Saves a finished recording to this device. */
export function saveRecording(file: { blob: Blob; name: string }) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/**
 * Who else is recording the class right now (identity → name), from their pages' notices. `onStarted`: someone
 * just started (to say so on this screen).
 */
export function useRecordingNotices(room: Room, onStarted?: (name: string) => void): Map<string, string> {
  const [seen, setSeen] = React.useState<Map<string, { name: string; at: number }>>(new Map());
  const onStartedRef = React.useRef(onStarted);
  React.useEffect(() => {
    onStartedRef.current = onStarted;
  }, [onStarted]);
  const known = React.useRef(new Set<string>());
  React.useEffect(() => {
    const onData = (payload: Uint8Array, participant?: Participant) => {
      if (!participant) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.type !== TOPIC.rec) return;
      // Only about yourself.
      const who = participant.identity;
      if (msg.on === true && !known.current.has(who)) onStartedRef.current?.(nameOf(participant));
      if (msg.on === true) known.current.add(who);
      else known.current.delete(who);
      setSeen((m) => {
        const next = new Map(m);
        if (msg.on === true) next.set(who, { name: nameOf(participant), at: Date.now() });
        else next.delete(who);
        return next;
      });
    };
    const onLeave = (p: Participant) => {
      known.current.delete(p.identity);
      setSeen((m) => {
        if (!m.has(p.identity)) return m;
        const next = new Map(m);
        next.delete(p.identity);
        return next;
      });
    };
    const expire = window.setInterval(
      () =>
        setSeen((m) => {
          const now = Date.now();
          if (![...m.values()].some((v) => now - v.at > REC_STALE_MS)) return m;
          const kept = new Map([...m].filter(([, v]) => now - v.at <= REC_STALE_MS));
          known.current = new Set(kept.keys());
          return kept;
        }),
      5000,
    );
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    return () => {
      window.clearInterval(expire);
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
    };
  }, [room]);
  return React.useMemo(() => new Map([...seen].map(([k, v]) => [k, v.name])), [seen]);
}

/** Tells the room this page is recording (again every few seconds), or that it stopped. */
export function announceRecording(room: Room, on: boolean) {
  room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: TOPIC.rec, on })), { reliable: true }).catch(() => {});
}
