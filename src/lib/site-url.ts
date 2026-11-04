/*
 * Which address links in security emails (password reset) may point to. Pure functions, so the rules can
 * be tested on their own.
 */

/** True for http://localhost:…, 127.x.x.x and [::1], the addresses of a site on its own computer. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host.endsWith(".localhost") || /^127\./.test(host) || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * The origin reset links are built from: the configured site address (NEXT_PUBLIC_SITE_URL), never the
 * Host header of the request (a sender could fake that and have reset links point at their own site).
 * It must be https://, except for a site running on its own computer (http://localhost). Returns null when
 * the setting is missing or not https, and then no reset email is sent.
 */
export function resetLinkOrigin(siteUrl: string): string | null {
  if (!siteUrl) return null;
  try {
    const url = new URL(siteUrl);
    if (url.protocol === "https:" || (url.protocol === "http:" && isLocalOrigin(url.origin))) return url.origin;
  } catch {}
  return null;
}
