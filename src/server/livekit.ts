import "server-only";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import type { ParticipantMeta } from "@/lib/classroom";
import { env, liveVideoReady } from "./env";

/*
 * LiveKit (the media server for live lessons). This server only signs join tokens and makes admin calls
 * (closing a room); audio, video, screen share and whiteboard traffic go between the browsers and LiveKit.
 * The API secret never leaves this server.
 */

const LOCAL_FALLBACK = "http://127.0.0.1:7880";

/**
 * Where admin calls go. The server SDK builds an absolute /twirp/… path and drops any path on the URL, so
 * only a bare origin works: wss://host/livekit would silently post to https://host/twirp/….
 */
export function livekitHost(): string {
  if (env.livekitHostUrl) return env.livekitHostUrl;
  try {
    const u = new URL(env.livekitWsUrl.replace(/^ws/, "http"));
    if (u.pathname && u.pathname !== "/") {
      console.warn(`[livekit] LIVEKIT_WS_URL has a path (${u.pathname}); admin calls use ${LOCAL_FALLBACK}. Set LIVEKIT_HOST_URL to change it.`);
      return LOCAL_FALLBACK;
    }
    return u.origin;
  } catch {
    return LOCAL_FALLBACK;
  }
}

function roomService(): RoomServiceClient | null {
  return liveVideoReady() ? new RoomServiceClient(livekitHost(), env.livekitKey, env.livekitSecret) : null;
}

/** A join token for one room. Host-ness and role go into server-signed metadata the browsers can trust. */
export async function mintToken(opts: { room: string; identity: string; meta: ParticipantMeta; ttlSeconds: number }): Promise<string> {
  const at = new AccessToken(env.livekitKey, env.livekitSecret, {
    identity: opts.identity,
    name: opts.meta.name,
    ttl: Math.max(60, Math.min(opts.ttlSeconds, 6 * 3600)),
    metadata: JSON.stringify(opts.meta),
  });
  at.addGrant({ roomJoin: true, room: opts.room, canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: opts.meta.isHost });
  return at.toJwt();
}

/** Disconnects everyone. Never throws: ending a class must not fail because the media server hiccuped. */
export async function closeRoom(room: string): Promise<boolean> {
  const svc = roomService();
  if (!svc) return false;
  try {
    await svc.deleteRoom(room);
    return true;
  } catch (e) {
    // A room nobody joined doesn't exist on the server: that counts as closed.
    const msg = String((e as Error)?.message ?? "");
    if (/not.?found/i.test(msg)) return true;
    console.error("[livekit] couldn't close", room, "-", msg);
    return false;
  }
}

/** Who is in a room right now (identities). Empty when the room doesn't exist or the server can't be reached. */
export async function roomParticipants(room: string): Promise<string[]> {
  const svc = roomService();
  if (!svc) return [];
  try {
    return (await svc.listParticipants(room)).map((p) => p.identity);
  } catch {
    return [];
  }
}
