import { contactSchema, type ContactInput, type ContactResponse } from "@/components/content/contact-schema";

/*
 * POST /api/contact — public support form.
 *
 * Validation runs here with the same zod schema the form uses. There is no email provider in the
 * preview build: messages go through the EmailService interface below, whose only implementation
 * logs to the server console. In production, a Resend-backed implementation plugs in behind the
 * same interface (and the ticket is persisted by the support module) without changing this handler.
 */

interface SupportMessage extends Omit<ContactInput, "website"> {
  ticketId: string;
  receivedAt: string;
  ip: string;
}

interface EmailService {
  sendSupportMessage(message: SupportMessage): Promise<void>;
}

const consoleEmailService: EmailService = {
  async sendSupportMessage(m) {
    console.info(`[contact] ${m.ticketId} · ${m.role} · ${m.topic} · from ${m.name} <${m.email}>\n${m.message}`);
  },
};

const emailService: EmailService = consoleEmailService;

/* ─── Rate limiting: 5 requests per 10 minutes per IP (in memory, per server instance) ─── */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

// Kept on globalThis so the map survives hot reloads in development. Production should use a
// shared store (e.g. Redis) because in-memory state is per instance.
const store = globalThis as unknown as { __contactRateLimit?: Map<string, number[]> };
const hits = (store.__contactRateLimit ??= new Map<string, number[]>());

function rateLimit(ip: string, now: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)) };
  }
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map can't grow without bound.
  if (hits.size > 5000) for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  return { ok: true };
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function ticketId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `TL-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

function json(body: ContactResponse, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export async function POST(request: Request) {
  const now = Date.now();
  const ip = clientIp(request);

  const limit = rateLimit(ip, now);
  if (!limit.ok) {
    return json(
      { ok: false, error: "Too many messages. Please wait a few minutes before trying again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "The request body must be valid JSON." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ ok: false, error: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { website, ...fields } = parsed.data;
  const id = ticketId();

  // Honeypot filled in: answer like a success so bots learn nothing, but don't deliver it.
  if (website) return json({ ok: true, ticketId: id });

  try {
    await emailService.sendSupportMessage({ ...fields, ticketId: id, receivedAt: new Date(now).toISOString(), ip });
  } catch (err) {
    console.error("[contact] failed to deliver support message", err);
    return json({ ok: false, error: "We couldn't send your message right now. Please try again shortly." }, { status: 502 });
  }

  return json({ ok: true, ticketId: id });
}
