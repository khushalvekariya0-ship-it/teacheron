import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

/* The picture shown when a TutorLink link is shared (WhatsApp, Facebook, LinkedIn, X…). */

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#15140f", color: "#eee9dd", padding: "72px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, background: "#eee9dd", color: "#15140f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 700 }}>T</div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{SITE.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>{SITE.tagline}</div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#a49d8c" }}>Search tutors by subject, level and schedule · Online and in person</div>
        </div>
        <div style={{ display: "flex", height: 10, width: 220, background: "#e5582f" }} />
      </div>
    ),
    size,
  );
}
