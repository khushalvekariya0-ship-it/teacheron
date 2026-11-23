"use client";

import { Track, type LocalTrackPublication, type Room } from "livekit-client";
import { judge, numbersInPicture } from "@/lib/handwriting/digits";
import type { ContactKind } from "@/lib/domain/contact";
import type { SafetyResult } from "./LessonSafety";
import { guestPass } from "./guestPass";

/*
 * Protected screen share: the screen is checked BEFORE anyone else sees it.
 *
 *   1. The screen is captured on this computer only; that capture is never sent.
 *   2. Each new picture is checked: printed text and QR codes on TutorLink's own server (Tesseract / jsQR,
 *      nothing stored, no outside service), handwritten numbers here in the browser.
 *   3. Clean → it's drawn on the canvas whose stream is what the others get.
 *   4. Contact details found → the lines that hold them are blacked out and the blacked-out picture is
 *      checked again; only if that comes back clean is it shown ("hidden").
 *   5. Can't be blacked out (handwriting, or it's spread over the picture), the check failed or is too late →
 *      the others see a "paused" card instead ("paused"). An unchecked picture is never drawn.
 *
 * Others see the screen a second or so late, and only pictures that changed are checked again.
 * Limits: a browser can't stop someone pointing a phone camera at their screen, and very small, unusual or
 * handwritten text can be missed by OCR.
 */

export type GuardState = "checking" | "live" | "hidden" | "paused";

export const GUARD_TEXT = {
  title: "TutorLink Privacy Protection Alert!",
  hidden: "Personal information has been detected. Your content has been automatically hidden to protect your privacy.",
  paused: "Screen sharing has been temporarily paused because personal information was detected.",
  unchecked: "Screen sharing is paused for a moment: your screen couldn't be checked. It comes back by itself.",
};

type Box = [number, number, number, number];
type Answer = { found: boolean; checked?: boolean; kinds?: ContactKind[]; boxes?: Box[]; maskable?: boolean } & Partial<SafetyResult>;

/** Largest picture the others get; pictures are checked at CHECK_WIDTH (the server reads them at twice that). */
const OUT_WIDTH = 1600;
const CHECK_WIDTH = 1280;
const CHECK_TIMEOUT_MS = 9000;
/** After this long showing the screen as it is, contact details shown again count as a new catch. */
const NEW_CATCH_AFTER_MS = 20_000;

/** Timers that keep running while this tab is in the background (a worker isn't slowed down like a page). */
function backgroundSleep(): { sleep: (ms: number) => Promise<void>; close: () => void } {
  try {
    const src = "onmessage=(e)=>setTimeout(()=>postMessage(e.data.id),e.data.ms)";
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    let seq = 0;
    const waiting = new Map<number, () => void>();
    worker.onmessage = (e: MessageEvent<number>) => {
      waiting.get(e.data)?.();
      waiting.delete(e.data);
    };
    return {
      sleep: (ms) => new Promise<void>((done) => {
        const id = ++seq;
        waiting.set(id, done);
        worker.postMessage({ id, ms });
      }),
      close: () => {
        worker.terminate();
        for (const done of waiting.values()) done();
        waiting.clear();
      },
    };
  } catch {
    return { sleep: (ms) => new Promise((done) => window.setTimeout(done, ms)), close: () => {} };
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** The card the others see while the share is paused or still being checked. */
function drawCard(ctx: CanvasRenderingContext2D, w: number, h: number, kind: "checking" | "paused" | "unchecked") {
  ctx.fillStyle = "#16130f";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const big = Math.max(18, Math.round(w / 40));
  ctx.fillStyle = kind === "checking" ? "#f5efe6" : "#f26b3a";
  ctx.font = `600 ${big}px system-ui, sans-serif`;
  ctx.fillText(kind === "checking" ? "Checking the screen before it's shown…" : "Screen sharing paused", w / 2, h / 2 - big);
  ctx.fillStyle = "#cfc6b8";
  ctx.font = `${Math.round(big * 0.6)}px system-ui, sans-serif`;
  ctx.fillText(kind === "paused" ? "Personal information was detected, so this screen is hidden." : kind === "unchecked" ? "The screen couldn't be checked yet. It comes back by itself." : "TutorLink checks shared screens for contact details first.", w / 2, h / 2 + big * 0.4);
  ctx.fillText("Protected by TutorLink", w / 2, h / 2 + big * 1.4);
}

/** A small grey copy of a picture, to tell whether the next one changed at all. */
function signature(src: CanvasImageSource): Uint8Array {
  const c = canvas(240, 135);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, 240, 135);
  const px = ctx.getImageData(0, 0, 240, 135).data;
  const g = new Uint8Array(240 * 135);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (px[p] * 299 + px[p + 1] * 587 + px[p + 2] * 114) / 1000;
  return g;
}
const unchanged = (a: Uint8Array, b: Uint8Array) => {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 6) return false;
  return true;
};

export interface ScreenGuard {
  stop: () => Promise<void>;
}

/**
 * Starts a protected screen share: asks which screen to share, then publishes only checked pictures.
 * Throws what getDisplayMedia throws (NotAllowedError when the picker is cancelled).
 */
export async function startScreenGuard(opts: {
  room: Room;
  bookingId: string;
  onState: (state: GuardState, kinds?: ContactKind[]) => void;
  /** The first catch while sharing (recorded on the server like any other: warnings, the ladder). */
  onCaught: (res: SafetyResult) => void;
  /** The share ended by itself (the browser's own "Stop sharing" bar). */
  onEnded: () => void;
  /** Screen sharing is blocked for this person until then (repeated catches): the share has stopped. */
  onBlocked: (until: string) => void;
}): Promise<ScreenGuard> {
  const { room, bookingId } = opts;
  const raw = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 5, max: 10 }, width: { max: 1920 }, height: { max: 1080 }, cursor: "never" } as MediaTrackConstraints,
    audio: false,
  });
  const source = raw.getVideoTracks()[0];
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = raw;
  await video.play().catch(() => {});
  for (let i = 0; i < 50 && !video.videoWidth; i++) await new Promise((r) => window.setTimeout(r, 100));
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
  const scale = Math.min(1, OUT_WIDTH / vw);
  const W = Math.round(vw * scale), H = Math.round(vh * scale);

  // What the others get: only ever checked pictures (or the card).
  const out = canvas(W, H);
  const octx = out.getContext("2d")!;
  drawCard(octx, W, H, "checking");
  let shown: HTMLCanvasElement | null = null;
  const outTrack = out.captureStream(5).getVideoTracks()[0];
  outTrack.contentHint = "detail";
  let pub: LocalTrackPublication | null = null;
  try {
    pub = await room.localParticipant.publishTrack(outTrack, { source: Track.Source.ScreenShare, name: "screen", simulcast: false, videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 5 } });
  } catch (e) {
    source.stop();
    outTrack.stop();
    throw e;
  }
  opts.onState("checking");

  const timers = backgroundSleep();
  let stopped = false;
  // The canvas stream only sends a picture when the canvas is drawn on: the current picture is drawn again
  // every second so someone joining late gets it too.
  const keepAlive = window.setInterval(() => {
    if (shown) octx.drawImage(shown, 0, 0);
  }, 1000);

  const show = (picture: HTMLCanvasElement | "paused" | "unchecked") => {
    if (picture === "paused" || picture === "unchecked") {
      shown = null;
      drawCard(octx, W, H, picture);
      return;
    }
    shown = picture;
    octx.drawImage(picture, 0, 0);
  };

  /** One picture of the screen as it is now (never shown before it's checked). */
  const grab = (): HTMLCanvasElement | null => {
    if (!video.videoWidth || video.readyState < 2) return null;
    const c = canvas(W, H);
    c.getContext("2d")!.drawImage(video, 0, 0, W, H);
    return c;
  };

  /** The server reads printed text and QR codes; this browser reads handwritten numbers. */
  const check = async (picture: HTMLCanvasElement, record: boolean): Promise<Answer | null> => {
    const small = canvas(Math.min(CHECK_WIDTH, W), Math.round((Math.min(CHECK_WIDTH, W) / W) * H));
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(picture, 0, 0, small.width, small.height);
    const stop = new AbortController();
    const t = window.setTimeout(() => stop.abort(), CHECK_TIMEOUT_MS);
    const server = (async (): Promise<Answer | null> => {
      try {
        const res = await fetch("/api/classroom/screen-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: bookingId, ...guestPass(), image: small.toDataURL("image/jpeg", 0.85), record }),
          signal: stop.signal,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as Answer & { ok?: boolean };
        return data.ok === false ? null : data;
      } catch {
        return null;
      } finally {
        window.clearTimeout(t);
      }
    })();
    const handwritten = (async () => {
      try {
        const found = await numbersInPicture(sctx.getImageData(0, 0, small.width, small.height));
        return found.find((n) => judge(n) === "phone")?.digits ?? null;
      } catch {
        return null;
      }
    })();
    const [answer, phone] = await Promise.all([server, handwritten]);
    if (!answer) return null;
    if (answer.checked === false) return { found: false };
    if (phone) {
      // A handwritten number has no place to black out: the share pauses. The server records it (once).
      let recorded: Answer | null = null;
      if (record && !answer.found) {
        recorded = await fetch("/api/classroom/screen-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: bookingId, ...guestPass(), image: small.toDataURL("image/jpeg", 0.85), record: true, excerpt: phone }),
        }).then((r) => (r.ok ? (r.json() as Promise<Answer>) : null)).catch(() => null);
      }
      return { ...answer, ...(recorded ?? {}), found: true, kinds: [...new Set([...(answer.kinds ?? []), "phone" as const])], maskable: false };
    }
    return answer;
  };

  const masked = (picture: HTMLCanvasElement, boxes: Box[]) => {
    const c = canvas(W, H);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(picture, 0, 0);
    for (const [x, y, w, h] of boxes) {
      const bx = Math.floor(x * W), by = Math.floor(y * H), bw = Math.ceil(w * W), bh = Math.ceil(h * H);
      ctx.fillStyle = "#16130f";
      ctx.fillRect(bx, by, bw, bh);
      if (bh >= 12 && bw >= 90) {
        ctx.fillStyle = "#f5efe6";
        ctx.font = `600 ${Math.min(16, Math.round(bh * 0.6))}px system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.fillText("Hidden by TutorLink", bx + 6, by + bh / 2, bw - 12);
      }
    }
    return c;
  };

  // (finish is defined below; the loop only calls it once it's running.)
  // eslint-disable-next-line prefer-const
  let finish: () => Promise<void>;
  let lastSig: Uint8Array | null = null;
  let catchOpen = false;
  let plainSince = 0;
  const loop = async () => {
    while (!stopped) {
      const picture = grab();
      if (!picture) {
        await timers.sleep(200);
        continue;
      }
      const sig = signature(picture);
      if (lastSig && unchanged(sig, lastSig)) {
        await timers.sleep(250);
        continue;
      }
      if (catchOpen && plainSince && Date.now() - plainSince > NEW_CATCH_AFTER_MS) catchOpen = false;
      const answer = await check(picture, !catchOpen);
      if (stopped) break;
      if (!answer) {
        // Couldn't be checked (offline, slow server): nothing new goes out; try again shortly.
        show("unchecked");
        opts.onState("paused");
        lastSig = null;
        await timers.sleep(1000);
        continue;
      }
      lastSig = sig;
      if (answer.found && !catchOpen) {
        catchOpen = true;
        if (answer.strikes !== undefined) opts.onCaught({ found: true, kinds: answer.kinds, strikes: answer.strikes, removed: answer.removed, suspended: answer.suspended, level: answer.level, mutedUntil: answer.mutedUntil });
      }
      if (answer.blockedUntil) {
        // Shown again after warnings: sharing is blocked for a while. This picture isn't shown either.
        show("paused");
        const until = answer.blockedUntil;
        await finish();
        opts.onBlocked(until);
        break;
      }
      if (!answer.found && !answer.boxes?.length) {
        show(picture);
        if (!plainSince) plainSince = Date.now();
        opts.onState("live");
        continue;
      }
      plainSince = 0;
      if (answer.maskable !== false && answer.boxes?.length) {
        const hidden = masked(picture, answer.boxes);
        const again = await check(hidden, false);
        if (stopped) break;
        if (again && !again.found) {
          show(hidden);
          opts.onState(answer.found ? "hidden" : "live", answer.kinds);
          continue;
        }
      }
      show("paused");
      opts.onState("paused", answer.kinds);
    }
  };

  finish = async () => {
    if (stopped) return;
    stopped = true;
    timers.close();
    window.clearInterval(keepAlive);
    source.removeEventListener("ended", ended);
    source.stop();
    video.srcObject = null;
    if (pub?.track) await room.localParticipant.unpublishTrack(pub.track, true).catch(() => {});
    outTrack.stop();
  };
  const ended = () => {
    void finish().then(() => opts.onEnded());
  };
  source.addEventListener("ended", ended);
  void loop();
  return { stop: finish };
}
