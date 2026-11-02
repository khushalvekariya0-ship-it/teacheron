"use client";

import * as React from "react";
import { Film, Link2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_VIDEO_MB, MAX_VIDEO_SECONDS, checkVideoFile, parseIntroVideo, videoDuration } from "@/lib/video";
import { uploadFile } from "@/lib/upload";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Controls";

/** A URL a <video> element can play for a stored intro-video value (uploads and direct file links). */
export function usePlayableVideoUrl(value: string | undefined): { url: string | null; loading: boolean } {
  const src = parseIntroVideo(value);
  return { url: src?.kind === "file" ? src.url : null, loading: false };
}

/**
 * Plays a tutor's intro video: YouTube and Vimeo links in their own player, files in a <video>.
 * With hideWhenMissing, a value that can't be played renders nothing.
 */
export function IntroVideoPlayer({ value, title, hideWhenMissing, className }: { value: string; title: string; hideWhenMissing?: boolean; className?: string }) {
  const src = parseIntroVideo(value);
  const { url, loading } = usePlayableVideoUrl(value);
  const embed = src?.kind === "youtube" || src?.kind === "vimeo" ? src.embedUrl : null;
  if (!src || (hideWhenMissing && !embed && !url && !loading)) return null;
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-night", className)}>
      {embed ? (
        <iframe
          src={embed}
          title={title}
          className="absolute inset-0 size-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : url ? (
        <video src={url} controls playsInline preload="metadata" aria-label={title} className="absolute inset-0 size-full object-contain" />
      ) : (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-[13.5px] text-white/75">{loading ? "Loading video…" : "This video can't be played."}</p>
      )}
    </div>
  );
}

function describe(value: string, name?: string): string {
  const src = parseIntroVideo(value);
  if (src?.kind === "youtube") return "YouTube video";
  if (src?.kind === "vimeo") return "Vimeo video";
  if (src?.kind === "file") return src.url.split("/").pop() ?? "Video link";
  return name ?? "Uploaded video";
}

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * Add, preview, replace or remove an intro video: upload a file (stored in Supabase Storage) or paste
 * a YouTube/Vimeo link. onChange receives the new value (none when removed) and resolves to false if
 * it couldn't be saved; the server removes a replaced upload once the new value is saved.
 */
export function IntroVideoField({
  value,
  name,
  onChange,
}: {
  value?: string;
  name?: string;
  onChange: (next: { url?: string; name?: string }) => boolean | Promise<boolean>;
}) {
  const [mode, setMode] = React.useState<"upload" | "link">("upload");
  const [link, setLink] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [replacing, setReplacing] = React.useState(false);
  const inputId = React.useId();
  const current = value && parseIntroVideo(value) ? value : null;

  const commit = async (next: { url?: string; name?: string }) => {
    if (!(await onChange(next))) return false;
    setReplacing(false);
    setLink("");
    setError(null);
    return true;
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkVideoFile(file);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      // NaN: the browser can't read the file. Infinity: a length the file doesn't record (common for WebM), so it's accepted.
      const seconds = await videoDuration(file);
      if (Number.isNaN(seconds)) return setError("This browser can't play that video. Try an MP4 file, or paste a YouTube link instead.");
      if (Number.isFinite(seconds) && seconds > MAX_VIDEO_SECONDS + 1) return setError(`Keep your video under ${MAX_VIDEO_SECONDS / 60} minutes. This one is ${minutes(seconds)}.`);
      const up = await uploadFile("video", file);
      if (!up.ok || !up.file.publicUrl) return setError(up.ok ? "That video couldn't be saved. Please try again." : up.error);
      await commit({ url: up.file.publicUrl, name: file.name });
    } catch {
      setError("That video couldn't be saved. Try a smaller file, or paste a YouTube link instead.");
    } finally {
      setBusy(false);
    }
  };

  const addLink = () => {
    const src = parseIntroVideo(link);
    if (!src) return setError("Paste a YouTube or Vimeo link, or a direct link to an MP4 file.");
    void commit({ url: link.trim() });
  };

  return (
    <div className="space-y-3">
      {current && !replacing ? (
        <>
          <IntroVideoPlayer value={current} title="Your intro video" />
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-2">{describe(current, name)}</p>
            <Button variant="secondary" size="sm" onClick={() => setReplacing(true)}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void commit({})}>
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <Segmented
            size="sm"
            label="How to add your video"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: "upload", label: <span className="inline-flex items-center gap-1.5"><Upload className="size-3.5" aria-hidden /> Upload a file</span> },
              { value: "link", label: <span className="inline-flex items-center gap-1.5"><Link2 className="size-3.5" aria-hidden /> Paste a link</span> },
            ]}
          />
          {mode === "upload" ? (
            <label
              htmlFor={inputId}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-4 py-7 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy hover:bg-canvas",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <Film className="size-6 text-navy" aria-hidden />
              <span className="text-sm font-semibold text-ink">{busy ? "Uploading your video…" : "Choose a video"}</span>
              <span className="text-[12.5px] text-muted">
                MP4, WebM or MOV · up to {MAX_VIDEO_SECONDS / 60} minutes · {MAX_VIDEO_MB} MB
              </span>
              <input
                id={inputId}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void pick(file);
                }}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Video link"
                type="url"
                inputMode="url"
                placeholder="https://youtu.be/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addLink();
                }}
                className="flex-1"
              />
              <Button variant="secondary" className="h-11" onClick={addLink}>
                Add video
              </Button>
            </div>
          )}
          <p className="text-[12.5px] leading-relaxed text-muted">
            {mode === "upload"
              ? "Your video is uploaded securely and plays on your public profile."
              : "YouTube (including unlisted videos), Vimeo, or a direct link to an MP4 file."}
          </p>
          {replacing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReplacing(false);
                setError(null);
              }}
            >
              Keep the current video
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
