/*
 * Handwritten phone numbers, read in the browser (nothing leaves the computer): on the whiteboard from the
 * pen strokes, and in a shared screen from the picture itself.
 *
 * Ink is grouped into characters (pieces that sit over each other side by side; a character much wider than
 * it is tall is digits touching each other and is split where it's thinnest), characters into rows (each one
 * close to the right of the one before, even on a slant or a wave), and each character is turned into a
 * 28×28 picture the way the MNIST handwritten-digit set is made (strokes about as thick, fitted into 20×20,
 * centred on its mass) and read by a small neural network trained on that set (./digit-model.ts, int8).
 *
 * A row of 10+ digits is a phone number. "+", "=" and "×" split a row (a sum is several numbers); a "-" or a
 * gap the size of a digit doesn't (98765-43210, 98765 43210). A number can go on underneath (wrapped onto the
 * next line): two rows join when the second starts right under the first. Joined rows count as a phone number
 * when they read like one (an Indian mobile number), otherwise as "maybe" (see `judge`).
 */

export interface InkStroke {
  /** Points as fractions of the board's width and height. */
  pts: { x: number; y: number }[];
}

export interface HandwrittenNumber {
  /** The digits read, in order ("?" for a character that wasn't clearly a digit). */
  digits: string;
  /** How many characters were read as digits. */
  count: number;
  /** Characters in the run (digits and unclear ones; dashes not counted). */
  length: number;
  /** Read from more than one row, a column, or turned (not one plain row). */
  joined: boolean;
  /** Digits in each group, where the writer left a gap (98765 43210 is [5, 5]; counting 1 2 3 … is [1, 1, 1 …]). */
  groups: number[];
  /** A line of four or more small separate numbers (a list, counting). */
  listy: boolean;
}

/** An RGBA picture (a canvas ImageData, or raw pixels). */
export interface Frame {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export const MIN_DIGITS = 10;
const CONFIDENT = 0.55;

type Pt = { x: number; y: number };
interface Box { x0: number; y0: number; x1: number; y1: number }
type Kind = "ink" | "plus" | "equals" | "times" | "dash";
/** 1 = ink. */
interface Mask { w: number; h: number; data: Uint8Array }
/** A character: where it is, what sign it may be, and its ink (mask pixel (i, j) is x = x0 + (i - ox) / s). */
interface Glyph extends Box { kind: Kind; mask: Mask; s: number; ox: number; oy: number; read?: number[] }

const w = (b: Box) => b.x1 - b.x0;
const h = (b: Box) => b.y1 - b.y0;

function boxOf(pts: Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

const join = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

/** Pieces that sit over each other side by side are one character (a "4" or a crossed "7"; the lines of "="). */
function groupBoxes(boxes: Box[]): number[][] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairs: { i: number; j: number; gap: number; flat: boolean }[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const narrow = Math.max(1e-6, Math.min(w(a), w(b)));
      const tall = Math.max(h(a), h(b), 1e-6);
      const gapY = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
      // Two flat lines one over the other are one sign ("="), however far apart they're written.
      const flatPair = h(a) < 0.35 * w(a) && h(b) < 0.35 * w(b) && gapY <= 0.9 * Math.max(w(a), w(b));
      // A box, circle or underline drawn around writing is much bigger than a character: it stays apart.
      const big = Math.max(w(a), h(a), w(b), h(b)) / Math.max(1e-6, Math.min(Math.max(w(a), h(a)), Math.max(w(b), h(b))));
      if (big <= 3 && overlapX >= 0.45 * narrow && (gapY <= 0.35 * tall || flatPair)) pairs.push({ i, j, gap: Math.max(0, gapY), flat: flatPair });
    }
  }
  // Closest pieces first; a character never grows much taller than its tallest piece, so the top bar of a
  // "5" joins its own body, not the digit above it, and digits written in a column stay apart.
  const box = boxes.slice();
  const tallest = boxes.map((b) => h(b));
  for (const p of pairs.sort((a, b) => a.gap - b.gap)) {
    const a = find(p.i), b = find(p.j);
    if (a === b) continue;
    const u = join(box[a], box[b]);
    const top = Math.max(tallest[a], tallest[b]);
    if (!p.flat && h(u) > 1.35 * top) continue;
    parent[a] = b;
    box[b] = u;
    tallest[b] = top;
  }
  const groups = new Map<number, number[]>();
  boxes.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.values()];
}

/** Rough shapes of the signs that split a row: "+", "=", "×" and a "-" (which doesn't). */
function symbolOf(list: Pt[][], box: Box): Kind {
  const lines = list.map((s) => {
    const a = s[0], z = s[s.length - 1];
    const len = Math.hypot(z.x - a.x, z.y - a.y);
    const path = s.slice(1).reduce((t, p, i) => t + Math.hypot(p.x - s[i].x, p.y - s[i].y), 0);
    return { straight: len > 0 && path / len < 1.25, angle: Math.atan2(z.y - a.y, z.x - a.x) };
  });
  if (!lines.every((l) => l.straight)) return "ink";
  const flat = (t: number) => Math.abs(Math.sin(t)) < 0.35;
  const upright = (t: number) => Math.abs(Math.cos(t)) < 0.35;
  const diag = (t: number) => Math.abs(Math.abs(Math.sin(t)) - Math.abs(Math.cos(t))) < 0.45;
  if (lines.length === 1 && flat(lines[0].angle) && w(box) > 1.8 * h(box)) return "dash";
  if (lines.length === 2) {
    const [p, q] = lines;
    if (flat(p.angle) && flat(q.angle) && w(box) > 1.1 * h(box)) return "equals";
    if ((flat(p.angle) && upright(q.angle)) || (upright(p.angle) && flat(q.angle))) return "plus";
    if (diag(p.angle) && diag(q.angle) && Math.sign(Math.sin(p.angle) * Math.cos(p.angle)) !== Math.sign(Math.sin(q.angle) * Math.cos(q.angle))) return "times";
  }
  return "ink";
}

/* ─── ink as pixels ───────────────────────────────────────────────────────── */

/** Pen strokes drawn as a mask, about 64 px tall, with a pen as thick (for its size) as MNIST's digits. */
function strokeGlyph(strokes: Pt[][], box: Box, kind: Kind): Glyph {
  const s = Math.min(64 / Math.max(h(box), 1e-6), 256 / Math.max(w(box), 1e-6));
  const r = Math.max(1.5, 0.06 * Math.max(h(box), 0.6 * w(box)) * s);
  const pad = Math.ceil(r) + 1;
  const W = Math.ceil(w(box) * s) + 2 * pad, H = Math.ceil(h(box) * s) + 2 * pad;
  const data = new Uint8Array(W * H);
  const stamp = (cx: number, cy: number) => {
    const xa = Math.max(0, Math.floor(cx - r)), xb = Math.min(W - 1, Math.ceil(cx + r));
    const ya = Math.max(0, Math.floor(cy - r)), yb = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) data[y * W + x] = 1;
  };
  for (const st of strokes) {
    const pts = st.map((p) => ({ x: (p.x - box.x0) * s + pad, y: (p.y - box.y0) * s + pad }));
    if (pts.length === 1) stamp(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r / 2)));
      for (let k = 0; k <= steps; k++) stamp(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
    }
  }
  return { ...box, kind, mask: { w: W, h: H, data }, s, ox: pad, oy: pad };
}

/** One character's ink as a 28×28 MNIST-style picture (0 = paper, 1 = ink). */
function mnistPixels(m: Mask): Float32Array {
  const out = new Float32Array(784);
  let cx0 = m.w, cy0 = m.h, cx1 = -1, cy1 = -1, area = 0, edge = 0;
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.data[y * m.w + x]) continue;
      area++;
      if (x < cx0) cx0 = x;
      if (x > cx1) cx1 = x;
      if (y < cy0) cy0 = y;
      if (y > cy1) cy1 = y;
      if (x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1 || !m.data[y * m.w + x - 1] || !m.data[y * m.w + x + 1] || !m.data[(y - 1) * m.w + x] || !m.data[(y + 1) * m.w + x]) edge++;
    }
  }
  if (!area) return out;
  let bw = cx1 - cx0 + 1, bh = cy1 - cy0 + 1;
  // Thin strokes (a pen on a big board, seen on a screen) are thickened to MNIST's pen size for the reading.
  const target = 0.12 * Math.max(bw, bh);
  const width = (2 * area) / Math.max(1, edge);
  const grow = width < 0.6 * target ? Math.min(12, Math.round((target - width) / 2)) : 0;
  let src = m, sx0 = cx0, sy0 = cy0;
  if (grow > 0) {
    const W = bw + 2 * grow, H = bh + 2 * grow;
    const rowMax = new Uint8Array(W * H);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (!m.data[(y + cy0) * m.w + x + cx0]) continue;
        for (let d = -grow; d <= grow; d++) rowMax[(y + grow) * W + x + grow + d] = 1;
      }
    }
    const grown = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!rowMax[y * W + x]) continue;
        for (let d = -grow; d <= grow; d++) if (y + d >= 0 && y + d < H) grown[(y + d) * W + x] = 1;
      }
    }
    src = { w: W, h: H, data: grown };
    sx0 = 0;
    sy0 = 0;
    bw = W;
    bh = H;
  }
  // Fitted into 20×20 (keeping its shape), each pixel the share of ink under it.
  const f = 20 / Math.max(bw, bh);
  const ow = Math.max(1, Math.round(bw * f)), oh = Math.max(1, Math.round(bh * f));
  const offX = Math.floor((20 - ow) / 2), offY = Math.floor((20 - oh) / 2);
  const small = new Float32Array(400);
  const N = 4;
  let mass = 0, mx = 0, my = 0;
  for (let v = 0; v < oh; v++) {
    for (let u = 0; u < ow; u++) {
      let t = 0;
      for (let a = 0; a < N; a++) {
        for (let b = 0; b < N; b++) {
          const x = sx0 + Math.min(bw - 1, Math.floor(((u + (b + 0.5) / N) / ow) * bw));
          const y = sy0 + Math.min(bh - 1, Math.floor(((v + (a + 0.5) / N) / oh) * bh));
          t += src.data[y * src.w + x];
        }
      }
      const val = t / (N * N);
      small[(v + offY) * 20 + u + offX] = val;
      mass += val;
      mx += val * (u + offX);
      my += val * (v + offY);
    }
  }
  const dx = Math.round(14 - (mass ? mx / mass : 9.5) - 0.5), dy = Math.round(14 - (mass ? my / mass : 9.5) - 0.5);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      const tx = x + dx, ty = y + dy;
      if (tx >= 0 && tx < 28 && ty >= 0 && ty < 28) out[ty * 28 + tx] = small[y * 20 + x];
    }
  }
  return out;
}

/** Pen strokes of one character as a 28×28 MNIST-style picture. */
export function characterPixels(strokes: Pt[][]): Float32Array {
  return mnistPixels(strokeGlyph(strokes, strokes.map(boxOf).reduce(join), "ink").mask);
}

/** A character much wider than tall is digits touching each other ("00" in one go): split where the ink is thinnest. */
function splitWide(g: Glyph, depth = 0): Glyph[] {
  if (g.kind !== "ink" || depth > 2 || w(g) <= 1.25 * h(g)) return [g];
  const m = g.mask;
  const cols = new Array<number>(m.w).fill(0);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) cols[x] += m.data[y * m.w + x];
  const top = Math.max(...cols);
  let cut = -1, least = Infinity;
  for (let x = Math.floor(m.w * 0.3); x <= Math.ceil(m.w * 0.7); x++) {
    const v = cols[x] + Math.abs(x - m.w / 2) / m.w; // the thinnest point, nearer the middle on ties
    if (v < least) {
      least = v;
      cut = x;
    }
  }
  if (cut <= 0 || cols[cut] > 0.4 * top) return [g];
  const part = (from: number, to: number): Glyph | null => {
    let a = to, b = from - 1, ya = m.h, yb = -1;
    for (let x = from; x < to; x++) {
      for (let y = 0; y < m.h; y++) {
        if (!m.data[y * m.w + x]) continue;
        if (x < a) a = x;
        if (x > b) b = x;
        if (y < ya) ya = y;
        if (y > yb) yb = y;
      }
    }
    if (b < a) return null;
    const W = b - a + 1, H = yb - ya + 1;
    const data = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data[y * W + x] = m.data[(y + ya) * m.w + x + a];
    const box = { x0: g.x0 + (a - g.ox) / g.s, x1: g.x0 + (b + 1 - g.ox) / g.s, y0: g.y0 + (ya - g.oy) / g.s, y1: g.y0 + (yb + 1 - g.oy) / g.s };
    return { ...box, kind: "ink", mask: { w: W, h: H, data }, s: g.s, ox: 0, oy: 0 };
  };
  const pieces = [part(0, cut), part(cut, m.w)].filter((x): x is Glyph => !!x && h(x) > 0.4 * h(g));
  if (pieces.length < 2) return [g];
  return pieces.flatMap((p) => splitWide(p, depth + 1));
}

/* ─── rows and numbers ────────────────────────────────────────────────────── */

/** Rows of characters: each one links to the nearest character just to its right, on a slant too. */
function rows<T extends Box>(chars: T[]): T[][] {
  const sorted = [...chars].sort((a, b) => a.x0 - b.x0);
  const next = new Map<T, T>();
  const prev = new Map<T, T>();
  for (const c of sorted) {
    let best: T | null = null, bestGap = Infinity;
    for (const d of sorted) {
      if (d === c || d.x0 < c.x0 + 0.3 * w(c)) continue;
      const size = Math.max(h(c), h(d), 0.5 * Math.max(w(c), w(d)));
      const gap = d.x0 - c.x1;
      const dy = Math.abs((d.y0 + d.y1) / 2 - (c.y0 + c.y1) / 2);
      if (gap > 1.1 * size || gap < -0.4 * size || dy > 0.85 * size) continue;
      if (gap < bestGap) {
        bestGap = gap;
        best = d;
      }
    }
    if (best && (!prev.has(best) || best.x0 - c.x1 < best.x0 - prev.get(best)!.x1)) {
      if (prev.has(best)) next.delete(prev.get(best)!);
      next.set(c, best);
      prev.set(best, c);
    }
  }
  const out: T[][] = [];
  for (const c of sorted) {
    if (prev.has(c)) continue;
    const row = [c];
    for (let n = next.get(c); n && row.length < 200; n = next.get(n)) row.push(n);
    out.push(row);
  }
  return out;
}

async function readGlyph(g: Glyph): Promise<number[]> {
  g.read ??= await readDigit(mnistPixels(g.mask));
  return g.read;
}

/** A mask turned a quarter (counter-clockwise) `turns` times. */
function turnMask(m: Mask, turns: number): Mask {
  let cur = m;
  for (let t = 0; t < turns % 4; t++) {
    const W = cur.h, H = cur.w;
    const data = new Uint8Array(W * H);
    for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) data[(cur.w - 1 - x) * W + y] = cur.data[y * cur.w + x];
    cur = { w: W, h: H, data };
  }
  return cur;
}

/** A box seen turned a quarter counter-clockwise `turns` times ((x, y) → (y, −x)). */
function turnBox(b: Box, turns: number): Box {
  let cur = b;
  for (let t = 0; t < turns % 4; t++) cur = { x0: cur.y0, x1: cur.y1, y0: -cur.x1, y1: -cur.x0 };
  return cur;
}

/** A character as it looks turned a quarter counter-clockwise `turns` times (its margins are even, so they stay). */
function turnGlyph(g: Glyph, turns: number): Glyph {
  if (!(turns % 4)) return g;
  const box = turnBox(g, turns);
  return { ...box, kind: g.kind, mask: turnMask(g.mask, turns), s: g.s, ox: g.ox, oy: g.oy };
}

type Reading = { digits: string; count: number; length: number; groups: number[]; listy: boolean };

/**
 * Characters in reading order (lines top to bottom, each left to right), with the gaps the writer left. A line
 * of four or more small separate numbers ("1 2 3 4 5", "12 45 78 90") is a list.
 */
async function readInOrder(list: Glyph[]): Promise<Reading> {
  const size = list.map((g) => h(g)).sort((a, b) => a - b)[Math.floor(list.length / 2)] || 1;
  const lines: Glyph[][] = [];
  for (const g of [...list].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2)) {
    const mid = (g.y0 + g.y1) / 2;
    const line = lines.find((l) => Math.abs((l[0].y0 + l[0].y1) / 2 - mid) < 0.6 * size);
    if (line) line.push(g);
    else lines.push([g]);
  }
  let digits = "", count = 0, length = 0, listy = false;
  const groups: number[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x0 - b.x0);
    const lineGroups: number[] = [];
    let group = 0;
    for (let i = 0; i < line.length; i++) {
      const g = line[i];
      if (i > 0 && g.x0 - line[i - 1].x1 > 0.6 * size && group) {
        lineGroups.push(group);
        group = 0;
      }
      if (g.kind === "dash") continue;
      length++;
      const p = await readGlyph(g);
      const best = p.indexOf(Math.max(...p));
      if (g.kind === "ink" && p[best] >= CONFIDENT && w(g) < 1.6 * h(g)) {
        digits += String(best);
        count++;
        group++;
      } else digits += "?";
    }
    if (group) lineGroups.push(group);
    if (lineGroups.length >= 4 && Math.max(...lineGroups) <= 3) listy = true;
    groups.push(...lineGroups);
  }
  return { digits, count, length, groups, listy };
}

/**
 * The numbers in a set of characters: each row (split at signs), rows that go on underneath, and digits
 * close together in any direction (a column, a zigzag, written turned or upside down).
 */
async function numbersIn(glyphs: Glyph[], min: number): Promise<HandwrittenNumber[]> {
  // Specks (much smaller than the writing around them) are dots; much bigger shapes are frames, circles or
  // underlines drawn around the writing. Neither is a character.
  const keep = (list: Glyph[]) => {
    const sizes = list.map((c) => Math.max(w(c), h(c))).sort((a, b) => a - b);
    const typical = sizes[Math.floor(sizes.length / 2)] ?? 0;
    return { typical, chars: list.filter((c) => Math.max(w(c), h(c)) >= 0.2 * typical && (c.kind !== "ink" || Math.max(w(c), h(c)) <= 3 * typical)) };
  };
  const { chars } = keep(glyphs.flatMap((g) => splitWide(g)));
  const found: HandwrittenNumber[] = [];
  const add = (n: HandwrittenNumber) => {
    if (n.count >= min && !found.some((f) => f.digits === n.digits)) found.push(n);
  };
  const plain: { box: Box; size: number; text: Reading }[] = [];
  for (const row of rows(chars)) {
    // A sum is several numbers: split the row at +, = and ×.
    const parts: Glyph[][] = [[]];
    for (const c of row) {
      if (c.kind === "plus" || c.kind === "equals" || c.kind === "times") parts.push([]);
      else parts[parts.length - 1].push(c);
    }
    for (const part of parts) if (part.length) add({ ...(await readInOrder(part)), joined: false });
    if (parts.length === 1 && row.length >= 2) {
      const box = row.reduce<Box>((a, c) => join(a, c), row[0]);
      const size = row.map((c) => h(c)).sort((a, b) => a - b)[Math.floor(row.length / 2)];
      plain.push({ box, size, text: await readInOrder(row) });
    }
  }
  // A number that goes on underneath: the next row starts right under this one (no signs in either).
  for (const a of plain) {
    for (const b of plain) {
      if (a === b) continue;
      const size = Math.max(a.size, b.size);
      const startsUnder = b.box.x0 >= a.box.x0 - size && b.box.x0 <= a.box.x1 + 0.5 * size;
      if (b.box.y0 > (a.box.y0 + a.box.y1) / 2 && b.box.y0 - a.box.y1 <= 1.2 * size && startsUnder) {
        add({ digits: a.text.digits + b.text.digits, count: a.text.count + b.text.count, length: a.text.length + b.text.length, groups: [...a.text.groups, ...b.text.groups], listy: a.text.listy || b.text.listy, joined: true });
      }
    }
  }
  // Digits close together in any direction, with no sum signs near them (a column of digits, a zigzag,
  // digits around a drawing), read upright, turned either way and upside down. Each character is turned
  // before touching digits are split, since a sideways digit is wider than it is tall.
  const whole = keep(glyphs);
  const signs = whole.chars.filter((c) => c.kind === "plus" || c.kind === "equals" || c.kind === "times");
  const inks = whole.chars.filter((c) => c.kind === "ink");
  const sz = (c: Box) => Math.max(h(c), w(c));
  const gapBetween = (a: Box, b: Box) => Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
  const parent = inks.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < inks.length; i++) for (let j = i + 1; j < inks.length; j++) if (gapBetween(inks[i], inks[j]) <= 0.9 * Math.max(sz(inks[i]), sz(inks[j]))) parent[find(i)] = find(j);
  const clusters = new Map<number, Glyph[]>();
  inks.forEach((g, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), g]));
  for (const group of clusters.values()) {
    if (group.length < Math.min(min, 3) || group.length > 40) continue;
    const box = group.reduce<Box>((a, c) => join(a, c), group[0]);
    if (signs.some((s) => gapBetween(s, box) <= whole.typical)) continue;
    add({ ...(await readInOrder(group.flatMap((g) => splitWide(g)))), joined: true });
  }
  return found;
}

/**
 * What a number read by hand is:
 *  - "phone": reads like a mobile number (10 digits starting 6–9, maybe after 91 or 0), not a line of small
 *    separate numbers (a list, counting);
 *  - "maybe": 10 or so digits that might be maths (counting, a list, a long answer): kept off the board until
 *    the writer says it's maths;
 *  - null: anything shorter.
 */
export function judge(n: HandwrittenNumber): "phone" | "maybe" | null {
  const clean = n.digits.replace(/\?/g, "");
  const list = n.listy;
  // A mobile number, or one inside a slightly longer reading (a stray mark or a touching digit read as two).
  const mobile = /^(?:\+?91|0)?[6-9]\d{9}$/.test(clean) || (n.count <= (n.joined ? 12 : 13) && /[6-9]\d{9}/.test(clean));
  if (n.count >= MIN_DIGITS && mobile && !list) return "phone";
  // One unclear character in what otherwise reads like a mobile number (a sloppy or touching digit).
  const oneUnclear = (d: string) => (d.match(/\?/g)?.length ?? 0) === 1 && /^(?:91|0)?[6-9][0-9?]{9}$/.test(d);
  if (!list && n.count >= MIN_DIGITS - 1 && (oneUnclear(n.digits) || oneUnclear(n.digits.replace(/^\?+|\?+$/g, "")))) return "phone";
  if (n.count >= MIN_DIGITS || (n.count >= MIN_DIGITS - 2 && n.length >= MIN_DIGITS)) return "maybe";
  return null;
}

/* ─── from pen strokes (the whiteboard) ───────────────────────────────────── */

/**
 * Numbers written by hand with at least `min` digits. `width` / `height` are the board's size on screen
 * (strokes are stored as fractions of it), so shapes keep their real proportions.
 */
export async function handwrittenNumbers(strokes: InkStroke[], width: number, height: number, min = 3): Promise<HandwrittenNumber[]> {
  const ink = strokes.map((s) => s.pts.map((p) => ({ x: p.x * width, y: p.y * height }))).filter((pts) => pts.length > 0);
  if (ink.length < Math.min(min, MIN_DIGITS)) return [];
  // Read the right way up, then turned each way and upside down (the whole writing is turned first, so its
  // characters are grouped and split as they're meant to be read).
  return everyWayRound(ink.length, async (turns) => {
    const turned = turns ? ink.map((pts) => pts.map((p) => turnPoint(p, turns))) : ink;
    const boxes = turned.map(boxOf);
    return numbersIn(
      groupBoxes(boxes).map((ids) => {
        const list = ids.map((i) => turned[i]);
        const box = ids.map((i) => boxes[i]).reduce(join);
        return strokeGlyph(list, box, symbolOf(list, box));
      }),
      min,
    );
  });
}

const turnPoint = (p: Pt, turns: number): Pt => {
  let x = p.x, y = p.y;
  for (let t = 0; t < turns % 4; t++) [x, y] = [y, -x];
  return { x, y };
};

/**
 * Numbers read the right way up and turned each way (a quarter turn either way, upside down). A turned
 * reading only counts when every character in it is clearly a digit and it's long enough to be a phone
 * number, so ordinary writing read sideways doesn't make up numbers. Very busy boards are read upright only.
 */
async function everyWayRound(pieces: number, read: (turns: number) => Promise<HandwrittenNumber[]>): Promise<HandwrittenNumber[]> {
  const out: HandwrittenNumber[] = [];
  for (const turns of pieces > 400 ? [0] : [0, 1, 3, 2]) {
    for (const n of await read(turns)) {
      if (turns && !(n.count >= MIN_DIGITS && n.count === n.length)) continue;
      if (!out.some((o) => o.digits === n.digits)) out.push(turns ? { ...n, joined: true } : n);
    }
  }
  return out;
}

/* ─── from a picture (a shared screen) ────────────────────────────────────── */

/**
 * Numbers written by hand (or printed large) in a picture: dark ink on a light background and light on
 * dark, each read from the shapes in the picture. Characters smaller than `minCharPx` (ordinary screen
 * text) are left to the server's text reader.
 */
export async function numbersInPicture(frame: Frame, minCharPx = 22, min = 3): Promise<HandwrittenNumber[]> {
  const W = frame.width, H = frame.height;
  if (W < 32 || H < 32) return [];
  const g = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) g[i] = (frame.data[p] * 299 + frame.data[p + 1] * 587 + frame.data[p + 2] * 114) / 1000;
  // Local brightness (a 41-pixel window), so ink is found on a white board inside a dark page too.
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += g[y * W + x];
      I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row;
    }
  }
  const R = 20;
  const mean = (x: number, y: number) => {
    const xa = Math.max(0, x - R), xb = Math.min(W, x + R + 1), ya = Math.max(0, y - R), yb = Math.min(H, y + R + 1);
    return (I[yb * (W + 1) + xb] - I[ya * (W + 1) + xb] - I[yb * (W + 1) + xa] + I[ya * (W + 1) + xa]) / ((xb - xa) * (yb - ya));
  };
  const dark = new Uint8Array(W * H), light = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = g[y * W + x], m = mean(x, y);
      if (v < m - 30 && v < 150) dark[y * W + x] = 1;
      else if (v > m + 30 && v > 110) light[y * W + x] = 1;
    }
  }
  const found: HandwrittenNumber[] = [];
  for (const ink of [dark, light]) {
    const pieces = components(ink, W, H, minCharPx);
    if (pieces.length < Math.min(min, MIN_DIGITS) || pieces.length > 600) continue;
    // Pieces of one character (the lines of "=", a "4" written in two strokes) are merged, in each direction.
    found.push(
      ...(await everyWayRound(pieces.length, async (turns) => {
        const turned = pieces.map((p) => turnGlyph(p, turns));
        return numbersIn(groupBoxes(turned).map((ids) => mergePieces(ids.map((i) => turned[i]))), min);
      })),
    );
  }
  return found;
}

/** The shapes in a black-and-white picture big enough to be written characters. */
function components(ink: Uint8Array, W: number, H: number, minCharPx: number): Glyph[] {
  const label = new Int32Array(W * H);
  const out: Glyph[] = [];
  const stack: number[] = [];
  let next = 0;
  for (let start = 0; start < W * H; start++) {
    if (!ink[start] || label[start]) continue;
    next++;
    label[start] = next;
    stack.push(start);
    let x0 = W, y0 = H, x1 = -1, y1 = -1, area = 0;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i - x) / W;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (ink[j] && !label[j]) {
            label[j] = next;
            stack.push(j);
          }
        }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    // Writing: tall enough, not a frame or a panel edge, not a filled block.
    if (bh < minCharPx || bh > 0.6 * H || bw > 6 * bh || area < 20 || area > 0.6 * bw * bh) continue;
    const data = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) data[y * bw + x] = label[(y + y0) * W + x + x0] === next ? 1 : 0;
    out.push({ x0, y0, x1: x1 + 1, y1: y1 + 1, kind: "ink", mask: { w: bw, h: bh, data }, s: 1, ox: 0, oy: 0 });
  }
  return out;
}

function mergePieces(list: Glyph[]): Glyph {
  if (list.length === 1) return list[0];
  const box = list.reduce<Box>((a, c) => join(a, c), list[0]);
  const W = Math.ceil(w(box)), H = Math.ceil(h(box));
  const data = new Uint8Array(W * H);
  for (const p of list) {
    const ox = Math.round(p.x0 - box.x0), oy = Math.round(p.y0 - box.y0);
    for (let y = 0; y < p.mask.h; y++) for (let x = 0; x < p.mask.w; x++) if (p.mask.data[y * p.mask.w + x]) data[(y + oy) * W + x + ox] = 1;
  }
  return { ...box, kind: "ink", mask: { w: W, h: H, data }, s: 1, ox: 0, oy: 0 };
}

/* ─── the network ─────────────────────────────────────────────────────────── */

type Tensor = { shape: number[]; scale: number; data: string };
type Weights = Record<"c1w" | "c1b" | "c2w" | "c2b" | "f1w" | "f1b" | "f2w" | "f2b", Float32Array>;
let weights: Promise<Weights> | null = null;

function decode(t: Tensor): Float32Array {
  const bin = atob(t.data);
  const out = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    const b = bin.charCodeAt(i);
    out[i] = (b > 127 ? b - 256 : b) * t.scale;
  }
  return out;
}

function loadWeights(): Promise<Weights> {
  weights ??= import("./digit-model").then(({ DIGIT_MODEL: m }) => ({
    c1w: decode(m["c1.weight"]), c1b: decode(m["c1.bias"]), c2w: decode(m["c2.weight"]), c2b: decode(m["c2.bias"]),
    f1w: decode(m["f1.weight"]), f1b: decode(m["f1.bias"]), f2w: decode(m["f2.weight"]), f2b: decode(m["f2.bias"]),
  }));
  return weights;
}

/** 3×3 convolution with padding 1, then ReLU and 2×2 max pooling. */
function convBlock(input: Float32Array, cin: number, size: number, wt: Float32Array, bias: Float32Array, cout: number): Float32Array {
  const conv = new Float32Array(cout * size * size);
  for (let o = 0; o < cout; o++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = bias[o];
        for (let c = 0; c < cin; c++) {
          for (let ky = 0; ky < 3; ky++) {
            const iy = y + ky - 1;
            if (iy < 0 || iy >= size) continue;
            for (let kx = 0; kx < 3; kx++) {
              const ix = x + kx - 1;
              if (ix < 0 || ix >= size) continue;
              s += input[(c * size + iy) * size + ix] * wt[((o * cin + c) * 3 + ky) * 3 + kx];
            }
          }
        }
        conv[(o * size + y) * size + x] = s > 0 ? s : 0;
      }
    }
  }
  const half = size / 2;
  const pooled = new Float32Array(cout * half * half);
  for (let o = 0; o < cout; o++) {
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const i = (o * size + 2 * y) * size + 2 * x;
        pooled[(o * half + y) * half + x] = Math.max(conv[i], conv[i + 1], conv[i + size], conv[i + size + 1]);
      }
    }
  }
  return pooled;
}

function dense(input: Float32Array, wt: Float32Array, bias: Float32Array, outN: number, relu: boolean): Float32Array {
  const out = new Float32Array(outN);
  const inN = input.length;
  for (let o = 0; o < outN; o++) {
    let s = bias[o];
    for (let i = 0; i < inN; i++) s += input[i] * wt[o * inN + i];
    out[o] = relu && s < 0 ? 0 : s;
  }
  return out;
}

/** Chances for 0–9 of one 28×28 picture (0 = paper, 1 = ink). */
export async function readDigit(pixels: Float32Array): Promise<number[]> {
  const m = await loadWeights();
  const a = convBlock(pixels, 1, 28, m.c1w, m.c1b, 16);
  const b = convBlock(a, 16, 14, m.c2w, m.c2b, 32);
  const c = dense(b, m.f1w, m.f1b, 64, true);
  const z = dense(c, m.f2w, m.f2b, 10, false);
  const top = Math.max(...z);
  const e = Array.from(z, (v) => Math.exp(v - top));
  const sum = e.reduce((s, v) => s + v, 0);
  return e.map((v) => v / sum);
}
