import "server-only";

/*
 * Server configuration, read from environment variables (.env.local in development, the hosting
 * provider's settings in production). Nothing here is sent to the browser: only NEXT_PUBLIC_* values
 * ever reach client code, and the service-role key and database URL are never NEXT_PUBLIC.
 */
export const env = {
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  dbUrl: process.env.SUPABASE_DB_URL ?? "",
  dbPoolMax: Math.max(1, Number(process.env.DATABASE_POOL_MAX ?? 3) || 3),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
  cronSecret: process.env.CRON_SECRET ?? "",
  resendKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  /** An SMTP mailbox (e.g. Gmail with an app password). Used instead of Resend when set. */
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 465) || 465,
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  /** Only changed for local testing; production uses Resend's API. */
  resendUrl: (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/$/, ""),
  /** Set once a payment provider (Stripe) is connected; until then card/UPI charges are refused. */
  paymentsEnabled: false,
  /** Live classroom media server (LiveKit Cloud or self-hosted). The key and secret never leave the server. */
  livekitKey: process.env.LIVEKIT_API_KEY ?? "",
  livekitSecret: process.env.LIVEKIT_API_SECRET ?? "",
  /** What browsers connect to, e.g. wss://your-project.livekit.cloud */
  livekitWsUrl: (process.env.LIVEKIT_WS_URL ?? "").replace(/\/$/, ""),
  /** What this server calls for admin requests (closing a room). A bare origin; defaults to LIVEKIT_WS_URL as http(s). */
  livekitHostUrl: (process.env.LIVEKIT_HOST_URL ?? "").replace(/\/$/, ""),
  /** Optional: an AI recap of the lesson transcript (Google Gemini). Without it the transcript is kept, unsummarised. */
  geminiKey: process.env.GEMINI_API_KEY ?? "",
};

/** Whether live video for lessons is connected (all three LiveKit settings present). */
export const liveVideoReady = () => !!(env.livekitKey && env.livekitSecret && env.livekitWsUrl);

export interface BackendStatus {
  database: boolean;
  auth: boolean;
  storage: boolean;
  email: boolean;
  payments: boolean;
  missing: string[];
}

export function backendStatus(): BackendStatus {
  const missing = [
    !env.supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !env.supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    !env.serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    !env.dbUrl && "SUPABASE_DB_URL",
  ].filter(Boolean) as string[];
  return {
    database: !!env.dbUrl,
    auth: !!(env.supabaseUrl && env.supabaseAnonKey),
    storage: !!(env.supabaseUrl && env.serviceRoleKey),
    email: !!((env.smtpHost || env.resendKey) && env.emailFrom),
    payments: env.paymentsEnabled,
    missing,
  };
}

export class NotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} isn't connected yet. Add the Supabase settings to the environment (see docs/SUPABASE_SETUP.md).`);
    this.name = "NotConfiguredError";
  }
}
