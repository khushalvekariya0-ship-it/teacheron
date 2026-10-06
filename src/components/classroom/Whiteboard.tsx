"use client";

import * as React from "react";
import { Circle, Download, Eraser, Hand, Highlighter, Minus, Pencil, Plus, Redo2, Square, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { ConfirmDialog, Tooltip } from "@/components/ui/Overlay";

/*
 * An infinite whiteboard on one <canvas>.
 *
 * Strokes are stored in "world" coordinates; the view (pan + zoom) maps them to the screen, so the
 * board has no edges. Drag with the hand tool, two fingers or the mouse wheel to move; pinch or
 * Ctrl + wheel to zoom. The board is saved in this browser per room and mirrored live between
 * windows on the same device — in production the same stroke list syncs through the lesson's
 * realtime channel instead (see docs/ARCHITECTURE.md).
 */

type Tool = "pan" | "pen" | "highlighter" | "eraser" | "line" | "rect" | "ellipse";
type ColorKey = "ink" | "coral" | "indigo" | "teal" | "amber" | "violet";

interface Stroke {
  id: string;
  tool: Exclude<Tool, "pan" | "eraser">;
  color: ColorKey;
  size: number;
  /** x0, y0, x1, y1 … in world units. Shapes keep two points: start and end. */
  points: number[];
}

interface View {
  x: number;
  y: number;
  k: number;
}

const PALETTE: Record<"light" | "dark", Record<ColorKey, string> & { board: string; dot: string }> = {
  light: { ink: "#15140f", coral: "#d9502b", indigo: "#4b6b63", teal: "#2f7a6e", amber: "#c98a12", violet: "#6f5a83", board: "#faf7f0", dot: "rgba(21,20,15,0.14)" },
  dark: { ink: "#eee9dd", coral: "#e5582f", indigo: "#8fb3b0", teal: "#5fc1b0", amber: "#e2b159", violet: "#c3abd1", board: "#1b1a14", dot: "rgba(238,233,221,0.13)" },
};
const COLORS: { key: ColorKey; label: string }[] = [
  { key: "ink", label: "Ink" },
  { key: "coral", label: "Coral" },
  { key: "indigo", label: "Slate" },
  { key: "teal", label: "Teal" },
  { key: "amber", label: "Amber" },
  { key: "violet", label: "Lavender" },
];
const SIZES = [
  { value: 2.5, label: "Fine" },
  { value: 5, label: "Medium" },
  { value: 10, label: "Bold" },
];
const TOOLS: { key: Tool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pan", label: "Move the board", icon: Hand },
  { key: "pen", label: "Pen", icon: Pencil },
  { key: "highlighter", label: "Highlighter", icon: Highlighter },
  { key: "eraser", label: "Eraser", icon: Eraser },
  { key: "line", label: "Line", icon: Minus },
  { key: "rect", label: "Rectangle", icon: Square },
  { key: "ellipse", label: "Ellipse", icon: Circle },
];
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const GRID = 28;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const storageKey = (roomId: string) => `tutorlink-board:${roomId}`;

function loadStrokes(roomId: string): Stroke[] {
  try {
    const raw = localStorage.getItem(storageKey(roomId));
    const parsed = raw ? (JSON.parse(raw) as { strokes?: Stroke[] }) : null;
    return Array.isArray(parsed?.strokes) ? parsed.strokes : [];
  } catch {
    return [];
  }
}

/* ─── History (undo / redo) ─────────────────────────────────────────────────── */

interface Board {
  strokes: Stroke[];
  past: Stroke[][];
  future: Stroke[][];
}
type BoardAction = { type: "commit"; strokes: Stroke[] } | { type: "undo" } | { type: "redo" } | { type: "sync"; strokes: Stroke[] };

function reduce(b: Board, a: BoardAction): Board {
  switch (a.type) {
    case "commit":
      return { strokes: a.strokes, past: [...b.past.slice(-99), b.strokes], future: [] };
    case "undo":
      return b.past.length ? { strokes: b.past[b.past.length - 1], past: b.past.slice(0, -1), future: [b.strokes, ...b.future] } : b;
    case "redo":
      return b.future.length ? { strokes: b.future[0], past: [...b.past, b.strokes], future: b.future.slice(1) } : b;
    case "sync":
      // The other window changed the board: take its strokes and keep our own undo history.
      return { ...b, strokes: a.strokes };
  }
}

/* ─── Drawing ───────────────────────────────────────────────────────────────── */

function trace(ctx: CanvasRenderingContext2D, s: Stroke) {
  const p = s.points;
  ctx.beginPath();
  if (s.tool === "pen" || s.tool === "highlighter") {
    ctx.moveTo(p[0], p[1]);
    if (p.length === 2) ctx.lineTo(p[0] + 0.01, p[1] + 0.01);
    // Curves through the midpoints keep fast strokes smooth.
    for (let i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
    if (p.length >= 4) ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  } else if (s.tool === "line") {
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[2] ?? p[0], p[3] ?? p[1]);
  } else if (s.tool === "rect") {
    ctx.rect(p[0], p[1], (p[2] ?? p[0]) - p[0], (p[3] ?? p[1]) - p[1]);
  } else {
    const x1 = p[2] ?? p[0];
    const y1 = p[3] ?? p[1];
    ctx.ellipse((p[0] + x1) / 2, (p[1] + y1) / 2, Math.abs(x1 - p[0]) / 2, Math.abs(y1 - p[1]) / 2, 0, 0, Math.PI * 2);
  }
}

function paint(canvas: HTMLCanvasElement, strokes: Stroke[], view: View, theme: "light" | "dark", opts: { grid?: boolean } = { grid: true }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const colors = PALETTE[theme];
  const dpr = canvas.width / (canvas.clientWidth || canvas.width);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = colors.board;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (opts.grid && view.k >= 0.45) {
    const step = GRID * view.k * dpr;
    const ox = (((view.x * dpr) % step) + step) % step;
    const oy = (((view.y * dpr) % step) + step) % step;
    ctx.fillStyle = colors.dot;
    const r = Math.max(1, 1.1 * dpr);
    for (let x = ox; x < canvas.width; x += step) for (let y = oy; y < canvas.height; y += step) ctx.fillRect(x - r / 2, y - r / 2, r, r);
  }

  ctx.setTransform(view.k * dpr, 0, 0, view.k * dpr, view.x * dpr, view.y * dpr);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    ctx.globalAlpha = s.tool === "highlighter" ? 0.32 : 1;
    ctx.strokeStyle = colors[s.color];
    ctx.lineWidth = s.tool === "highlighter" ? s.size * 3.2 : s.size;
    trace(ctx, s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Distance from a point to the segment a→b. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function hits(s: Stroke, x: number, y: number, reach: number): boolean {
  const p = s.points;
  const r = reach + (s.tool === "highlighter" ? s.size * 1.6 : s.size / 2);
  if (s.tool === "pen" || s.tool === "highlighter" || s.tool === "line") {
    if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= r;
    for (let i = 0; i < p.length - 2; i += 2) if (segmentDistance(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= r) return true;
    return false;
  }
  const [x0, y0, x1 = x0, y1 = y0] = p;
  if (s.tool === "rect") {
    return (
      segmentDistance(x, y, x0, y0, x1, y0) <= r || segmentDistance(x, y, x1, y0, x1, y1) <= r || segmentDistance(x, y, x1, y1, x0, y1) <= r || segmentDistance(x, y, x0, y1, x0, y0) <= r
    );
  }
  // Ellipse: compare the point's normalised radius with 1.
  const rx = Math.abs(x1 - x0) / 2 || 0.01;
  const ry = Math.abs(y1 - y0) / 2 || 0.01;
  const d = Math.hypot((x - (x0 + x1) / 2) / rx, (y - (y0 + y1) / 2) / ry);
  return Math.abs(d - 1) * Math.min(rx, ry) <= r;
}

function bounds(strokes: Stroke[]): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    const pad = s.tool === "highlighter" ? s.size * 1.6 : s.size / 2;
    for (let i = 0; i < s.points.length; i += 2) {
      minX = Math.min(minX, s.points[i] - pad);
      maxX = Math.max(maxX, s.points[i] + pad);
      minY = Math.min(minY, s.points[i + 1] - pad);
      maxY = Math.max(maxY, s.points[i + 1] + pad);
    }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

type Gesture =
  | { kind: "draw"; stroke: Stroke }
  | { kind: "erase"; removed: Set<string> }
  | { kind: "pan"; startX: number; startY: number; view: View }
  | { kind: "pinch"; dist: number; cx: number; cy: number; view: View };

export function Whiteboard({ roomId, className }: { roomId: string; className?: string }) {
  const theme = useTheme();
  const [board, dispatch] = React.useReducer(reduce, roomId, (id): Board => ({ strokes: loadStrokes(id), past: [], future: [] }));
  const [view, setView] = React.useState<View>({ x: 0, y: 0, k: 1 });
  const [tool, setTool] = React.useState<Tool>("pen");
  const [color, setColor] = React.useState<ColorKey>("ink");
  const [size, setSize] = React.useState(SIZES[1].value);
  const [confirmClear, setConfirmClear] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const gesture = React.useRef<Gesture | null>(null);
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const frame = React.useRef(0);
  const channel = React.useRef<BroadcastChannel | null>(null);
  /** What the pointer handlers and the painter read: always the values of the latest render. */
  const latest = React.useRef({ strokes: board.strokes, view, theme });

  const redraw = React.useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const g = gesture.current;
      const { strokes, view: v, theme: t } = latest.current;
      const shown = g?.kind === "erase" ? strokes.filter((s) => !g.removed.has(s.id)) : g?.kind === "draw" ? [...strokes, g.stroke] : strokes;
      paint(canvas, shown, v, t);
    });
  }, []);

  React.useEffect(() => {
    latest.current = { strokes: board.strokes, view, theme };
    redraw();
  }, [board.strokes, view, theme, redraw]);

  // Keep the canvas as sharp as the screen, whatever size its panel takes.
  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
      const h = Math.max(1, Math.round(wrap.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [redraw]);

  // Save in this browser, and mirror to other windows that have the same room open.
  React.useEffect(() => {
    const bc = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(storageKey(roomId));
    channel.current = bc;
    if (bc) bc.onmessage = (e: MessageEvent<Stroke[]>) => dispatch({ type: "sync", strokes: e.data });
    return () => {
      bc?.close();
      channel.current = null;
    };
  }, [roomId]);
  React.useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(storageKey(roomId), JSON.stringify({ v: 1, strokes: board.strokes }));
      } catch {
        // Storage full or blocked: the board still works for this visit.
      }
    }, 300);
    return () => clearTimeout(id);
  }, [roomId, board.strokes]);

  const commit = (strokes: Stroke[]) => {
    dispatch({ type: "commit", strokes });
    channel.current?.postMessage(strokes);
  };
  const undo = () => {
    if (!board.past.length) return;
    channel.current?.postMessage(board.past[board.past.length - 1]);
    dispatch({ type: "undo" });
  };
  const redo = () => {
    if (!board.future.length) return;
    channel.current?.postMessage(board.future[0]);
    dispatch({ type: "redo" });
  };

  const zoomAt = React.useCallback((sx: number, sy: number, factor: number) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = k / v.k;
      return { k, x: sx - (sx - v.x) * ratio, y: sy - (sy - v.y) * ratio };
    });
  }, []);

  // Wheel: pan by default, zoom with Ctrl/⌘ (which is also what a trackpad pinch sends).
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = canvas.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toWorld = (p: { x: number; y: number }, v: View) => ({ x: (p.x - v.x) / v.k, y: (p.y - v.y) / v.k });

  const eraseAt = (g: Extract<Gesture, { kind: "erase" }>, p: { x: number; y: number }) => {
    const v = latest.current.view;
    const w = toWorld(p, v);
    for (const s of latest.current.strokes) if (!g.removed.has(s.id) && hits(s, w.x, w.y, 9 / v.k)) g.removed.add(s.id);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Not every pointer can be captured (e.g. a synthetic one); drawing still works without it.
    }
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const v = latest.current.view;

    if (pointers.current.size === 2) {
      // A second finger: drop whatever the first one started and move/zoom the board instead.
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, view: v };
      redraw();
      return;
    }
    if (pointers.current.size > 2) return;

    if (tool === "pan" || e.button === 1) {
      gesture.current = { kind: "pan", startX: p.x, startY: p.y, view: v };
    } else if (tool === "eraser") {
      const g: Gesture = { kind: "erase", removed: new Set() };
      gesture.current = g;
      eraseAt(g, p);
    } else {
      const w = toWorld(p, v);
      gesture.current = { kind: "draw", stroke: { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, tool, color, size: size / v.k, points: [w.x, w.y] } };
    }
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;

    if (g.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const k = clamp(g.view.k * ((Math.hypot(a.x - b.x, a.y - b.y) || 1) / g.dist), MIN_ZOOM, MAX_ZOOM);
      const ratio = k / g.view.k;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      setView({ k, x: cx - (g.cx - g.view.x) * ratio, y: cy - (g.cy - g.view.y) * ratio });
    } else if (g.kind === "pan") {
      setView({ ...g.view, x: g.view.x + p.x - g.startX, y: g.view.y + p.y - g.startY });
    } else if (g.kind === "erase") {
      eraseAt(g, p);
      redraw();
    } else {
      const w = toWorld(p, latest.current.view);
      const pts = g.stroke.points;
      if (g.stroke.tool === "pen" || g.stroke.tool === "highlighter") {
        // Skip points closer than ~1.5 screen pixels: smoother lines, smaller boards.
        if (Math.hypot(w.x - pts[pts.length - 2], w.y - pts[pts.length - 1]) * latest.current.view.k >= 1.5) pts.push(w.x, w.y);
      } else {
        pts[2] = w.x;
        pts[3] = w.y;
      }
      redraw();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      // Lifting one finger of a pinch ends the gesture; the other finger doesn't start drawing.
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (g.kind === "draw") {
      const s = g.stroke;
      const isShape = s.tool === "line" || s.tool === "rect" || s.tool === "ellipse";
      if (!isShape || s.points.length === 4) commit([...latest.current.strokes, s]);
      else redraw();
    } else if (g.kind === "erase") {
      if (g.removed.size) commit(latest.current.strokes.filter((s) => !g.removed.has(s.id)));
      else redraw();
    }
  };

  const zoomBy = (factor: number) => {
    const c = canvasRef.current;
    if (c) zoomAt(c.clientWidth / 2, c.clientHeight / 2, factor);
  };

  const download = () => {
    const box = bounds(board.strokes);
    if (!box) return;
    const pad = 48;
    const scale = Math.min(2, 4000 / Math.max(box.w + pad * 2, box.h + pad * 2));
    const out = document.createElement("canvas");
    out.width = Math.ceil((box.w + pad * 2) * scale);
    out.height = Math.ceil((box.h + pad * 2) * scale);
    paint(out, board.strokes, { k: scale, x: (pad - box.x) * scale, y: (pad - box.y) * scale }, theme, { grid: false });
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = "tutorlink-whiteboard.png";
    a.click();
  };

  const empty = board.strokes.length === 0;
  const drawing = tool !== "pan" && tool !== "eraser";

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      {/* Tools */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1.5 border-b border-line bg-surface px-2.5 py-2" role="toolbar" aria-label="Whiteboard tools">
        {TOOLS.map((t) => (
          <Tooltip key={t.key} content={t.label} side="bottom">
            <button
              type="button"
              aria-label={t.label}
              aria-pressed={tool === t.key}
              onClick={() => setTool(t.key)}
              className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition-colors", tool === t.key ? "bg-brand text-on-brand" : "text-ink-2 hover:bg-sunken hover:text-ink")}
            >
              <t.icon className="size-[18px]" />
            </button>
          </Tooltip>
        ))}
        <span className="mx-1.5 h-6 w-px shrink-0 bg-line" aria-hidden />
        <div role="radiogroup" aria-label="Colour" className={cn("flex shrink-0 items-center gap-1", !drawing && "opacity-40")}>
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={color === c.key}
              aria-label={c.label}
              disabled={!drawing}
              onClick={() => setColor(c.key)}
              className={cn("grid size-7 place-items-center rounded-full transition-shadow", color === c.key && "shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-ink)]")}
            >
              <span className="size-5 rounded-full border border-black/10" style={{ backgroundColor: PALETTE[theme][c.key] }} />
            </button>
          ))}
        </div>
        <span className="mx-1.5 h-6 w-px shrink-0 bg-line" aria-hidden />
        <div role="radiogroup" aria-label="Line width" className={cn("flex shrink-0 items-center gap-0.5", !drawing && "opacity-40")}>
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={size === s.value}
              aria-label={s.label}
              disabled={!drawing}
              onClick={() => setSize(s.value)}
              className={cn("grid size-9 place-items-center rounded-lg transition-colors", size === s.value ? "bg-sunken" : "hover:bg-canvas")}
            >
              <span className="rounded-full bg-ink" style={{ width: s.value + 3, height: s.value + 3 }} />
            </button>
          ))}
        </div>
        <span className="mx-1.5 h-6 w-px shrink-0 bg-line" aria-hidden />
        <ToolButton label="Undo" onClick={undo} disabled={!board.past.length}>
          <Undo2 />
        </ToolButton>
        <ToolButton label="Redo" onClick={redo} disabled={!board.future.length}>
          <Redo2 />
        </ToolButton>
        <ToolButton label="Save as picture" onClick={download} disabled={empty}>
          <Download />
        </ToolButton>
        <ToolButton label="Clear the board" onClick={() => setConfirmClear(true)} disabled={empty}>
          <Trash2 />
        </ToolButton>
      </div>

      {/* Board */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 bg-surface" data-lenis-prevent>
        <canvas
          ref={canvasRef}
          aria-label="Whiteboard. Draw with a mouse, pen or finger."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn("absolute inset-0 size-full touch-none select-none", tool === "pan" ? "cursor-grab active:cursor-grabbing" : tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
        />
        {empty && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-[14.5px] leading-relaxed text-muted">
            Start writing — equations, graphs, diagrams.
            <span className="block text-[13px]">The board has no edges: drag with two fingers or the hand tool to get more room.</span>
          </p>
        )}
        <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-full border border-line bg-surface/95 p-1 shadow-sm backdrop-blur">
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)} className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink">
            <Minus className="size-4" />
          </button>
          <button type="button" aria-label="Reset zoom and position" onClick={() => setView({ x: 0, y: 0, k: 1 })} className="h-8 min-w-12 rounded-full px-1.5 text-[12.5px] font-semibold tabular-nums text-ink hover:bg-sunken">
            {Math.round(view.k * 100)}%
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)} className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink">
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear the whole board?"
        description="Everything on the board is removed. You can bring it back with Undo."
        confirmLabel="Clear board"
        tone="danger"
        onConfirm={() => {
          commit([]);
          setConfirmClear(false);
        }}
      />
    </div>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[18px]"
      >
        {children}
      </button>
    </Tooltip>
  );
}
