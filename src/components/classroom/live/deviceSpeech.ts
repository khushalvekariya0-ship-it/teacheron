"use client";

/*
 * The on-device speech reader for the live class (Vosk through vosk-browser, open source, Apache-2.0): it turns
 * what is said into words inside the browser, so the voice never leaves the device, and it works on phones,
 * Safari and Firefox (the browser's own recogniser only works in Chrome / Edge on computers and sends the audio
 * to Google / Microsoft). The reader and its models are served from this site (public/speech, see README.txt):
 * about 6 MB of code and a ~40 MB model, downloaded once per device and cached.
 *
 * It reads any audio track: the person's own microphone (before anything else touches it) and, on computers,
 * the voices received from the others, so someone whose own device can't check is still covered.
 */

type RecognizerMessage = { result?: { text?: string; partial?: string } };
interface Recognizer {
  on(event: "result" | "partialresult" | "error", listener: (message: RecognizerMessage) => void): void;
  acceptWaveform(buffer: AudioBuffer): void;
  acceptWaveformFloat(buffer: Float32Array, sampleRate: number): void;
  remove(): void;
}
interface VoskModel {
  KaldiRecognizer: new (sampleRate: number) => Recognizer;
}
declare global {
  interface Window {
    Vosk?: { createModel(url: string, logLevel?: number): Promise<VoskModel> };
  }
}

const SCRIPT = "/speech/vosk-browser-0.0.8.js";
const MODELS = { "en-in": "/speech/vosk-model-small-en-in-0.4.tar.gz", hi: "/speech/vosk-model-small-hi-0.22.tar.gz" } as const;
export type SpeechModel = keyof typeof MODELS;

/**
 * The model for the class language: Hindi for Hindi and Gujarati, English (India) for everything else (it reads US
 * English well enough too). Gujarati numbers sound almost the same as Hindi ones, and in tests the Hindi model heard
 * Gujarati phone numbers (and app names) that the English one missed. Vosk's own Gujarati model is 347 MB once
 * unpacked (the class tab grows by about 700 MB of memory), too heavy for phones and most computers.
 */
export const speechModelFor = (lang: string): SpeechModel => (/^(?:hi|gu)\b/i.test(lang) ? "hi" : "en-in");

let script: Promise<void> | null = null;
const models = new Map<SpeechModel, Promise<VoskModel>>();
let sharedContext: AudioContext | null = null;

function loadScript(): Promise<void> {
  if (window.Vosk) return Promise.resolve();
  script ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT;
    el.async = true;
    el.onload = () => (window.Vosk ? resolve() : reject(new Error("The speech reader didn't start.")));
    el.onerror = () => reject(new Error("The speech reader couldn't be downloaded."));
    document.head.appendChild(el);
  }).catch((e: unknown) => {
    script = null;
    throw e;
  });
  return script;
}

/** Loads (once per page) the reader and a model. Fails on a device that can't run it (very old browsers). */
export function loadSpeechModel(model: SpeechModel): Promise<VoskModel> {
  let p = models.get(model);
  if (!p) {
    p = loadScript().then(() => window.Vosk!.createModel(MODELS[model], -1));
    models.set(model, p);
    p.then(() => loaded.add(model), () => models.delete(model));
  }
  return p;
}

const loaded = new Set<SpeechModel>();
/** Whether this page already has the model ready (it loads once per page). */
export const speechModelLoaded = (model: SpeechModel) => loaded.has(model);

/**
 * Downloads the reader and a model into the browser's cache without starting anything (from the lesson page,
 * shortly before class), so the class page has them at once. Once per page.
 */
const prefetched = new Set<SpeechModel>();
export function prefetchSpeechReader(model: SpeechModel = "en-in") {
  if (prefetched.has(model) || !canReadOnDevice()) return;
  prefetched.add(model);
  for (const url of [SCRIPT, MODELS[model]]) {
    void fetch(url, { priority: "low" } as RequestInit)
      .then((r) => r.arrayBuffer())
      .catch(() => prefetched.delete(model));
  }
}

/** Whether this browser can run the reader at all (Web Audio, WebAssembly and workers). */
export function canReadOnDevice(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown; WebAssembly?: unknown; Worker?: unknown };
  return !!(w.AudioContext ?? w.webkitAudioContext) && !!w.WebAssembly && !!w.Worker;
}

/** One audio context for the page's speech checks and protected voice (browsers limit how many a page may open). */
export function sharedAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === "closed") {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Ctx();
  }
  if (sharedContext.state === "suspended") void sharedContext.resume().catch(() => {});
  return sharedContext;
}

/**
 * The reader's own audio context at 16 kHz, the rate the models use: the browser resamples the voice, so the reader
 * gets a third of the sound to work through (it has to keep up with speech in real time, on phones too). Null
 * where a browser can't take a voice at another rate (Firefox): the shared context is used there.
 */
let readerContext: AudioContext | null | undefined;
function readerSource(track: MediaStreamTrack): { ctx: AudioContext; source: MediaStreamAudioSourceNode } {
  if (readerContext === undefined || readerContext?.state === "closed") {
    try {
      readerContext = new AudioContext({ sampleRate: 16_000 });
    } catch {
      readerContext = null;
    }
  }
  if (readerContext) {
    if (readerContext.state === "suspended") void readerContext.resume().catch(() => {});
    try {
      return { ctx: readerContext, source: readerContext.createMediaStreamSource(new MediaStream([track])) };
    } catch {
      readerContext = null;
    }
  }
  const ctx = sharedAudioContext();
  return { ctx, source: ctx.createMediaStreamSource(new MediaStream([track])) };
}

/**
 * Reads sound handed over in chunks (protected voice's hold), in order: the reader answers once per chunk, so each
 * answer says what was said up to the end of that chunk (`end`, the hold's running sample count). `onResult` gets
 * the words so far (or the finished sentence, `final`) for each chunk, in order.
 */
export async function readChunks(model: SpeechModel, sampleRate: number, onResult: (end: number, text: string, final: boolean) => void): Promise<{ feed: (data: Float32Array, end: number) => void; stop: () => void }> {
  const m = await loadSpeechModel(model);
  const rec = new m.KaldiRecognizer(sampleRate);
  const ends: number[] = [];
  let live = true;
  rec.on("partialresult", (msg) => {
    const end = ends.shift();
    if (live && end !== undefined) onResult(end, msg.result?.partial ?? "", false);
  });
  rec.on("result", (msg) => {
    const end = ends.shift();
    if (live && end !== undefined) onResult(end, msg.result?.text ?? "", true);
  });
  return {
    feed: (data, end) => {
      if (!live) return;
      ends.push(end);
      try {
        rec.acceptWaveformFloat(data, sampleRate);
      } catch {
        ends.pop();
      }
    },
    stop: () => {
      if (!live) return;
      live = false;
      try {
        rec.remove();
      } catch {
        // already gone
      }
    },
  };
}

/**
 * Reads one voice until the returned stop() is called: `onPartial` gets the words of the sentence so far (several
 * times a second), `onFinal` each finished sentence.
 */
export async function readVoice(track: MediaStreamTrack, model: SpeechModel, handlers: { onPartial: (text: string) => void; onFinal: (text: string) => void }): Promise<() => void> {
  const m = await loadSpeechModel(model);
  const { ctx, source } = readerSource(track);
  const rec = new m.KaldiRecognizer(ctx.sampleRate);
  let live = true;
  rec.on("partialresult", (msg) => {
    const t = msg.result?.partial;
    if (live && t) handlers.onPartial(t);
  });
  rec.on("result", (msg) => {
    const t = msg.result?.text;
    if (live && t) handlers.onFinal(t);
  });
  // ScriptProcessor still works everywhere; its output is silence, so nothing extra is heard. Chunks of about
  // an eighth of a second (whatever the rate), so words reach the reader promptly.
  const node = ctx.createScriptProcessor(ctx.sampleRate <= 16_000 ? 2048 : 4096, 1, 1);
  node.onaudioprocess = (e) => {
    if (!live) return;
    try {
      rec.acceptWaveform(e.inputBuffer);
    } catch {
      // the reader was stopped
    }
  };
  source.connect(node);
  node.connect(ctx.destination);
  return () => {
    if (!live) return;
    live = false;
    node.onaudioprocess = null;
    try {
      source.disconnect();
      node.disconnect();
      rec.remove();
    } catch {
      // already gone
    }
  };
}
