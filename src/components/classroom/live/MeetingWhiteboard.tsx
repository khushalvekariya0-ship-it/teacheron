"use client";

import * as React from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type Participant } from "livekit-client";
import {
  ArrowDownToLine, ArrowUpToLine, Check, Circle, Copy, Eraser, Eye, ImagePlus, Minus, MousePointer2, PenLine, Redo2, Scissors, Share2, Square, Trash2, Type, Undo2, X,
} from "lucide-react";
import { readMeta, TOPIC } from "@/lib/classroom";
import { scanContact } from "@/lib/domain/contact";
import { cn } from "@/lib/utils";
import { BoardSnip } from "./BoardSnip";

/*
 * The shared whiteboard. Strokes travel over LiveKit's data channel (no server of our own in the loop):
 * every finished stroke is broadcast and appended by everyone; a late joiner asks for the board and the
 * host answers with a snapshot (chunked when large). Only the host can clear, undo or reorder, and hands
 * out drawing rights per person. Receivers check everything: who sent it (host-ness comes from the
 * server-signed token metadata), that images are ones the server stored after reading them for contact
 * details, and that text has no contact details.
 */

type Tool = "select" | "pen" | "eraser" | "line" | "rect" | "circle" | "text";
interface Pt { x: number; y: number }
interface Stroke {
  id: string;
  tool: Tool | "image";
  color?: string;
  size?: number;
  /** Points as fractions of the board, so a drawing lands in the same place on every screen. */
  pts?: Pt[];
  text?: string;
  url?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** On-screen aspect ratio of an image, so it keeps its shape when the board changes size. */
  sar?: number;
}
interface Person { id: string; name: string }

const COLORS = ["#15140f", "#e5582f", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#db2777", "#ffffff"];
const SIZES = [2, 4, 8, 14, 22];
const MIN_IMAGE_PX = 32;
// A data packet tops out around 60 KB, and a busy board is far bigger: snapshots go in pieces.
const SNAP_CHUNK = 18_000;
const HISTORY_LIMIT = 60;
const MAX_POINTS = 6000;
const STORAGE_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/sign/private-files/classroom/`;

const HANDLES = [
  { k: "nw", fx: 0, fy: 0, cursor: "nwse-resize" },
  { k: "n", fx: 0.5, fy: 0, cursor: "ns-resize" },
  { k: "ne", fx: 1, fy: 0, cursor: "nesw-resize" },
  { k: "e", fx: 1, fy: 0.5, cursor: "ew-resize" },
  { k: "se", fx: 1, fy: 1, cursor: "nwse-resize" },
  { k: "s", fx: 0.5, fy: 1, cursor: "ns-resize" },
  { k: "sw", fx: 0, fy: 1, cursor: "nesw-resize" },
  { k: "w", fx: 0, fy: 0.5, cursor: "ew-resize" },
] as const;

const finite = (n: unknown, lo = -10, hi = 10): n is number => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;

/** Only well-formed strokes, images the server stored, and text without contact details are accepted. */
function cleanStroke(raw: unknown): Stroke | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || s.id.length > 160) return null;
  if (s.tool === "image") {
    if (typeof s.url !== "string" || !s.url.startsWith(STORAGE_PREFIX) || s.url.length > 2000) return null;
    if (![s.x, s.y].every((v) => finite(v)) || ![s.w, s.h].every((v) => finite(v, 0, 10))) return null;
    return { id: s.id, tool: "image", url: s.url, x: s.x as number, y: s.y as number, w: s.w as number, h: s.h as number, sar: finite(s.sar, 0, 1000) ? s.sar : undefined };
  }
  const tools: Tool[] = ["pen", "eraser", "line", "rect", "circle", "text"];
  if (!tools.includes(s.tool as Tool)) return null;
  if (!Array.isArray(s.pts) || !s.pts.length || s.pts.length > MAX_POINTS) return null;
  const pts = (s.pts as unknown[]).map((p) => (p && typeof p === "object" && finite((p as Pt).x) && finite((p as Pt).y) ? { x: (p as Pt).x, y: (p as Pt).y } : null));
  if (pts.some((p) => !p)) return null;
  const color = typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#15140f";
  const size = finite(s.size, 1, 40) ? s.size : 4;
  if (s.tool === "text") {
    const text = typeof s.text === "string" ? s.text.slice(0, 300) : "";
    if (!text || scanContact(text, "chat").found) return null;
    return { id: s.id, tool: "text", color, size, pts: pts as Pt[], text };
  }
  return { id: s.id, tool: s.tool as Tool, color, size, pts: pts as Pt[] };
}

/** Where an image sits on the canvas, in pixels (keeps its shape inside the box it was given). */
function imageRect(st: Stroke, cw: number, ch: number) {
  const x = (st.x ?? 0) * cw;
  const y = (st.y ?? 0) * ch;
  const bw = (st.w ?? 1) * cw;
  const bh = (st.h ?? 1) * ch;
  if (!(st.sar && st.sar > 0)) return { x, y, w: bw, h: bh };
  const w = Math.min(bw, bh * st.sar);
  return { x, y, w, h: w / st.sar };
}

/** Stroke ids are "<identity>-<time>-<n>": a receiver can check ownership without trusting the sender. */
const strokeOwnedBy = (st: Stroke | undefined, identity: string | undefined) => !!st && !!identity && st.id.startsWith(`${identity}-`);
const senderIsHost = (p: Participant | undefined) => !!readMeta(p?.metadata)?.isHost;

async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ ok: boolean; error?: string } & Partial<T>> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Partial<T>;
    return { ...data, ok: res.ok && data.ok !== false, error: data.error ?? (res.ok ? undefined : "Something went wrong. Please try again.") };
  } catch {
    return { ok: false, error: "You seem to be offline. Please try again." } as { ok: boolean; error?: string } & Partial<T>;
  }
}

function ToolBtn({ t, label, icon: Icon, tool, setTool }: { t: Tool; label: string; icon: React.ComponentType<{ className?: string }>; tool: Tool; setTool: (t: Tool) => void }) {
  return (
    <button
      type="button"
      onClick={() => setTool(t)}
      title={label}
      aria-label={label}
      aria-pressed={tool === t}
      className={cn("grid size-8 place-items-center transition-colors", tool === t ? "bg-brand text-on-brand" : "text-ink hover:bg-sunken")}
    >
      <Icon className="size-4" />
    </button>
  );
}

export function MeetingWhiteboard({
  isHost,
  bookingId,
  title,
  participants,
  onCanDrawChange,
}: {
  isHost: boolean;
  bookingId: string;
  title: string;
  /** Everyone else in the room (identity + name). */
  participants: Person[];
  onCanDrawChange?: (canDraw: boolean) => void;
}) {
  const room = useRoomContext();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const strokesRef = React.useRef<Stroke[]>([]);
  const currentRef = React.useRef<Stroke | null>(null);

  const [tool, setTool] = React.useState<Tool>("pen");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selectedIdRef = React.useRef<string | null>(null);
  const [selBox, setSelBox] = React.useState<{ left: number; top: number; width: number; height: number; cw: number; ch: number } | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const dragRef = React.useRef<{ mode: string; id: string; rect: { x: number; y: number; w: number; h: number }; saved: boolean; ar: number; startX: number; startY: number } | null>(null);
  const lastGeomSend = React.useRef(0);
  const undoStack = React.useRef<Stroke[][]>([]);
  const redoStack = React.useRef<Stroke[][]>([]);
  const snapSeq = React.useRef(0);
  const snapBufs = React.useRef(new Map<string, { seq: number; parts: number; got: string[] }>());
  // True until the board arrives or this client changes it: a host who refreshed holds an empty board,
  // and must not announce it as the lesson (that would wipe everyone's).
  const awaitingSyncRef = React.useRef(true);
  const [histDepth, setHistDepth] = React.useState({ undo: 0, redo: 0 });
  const [color, setColor] = React.useState(COLORS[0]);
  const [size, setSize] = React.useState(4);
  const [textInput, setTextInput] = React.useState("");
  const [textPos, setTextPos] = React.useState<Pt | null>(null);
  const [textError, setTextError] = React.useState<string | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareTitle, setShareTitle] = React.useState("");
  const [sharing, setSharing] = React.useState(false);
  const [shareMsg, setShareMsg] = React.useState("");
  const [editors, setEditors] = React.useState<string[]>([]);
  const editorsRef = React.useRef<string[]>([]);
  const strokeSeq = React.useRef(0);
  const imgCache = React.useRef(new Map<string, HTMLImageElement | null | false>());
  const [pasting, setPasting] = React.useState(false);
  const [pasteMsg, setPasteMsg] = React.useState("");
  const [snipping, setSnipping] = React.useState(false);
  const [snipPanel, setSnipPanel] = React.useState(false);
  const [autoClip, setAutoClip] = React.useState(false);
  const lastClipRef = React.useRef("");
  const [pushCode, setPushCode] = React.useState("");
  const [helperCmd, setHelperCmd] = React.useState("");
  const [pushBusy, setPushBusy] = React.useState(false);
  const [pushCount, setPushCount] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const redrawRef = React.useRef<() => void>(() => {});

  const myId = room.localParticipant.identity;
  const canDraw = isHost || editors.includes(myId);
  React.useEffect(() => {
    editorsRef.current = editors;
  }, [editors]);
  React.useEffect(() => {
    onCanDrawChange?.(canDraw);
  }, [canDraw, onCanDrawChange]);

  const nextStrokeId = () => `${room.localParticipant.identity || "me"}-${Date.now()}-${++strokeSeq.current}`;
  const flash = (msg: string, ms = 2500) => {
    setPasteMsg(msg);
    window.setTimeout(() => setPasteMsg(""), ms);
  };

  /* ── drawing ─────────────────────────────────────────────────────────── */

  const drawStroke = React.useCallback((ctx: CanvasRenderingContext2D, s: Stroke) => {
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    if (s.tool === "image" && s.url) {
      const cached = imgCache.current.get(s.url);
      if (cached === undefined) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        imgCache.current.set(s.url, null); // pending: a redraw storm can't queue a hundred loads
        img.onload = () => {
          imgCache.current.set(s.url!, img);
          redrawRef.current();
        };
        img.onerror = () => imgCache.current.set(s.url!, false);
        img.src = s.url;
        return;
      }
      if (!cached) return;
      const r = imageRect(s, cw, ch);
      ctx.drawImage(cached, r.x, r.y, r.w, r.h);
      return;
    }
    const pts = (s.pts ?? []).map((p) => ({ x: p.x * cw, y: p.y * ch }));
    if (!pts.length) return;
    ctx.save();
    ctx.strokeStyle = s.tool === "eraser" ? "#ffffff" : (s.color ?? "#15140f");
    ctx.fillStyle = s.color ?? "#15140f";
    ctx.lineWidth = s.size ?? 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const p0 = pts[0];
    const p1 = pts[pts.length - 1];
    if (s.tool === "text") {
      ctx.font = `${(s.size ?? 4) * 4}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(s.text ?? "", p0.x, p0.y);
    } else if (s.tool === "line" && pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    } else if (s.tool === "rect" && pts.length >= 2) {
      ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    } else if (s.tool === "circle" && pts.length >= 2) {
      ctx.beginPath();
      ctx.ellipse(p0.x + (p1.x - p0.x) / 2, p0.y + (p1.y - p0.y) / 2, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (currentRef.current) drawStroke(ctx, currentRef.current);
  }, [drawStroke]);
  React.useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  const refreshSel = React.useCallback((id?: string | null) => {
    const want = id === undefined ? selectedIdRef.current : id;
    const canvas = canvasRef.current;
    const st = want ? strokesRef.current.find((x) => x.id === want) : null;
    if (!st || !canvas || st.tool !== "image") {
      setSelBox(null);
      return;
    }
    const r = imageRect(st, canvas.width, canvas.height);
    setSelBox({ left: r.x, top: r.y, width: r.w, height: r.h, cw: canvas.width, ch: canvas.height });
  }, []);

  const selectImage = React.useCallback(
    (id: string | null) => {
      selectedIdRef.current = id;
      setSelectedId(id);
      refreshSel(id);
    },
    [refreshSel],
  );

  const pushHistory = React.useCallback(() => {
    awaitingSyncRef.current = false;
    undoStack.current.push(strokesRef.current.slice());
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    setHistDepth({ undo: undoStack.current.length, redo: 0 });
  }, []);

  /** Someone else's change lands in the saved states too, so undo never deletes their work. */
  const rebaseHistory = React.useCallback((fn: (list: Stroke[]) => Stroke[]) => {
    undoStack.current = undoStack.current.map(fn);
    redoStack.current = redoStack.current.map(fn);
  }, []);

  const resetHistory = React.useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    snapBufs.current = new Map();
    setHistDepth({ undo: 0, redo: 0 });
  }, []);

  /* ── sending ─────────────────────────────────────────────────────────── */

  const send = React.useCallback(
    (msg: Record<string, unknown>) => {
      try {
        const enc = new TextEncoder().encode(JSON.stringify(msg));
        if (enc.length < 60_000) void room.localParticipant.publishData(enc, { reliable: true });
        else console.warn("[whiteboard] message too large to send:", enc.length);
      } catch (e) {
        console.error("[whiteboard] send failed", e);
      }
    },
    [room],
  );

  const broadcastStroke = React.useCallback((stroke: Stroke) => send({ type: TOPIC.stroke, stroke }), [send]);

  const sendSnapshot = React.useCallback(() => {
    const json = JSON.stringify(strokesRef.current);
    if (json.length <= SNAP_CHUNK) {
      send({ type: TOPIC.board, strokes: strokesRef.current });
      return;
    }
    const seq = ++snapSeq.current;
    const parts = Math.ceil(json.length / SNAP_CHUNK);
    for (let i = 0; i < parts; i++) send({ type: TOPIC.board, seq, part: i, parts, chunk: json.slice(i * SNAP_CHUNK, (i + 1) * SNAP_CHUNK) });
  }, [send]);

  const broadcastSnapshot = React.useCallback(() => {
    if (isHost) sendSnapshot();
  }, [isHost, sendSnapshot]);

  /* ── receiving ───────────────────────────────────────────────────────── */

  React.useEffect(() => {
    const mayDraw = (p: Participant | undefined, fromHost: boolean) => fromHost || (!!p?.identity && editorsRef.current.includes(p.identity));
    const handler = (payload: Uint8Array, participant?: Participant) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
      } catch {
        return;
      }
      const fromHost = senderIsHost(participant);
      switch (msg.type) {
        case TOPIC.grant:
          if (!fromHost) return;
          setEditors(Array.isArray(msg.ids) ? (msg.ids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 50) : []);
          return;
        case TOPIC.board: {
          const recovering = isHost && awaitingSyncRef.current;
          if (!fromHost && !recovering) return;
          let list: unknown = null;
          if (Array.isArray(msg.strokes)) list = msg.strokes;
          else if (typeof msg.parts === "number" && msg.parts > 0 && msg.parts < 2000) {
            const who = participant?.identity ?? "";
            let buf = snapBufs.current.get(who);
            if (!buf || buf.seq !== msg.seq) {
              buf = { seq: Number(msg.seq), parts: msg.parts, got: [] };
              snapBufs.current.set(who, buf);
            }
            buf.got[Number(msg.part)] = String(msg.chunk ?? "");
            if (buf.got.filter((c) => typeof c === "string").length < buf.parts) return;
            snapBufs.current.delete(who);
            try {
              list = JSON.parse(buf.got.join(""));
            } catch {
              return;
            }
          }
          if (!Array.isArray(list)) return;
          const clean = list.map(cleanStroke).filter((s): s is Stroke => !!s);
          if (!fromHost && clean.length === 0) return;
          awaitingSyncRef.current = false;
          strokesRef.current = clean;
          resetHistory();
          redraw();
          if (!strokesRef.current.some((x) => x.id === selectedIdRef.current)) selectImage(null);
          else refreshSel();
          // Handed back by a student after the host refreshed: make it official for everyone.
          if (!fromHost) broadcastSnapshot();
          return;
        }
        case TOPIC.clear:
          if (!fromHost) return;
          awaitingSyncRef.current = false;
          strokesRef.current = [];
          resetHistory();
          selectImage(null);
          redraw();
          return;
        case TOPIC.update: {
          const up = msg.stroke as Record<string, unknown> | undefined;
          if (!up || typeof up.id !== "string") return;
          const idx = strokesRef.current.findIndex((x) => x.id === up.id);
          if (idx < 0 || !mayDraw(participant, fromHost)) return;
          if (!fromHost && !strokeOwnedBy(strokesRef.current[idx], participant?.identity)) return;
          if (![up.x, up.y].every((v) => finite(v)) || ![up.w, up.h].every((v) => finite(v, 0, 10))) return;
          const geom = { x: up.x as number, y: up.y as number, w: up.w as number, h: up.h as number, sar: finite(up.sar, 0, 1000) ? (up.sar as number) : undefined };
          strokesRef.current[idx] = { ...strokesRef.current[idx], ...geom };
          if (msg.final) rebaseHistory((list) => list.map((x) => (x.id === up.id ? { ...x, ...geom } : x)));
          redraw();
          if (up.id === selectedIdRef.current) refreshSel();
          return;
        }
        case TOPIC.remove: {
          const id = msg.id;
          if (typeof id !== "string") return;
          const victim = strokesRef.current.find((x) => x.id === id);
          if (!victim || !mayDraw(participant, fromHost)) return;
          if (!fromHost && !strokeOwnedBy(victim, participant?.identity)) return;
          strokesRef.current = strokesRef.current.filter((x) => x.id !== id);
          rebaseHistory((list) => list.filter((x) => x.id !== id));
          if (id === selectedIdRef.current) selectImage(null);
          redraw();
          return;
        }
        case TOPIC.stroke: {
          const st = cleanStroke(msg.stroke);
          if (!st || !mayDraw(participant, fromHost)) return;
          // Images come only from the host (only the host can store them).
          if (st.tool === "image" && !fromHost) return;
          if (strokesRef.current.some((x) => x.id === st.id)) return;
          strokesRef.current.push(st);
          rebaseHistory((list) => (list.some((x) => x.id === st.id) ? list : [...list, st]));
          redraw();
          return;
        }
        case TOPIC.sync:
          if (isHost) {
            if (strokesRef.current.length || !awaitingSyncRef.current) broadcastSnapshot();
            if (editorsRef.current.length) send({ type: TOPIC.grant, ids: editorsRef.current });
          } else if (fromHost && strokesRef.current.length) {
            sendSnapshot();
          }
          return;
        default:
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room, redraw, isHost, broadcastSnapshot, sendSnapshot, send, rebaseHistory, resetHistory, refreshSel, selectImage]);

  // Ask for the current board on arrival (the host too: after a refresh the room has it).
  React.useEffect(() => {
    const t = window.setTimeout(() => send({ type: TOPIC.sync }), 400);
    return () => window.clearTimeout(t);
  }, [send]);

  // The host re-announces the board and its editors whenever someone arrives.
  React.useEffect(() => {
    if (!isHost) return;
    const onJoin = () => {
      if (strokesRef.current.length || !awaitingSyncRef.current) broadcastSnapshot();
      if (editorsRef.current.length) send({ type: TOPIC.grant, ids: editorsRef.current });
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, isHost, broadcastSnapshot, send]);

  // The canvas follows its box.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const box = canvas?.parentElement;
    if (!canvas || !box) return;
    const resize = () => {
      const { width, height } = box.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));
      redraw();
      refreshSel();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw, refreshSel]);

  /* ── pointer helpers ─────────────────────────────────────────────────── */

  const clientPoint = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const src = "touches" in e ? e.touches[0] ?? (e as TouchEvent).changedTouches?.[0] : e;
    return { clientX: src?.clientX ?? 0, clientY: src?.clientY ?? 0 };
  };
  const getXY = (e: React.MouseEvent | React.TouchEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const { clientX, clientY } = clientPoint(e);
    return { x: clientX - r.left, y: clientY - r.top };
  };
  const toFrac = (p: Pt) => {
    const c = canvasRef.current!;
    return { x: p.x / c.width, y: p.y / c.height };
  };

  // The host may rearrange everything; anyone else only the pictures they added.
  const canEditStroke = React.useCallback((st: Stroke | undefined) => !!st && st.tool === "image" && (isHost || strokeOwnedBy(st, myId)), [isHost, myId]);

  const hitImage = React.useCallback(
    (px: number, py: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      for (let i = strokesRef.current.length - 1; i >= 0; i--) {
        const st = strokesRef.current[i];
        if (!canEditStroke(st)) continue;
        const r = imageRect(st, canvas.width, canvas.height);
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return st;
      }
      return null;
    },
    [canEditStroke],
  );

  /** Writes a new geometry, redraws and tells the room (throttled during a drag, always once at the end). */
  const commitGeom = React.useCallback(
    (id: string, px: number, py: number, pw: number, ph: number, final: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const idx = strokesRef.current.findIndex((x) => x.id === id);
      if (idx < 0) return;
      const geom = { x: px / canvas.width, y: py / canvas.height, w: pw / canvas.width, h: ph / canvas.height, sar: pw / (ph || 1) };
      // A new object each time: saved states hold references, and editing in place would rewrite history.
      strokesRef.current[idx] = { ...strokesRef.current[idx], ...geom };
      redraw();
      refreshSel(id);
      const now = Date.now();
      if (canDraw && (final || now - lastGeomSend.current > 110)) {
        lastGeomSend.current = now;
        send({ type: TOPIC.update, final, stroke: { id, ...geom } });
      }
    },
    [redraw, refreshSel, send, canDraw],
  );

  const beginDrag = React.useCallback(
    (e: React.MouseEvent | React.TouchEvent, mode: string, stroke?: Stroke | null) => {
      const canvas = canvasRef.current;
      const st = stroke ?? strokesRef.current.find((x) => x.id === selectedIdRef.current);
      if (!canvas || !st || !canEditStroke(st)) return;
      const box = canvas.getBoundingClientRect();
      const { clientX, clientY } = clientPoint(e);
      const rect = imageRect(st, canvas.width, canvas.height);
      dragRef.current = { mode, id: st.id, rect, saved: false, ar: rect.w / (rect.h || 1), startX: clientX - box.left, startY: clientY - box.top };
      setDragActive(true);
    },
    [canEditStroke],
  );

  const applyDrag = React.useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const d = dragRef.current;
      if (!canvas || !d || selectedIdRef.current !== d.id) return;
      if (!d.saved) {
        d.saved = true;
        pushHistory();
      }
      const box = canvas.getBoundingClientRect();
      const dx = clientX - box.left - d.startX;
      const dy = clientY - box.top - d.startY;
      let { x, y, w, h } = d.rect;
      if (d.mode === "move") {
        // A grabbable strip always stays on the board.
        const keep = Math.min(MIN_IMAGE_PX, w, h);
        x = Math.min(Math.max(x + dx, keep - w), canvas.width - keep);
        y = Math.min(Math.max(y + dy, keep - h), canvas.height - keep);
      } else {
        if (d.mode.includes("w")) w = d.rect.w - dx;
        if (d.mode.includes("e")) w = d.rect.w + dx;
        if (d.mode.includes("n")) h = d.rect.h - dy;
        if (d.mode.includes("s")) h = d.rect.h + dy;
        if (d.mode.length === 2) {
          // A corner keeps the picture's shape, driven by whichever axis moved further.
          const ar = d.ar > 0 ? d.ar : 1;
          if (Math.abs(w - d.rect.w) >= Math.abs(h - d.rect.h) * ar) h = w / ar;
          else w = h * ar;
          const minW = MIN_IMAGE_PX * Math.max(1, ar);
          if (w < minW) {
            w = minW;
            h = w / ar;
          }
        } else {
          w = Math.max(w, MIN_IMAGE_PX);
          h = Math.max(h, MIN_IMAGE_PX);
        }
        // Anchor the far side to the final size.
        x = d.mode.includes("w") ? d.rect.x + d.rect.w - w : d.rect.x;
        y = d.mode.includes("n") ? d.rect.y + d.rect.h - h : d.rect.y;
      }
      commitGeom(d.id, x, y, w, h, false);
    },
    [commitGeom, pushHistory],
  );

  const endDrag = React.useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragActive(false);
    if (!d) return;
    const st = strokesRef.current.find((x) => x.id === d.id);
    if (st && canDraw) send({ type: TOPIC.update, final: true, stroke: { id: st.id, x: st.x, y: st.y, w: st.w, h: st.h, sar: st.sar } });
  }, [send, canDraw]);

  // On the window, so a drag that runs off the board (or over a handle) keeps working.
  React.useEffect(() => {
    if (!dragActive) return;
    const move = (e: MouseEvent | TouchEvent) => {
      if (!("touches" in e) && e.buttons === 0) {
        endDrag();
        return;
      }
      if (e.cancelable) e.preventDefault();
      const { clientX, clientY } = clientPoint(e);
      applyDrag(clientX, clientY);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", endDrag);
    window.addEventListener("touchcancel", endDrag);
    window.addEventListener("blur", endDrag);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", endDrag);
      window.removeEventListener("touchcancel", endDrag);
      window.removeEventListener("blur", endDrag);
    };
  }, [dragActive, applyDrag, endDrag]);

  const pickTool = (t: Tool) => {
    setTool(t);
    if (t !== "select") selectImage(null);
  };

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canDraw) return;
    const pt = getXY(e);
    if (tool === "select") {
      const hit = hitImage(pt.x, pt.y);
      if (!hit) {
        selectImage(null);
        return;
      }
      selectImage(hit.id);
      beginDrag(e, "move", hit);
      return;
    }
    if (tool === "text") {
      setTextPos(pt);
      setTextError(null);
      return;
    }
    drawing.current = true;
    currentRef.current = { id: "", tool, color, size, pts: [toFrac(pt)] };
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canDraw || !drawing.current || !currentRef.current) return;
    const pts = currentRef.current.pts!;
    if (pts.length >= MAX_POINTS) return;
    pts.push(toFrac(getXY(e)));
    redraw();
  };

  const onUp = () => {
    if (!canDraw || !drawing.current) return;
    drawing.current = false;
    const cur = currentRef.current;
    currentRef.current = null;
    if (cur) {
      const pts = cur.pts ?? [];
      if (pts.length < 2) {
        // A click: a dot for the pen and eraser, nothing for a shape.
        if (cur.tool === "pen" || cur.tool === "eraser") pts.push({ ...pts[0] });
        else {
          redraw();
          return;
        }
      }
      pushHistory();
      const stroke: Stroke = { ...cur, pts, id: nextStrokeId() };
      strokesRef.current.push(stroke);
      broadcastStroke(stroke);
    }
    redraw();
  };

  const addText = () => {
    const text = textInput.trim();
    if (!text || !textPos) return;
    if (scanContact(text, "chat").found) {
      setTextError("Contact details can't be shared on TutorLink.");
      return;
    }
    pushHistory();
    const stroke: Stroke = { id: nextStrokeId(), tool: "text", color, size, pts: [toFrac(textPos)], text: text.slice(0, 300) };
    strokesRef.current.push(stroke);
    setTextInput("");
    setTextPos(null);
    broadcastStroke(stroke);
    redraw();
  };

  /* ── host-only whole-board operations ────────────────────────────────── */

  const clearBoard = () => {
    if (!isHost) return;
    pushHistory();
    strokesRef.current = [];
    currentRef.current = null;
    selectImage(null);
    send({ type: TOPIC.clear });
    redraw();
  };

  const stepHistory = React.useCallback(
    (back: boolean) => {
      if (!isHost) return;
      const from = back ? undoStack.current : redoStack.current;
      const to = back ? redoStack.current : undoStack.current;
      if (!from.length) return;
      if (dragRef.current) {
        dragRef.current = null;
        setDragActive(false);
      }
      to.push(strokesRef.current.slice());
      strokesRef.current = from.pop()!;
      setHistDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
      if (!strokesRef.current.some((x) => x.id === selectedIdRef.current)) selectImage(null);
      else refreshSel();
      broadcastSnapshot();
      redraw();
    },
    [isHost, broadcastSnapshot, redraw, refreshSel, selectImage],
  );
  const undo = React.useCallback(() => stepHistory(true), [stepHistory]);
  const redo = React.useCallback(() => stepHistory(false), [stepHistory]);

  const deleteSelected = React.useCallback(() => {
    const id = selectedIdRef.current;
    const st = id ? strokesRef.current.find((x) => x.id === id) : undefined;
    if (!id || !canEditStroke(st)) return;
    pushHistory();
    strokesRef.current = strokesRef.current.filter((x) => x.id !== id);
    selectImage(null);
    redraw();
    if (canDraw) send({ type: TOPIC.remove, id });
  }, [canEditStroke, pushHistory, selectImage, redraw, send, canDraw]);

  const reorderSelected = (toFront: boolean) => {
    if (!isHost) return;
    const id = selectedIdRef.current;
    const idx = strokesRef.current.findIndex((x) => x.id === id);
    if (idx < 0) return;
    pushHistory();
    const next = strokesRef.current.slice();
    const [st] = next.splice(idx, 1);
    if (toFront) next.push(st);
    else next.unshift(st);
    strokesRef.current = next;
    redraw();
    refreshSel(id);
    broadcastSnapshot();
  };

  /* ── images: paste, upload, snip ─────────────────────────────────────── */

  const placeImage = React.useCallback(
    async (url: string, knownW?: number, knownH?: number) => {
      let iw = knownW;
      let ih = knownH;
      if (!iw || !ih) {
        const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve(null);
          img.src = url;
        });
        if (!dims) return;
        iw = dims.w;
        ih = dims.h;
      }
      const canvas = canvasRef.current;
      const cw = canvas?.width || 1;
      const chh = canvas?.height || 1;
      const fit = Math.min((cw * 0.8) / iw, (chh * 0.8) / ih, 1);
      const w = (iw * fit) / cw;
      const h = (ih * fit) / chh;
      const stroke: Stroke = { id: nextStrokeId(), tool: "image", url, x: (1 - w) / 2, y: (1 - h) / 2, w, h, sar: iw / ih };
      pushHistory();
      strokesRef.current.push(stroke);
      redraw();
      broadcastStroke(stroke);
      // Handed straight over ready to be moved: positioning a snip is almost always next.
      setTool("select");
      selectImage(stroke.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [redraw, broadcastStroke, pushHistory, selectImage],
  );

  /** Shrinks the picture, has the server read and store it, then broadcasts only its address. */
  const addImage = React.useCallback(
    async (file: Blob) => {
      if (!isHost) return;
      setPasting(true);
      setPasteMsg("");
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error("Couldn't read that image."));
          fr.readAsDataURL(file);
        });
        const shrunk = await new Promise<{ url: string; w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
            if (scale === 1 && /^data:image\/(png|jpeg|webp);/.test(dataUrl)) return resolve({ url: dataUrl, w: img.width, h: img.height });
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
            resolve({ url: c.toDataURL("image/png"), w: c.width, h: c.height });
          };
          img.onerror = () => resolve({ url: dataUrl, w: 0, h: 0 });
          img.src = dataUrl;
        });
        flash("Checking the image…", 60_000);
        const res = await postJson<{ url: string }>("/api/classroom/board-image", { id: bookingId, image: shrunk.url });
        if (!res.ok || !res.url) throw new Error(res.error ?? "Couldn't add that image.");
        await placeImage(res.url, shrunk.w, shrunk.h);
        flash("Image added", 1500);
      } catch (e) {
        flash((e as Error).message, 6000);
      } finally {
        setPasting(false);
      }
    },
    [isHost, bookingId, placeImage],
  );

  // Whatever image is on the clipboard now, with a fingerprint so a snip is never added twice.
  const readClipImage = React.useCallback(async (): Promise<{ blob: Blob; hash: string } | null> => {
    if (!navigator.clipboard?.read) throw new Error("unsupported");
    for (const it of await navigator.clipboard.read()) {
      const type = it.types.find((t) => t.startsWith("image/"));
      if (!type) continue;
      const blob = await it.getType(type);
      const d = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      return { blob, hash: Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("") };
    }
    return null;
  }, []);

  // Turning it on happens inside the click: the permission prompt needs that gesture.
  const enableAutoClip = async () => {
    try {
      const current = await readClipImage();
      lastClipRef.current = current?.hash ?? "";
      setAutoClip(true);
      flash("Watching for snips", 2000);
    } catch (e) {
      flash((e as Error)?.message === "unsupported" ? "This browser can't read the clipboard. Use Ctrl+V instead." : "Clipboard access was blocked. Allow it from the icon in the address bar.", 5000);
    }
  };

  // The clipboard is readable only while this tab has focus, which is exactly when a fresh snip is waiting.
  React.useEffect(() => {
    if (!autoClip || !isHost) return;
    let alive = true;
    const check = async () => {
      if (!alive || document.visibilityState !== "visible" || !document.hasFocus()) return;
      try {
        const found = await readClipImage();
        if (!alive || !found || found.hash === lastClipRef.current) return;
        lastClipRef.current = found.hash;
        void addImage(found.blob);
      } catch (e) {
        if ((e as Error)?.name === "NotAllowedError" && document.hasFocus()) {
          setAutoClip(false);
          flash("Clipboard access was withdrawn.", 4000);
        }
      }
    };
    const t = window.setInterval(check, 1200);
    window.addEventListener("focus", check);
    void check();
    return () => {
      alive = false;
      window.clearInterval(t);
      window.removeEventListener("focus", check);
    };
  }, [autoClip, isHost, readClipImage, addImage]);

  const linkHelper = async () => {
    setPushBusy(true);
    const res = await postJson<{ code: string; command: string }>("/api/classroom/push-code", { id: bookingId });
    setPushBusy(false);
    if (!res.ok || !res.code) return flash(res.error ?? "Couldn't set up the helper.", 5000);
    setPushCode(res.code);
    setHelperCmd(res.command ?? "");
  };

  // Collect what the helper sent (only once one is linked).
  React.useEffect(() => {
    if (!pushCode || !isHost) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/classroom/push?code=${encodeURIComponent(pushCode)}`);
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { pushes?: { id: string; url: string }[] };
        for (const p of data.pushes ?? []) {
          if (!alive) return;
          await placeImage(p.url);
          setPushCount((n) => n + 1);
        }
      } catch {
        // A dropped poll is collected on the next one.
      }
    };
    const t = window.setInterval(tick, 1800);
    void tick();
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [pushCode, isHost, placeImage]);

  // The board stays mounted while hidden, so shortcuts check it's on screen first.
  const boardVisible = () => !!canvasRef.current && canvasRef.current.offsetParent !== null;

  React.useEffect(() => {
    if (!canDraw) return;
    const onKey = (e: KeyboardEvent) => {
      if (!boardVisible()) return;
      const el = e.target as HTMLElement | null;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
      const key = (e.key || "").toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === "y") {
          e.preventDefault();
          redo();
        }
        return;
      }
      if (e.key === "Escape") selectImage(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canDraw, undo, redo, selectImage, deleteSelected]);

  // Ctrl+V anywhere while the board is open.
  React.useEffect(() => {
    if (!isHost) return;
    const onPaste = (e: ClipboardEvent) => {
      if (!boardVisible()) return;
      for (const it of Array.from(e.clipboardData?.items ?? [])) {
        if (it.type?.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            void addImage(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [isHost, addImage]);

  const setRights = (id: string, may: boolean) => {
    const next = may ? [...new Set([...editors, id])] : editors.filter((x) => x !== id);
    setEditors(next);
    send({ type: TOPIC.grant, ids: next });
    setShareMsg(may ? "They can draw now." : "Set back to view only.");
  };

  // Someone who left can't draw (and isn't counted).
  const present = React.useMemo(() => new Set(participants.map((p) => p.id)), [participants]);
  const liveEditors = editors.filter((id) => present.has(id));

  /** Flattens the board onto white, hands drawing to whoever is chosen, and saves a copy for the student. */
  const shareBoard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSharing(true);
    setShareMsg("");
    const grantIds = liveEditors.length ? liveEditors : participants.map((p) => p.id);
    setEditors(grantIds);
    send({ type: TOPIC.grant, ids: grantIds });
    try {
      const flat = document.createElement("canvas");
      flat.width = canvas.width;
      flat.height = canvas.height;
      const fx = flat.getContext("2d")!;
      fx.fillStyle = "#ffffff";
      fx.fillRect(0, 0, flat.width, flat.height);
      fx.drawImage(canvas, 0, 0);
      const res = await postJson("/api/classroom/share-board", { id: bookingId, title: shareTitle.trim() || title, image: flat.toDataURL("image/png"), recipients: liveEditors });
      if (!res.ok) throw new Error(res.error ?? "Couldn't share the board.");
      setShareMsg("Saved to the lesson page ✓");
      window.setTimeout(() => {
        setShareOpen(false);
        setShareMsg("");
      }, 1800);
    } catch (e) {
      setShareMsg(`They can draw on it now, but saving a copy failed: ${(e as Error).message}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="relative flex size-full flex-col bg-white">
      {/* ── Snip panel ── */}
      {isHost && snipPanel && (
        <div className="absolute left-3 top-14 z-30 w-[23rem] max-w-[calc(100%-1.5rem)] border border-line bg-surface p-3 text-ink shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Snip from anywhere</span>
            <button type="button" onClick={() => setSnipPanel(false)} className="text-xs text-muted hover:text-ink">
              Close
            </button>
          </div>
          <div className="mb-2.5 border border-line p-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">Auto-paste snips</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
                  Press <b>Win+Shift+S</b> (Mac: <b>Ctrl+Cmd+Shift+4</b>) and drag. Come back to this tab and it&apos;s on the board.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoClip}
                aria-label="Watch the clipboard for snips"
                onClick={() => (autoClip ? setAutoClip(false) : void enableAutoClip())}
                className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", autoClip ? "bg-live" : "bg-line-strong")}
              >
                <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", autoClip ? "left-[18px]" : "left-0.5")} />
              </button>
            </div>
          </div>
          <div className="mb-2.5 border border-line p-2.5">
            <p className="text-xs font-semibold">Desktop helper (Windows)</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted">Snips land on the board without switching back to this tab. Nothing is installed.</p>
            {!pushCode ? (
              <button type="button" onClick={() => void linkHelper()} disabled={pushBusy} className="mt-2 w-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60">
                {pushBusy ? "Setting up…" : "Set it up"}
              </button>
            ) : (
              <div className="mt-2">
                <p className="mb-1 text-[11.5px] text-muted">
                  Run this once in <b>Windows PowerShell</b>:
                </p>
                <div className="flex items-center gap-1">
                  <code className="min-w-0 flex-1 truncate bg-night px-2 py-1.5 font-mono text-[10.5px] text-live" title={helperCmd}>
                    {helperCmd}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(helperCmd);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    }}
                    className="grid size-7 shrink-0 place-items-center bg-sunken text-ink hover:bg-line"
                    aria-label="Copy the command"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11.5px] font-semibold text-live">
                  ● Listening{pushCount > 0 ? `: ${pushCount} snip${pushCount > 1 ? "s" : ""} received` : ""}
                </p>
                <p className="mt-1 text-[10.5px] leading-snug text-warning">While the helper runs, every image you copy goes to the board. Press P in its window to pause it.</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSnipPanel(false);
              setSnipping(true);
            }}
            className="w-full border border-line-strong px-3 py-1.5 text-xs font-semibold hover:bg-sunken"
          >
            Capture a screen instead
          </button>
          <p className="mt-1.5 text-center text-[10.5px] leading-snug text-muted">A web page can&apos;t read another window by itself, so that one asks which screen to share.</p>
        </div>
      )}

      {snipping && <BoardSnip onInsert={(blob) => addImage(blob)} onClose={() => setSnipping(false)} />}

      {/* ── Share panel (host) ── */}
      {isHost && shareOpen && (
        <div className="absolute right-3 top-14 z-30 w-72 border border-line bg-surface p-3 text-ink shadow-2xl">
          <input
            value={shareTitle}
            onChange={(e) => setShareTitle(e.target.value)}
            placeholder={title}
            maxLength={120}
            aria-label="Board title"
            className="mb-2 w-full border border-line-strong bg-canvas px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
          />
          <div className="mb-2 max-h-48 space-y-1 overflow-y-auto border border-line bg-canvas p-1.5">
            {participants.length === 0 && <p className="px-1 py-2 text-xs text-muted">No one else is in the room yet.</p>}
            {participants.map((p) => {
              const may = editors.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-2 px-1 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className={cn("text-[10.5px] font-semibold", may ? "text-live" : "text-muted")}>{may ? "Can draw" : "View only"}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={may}
                    aria-label={`${p.name} can draw`}
                    onClick={() => setRights(p.id, !may)}
                    className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", may ? "bg-live" : "bg-line-strong")}
                  >
                    <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", may ? "left-[18px]" : "left-0.5")} />
                  </button>
                </div>
              );
            })}
          </div>
          {shareMsg && <p className="mb-2 text-xs font-semibold text-live">{shareMsg}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void shareBoard()} disabled={sharing} className="flex-1 bg-brand px-3 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60">
              {sharing ? "Saving…" : "Save a copy for the lesson"}
            </button>
            <button type="button" onClick={() => setShareOpen(false)} className="border border-line-strong px-3 py-2 text-sm font-semibold hover:bg-sunken">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      {canDraw && (
        <div className="z-10 flex flex-wrap items-center gap-1.5 border-b border-line bg-surface px-2 py-1.5 text-ink">
          <div className="flex border border-line">
            <ToolBtn t="select" label="Select: move and resize a picture" icon={MousePointer2} tool={tool} setTool={pickTool} />
            <ToolBtn t="pen" label="Pen" icon={PenLine} tool={tool} setTool={pickTool} />
            <ToolBtn t="eraser" label="Eraser" icon={Eraser} tool={tool} setTool={pickTool} />
            <ToolBtn t="line" label="Line" icon={Minus} tool={tool} setTool={pickTool} />
            <ToolBtn t="rect" label="Rectangle" icon={Square} tool={tool} setTool={pickTool} />
            <ToolBtn t="circle" label="Circle" icon={Circle} tool={tool} setTool={pickTool} />
            <ToolBtn t="text" label="Text" icon={Type} tool={tool} setTool={pickTool} />
          </div>
          {isHost && (
            <>
              <label className={cn("flex h-8 cursor-pointer items-center gap-1 border border-line px-2 text-[13px] hover:bg-sunken", pasting && "opacity-60")} title="Paste a screenshot (Ctrl+V) or choose an image">
                <ImagePlus className="size-4" aria-hidden /> {pasting ? "Adding…" : "Image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={pasting}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void addImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button type="button" onClick={() => setSnipPanel((v) => !v)} className={cn("flex h-8 items-center gap-1 border border-line px-2 text-[13px]", snipPanel ? "bg-brand text-on-brand" : "hover:bg-sunken")} title="Snip any part of your screen onto the board">
                <Scissors className="size-4" aria-hidden /> Snip
                {(autoClip || pushCode) && <span className="size-1.5 rounded-full bg-live" />}
              </button>
            </>
          )}
          {pasteMsg && <span className="max-w-[16rem] truncate text-xs text-live" role="status">{pasteMsg}</span>}
          <span className="mx-0.5 h-6 w-px bg-line" />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={cn("size-6 rounded-full border-2 transition-transform", color === c ? "scale-110 border-brand" : "border-line")} style={{ background: c }} />
            ))}
          </div>
          <span className="mx-0.5 h-6 w-px bg-line" />
          <div className="flex items-center gap-1">
            {SIZES.map((s) => (
              <button key={s} type="button" onClick={() => setSize(s)} aria-label={`Size ${s}`} className={cn("grid size-7 place-items-center", size === s ? "bg-brand" : "hover:bg-sunken")}>
                <span className={cn("rounded-full", size === s ? "bg-on-brand" : "bg-ink")} style={{ width: Math.min(s * 1.5, 18), height: Math.min(s * 1.5, 18) }} />
              </button>
            ))}
          </div>
          {isHost && (
            <>
              <span className="mx-0.5 h-6 w-px bg-line" />
              <button type="button" onClick={undo} disabled={!histDepth.undo} className="grid size-8 place-items-center hover:bg-sunken disabled:opacity-40" title="Undo (Ctrl+Z)" aria-label="Undo">
                <Undo2 className="size-4" />
              </button>
              <button type="button" onClick={redo} disabled={!histDepth.redo} className="grid size-8 place-items-center hover:bg-sunken disabled:opacity-40" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
                <Redo2 className="size-4" />
              </button>
              <button type="button" onClick={clearBoard} className="flex h-8 items-center gap-1 px-2 text-[13px] text-danger hover:bg-danger/10" title="Clear the board for everyone">
                <Trash2 className="size-4" aria-hidden /> Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setShareOpen((v) => !v);
                  setShareMsg("");
                }}
                className="flex h-8 items-center gap-1 bg-brand px-2 text-[13px] font-semibold text-on-brand hover:bg-brand-hover"
                title="Let the student draw, and save a copy to the lesson page"
              >
                <Share2 className="size-4" aria-hidden /> Share
              </button>
            </>
          )}
          {!isHost && <span className="px-1 text-xs font-medium text-live">You can draw on this board</span>}
        </div>
      )}

      {/* ── Canvas ── */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          data-board-canvas=""
          aria-label="Whiteboard"
          className={cn("absolute inset-0", !canDraw || tool === "select" ? "cursor-default" : tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
          style={{ background: "#ffffff", touchAction: "none" }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        />

        {/* Handles live in the page, not on the canvas: the canvas is what gets saved and shared. */}
        {canDraw && tool === "select" && selBox && selectedId && (
          <>
            <div className="pointer-events-none absolute z-10 border-2 border-brand" style={{ left: selBox.left, top: selBox.top, width: selBox.width, height: selBox.height }} />
            <div
              className="absolute z-10"
              style={{ left: selBox.left, top: selBox.top, width: selBox.width, height: selBox.height, cursor: "move", touchAction: "none" }}
              onMouseDown={(e) => {
                e.preventDefault();
                beginDrag(e, "move");
              }}
              onTouchStart={(e) => beginDrag(e, "move")}
            />
            {HANDLES.map((hd) => (
              <div
                key={hd.k}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  beginDrag(e, hd.k);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  beginDrag(e, hd.k);
                }}
                className="absolute z-20 rounded-full border-2 border-white bg-brand shadow"
                style={{ width: 13, height: 13, cursor: hd.cursor, touchAction: "none", left: selBox.left + hd.fx * selBox.width - 6.5, top: selBox.top + hd.fy * selBox.height - 6.5 }}
              />
            ))}
            <div
              className="absolute z-20 flex items-center gap-1 bg-night px-1.5 py-1 text-white shadow-xl"
              style={{
                left: Math.min(Math.max(4, selBox.left), Math.max(4, selBox.cw - (isHost ? 236 : 124))),
                top: selBox.top > 40 ? selBox.top - 36 : Math.min(selBox.top + selBox.height + 8, selBox.ch - 40),
              }}
            >
              {isHost && (
                <>
                  <button type="button" onClick={() => reorderSelected(true)} className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-white/15">
                    <ArrowUpToLine className="size-3.5" aria-hidden /> Front
                  </button>
                  <button type="button" onClick={() => reorderSelected(false)} className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-white/15">
                    <ArrowDownToLine className="size-3.5" aria-hidden /> Back
                  </button>
                  <span className="h-4 w-px bg-white/20" />
                </>
              )}
              <button type="button" onClick={deleteSelected} className="flex items-center gap-1 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20">
                <Trash2 className="size-3.5" aria-hidden /> Remove
              </button>
              <button type="button" onClick={() => selectImage(null)} className="grid size-6 place-items-center hover:bg-white/15" aria-label="Deselect">
                <X className="size-3.5" />
              </button>
            </div>
          </>
        )}

        {canDraw && tool === "select" && !selBox && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 bg-night/85 px-3 py-1 text-xs text-white">Click a picture to move or resize it</div>
        )}

        {canDraw && textPos && (
          <div className="absolute z-20 flex flex-col gap-1" style={{ left: Math.max(4, textPos.x), top: Math.max(4, textPos.y - 40) }}>
            <div className="flex gap-1.5 shadow-xl">
              <input
                autoFocus
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  setTextError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && addText()}
                placeholder="Type text…"
                maxLength={300}
                aria-label="Text for the board"
                className="border border-brand bg-white px-2 py-1 text-sm text-black outline-none"
                style={{ color }}
              />
              <button type="button" onClick={addText} className="bg-brand px-3 py-1 text-sm font-semibold text-on-brand">
                Add
              </button>
              <button type="button" onClick={() => setTextPos(null)} className="grid w-8 place-items-center bg-white text-black" aria-label="Cancel">
                <X className="size-4" />
              </button>
            </div>
            {textError && <p className="bg-white px-2 py-1 text-xs font-medium text-danger" role="alert">{textError}</p>}
          </div>
        )}

        {!canDraw && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1 border border-warning/40 bg-warning-50 px-3 py-1 text-xs font-medium text-ink">
            <Eye className="size-3.5" aria-hidden /> View only
          </div>
        )}
      </div>
    </div>
  );
}
