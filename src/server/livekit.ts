import "server-only";
import { AccessToken, DataPacket_Kind, RoomServiceClient, TrackSource } from "livekit-server-sdk";
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

function roomService(timeoutSeconds = 10): RoomServiceClient | null {
  return liveVideoReady() ? new RoomServiceClient(livekitHost(), env.livekitKey, env.livekitSecret, { requestTimeout: timeoutSeconds }) : null;
}

/** "Not found" / "does not exist": the room or the person is already gone. */
const gone = (msg: string) => /not.?found|does not exist/i.test(msg);

/**
 * A call about a room people are in. LiveKit Cloud can take several seconds to answer those (the room
 * lives on the media server nearest the people in it), so it gets a longer limit and a second try.
 */
async function roomCall(what: string, room: string, call: (svc: RoomServiceClient) => Promise<unknown>): Promise<boolean> {
  const svc = roomService(20);
  if (!svc) return false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await call(svc);
      return true;
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      const msg = String(err?.message ?? "");
      if (gone(msg)) return false;
      if (attempt === 2) console.error(`[livekit] couldn't ${what}`, room, "-", msg, err?.cause?.code ?? err?.cause?.message ?? "");
      else await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return false;
}

/** A join token for one room. Host-ness and role go into server-signed metadata the browsers can trust. */
export async function mintToken(opts: { room: string; identity: string; meta: ParticipantMeta; ttlSeconds: number; noMicrophone?: boolean }): Promise<string> {
  const at = new AccessToken(env.livekitKey, env.livekitSecret, {
    identity: opts.identity,
    name: opts.meta.name,
    ttl: Math.max(60, Math.min(opts.ttlSeconds, 6 * 3600)),
    metadata: JSON.stringify(opts.meta),
  });
  at.addGrant({ roomJoin: true, room: opts.room, canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: opts.meta.isHost, ...(opts.noMicrophone ? { canPublishSources: WITHOUT_MICROPHONE } : {}) });
  return at.toJwt();
}

/** Everything but the microphone (an audio pause in class). */
const WITHOUT_MICROPHONE = [TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];

/**
 * Pauses or restores one person's microphone for the others: LiveKit stops (or allows) publishing it, so
 * a changed page can't get around it. Camera, screen share, chat and hearing the others stay. Never throws.
 */
export function setAudioAllowed(room: string, identity: string, allowed: boolean): Promise<boolean> {
  return roomCall(allowed ? "restore audio in" : "pause audio in", room, (svc) =>
    svc.updateParticipant(room, identity, undefined, { canSubscribe: true, canPublish: true, canPublishData: true, canPublishSources: allowed ? [] : WITHOUT_MICROPHONE }),
  );
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
    if (gone(msg)) return true;
    console.error("[livekit] couldn't close", room, "-", msg);
    return false;
  }
}

/** Takes one person out of a room (they see "You were removed"). Never throws. */
export function removeFromRoom(room: string, identity: string): Promise<boolean> {
  return roomCall("remove a participant from", room, (svc) => svc.removeParticipant(room, identity));
}

/** A message from the server to everyone in a room (reliable data packet, JSON). Never throws. */
export function broadcastToRoom(room: string, message: object): Promise<boolean> {
  return roomCall("send to", room, (svc) => svc.sendData(room, new TextEncoder().encode(JSON.stringify(message)), DataPacket_Kind.RELIABLE, {}));
}

/** Whether the video-class service answers with these keys (health self-test). Never throws. */
export async function livekitReachable(): Promise<{ ok: boolean; host: string; error?: string }> {
  const svc = roomService(15);
  if (!svc) return { ok: false, host: "", error: "not set up" };
  try {
    await svc.listRooms();
    return { ok: true, host: new URL(livekitHost()).hostname };
  } catch (e) {
    console.warn("[livekit] health check", (e as Error)?.message ?? e);
    return { ok: false, host: new URL(livekitHost()).hostname, error: String((e as Error)?.message ?? e).slice(0, 300) };
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
