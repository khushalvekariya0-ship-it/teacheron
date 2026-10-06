"use client";

import * as React from "react";
import Link from "next/link";
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { Tooltip } from "@/components/ui/Overlay";

/** Plain-language reasons a camera, microphone or screen share couldn't start. */
function mediaError(e: unknown, what: "camera" | "microphone" | "screen"): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return what === "screen" ? "Screen sharing was cancelled." : `Your browser is blocking the ${what}. Allow it from the address bar, then try again.`;
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return `No ${what} was found on this device.`;
  if (name === "NotReadableError") return `The ${what} is being used by another app. Close it there and try again.`;
  return `The ${what} couldn't start. Please try again.`;
}

/** Attaches a MediaStream to a <video>. `srcObject` isn't a React prop, so it goes through the ref. */
function StreamVideo({ stream, className, mirrored }: { stream: MediaStream; className?: string; mirrored?: boolean }) {
  const attach = React.useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && el.srcObject !== stream) el.srcObject = stream;
    },
    [stream],
  );
  return <video ref={attach} autoPlay muted playsInline className={cn(className, mirrored && "-scale-x-100")} />;
}

/**
 * The video side of the classroom. Your own camera, microphone and screen share run right in the
 * browser (WebRTC capture). Sending them to the other person needs the media server, which the
 * preview build doesn't have — so the large tile shows who you're meeting and what will appear there.
 */
export function VideoStage({
  peerName,
  selfName,
  status,
  leaveHref,
  className,
}: {
  peerName: string;
  selfName: string;
  /** One line under the other person's name, e.g. "Joins at 4:00 PM". */
  status: string;
  leaveHref: string;
  className?: string;
}) {
  const [camera, setCamera] = React.useState<MediaStream | null>(null);
  const [mic, setMic] = React.useState<MediaStream | null>(null);
  const [screen, setScreen] = React.useState<MediaStream | null>(null);
  const [busy, setBusy] = React.useState<"camera" | "microphone" | "screen" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Everything that is capturing, so leaving the room always switches the devices off.
  const live = React.useRef(new Set<MediaStream>());

  const stop = (s: MediaStream | null) => {
    if (!s) return;
    s.getTracks().forEach((t) => t.stop());
    live.current.delete(s);
  };
  React.useEffect(() => {
    const all = live.current;
    return () => all.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  }, []);

  const start = async (what: "camera" | "microphone" | "screen") => {
    if (busy) return;
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) {
      setError("This browser can't use the camera here. Open the classroom over HTTPS in a current browser.");
      return;
    }
    setBusy(what);
    setError(null);
    try {
      const s =
        what === "camera"
          ? await devices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } })
          : what === "microphone"
            ? await devices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
            : await devices.getDisplayMedia({ video: true });
      live.current.add(s);
      if (what === "camera") setCamera(s);
      else if (what === "microphone") setMic(s);
      else {
        // The browser's own "Stop sharing" bar ends the track: follow it.
        s.getVideoTracks()[0]?.addEventListener("ended", () => {
          live.current.delete(s);
          setScreen((cur) => (cur === s ? null : cur));
        });
        setScreen(s);
      }
    } catch (e) {
      setError(mediaError(e, what));
    } finally {
      setBusy(null);
    }
  };

  const toggleCamera = () => {
    if (camera) {
      stop(camera);
      setCamera(null);
    } else void start("camera");
  };
  const toggleMic = () => {
    if (mic) {
      stop(mic);
      setMic(null);
    } else void start("microphone");
  };
  const toggleScreen = () => {
    if (screen) {
      stop(screen);
      setScreen(null);
    } else void start("screen");
  };

  return (
    <section aria-label="Video" className={cn("relative isolate flex min-h-0 flex-col overflow-hidden rounded-2xl bg-night text-white", className)}>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_20%_0%,rgb(75_107_99/0.38),transparent_70%),radial-gradient(ellipse_60%_60%_at_100%_100%,rgb(217_80_43/0.28),transparent_70%)]" aria-hidden />

      {/* Main tile: the shared screen, or the person you're meeting */}
      <div className="relative min-h-0 flex-1">
        {screen ? (
          <>
            <StreamVideo stream={screen} className="absolute inset-0 size-full object-contain" />
            <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium backdrop-blur">You&rsquo;re sharing your screen</span>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-6 text-center lg:gap-3">
            <span className="relative grid size-16 place-items-center rounded-full bg-white/10 font-heading text-xl font-semibold ring-1 ring-white/20 lg:size-24 lg:text-3xl">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/10 [animation-duration:2.4s]" aria-hidden />
              <span className="relative">{initials(peerName)}</span>
            </span>
            <div>
              <p className="text-[17px] font-semibold tracking-[-0.01em]">{peerName}</p>
              <p className="mt-0.5 text-[13.5px] text-white/65">{status}</p>
            </div>
          </div>
        )}

        {/* Your own picture: top corner on phones (the name sits in the middle), bottom corner on wide screens */}
        <div className="absolute right-3 top-3 aspect-video w-[27%] max-w-52 overflow-hidden rounded-xl bg-white/10 shadow-lg ring-1 ring-white/20 lg:bottom-3 lg:top-auto lg:w-[34%]">
          {camera ? (
            <StreamVideo stream={camera} mirrored className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-[13px] font-medium text-white/70">
              <span className="grid size-9 place-items-center rounded-full bg-white/10 font-heading text-[13px] font-semibold">{initials(selfName)}</span>
            </div>
          )}
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
            {mic ? <Mic className="size-3" aria-hidden /> : <MicOff className="size-3 text-white/60" aria-hidden />} You
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mx-3 mb-2 rounded-lg bg-white/10 px-3 py-2 text-[13px] leading-snug text-white/90">
          {error}
        </p>
      )}

      {/* Controls */}
      <div className="flex shrink-0 items-center justify-center gap-2 px-3 pb-3 pt-1 sm:gap-2.5">
        <StageButton label={mic ? "Mute microphone" : "Turn on microphone"} on={!!mic} loading={busy === "microphone"} onClick={toggleMic}>
          {mic ? <Mic /> : <MicOff />}
        </StageButton>
        <StageButton label={camera ? "Turn off camera" : "Turn on camera"} on={!!camera} loading={busy === "camera"} onClick={toggleCamera}>
          {camera ? <Video /> : <VideoOff />}
        </StageButton>
        <StageButton label={screen ? "Stop sharing your screen" : "Share your screen"} on={!!screen} loading={busy === "screen"} onClick={toggleScreen} className="hidden sm:grid">
          {screen ? <MonitorX /> : <MonitorUp />}
        </StageButton>
        <Tooltip content="Leave the classroom">
          <Link
            href={leaveHref}
            aria-label="Leave the classroom"
            className="grid h-11 w-14 place-items-center rounded-full bg-brand text-on-brand transition-colors hover:bg-brand-hover [&_svg]:size-5"
          >
            <PhoneOff />
          </Link>
        </Tooltip>
      </div>
    </section>
  );
}

function StageButton({ label, on, loading, onClick, className, children }: { label: string; on: boolean; loading: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        aria-busy={loading || undefined}
        onClick={onClick}
        className={cn(
          "grid size-11 place-items-center rounded-full transition-colors [&_svg]:size-5",
          on ? "bg-white text-night hover:bg-white/90" : "bg-white/12 text-white hover:bg-white/20",
          loading && "animate-pulse",
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
