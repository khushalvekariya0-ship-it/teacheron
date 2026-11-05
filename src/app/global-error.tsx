"use client";

/**
 * Last-resort error page, used only if the site's root layout itself fails. It replaces the whole
 * document, so it brings its own <html>, <body> and simple styles (TutorLink charcoal and cream).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#15140f", color: "#eee9dd", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <title>Something went wrong · TutorLink</title>
        <main style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
          <p style={{ fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "0.2em", color: "#a49d8c", fontSize: 14 }}>TUTORLINK</p>
          <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: "16px 0 0", fontWeight: 600 }}>Something went wrong on our side.</h1>
          <p style={{ color: "#a49d8c", fontSize: 17, lineHeight: 1.6, marginTop: 16 }}>The site didn&rsquo;t load. Your account and bookings are safe. Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, background: "#e5582f", color: "#15140f", border: 0, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
          {error.digest && <p style={{ marginTop: 20, fontSize: 13, color: "#a49d8c" }}>Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
