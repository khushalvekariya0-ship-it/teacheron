import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";
import { scanContact, type ContactKind } from "@/lib/domain/contact";
import { PRIVATE_BUCKET, signedDownload } from "./media";
import { supabaseAdmin } from "./supabase";

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
 *   • That text goes through the same contact-detail check as chat messages (file mode).
 *
 * Nothing read out of a file is stored or logged. Handwriting, very stylised text and text drawn as
 * shapes can't be read reliably; files are still checked for everything else.
 */

export type FileCheck =
  | { ok: true }
  | { ok: false; reason: "contact"; kinds: ContactKind[] }
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

/* ─── OCR ───────────────────────────────────────────────────────────────────── */

type OcrWorker = { recognize(image: Buffer): Promise<{ data: { text: string } }>; terminate(): Promise<unknown> };
let worker: Promise<OcrWorker> | null = null;

function ocrWorker(): Promise<OcrWorker> {
  worker ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    // English model shipped with the app (node_modules), so nothing is downloaded at run time.
    const local = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int");
    return (await createWorker("eng", 1, { ...(existsSync(local) ? { langPath: local } : {}), cacheMethod: "none", gzip: true })) as unknown as OcrWorker;
  })().catch((e) => {
    worker = null;
    throw e;
  });
  return worker;
}

/** Printed text in an image. Tries dark-on-light, then light-on-dark, then sideways when little was found. */
async function imageText(input: Buffer | { raw: Buffer; width: number; height: number; channels: 1 | 2 | 3 | 4 }): Promise<string> {
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

async function docxText(buf: Buffer): Promise<string> {
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
  for (const n of images) parts.push(await imageText(zip.get(n)!()));
  return parts.join("\n");
}

/* ─── PDFs ──────────────────────────────────────────────────────────────────── */

async function pdfText(buf: Buffer): Promise<string> {
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
        parts.push(await imageText({ raw: Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), width: img.width, height: img.height, channels: img.channels as 1 | 2 | 3 | 4 }));
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
export async function fileText(bytes: Buffer, extension: string): Promise<string> {
  if (bytes.length > MAX_BYTES) throw new Unchecked("That file is too large to check.");
  const expected = EXPECTED[extension.toLowerCase()];
  const actual = sniff(bytes);
  if (actual === "doc") throw new Unchecked("Older Word (.doc) files can't be checked. Save it as .docx or PDF and attach it again.");
  if (actual === "heic") throw new Unchecked("HEIC photos can't be checked. Send it as a JPG or PNG instead.");
  const real: Kind | null = actual === "zip" ? "docx" : actual === "unknown" ? (expected === "txt" ? "txt" : null) : actual;
  if (!expected || !real || real !== expected) throw new Unchecked("That file's contents don't match its type, so it can't be checked. Attach a PDF, image, Word (.docx) or text file.");
  switch (real) {
    case "pdf":
      return pdfText(bytes);
    case "docx":
      return docxText(bytes);
    case "txt":
      return plainText(bytes);
    default:
      return imageText(bytes);
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
    const text = await withTimeout(fileText(bytes, storagePath.split(".").pop() ?? ""), TIME_LIMIT_MS);
    const found = scanContact(text, "file");
    verdict = found.found ? { ok: false, reason: "contact", kinds: found.kinds } : { ok: true };
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

/** Checks an image that's already on the server (a profile photo) for contact details. */
export async function checkImageBytes(bytes: Buffer): Promise<FileCheck> {
  try {
    const found = scanContact(await withTimeout(imageText(bytes), TIME_LIMIT_MS), "file");
    return found.found ? { ok: false, reason: "contact", kinds: found.kinds } : { ok: true };
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
