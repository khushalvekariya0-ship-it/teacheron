"use client";

/*
 * PDF worksheets for the class whiteboard: the PDF is opened in this browser with pdf.js (Mozilla, open source,
 * Apache-2.0; the worker is served from this site, public/pdf) and each page is drawn into a picture. Nothing is
 * sent from here: the whiteboard hands each picture to the server like any other board picture, where it's read
 * for contact details before anyone sees it.
 */

// pdf.js's own files, served from this site (public/pdf/<version>, see README.txt): the worker, the standard
// fonts (a PDF that names Helvetica or Times without including it would draw blank pages otherwise), character
// maps (Asian scripts), colour profiles and the decoders for scanned pages.
const BASE = "/pdf/6.5.438";
const WORKER = `${BASE}/pdf.worker.min.mjs`;
/** Pages are drawn this wide / tall at most (sharp on a full-screen board, small enough to read quickly). */
const MAX_SIDE = 1600;
/** Pages read from one PDF at most (each is read for contact details on the server). */
export const PDF_MAX_PAGES = 30;

export interface PdfPage {
  /** 1-based page number in the PDF. */
  number: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Opens a PDF and draws its pages one at a time: `onPage` gets each one in order (await it to go on to the
 * next). Returns how many pages the PDF has. Password-protected or broken PDFs throw a readable error.
 */
export async function readPdfPages(file: Blob, onPage: (page: PdfPage, total: number) => Promise<void>, maxPages = PDF_MAX_PAGES): Promise<number> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    standardFontDataUrl: `${BASE}/standard_fonts/`,
    cMapUrl: `${BASE}/cmaps/`,
    cMapPacked: true,
    iccUrl: `${BASE}/iccs/`,
    wasmUrl: `${BASE}/wasm/`,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    const name = (e as { name?: string })?.name;
    throw new Error(name === "PasswordException" ? "That PDF is locked with a password. Open it, save an unlocked copy, and try again." : "That file couldn't be opened as a PDF.");
  }
  try {
    const total = doc.numPages;
    const count = Math.min(total, maxPages);
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3, MAX_SIDE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      // Paper-white behind the page (a PDF page can be transparent).
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();
      await onPage({ number: n, dataUrl: canvas.toDataURL("image/jpeg", 0.88), width: canvas.width, height: canvas.height }, total);
      canvas.width = canvas.height = 0;
    }
    return total;
  } finally {
    void task.destroy();
  }
}
