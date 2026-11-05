import type { NextConfig } from "next";

/*
 * Security headers on every page and API answer:
 *   - nothing can show TutorLink inside a frame on another site (stops click-jacking);
 *   - browsers use only HTTPS once they've seen the site over HTTPS (ignored on http://localhost);
 *   - no MIME sniffing, a privacy-friendly referrer, and forms can only post to this site;
 *   - camera, microphone and screen sharing only for this site (the live classroom), location too
 *     ("Find my address"); payment, USB and similar browser features are off.
 * Scripts aren't restricted further here: Next.js, Supabase and LiveKit would need nonces for that.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self), payment=(), usb=(), serial=(), bluetooth=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // The file check (src/server/scan.ts) runs OCR in a worker thread and reads PDFs; these load from node_modules as they are.
  // nodemailer sends the site's own email over SMTP.
  serverExternalPackages: ["tesseract.js", "unpdf", "nodemailer"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
