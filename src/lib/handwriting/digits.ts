/*
 * Handwritten phone numbers on the whiteboard, read in the browser (nothing leaves the computer).
 *
 * The pen strokes are grouped into characters (strokes that overlap side by side), characters into rows
 * (each one close to the right of the one before, even on a slant), and each character is drawn into a
 * 28×28 picture the way the MNIST handwritten-digit set is made (fitted into 20×20, centred on its mass)
 * and read by a small neural network trained on that set (./digit-model.ts, int8 weights).
 *
 * A row with 10 or more digits is a phone number. "+", "=" and "×" split a row (a sum is several numbers);
 * a "-" or a gap the size of a digit doesn't (98765-43210, 98765 43210).
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
}

export const MIN_DIGITS = 10;
const CONFIDENT = 0.55;

interface Box { x0: number; y0: number; x1: number; y1: number }
interface Char extends Box { strokes: { x: number; y: number }[][]; kind: "ink" | "plus" | "equals" | "times" | "dash" }

const w = (b: Box) => b.x1 - b.x0;
const h = (b: Box) => b.y1 - b.y0;

function boxOf(pts: { x: number; y: number }[]): Box {
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

/** Strokes that sit over each other side by side make one character (a "4" or a crossed "7" is two strokes). */
function groupCharacters(strokes: { x: number; y: number }[][]): Char[] {
  const boxes = strokes.map(boxOf);
  const parent = strokes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const narrow = Math.max(1e-6, Math.min(w(a), w(b)));
      const tall = Math.max(h(a), h(b), 1e-6);
      const gapY = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
      // Two flat lines one over the other are one sign ("="), however far apart they're written.
      const flatPair = h(a) < 0.35 * w(a) && h(b) < 0.35 * w(b) && gapY <= 0.9 * Math.max(w(a), w(b));
      if (overlapX >= 0.45 * narrow && (gapY <= 0.35 * tall || flatPair)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  boxes.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.values()].map((ids) => {
    const box = ids.map((i) => boxes[i]).reduce(join);
    const list = ids.map((i) => strokes[i]);
    return { ...box, strokes: list, kind: symbolOf(list, box) };
  });
}

/** Rough shapes of the signs that split a row: "+", "=", "×" and a "-" (which doesn't). */
function symbolOf(list: { x: number; y: number }[][], box: Box): Char["kind"] {
  const lines = list.map((s) => {
    const b = boxOf(s);
    const a = s[0], z = s[s.length - 1];
    const len = Math.hypot(z.x - a.x, z.y - a.y);
    const path = s.slice(1).reduce((t, p, i) => t + Math.hypot(p.x - s[i].x, p.y - s[i].y), 0);
    return { b, straight: len > 0 && path / len < 1.25, angle: Math.atan2(z.y - a.y, z.x - a.x) };
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

/** Rows of characters: each one links to the nearest character just to its right, on a slant too. */
function rows(chars: Char[]): Char[][] {
  const sorted = [...chars].sort((a, b) => a.x0 - b.x0);
  const next = new Map<Char, Char>();
  const prev = new Map<Char, Char>();
  for (const c of sorted) {
    let best: Char | null = null, bestGap = Infinity;
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
    if (best && (!prev.has(best) || (best.x0 - c.x1) < (best.x0 - prev.get(best)!.x1))) {
      if (prev.has(best)) next.delete(prev.get(best)!);
      next.set(c, best);
      prev.set(best, c);
    }
  }
  const out: Char[][] = [];
  for (const c of sorted) {
    if (prev.has(c)) continue;
    const row = [c];
    for (let n = next.get(c); n && row.length < 200; n = next.get(n)) row.push(n);
    out.push(row);
  }
  return out;
}

/* ─── one character into a 28×28 MNIST-style picture ─────────────────────── */

const SS = 4; // supersampling

export function characterPixels(strokes: { x: number; y: number }[][]): Float32Array {
  const box = strokes.map(boxOf).reduce(join);
  const size = Math.max(w(box), h(box)) || 1;
  const scale = 20 / size;
  const offX = (20 - w(box) * scale) / 2, offY = (20 - h(box) * scale) / 2;
  const big = new Float32Array(20 * SS * 20 * SS);
  const N = 20 * SS;
  const r = 1.2 * SS; // pen about 2.4 px wide at 20 px, like MNIST's strokes
  const stamp = (cx: number, cy: number) => {
    const xa = Math.max(0, Math.floor(cx - r)), xb = Math.min(N - 1, Math.ceil(cx + r));
    const ya = Math.max(0, Math.floor(cy - r)), yb = Math.min(N - 1, Math.ceil(cy + r));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) big[y * N + x] = 1;
  };
  for (const s of strokes) {
    const pts = s.map((p) => ({ x: ((p.x - box.x0) * scale + offX) * SS, y: ((p.y - box.y0) * scale + offY) * SS }));
    if (pts.length === 1) stamp(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r / 2)));
      for (let k = 0; k <= steps; k++) stamp(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
    }
  }
  const small = new Float32Array(400);
  let mass = 0, mx = 0, my = 0;
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      let t = 0;
      for (let v = 0; v < SS; v++) for (let u = 0; u < SS; u++) t += big[(y * SS + v) * N + x * SS + u];
      const val = t / (SS * SS);
      small[y * 20 + x] = val;
      mass += val;
      mx += val * x;
      my += val * y;
    }
  }
  const out = new Float32Array(784);
  const dx = Math.round(14 - (mass ? mx / mass : 9.5) - 0.5), dy = Math.round(14 - (mass ? my / mass : 9.5) - 0.5);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      const tx = x + dx, ty = y + dy;
      if (tx >= 0 && tx < 28 && ty >= 0 && ty < 28) out[ty * 28 + tx] = small[y * 20 + x];
    }
  }
  return out;
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

/* ─── putting it together ─────────────────────────────────────────────────── */

/**
 * Phone numbers written by hand (rows of at least `min` digits; 10 by default). `width` / `height` are the
 * board's size on screen (strokes are stored as fractions of it), so shapes keep their real proportions.
 */
export async function handwrittenNumbers(strokes: InkStroke[], width: number, height: number, min = MIN_DIGITS): Promise<HandwrittenNumber[]> {
  const ink = strokes
    .map((s) => s.pts.map((p) => ({ x: p.x * width, y: p.y * height })))
    .filter((pts) => pts.length > 0);
  if (ink.length < min) return [];
  const chars = groupCharacters(ink);
  // Specks (much smaller than the writing around them) are dots, not characters.
  const sizes = chars.map((c) => Math.max(w(c), h(c))).sort((a, b) => a - b);
  const typical = sizes[Math.floor(sizes.length / 2)] ?? 0;
  const found: HandwrittenNumber[] = [];
  for (const row of rows(chars.filter((c) => Math.max(w(c), h(c)) >= 0.2 * typical))) {
    if (row.length < min) continue;
    // A sum is several numbers: split the row at +, = and ×.
    const parts: Char[][] = [[]];
    for (const c of row) {
      if (c.kind === "plus" || c.kind === "equals" || c.kind === "times") parts.push([]);
      else parts[parts.length - 1].push(c);
    }
    for (const part of parts) {
      if (part.length < min) continue;
      let digits = "", count = 0;
      for (const c of part) {
        if (c.kind === "dash") continue;
        const p = await readDigit(characterPixels(c.strokes));
        const best = p.indexOf(Math.max(...p));
        if (p[best] >= CONFIDENT && w(c) < 1.6 * h(c)) {
          digits += String(best);
          count++;
        } else digits += "?";
      }
      if (count >= min) found.push({ digits, count });
    }
  }
  return found;
}
