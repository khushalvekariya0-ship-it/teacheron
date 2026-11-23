import "server-only";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";
import jsQR from "jsqr";
import { scanContact, type ContactKind } from "@/lib/domain/contact";
import { qrKinds } from "@/lib/domain/qr";
import { PRIVATE_BUCKET, signedDownload } from "./media";
import { supabaseAdmin } from "./supabase";
import { db } from "./db";
import { contactSafety } from "./safety-settings";

/*
 * Checks uploaded files for contact details before anyone else can open them.
 *
 *   • The real file type is read from the file's first bytes and must match its name; anything else
 *     (renamed files, old .doc files, animated images, password-protected or macro documents) is refused,
 *     because it can't be checked.
 *   • Text is read out of the file: typed text from PDFs (plus their links, form fields and properties)
 *     and Word documents (plus headers, footers, comments and links), and printed text inside images,
 *     screenshots, scanned pages and pictures pasted into documents, using OCR (Tesseract, which runs
 *     here on the server; nothing is sent to an outside service).
 *   • QR codes in pictures (and in pictures inside PDFs and Word files) are read too (jsQR): a phone,
 *     email, WhatsApp / Telegram / social link, contact card or UPI payment code counts.
 *   • That text goes through the same contact-detail check as chat messages (file mode).
 *   • Admin → Chat safety → Settings can switch off reading pictures, documents or QR codes.
 *   • A file staff approved after an appeal (same SHA-256) is let through.
 *
 * Nothing read out of a file is stored or logged. Handwriting, very stylised text and text drawn as
 * shapes can't be read reliably; files are still checked for everything else.
 */

export type FileCheck =
  | { ok: true }
  | { ok: false; reason: "contact"; kinds: ContactKind[]; via?: "ocr" | "qr" | "rules"; hash?: string }
  | { ok: false; reason: "unchecked"; error: string };

class Unchecked extends Error {}

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_UNPACKED = 60 * 1024 * 1024;
const MAX_IMAGES = 12;
const MAX_PDF_PAGES = 40;
const TIME_LIMIT_MS = 60_000;

type Kind = "png" | "jpg" | "webp" | "gif" | "pdf" | "docx" | "txt";

/** What the first bytes say the file is. */
function sniff(b: Buffer): Kind | "doc" | "zip" | "heic" | "unknown" {
  const head = (n: number) => b.subarray(0, n);
  if (head(8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (head(4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (/^GIF8[79]a/.test(head(6).toString("latin1"))) return "gif";
  if (b.subarray(0, 1024).includes("%PDF-")) return "pdf";
  if (head(4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "zip";
  if (head(8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "doc";
  if (b.subarray(4, 12).toString("latin1").startsWith("ftyp")) return "heic";
  return "unknown";
}

const EXPECTED: Record<string, Kind> = { png: "png", jpg: "jpg", jpeg: "jpg", webp: "webp", gif: "gif", pdf: "pdf", docx: "docx", txt: "txt" };

/** What reading one file found besides text: contact details in QR codes. */
type ReadCtx = { qr: boolean; qrKinds: Set<ContactKind> };

/* ─── QR codes ──────────────────────────────────────────────────────────────── */

// What a QR code holds is judged by the shared rules (src/lib/domain/qr.ts; the browser uses them too).
export { qrKinds };

/** The texts of QR codes in an image (one pass at a size jsQR handles well). */
async function qrTexts(open: () => ReturnType<typeof sharp>): Promise<string[]> {
  try {
    const { data, info } = await open().rotate().flatten({ background: "#ffffff" }).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
    return code?.data ? [code.data] : [];
  } catch {
    return [];
  }
}

/* ─── OCR ───────────────────────────────────────────────────────────────────── */

type OcrBox = { x0: number; y0: number; x1: number; y1: number };
type OcrPage = { text: string; blocks?: { paragraphs?: { lines?: { text?: string; bbox: OcrBox }[] }[] }[] | null };
type OcrWorker = { recognize(image: Buffer, options?: object, output?: { text?: boolean; blocks?: boolean }): Promise<{ data: OcrPage }>; terminate(): Promise<unknown> };
let worker: Promise<OcrWorker> | null = null;

function ocrWorker(): Promise<OcrWorker> {
  worker ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    // English, Gujarati and Hindi models shipped with the app (node_modules), so nothing is downloaded at run time:
    // digits and words written in Gujarati / Hindi script ("૯૮૭૬૫ ૪૩૨૧૦") are read too. The reader loads its
    // languages from one folder, so the three are copied together into a temporary one on first use.
    const dir = path.join(os.tmpdir(), "tutorlink-ocr");
    const langs: string[] = [];
    for (const lang of ["eng", "guj", "hin"]) {
      const from = path.join(process.cwd(), "node_modules", "@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`);
      if (!existsSync(from)) continue;
      try {
        mkdirSync(dir, { recursive: true });
        const to = path.join(dir, `${lang}.traineddata.gz`);
        if (!existsSync(to)) copyFileSync(from, to);
        langs.push(lang);
      } catch {
        // no writable temporary folder: read English the old way below
      }
    }
    if (!langs.includes("eng")) {
      const local = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int");
      return (await createWorker("eng", 1, { ...(existsSync(local) ? { langPath: local } : {}), cacheMethod: "none", gzip: true })) as unknown as OcrWorker;
    }
    return (await createWorker(langs.join("+"), 1, { langPath: dir, cacheMethod: "none", gzip: true })) as unknown as OcrWorker;
  })().catch((e) => {
    worker = null;
    throw e;
  });
  return worker;
}

/** Printed text in an image. Tries dark-on-light, then light-on-dark, then sideways when little was found. */
async function imageText(input: Buffer | { raw: Buffer; width: number; height: number; channels: 1 | 2 | 3 | 4 }, ctx?: ReadCtx): Promise<string> {
  const open = () =>
    Buffer.isBuffer(input)
      ? sharp(input, { limitInputPixels: 60_000_000, failOn: "error" })
      : sharp(input.raw, { raw: { width: input.width, height: input.height, channels: input.channels }, limitInputPixels: 60_000_000 });
  const meta = await open().metadata();
  if ((meta.pages ?? 1) > 1) throw new Unchecked("Animated images can't be checked. Send a still image instead.");
  const long = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (!long) throw new Unchecked("This image couldn't be opened. Try saving it as a PNG or JPG.");
  if (long < 24) return ""; // too small to hold readable text
  // Small screenshots are enlarged (OCR reads bigger text better); huge photos are shrunk.
  const target = long < 1400 ? Math.min(long * 2, 2400) : Math.min(long, 3000);
  // What a QR code holds is checked on its own (ctx.qrKinds): a code can hold just a link or a payment address.
  const codes = ctx?.qr ? await qrTexts(open) : [];
  for (const c of codes) for (const k of qrKinds(c)) ctx!.qrKinds.add(k);
  const base = () => open().rotate().flatten({ background: "#ffffff" }).grayscale().resize({ width: target, height: target, fit: "inside" });
  const ocr = await ocrWorker();
  const read = async (img: ReturnType<typeof sharp>) => (await ocr.recognize(await img.normalise().png().toBuffer())).data.text ?? "";
  const { channels } = await base().stats();
  const dark = (channels[0]?.mean ?? 255) < 110;
  let text = await read(dark ? base().negate({ alpha: false }) : base());
  if (!scanContact(text, "file").found) text += `\n${await read(dark ? base() : base().negate({ alpha: false }))}`;
  if (text.replace(/[^a-z0-9]/gi, "").length < 12) {
    for (const angle of [90, 270]) text += `\n${await read(open().rotate().rotate(angle).flatten({ background: "#ffffff" }).grayscale())}`;
  }
  return text;
}

/* ─── Word documents ────────────────────────────────────────────────────────── */

/** A small, careful .zip reader: entry count and unpacked size are capped (no zip bombs). */
function readZip(buf: Buffer): Map<string, () => Buffer> {
  const sig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocd = buf.lastIndexOf(sig);
  if (eocd < 0 || eocd < buf.length - 65_557) throw new Unchecked("This document looks damaged. Save it again and attach it.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (count > 3000 || p >= buf.length) throw new Unchecked("This document couldn't be checked. Save it as a PDF and attach that instead.");
  let budget = MAX_UNPACKED;
  const out = new Map<string, () => Buffer>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Unchecked("This document looks damaged. Save it again and attach it.");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (flags & 1) throw new Unchecked("Password-protected documents can't be checked. Remove the password or send a PDF.");
    out.set(name, () => {
      if (buf.readUInt32LE(local) !== 0x04034b50) throw new Unchecked("This document looks damaged. Save it again and attach it.");
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + compressed);
      let bytes: Buffer;
      if (method === 0) bytes = Buffer.from(data);
      else if (method === 8) {
        try {
          bytes = inflateRawSync(data, { maxOutputLength: budget });
        } catch {
          throw new Unchecked("This document is too large to check once unpacked. Save it as a PDF and attach that instead.");
        }
      } else throw new Unchecked("This document couldn't be checked. Save it as a PDF and attach that instead.");
      budget -= bytes.length;
      return bytes;
    });
  }
  return out;
}

const decodeXml = (s: string) =>
  s
    .replace(/<w:tab\/>|<w:tab [^>]*\/>/g, " ")
    .replace(/<\/w:p>|<w:br\/>|<w:br [^>]*\/>|<\/a:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

async function docxText(buf: Buffer, ctx?: ReadCtx): Promise<string> {
  const zip = readZip(buf);
  if (!zip.has("word/document.xml")) throw new Unchecked("That file isn't a Word document. Attach a PDF, image, Word (.docx) or text file.");
  const names = [...zip.keys()];
  if (names.some((n) => /^word\/(embeddings|activeX)\/|vbaProject\.bin$/i.test(n))) {
    throw new Unchecked("Documents with embedded files or macros can't be checked. Save it as a PDF and attach that instead.");
  }
  const parts: string[] = [];
  for (const n of names) {
    if (/^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$|^docProps\/(core|app|custom)\.xml$/.test(n)) parts.push(decodeXml(zip.get(n)!().toString("utf8")));
    // Links (mailto:, wa.me …) live in the relationship files.
    if (/^word\/_rels\/.+\.rels$/.test(n)) for (const m of zip.get(n)!().toString("utf8").matchAll(/Target="([^"]+)"/g)) parts.push(decodeXml(m[1]));
  }
  const media = names.filter((n) => n.startsWith("word/media/"));
  if (media.some((n) => /\.(emf|wmf)$/i.test(n))) throw new Unchecked("This document has drawings that can't be checked. Save it as a PDF and attach that instead.");
  const images = media.filter((n) => /\.(png|jpe?g|gif|bmp|tiff?|webp)$/i.test(n));
  if (images.length > MAX_IMAGES) throw new Unchecked(`This document has more than ${MAX_IMAGES} pictures, which is too many to check. Send fewer pages.`);
  for (const n of media.filter((x) => /\.svg$/i.test(x))) parts.push(decodeXml(zip.get(n)!().toString("utf8")));
  for (const n of images) parts.push(await imageText(zip.get(n)!(), ctx));
  return parts.join("\n");
}

/* ─── PDFs ──────────────────────────────────────────────────────────────────── */

async function pdfText(buf: Buffer, ctx?: ReadCtx): Promise<string> {
  const { getDocumentProxy, extractText, extractLinks, extractImages } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buf), { disableFontFace: true, useSystemFonts: false, stopAtErrors: false });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    throw new Unchecked(/password/i.test(msg) ? "Password-protected PDFs can't be checked. Remove the password and attach it again." : "This PDF couldn't be opened. Save it again and attach it.");
  }
  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Unchecked(`PDFs over ${MAX_PDF_PAGES} pages can't be checked. Send only the pages you need.`);
    const parts = [(await extractText(pdf, { mergePages: true })).text, ...(await extractLinks(pdf)).links];
    const meta = (await pdf.getMetadata().catch(() => null))?.info as Record<string, unknown> | undefined;
    for (const k of ["Title", "Author", "Subject", "Keywords", "Creator"]) if (typeof meta?.[k] === "string") parts.push(meta[k] as string);
    let images = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      for (const a of (await page.getAnnotations().catch(() => [])) as { contentsObj?: { str?: string }; fieldValue?: unknown; url?: string; unsafeUrl?: string }[]) {
        parts.push([a.contentsObj?.str, typeof a.fieldValue === "string" ? a.fieldValue : "", a.url, a.unsafeUrl].filter(Boolean).join(" "));
      }
      // Pictures on the page (screenshots, scanned pages) are read with OCR.
      let found: Awaited<ReturnType<typeof extractImages>>;
      try {
        found = await extractImages(pdf, n);
      } catch {
        throw new Unchecked("Some pictures in this PDF couldn't be read. Save it again or attach the pictures as images.");
      }
      for (const img of found) {
        if (img.width < 40 || img.height < 16) continue;
        if (++images > MAX_IMAGES) throw new Unchecked(`This PDF has more than ${MAX_IMAGES} pictures or scanned pages, which is too many to check. Send fewer pages.`);
        parts.push(await imageText({ raw: Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), width: img.width, height: img.height, channels: img.channels as 1 | 2 | 3 | 4 }, ctx));
      }
    }
    return parts.join("\n");
  } finally {
    await pdf.loadingTask.destroy().catch(() => {});
  }
}

/* ─── Text files ────────────────────────────────────────────────────────────── */

function plainText(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  if (buf.includes(0)) throw new Unchecked("That file isn't a text file. Attach a PDF, image, Word (.docx) or text file.");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    throw new Unchecked("That text file uses an unsupported encoding. Save it as UTF-8 and attach it again.");
  }
}

/* ─── Entry points ──────────────────────────────────────────────────────────── */

/** Reads the text in a file of the given type (by extension). */
export async function fileText(bytes: Buffer, extension: string, ctx?: ReadCtx): Promise<string> {
  if (bytes.length > MAX_BYTES) throw new Unchecked("That file is too large to check.");
  const expected = EXPECTED[extension.toLowerCase()];
  const actual = sniff(bytes);
  if (actual === "doc") throw new Unchecked("Older Word (.doc) files can't be checked. Save it as .docx or PDF and attach it again.");
  if (actual === "heic") throw new Unchecked("HEIC photos can't be checked. Send it as a JPG or PNG instead.");
  const real: Kind | null = actual === "zip" ? "docx" : actual === "unknown" ? (expected === "txt" ? "txt" : null) : actual;
  if (!expected || !real || real !== expected) throw new Unchecked("That file's contents don't match its type, so it can't be checked. Attach a PDF, image, Word (.docx) or text file.");
  switch (real) {
    case "pdf":
      return pdfText(bytes, ctx);
    case "docx":
      return docxText(bytes, ctx);
    case "txt":
      return plainText(bytes);
    default:
      return imageText(bytes, ctx);
  }
}

const verdicts = new Map<string, FileCheck>();

/**
 * Checks one uploaded private file (by its storage path) for contact details. Stored files never
 * change, so a verdict is remembered for the same path. Fails closed: a file that can't be read
 * isn't allowed.
 */
export async function checkStoredFile(storagePath: string): Promise<FileCheck> {
  const known = verdicts.get(storagePath);
  if (known) return known;
  let verdict: FileCheck;
  try {
    const res = await fetch(await signedDownload(storagePath, 60), { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, reason: "unchecked", error: "We couldn't find that file. Attach it again." };
    const bytes = Buffer.from(await res.arrayBuffer());
    const ext = (storagePath.split(".").pop() ?? "").toLowerCase();
    const s = await contactSafety();
    const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
    // Switched off in Admin → Chat safety → Settings: not read (the type is still checked when it's read).
    if (isImage ? !s.images : !s.documents) return { ok: true };
    const hash = createHash("sha256").update(bytes).digest("hex");
    // Staff accepted an appeal for this very file: it can be sent.
    const [approved] = await db()`select 1 from public.contact_flags where file_hash = ${hash} and status = 'dismissed' limit 1`.catch(() => []);
    if (approved) return { ok: true };
    const ctx: ReadCtx = { qr: s.qr, qrKinds: new Set() };
    const text = await withTimeout(fileText(bytes, ext, ctx), TIME_LIMIT_MS);
    const found = scanContact(text, "file");
    const kinds = [...new Set([...found.kinds, ...ctx.qrKinds])];
    verdict = kinds.length ? { ok: false, reason: "contact", kinds, via: ctx.qrKinds.size ? "qr" : isImage ? "ocr" : "rules", hash } : { ok: true };
  } catch (e) {
    if (e instanceof Unchecked) verdict = { ok: false, reason: "unchecked", error: e.message };
    else {
      console.error("[scan] couldn't check", storagePath, (e as Error)?.message ?? e);
      return { ok: false, reason: "unchecked", error: "We couldn't check this file right now. Please try again in a moment." };
    }
  }
  if (verdicts.size > 500) verdicts.delete(verdicts.keys().next().value!);
  verdicts.set(storagePath, verdict);
  return verdict;
}

/** Self-test (/api/health/deep): reads one picture like a class picture, letting any error through. */
export async function readPictureForSelfTest(bytes: Buffer): Promise<{ text: string; qrKinds: ContactKind[] }> {
  const ctx: ReadCtx = { qr: true, qrKinds: new Set() };
  const text = await withTimeout(imageText(bytes, ctx), 45_000);
  return { text: text.trim().slice(0, 200), qrKinds: [...ctx.qrKinds] };
}

/* ─── Shared-screen frames ──────────────────────────────────────────────────── */

/** Where something is on a frame: x, y, width, height as fractions of the frame. */
export type FrameBox = [number, number, number, number];

/** Printed lines (with where each is) and QR codes on one frame of a shared screen. */
async function readScreenFrame(bytes: Buffer, withQr: boolean): Promise<{ lines: { text: string; box: FrameBox }[]; codes: { text: string; box: FrameBox }[] }> {
  const open = () => sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error" });
  const meta = await open().metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  if (W < 24 || H < 24) return { lines: [], codes: [] };
  // Screen text is small: narrower frames are read at twice the size.
  const scale = W < 1400 ? 2 : 1;
  const base = () => open().flatten({ background: "#ffffff" }).grayscale().resize({ width: Math.round(W * scale) });
  const ocr = await ocrWorker();
  const read = async (img: ReturnType<typeof sharp>) => {
    const { data } = await ocr.recognize(await img.normalise().png().toBuffer(), {}, { text: true, blocks: true });
    const out: { text: string; box: FrameBox }[] = [];
    for (const b of data.blocks ?? []) {
      for (const p of b.paragraphs ?? []) {
        for (const l of p.lines ?? []) {
          const text = (l.text ?? "").trim();
          if (!text) continue;
          const { x0, y0, x1, y1 } = l.bbox;
          out.push({ text, box: [x0 / scale / W, y0 / scale / H, (x1 - x0) / scale / W, (y1 - y0) / scale / H] });
        }
      }
    }
    return out;
  };
  // Dark text on light is read as it is, light on dark turned round first; a screen with both (a dark menu
  // bar on a white page) is read both ways.
  const thumb = await base().resize({ width: 96 }).raw().toBuffer();
  let darkPx = 0;
  for (const v of thumb) if (v < 100) darkPx++;
  const darkShare = darkPx / Math.max(1, thumb.length);
  const dark = darkShare > 0.5;
  let lines = await read(dark ? base().negate({ alpha: false }) : base());
  const little = lines.map((l) => l.text).join("").replace(/[^a-z0-9]/gi, "").length < 20;
  if (little || (darkShare > 0.12 && darkShare < 0.88)) lines = lines.concat(await read(dark ? base() : base().negate({ alpha: false })));
  const codes: { text: string; box: FrameBox }[] = [];
  if (withQr) {
    try {
      const { data, info } = await open().flatten({ background: "#ffffff" }).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
      if (code?.data) {
        const c = code.location;
        const xs = [c.topLeftCorner.x, c.topRightCorner.x, c.bottomLeftCorner.x, c.bottomRightCorner.x], ys = [c.topLeftCorner.y, c.topRightCorner.y, c.bottomLeftCorner.y, c.bottomRightCorner.y];
        const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
        codes.push({ text: code.data, box: [x0 / info.width, y0 / info.height, (x1 - x0) / info.width, (y1 - y0) / info.height] });
      }
    } catch {
      // no readable code
    }
  }
  return { lines, codes };
}

/**
 * Contact details on one frame of a shared screen, and where they are so only those lines can be hidden
 * (`maskable`: once those lines are hidden, nothing else on the frame counts). Read here on the server
 * (Tesseract, jsQR); nothing read is stored or logged.
 */
export async function checkScreenFrame(bytes: Buffer, withQr: boolean): Promise<{ kinds: ContactKind[]; boxes: FrameBox[]; maskable: boolean }> {
  const { lines, codes } = await withTimeout(readScreenFrame(bytes, withQr), 12_000);
  const texts = lines.map((l) => l.text);
  // A margin round each line (a third of its height), so tall or wobbly handwriting is covered too.
  const pad = (b: FrameBox): FrameBox => {
    const py = Math.max(0.006, b[3] * 0.35), px = Math.max(0.005, b[3] * 0.3);
    const x = Math.max(0, b[0] - px), y = Math.max(0, b[1] - py);
    return [x, y, Math.min(1 - x, b[2] + 2 * px), Math.min(1 - y, b[3] + 2 * py)];
  };
  // A phone number being typed digit by digit: from seven digits it's hidden (not counted as a catch), so the
  // others never see most of a number before the last digit makes it one.
  const growing = texts.flatMap((t, i) => (/(?<![\d.,])[6-9](?:[\s.-]?\d){6,8}(?![\d.,]*\d)/.test(t) ? [i] : []));
  const kinds = new Set<ContactKind>(scanContact(texts.join("\n"), "file").kinds);
  const codeHits = codes.filter((c) => qrKinds(c.text).length);
  for (const c of codeHits) for (const k of qrKinds(c.text)) kinds.add(k);
  if (!kinds.size) return { kinds: [], boxes: growing.map((i) => pad(lines[i].box)), maskable: true };
  // The lines that hold it: one line, or a number split over two or three lines.
  const hit = new Set<number>(growing);
  const found = (t: string) => scanContact(t, "file").found;
  texts.forEach((t, i) => found(t) && hit.add(i));
  for (let i = 0; i + 1 < texts.length; i++) if (!hit.has(i) && !hit.has(i + 1) && found(`${texts[i]} ${texts[i + 1]}`)) [i, i + 1].forEach((k) => hit.add(k));
  for (let i = 0; i + 2 < texts.length; i++) if (![i, i + 1, i + 2].some((k) => hit.has(k)) && found(`${texts[i]} ${texts[i + 1]} ${texts[i + 2]}`)) [i, i + 1, i + 2].forEach((k) => hit.add(k));
  const rest = texts.filter((_, i) => !hit.has(i)).join("\n");
  const boxes = [...[...hit].map((i) => pad(lines[i].box)), ...codeHits.map((c) => pad(c.box))];
  return { kinds: [...kinds], boxes, maskable: boxes.length > 0 && !found(rest) };
}

/** Checks an image that's already on the server (a profile photo) for contact details. */
export async function checkImageBytes(bytes: Buffer): Promise<FileCheck> {
  try {
    const s = await contactSafety();
    if (!s.images) return { ok: true };
    const ctx: ReadCtx = { qr: s.qr, qrKinds: new Set() };
    const found = scanContact(await withTimeout(imageText(bytes, ctx), TIME_LIMIT_MS), "file");
    const kinds = [...new Set([...found.kinds, ...ctx.qrKinds])];
    return kinds.length ? { ok: false, reason: "contact", kinds, via: ctx.qrKinds.size ? "qr" : "ocr" } : { ok: true };
  } catch (e) {
    if (e instanceof Unchecked) return { ok: false, reason: "unchecked", error: e.message };
    console.error("[scan] couldn't check a photo", (e as Error)?.message ?? e);
    return { ok: false, reason: "unchecked", error: "We couldn't check this photo right now. Please try again in a moment." };
  }
}

/** Deletes a blocked upload so it isn't kept. Failures are logged, not thrown. */
export async function removePrivateFile(storagePath: string) {
  const { error } = await supabaseAdmin().storage.from(PRIVATE_BUCKET).remove([storagePath]);
  if (error) console.warn("[scan] couldn't remove", storagePath, error.message);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Unchecked("This file took too long to check. Try a smaller file.")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
