import { timingSafeEqual } from "node:crypto";
import { env, liveVideoReady } from "@/server/env";
import { json } from "@/server/http";
import { livekitReachable } from "@/server/livekit";
import { checkImageBytes } from "@/server/scan";

/*
 * GET /api/health/deep — for the owner only (Authorization: Bearer <CRON_SECRET>): proves on THIS server
 * that the class safety checks work. A picture of printed text with a phone number and a WhatsApp QR code
 * go through the same check as whiteboard, screen and camera pictures (text reading + QR), and the
 * video-class service is asked to answer. Nothing is stored; no member data is read.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "Call me on 98765 43210" in print, and a QR code for https://wa.me/919876543210.
const TEXT_PICTURE = "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";
const QR_PICTURE = "iVBORw0KGgoAAAANSUhEUgAAAPAAAADwAQMAAAAEm3vRAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAAsSAAALEgHS3X78AAABWElEQVRYw+2Zy3HGIAyE18PBR0pwKZSWlEYpLoEjBwZFEsaPSZwCpF8Xz/Bx2tFKQgb9G/hgb/gbGtsex1ENbZzAOP6Sw30jKohUgdDC1MQ1zkASrJqtRC10YPGCd86PWFfmzrC4pOJVFnt42IBxieyCF5e4w2fRLLFwsrzWVGN4xsyWGv7soeawpENOXBskHfSGxHLPFpcYKSftkuUomkQdSwfZxiwKX8AmohROFikPQxfbWNOBi4NMB0UptYWFgXEsuiQaNgD3yCrdoN+roks8miS7ZNQGMQl1kY1s4+ETjYM3PExkF+eU1SM8HPBHa8PTJRaxDEVp6lIxYyHf+JqZ5qyoLiHr+JyRx1dm5OAC31cirApElpdNkSt8vaCLNEmcLyYXeC7I1ialof9aJNnFY2Oq02K/ng528WEDeRussipqz3Rwiq/9uW6KOFuO+mAbf/4TOcI/XA+zGfYluvwAAAAASUVORK5CYII=";

function authorized(request: Request): boolean {
  if (!env.cronSecret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function timed(fn: () => Promise<{ ok: boolean; [k: string]: unknown }>) {
  const start = Date.now();
  try {
    return { ...(await fn()), ms: Date.now() - start };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? String(e), ms: Date.now() - start };
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const textReading = await timed(async () => {
    const r = await checkImageBytes(Buffer.from(TEXT_PICTURE, "base64"));
    return { ok: !r.ok && r.reason === "contact" && r.kinds.includes("phone"), result: r };
  });
  const qrReading = await timed(async () => {
    const r = await checkImageBytes(Buffer.from(QR_PICTURE, "base64"));
    return { ok: !r.ok && r.reason === "contact" && r.via === "qr", result: r };
  });
  const videoClasses = liveVideoReady() ? await timed(async () => ({ ok: await livekitReachable() })) : { ok: false, error: "LiveKit isn't set up on this server." };
  return json({ ok: textReading.ok && qrReading.ok && videoClasses.ok, textReading, qrReading, videoClasses });
}
