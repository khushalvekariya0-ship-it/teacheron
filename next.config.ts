import type { NextConfig } from "next";

/*
 * Security headers on every page and API answer:
 *   - nothing can show TutorLink inside a frame on another site (stops click-jacking);
 *   - browsers use only HTTPS once they've seen the site over HTTPS (ignored on http://localhost);
 *   - no MIME sniffing, a privacy-friendly referrer, and forms can only post to this site;
 *   - camera, microphone and screen sharing only for this site (the live classroom), location too
 *     ("Find my address"); the browser's payment feature only for this site and Razorpay's checkout;
 *     USB and similar browser features are off.
 * Scripts aren't restricted further here: Next.js, Supabase and LiveKit would need nonces for that.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com"), usb=(), serial=(), bluetooth=()' },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // The file check (src/server/scan.ts) runs OCR in a worker thread and reads PDFs; these load from node_modules as they are.
  // nodemailer sends the site's own email over SMTP.
  serverExternalPackages: ["tesseract.js", "unpdf", "nodemailer"],
  // The OCR worker starts from a file path and loads its engine and the English model by name at run time,
  // so hosting (Vercel) wouldn't pack them on its own: without these the reader never starts there.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/tesseract.js/src/**/*",
      // Every engine variant: which one loads depends on the server's CPU (Vercel's picks relaxed-SIMD).
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*",
      // Gujarati and Hindi writing is read too.
      "./node_modules/@tesseract.js-data/guj/4.0.0_best_int/**/*",
      "./node_modules/@tesseract.js-data/hin/4.0.0_best_int/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/node-fetch/**/*",
      "./node_modules/whatwg-url/**/*",
      "./node_modules/webidl-conversions/**/*",
      "./node_modules/tr46/**/*",
      "./node_modules/regenerator-runtime/**/*",
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      // The on-device speech reader and its models (public/speech): versioned names, so a device downloads each once.
      { source: "/speech/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // The PDF reader's worker (public/pdf): versioned name too.
      { source: "/pdf/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
