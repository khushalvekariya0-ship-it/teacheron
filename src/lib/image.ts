/**
 * Shrinks a picked image in the browser and returns it as a JPEG data URL, small enough to keep
 * in the store (a 512px portrait is ~40 KB). Production uploads the original to object storage
 * instead; the same call site then returns the stored URL.
 */
export async function imageFileToDataUrl(file: File, maxSide = 512, quality = 0.84): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close();
  }
}
