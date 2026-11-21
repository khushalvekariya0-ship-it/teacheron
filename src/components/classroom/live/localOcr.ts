"use client";

import type { Worker } from "tesseract.js";

/*
 * Printed text read in this browser (Tesseract, open source): a phone screen or a printout held up to the
 * camera is read here, so it's caught in a second or two and the camera picture never has to leave the
 * computer for it. The program and the English model are downloaded once (jsDelivr CDN, a few MB, then cached
 * by the browser); nothing about the person or their camera is sent anywhere for this. If it can't load, the
 * caller falls back to the server's reader.
 */

let worker: Promise<Worker | null> | null = null;

/** Starts loading the reader (call early, so it's ready by the time it's needed). */
export function warmLocalOcr(): Promise<Worker | null> {
  worker ??= (async () => {
    try {
      const { createWorker } = await import("tesseract.js");
      // 1 = the LSTM engine only (the smaller, faster model).
      return await createWorker("eng", 1, { logger: () => {} });
    } catch (e) {
      console.warn("[safety] the in-browser text reader couldn't start; the server reads instead", e);
      return null;
    }
  })();
  return worker;
}

/** The printed text in a picture, or null when the reader isn't available. */
export async function readTextHere(picture: HTMLCanvasElement): Promise<string | null> {
  const w = await warmLocalOcr();
  if (!w) return null;
  try {
    const { data } = await w.recognize(picture);
    return data.text ?? "";
  } catch (e) {
    console.warn("[safety] reading text here failed", e);
    return null;
  }
}
