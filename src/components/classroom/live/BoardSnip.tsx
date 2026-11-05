"use client";

import * as React from "react";
import { Check, Crop, Loader2, RefreshCw, X } from "lucide-react";

/**
 * A snipping tool inside the classroom. Pick any screen, window or tab; one frame is frozen and the
 * capture stops straight away (no lingering "sharing" indicator), then drag over the part you want and
 * insert just that on the whiteboard.
 */
export function BoardSnip({ onInsert, onClose }: { onInsert: (blob: Blob) => Promise<void> | void; onClose: () => void }) {
  const [stage, setStage] = React.useState<"starting" | "selecting" | "inserting" | "error">("starting");
  const [error, setError] = React.useState("");
  const [sel, setSel] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [frameUrl, setFrameUrl] = React.useState<string | null>(null);
  const frameRef = React.useRef<HTMLCanvasElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);

  const capture = React.useCallback(async () => {
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // Wait for real pixels: a freshly playing video can still be blank.
      await new Promise<void>((resolve) => {
        if ("requestVideoFrameCallback" in video) (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(() => resolve());
        else window.setTimeout(resolve, 250);
      });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      frameRef.current = canvas;
      setFrameUrl(canvas.toDataURL("image/png"));
      setSel(null);
      setStage("selecting");
    } catch (e) {
      // Dismissing the picker is a cancel, not a failure.
      if ((e as DOMException)?.name === "NotAllowedError") return onClose();
      setError((e as Error)?.message || "Couldn't capture the screen.");
      setStage("error");
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
    }
  }, [onClose]);

  React.useEffect(() => {
    const t = window.setTimeout(() => void capture(), 0);
    return () => window.clearTimeout(t);
  }, [capture]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pointFrom = (e: React.MouseEvent | React.TouchEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : e;
    return { x: Math.min(Math.max((src?.clientX ?? 0) - r.left, 0), r.width), y: Math.min(Math.max((src?.clientY ?? 0) - r.top, 0), r.height) };
  };
  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    dragStart.current = pointFrom(e);
    setSel({ ...dragStart.current, w: 0, h: 0 });
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const a = dragStart.current;
    if (!a) return;
    const p = pointFrom(e);
    setSel({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) });
  };
  const onUp = () => {
    dragStart.current = null;
  };

  const insert = async () => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return;
    setStage("inserting");
    try {
      const r = img.getBoundingClientRect();
      const sx = frame.width / r.width;
      const sy = frame.height / r.height;
      // No selection means the whole screen.
      const box = sel && sel.w > 4 && sel.h > 4 ? { x: sel.x * sx, y: sel.y * sy, w: sel.w * sx, h: sel.h * sy } : { x: 0, y: 0, w: frame.width, h: frame.height };
      const out = document.createElement("canvas");
      out.width = Math.round(box.w);
      out.height = Math.round(box.h);
      out.getContext("2d")!.drawImage(frame, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png"));
      if (!blob) throw new Error("Couldn't build the image.");
      await onInsert(blob);
      onClose();
    } catch (e) {
      setError((e as Error)?.message || "Couldn't insert that snip.");
      setStage("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 text-white" role="dialog" aria-label="Snip to the whiteboard">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Crop className="size-4" aria-hidden />
          {stage === "starting" && "Choose a screen or window to snip…"}
          {stage === "selecting" && (sel && sel.w > 4 ? "Drag to adjust, then insert" : "Drag over the area you want")}
          {stage === "inserting" && "Inserting…"}
          {stage === "error" && "Something went wrong"}
        </span>
        <div className="flex items-center gap-2">
          {stage === "selecting" && (
            <>
              <button type="button" onClick={() => void capture()} className="flex items-center gap-1.5 border border-white/25 px-3 py-1.5 text-sm hover:bg-white/10">
                <RefreshCw className="size-3.5" aria-hidden /> Snip again
              </button>
              <button type="button" onClick={() => void insert()} className="flex items-center gap-1.5 bg-brand px-4 py-1.5 text-sm font-semibold text-on-brand hover:bg-brand-hover">
                <Check className="size-3.5" aria-hidden /> Insert on the whiteboard
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="flex items-center gap-1.5 border border-white/25 px-3 py-1.5 text-sm hover:bg-white/10">
            <X className="size-3.5" aria-hidden /> Cancel
          </button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {stage === "starting" && (
          <p className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Waiting for you to pick a screen…
          </p>
        )}
        {stage === "error" && (
          <div className="max-w-md text-center">
            <p className="mb-4 text-sm text-red-300">{error}</p>
            <button type="button" onClick={() => void capture()} className="bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover">
              Try again
            </button>
          </div>
        )}
        {frameUrl && (stage === "selecting" || stage === "inserting") && (
          <div className="relative select-none" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local capture, not a site image */}
            <img ref={imgRef} src={frameUrl} alt="Screen capture" className="max-h-[calc(100dvh-7rem)] max-w-full cursor-crosshair object-contain" draggable={false} />
            {sel && sel.w > 2 && sel.h > 2 && (
              <>
                <div
                  className="pointer-events-none absolute inset-0 bg-black/50"
                  style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${sel.x}px ${sel.y}px, ${sel.x}px ${sel.y + sel.h}px, ${sel.x + sel.w}px ${sel.y + sel.h}px, ${sel.x + sel.w}px ${sel.y}px, ${sel.x}px ${sel.y}px)` }}
                />
                <div className="pointer-events-none absolute border-2 border-brand" style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }} />
              </>
            )}
          </div>
        )}
      </div>
      <p className="pb-3 text-center text-xs text-white/60">Tip: skip the drag to insert the whole screen. Esc cancels.</p>
    </div>
  );
}
