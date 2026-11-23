"use client";

import * as React from "react";
import { Loader2, Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Before joining the class: see yourself, see that the microphone hears you, pick the microphone, camera and
 * speaker, and choose to join with them on or off. The preview stays on this device (nothing is sent) and is
 * switched off before the class connects. The choices are remembered on this device for the next class.
 */

export interface JoinChoice {
  mic: boolean;
  cam: boolean;
  micId?: string;
  camId?: string;
  speakerId?: string;
}

const KEY = "class-devices";

/** The last choices on this device (mic and camera on, the default devices, the first time). */
export function savedChoice(): JoinChoice {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<JoinChoice>;
    return {
      mic: raw.mic !== false,
      cam: raw.cam !== false,
      micId: typeof raw.micId === "string" ? raw.micId : undefined,
      camId: typeof raw.camId === "string" ? raw.camId : undefined,
      speakerId: typeof raw.speakerId === "string" ? raw.speakerId : undefined,
    };
  } catch {
    return { mic: true, cam: true };
  }
}

function saveChoice(c: JoinChoice) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // private mode: chosen again next time
  }
}

/** Plain-language reasons a camera or microphone couldn't start. */
function deviceError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Your browser is blocking the camera or microphone. Allow them from the icon in the address bar, then press Check again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "That camera or microphone wasn't found. Pick another one.";
  if (name === "NotReadableError") return "Another app is using the camera or microphone. Close it there, then press Check again.";
  return "The camera or microphone couldn't start. You can still join and turn them on in the class.";
}

export function PreJoin({ title, name, cameraBlocked, onJoin, onCancel }: {
  title: string;
  name: string;
  /** The camera is off for now in this class (contact details were shown on it): it can't be turned on. */
  cameraBlocked?: boolean;
  onJoin: (choice: JoinChoice) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = React.useState<JoinChoice>(() => {
    const c = savedChoice();
    return cameraBlocked ? { ...c, cam: false } : c;
  });
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [level, setLevel] = React.useState(0);
  const [heard, setHeard] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const stopPreview = React.useCallback(() => {
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
  }, []);

  // The preview: started again when a device or on/off choice changes.
  React.useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | null = null;
    void (async () => {
      stopPreview();
      if (!choice.mic && !choice.cam) return;
      setStarting(true);
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: choice.mic ? { deviceId: choice.micId ? { exact: choice.micId } : undefined, echoCancellation: true, noiseSuppression: true } : false,
          video: choice.cam ? { deviceId: choice.camId ? { exact: choice.camId } : undefined, width: { ideal: 640 }, height: { ideal: 360 } } : false,
        });
        if (cancelled) return void stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = choice.cam ? stream : null;
        // Names of the devices are only given once one was allowed.
        setDevices(await navigator.mediaDevices.enumerateDevices());
        const mic = stream.getAudioTracks()[0];
        if (mic) {
          ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          ctx.createMediaStreamSource(new MediaStream([mic])).connect(analyser);
          const buf = new Float32Array(analyser.fftSize);
          const tick = () => {
            analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (const v of buf) sum += v * v;
            const rms = Math.sqrt(sum / buf.length);
            const l = Math.min(1, rms * 9);
            setLevel(l);
            if (l > 0.12) setHeard(true);
            raf = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch (e) {
        if (!cancelled) {
          // A remembered device that's gone: try the default one before giving up.
          if (e instanceof DOMException && (e.name === "NotFoundError" || e.name === "OverconstrainedError") && (choice.micId || choice.camId)) {
            setChoice((c) => ({ ...c, micId: undefined, camId: undefined }));
            return;
          }
          setError(deviceError(e));
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      void ctx?.close().catch(() => {});
      stopPreview();
      setLevel(0);
    };
  }, [choice.mic, choice.cam, choice.micId, choice.camId, attempt, stopPreview]);

  const mics = devices.filter((d) => d.kind === "audioinput" && d.deviceId);
  const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
  const speakers = devices.filter((d) => d.kind === "audiooutput" && d.deviceId);
  const canPickSpeaker = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype && speakers.length > 0;

  // A short tone through the chosen speaker.
  const testSpeaker = async () => {
    const audio = new Audio();
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    osc.connect(gain).connect(dest);
    audio.srcObject = dest.stream;
    try {
      if (choice.speakerId && "setSinkId" in audio) await (audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(choice.speakerId);
      await audio.play();
    } catch {
      // the tone is only a convenience
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.85);
    window.setTimeout(() => void ctx.close().catch(() => {}), 1200);
  };

  const join = () => {
    stopPreview();
    saveChoice(choice);
    onJoin(choice);
  };

  const select = (label: string, value: string | undefined, list: MediaDeviceInfo[], onPick: (id: string) => void) => (
    <label className="block text-xs text-muted">
      {label}
      <select
        value={value ?? list[0]?.deviceId ?? ""}
        onChange={(e) => onPick(e.target.value)}
        className="mt-1 w-full border border-line-strong bg-canvas px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
      >
        {list.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="w-full max-w-3xl border border-line bg-surface p-5 md:p-7" data-prejoin="">
      <p className="font-heading text-[1.5rem] leading-tight">Ready to join?</p>
      <p className="mt-1 text-sm text-muted">
        {title}
        {name ? ` · joining as ${name}` : ""}
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="relative aspect-video overflow-hidden bg-black">
            {choice.cam ? (
              <video ref={videoRef} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-sm text-white/70">{cameraBlocked ? "Your camera is off for now in this class" : "Camera off"}</div>
            )}
            {starting && <Loader2 className="absolute right-3 top-3 size-5 animate-spin text-white/80" aria-hidden />}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-3">
              <button
                type="button"
                onClick={() => setChoice((c) => ({ ...c, mic: !c.mic }))}
                className={cn("grid size-11 place-items-center rounded-full", choice.mic ? "bg-white/20 text-white hover:bg-white/30" : "bg-danger text-white")}
                aria-label={choice.mic ? "Join with the microphone off" : "Join with the microphone on"}
                aria-pressed={choice.mic}
              >
                {choice.mic ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              </button>
              <button
                type="button"
                onClick={() => !cameraBlocked && setChoice((c) => ({ ...c, cam: !c.cam }))}
                disabled={cameraBlocked}
                className={cn("grid size-11 place-items-center rounded-full disabled:opacity-50", choice.cam ? "bg-white/20 text-white hover:bg-white/30" : "bg-danger text-white")}
                aria-label={choice.cam ? "Join with the camera off" : "Join with the camera on"}
                aria-pressed={choice.cam}
              >
                {choice.cam ? <Video className="size-5" /> : <VideoOff className="size-5" />}
              </button>
            </div>
          </div>
          {choice.mic && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Mic className="size-3.5" aria-hidden />
                <div className="h-2 flex-1 overflow-hidden bg-sunken" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
                  <div className={cn("h-full transition-[width] duration-75", level > 0.12 ? "bg-live" : "bg-line-strong")} style={{ width: `${Math.round(level * 100)}%` }} />
                </div>
              </div>
              <p className={cn("mt-1 text-xs", heard ? "text-live" : "text-muted")} data-prejoin-heard={heard ? "" : undefined}>
                {heard ? "We can hear you." : "Say something: the bar moves when the microphone hears you."}
              </p>
            </div>
          )}
          {error && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}{" "}
              <button type="button" onClick={() => setAttempt((a) => a + 1)} className="font-semibold underline underline-offset-2">
                Check again
              </button>
            </p>
          )}
        </div>
        <div className="space-y-3">
          {mics.length > 0 && select("Microphone", choice.micId, mics, (id) => setChoice((c) => ({ ...c, micId: id, mic: true })))}
          {cams.length > 0 && !cameraBlocked && select("Camera", choice.camId, cams, (id) => setChoice((c) => ({ ...c, camId: id, cam: true })))}
          {canPickSpeaker && select("Speaker", choice.speakerId, speakers, (id) => setChoice((c) => ({ ...c, speakerId: id })))}
          <button type="button" onClick={() => void testSpeaker()} className="flex items-center gap-2 border border-line-strong px-3 py-1.5 text-sm hover:bg-sunken">
            <Volume2 className="size-4" aria-hidden /> Test speaker
          </button>
          <p className="text-[11.5px] leading-snug text-muted">The preview stays on this device. Your choices are remembered here for the next class.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="border border-line-strong px-5 py-2.5 text-sm font-semibold hover:bg-sunken">
          Back
        </button>
        <button type="button" onClick={join} className="bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover" data-prejoin-join="">
          Join class
        </button>
      </div>
    </div>
  );
}
