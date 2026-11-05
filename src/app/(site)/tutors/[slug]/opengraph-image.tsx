import { ImageResponse } from "next/og";
import { setLiveCatalog, subjectName } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";
import { publicCatalog, tutorBySlug } from "@/server/public";

/* The picture shown when a tutor's profile link is shared: their photo (or initials), name, headline and subjects. */

export const alt = "Tutor profile on TutorLink";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutor = await tutorBySlug(slug);
  setLiveCatalog(await publicCatalog());
  const name = tutor ? `${tutor.firstName} ${tutor.lastName.charAt(0)}.` : SITE.name;
  const headline = tutor?.headline ?? SITE.tagline;
  const subjects = tutor ? tutor.subjects.slice(0, 4).map((s) => subjectName(s)).join(" · ") : "";
  const initials = tutor ? `${tutor.firstName.charAt(0)}${tutor.lastName.charAt(0)}` : "T";
  // Only real numbers: a rating appears once there are reviews from completed lessons.
  const rating = tutor && tutor.rating !== null && tutor.reviewCount > 0 ? `★ ${tutor.rating.toFixed(1)} (${tutor.reviewCount} review${tutor.reviewCount === 1 ? "" : "s"})` : "";
  const photo = tutor?.photoUrl && /^https:\/\//.test(tutor.photoUrl) ? tutor.photoUrl : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#15140f", color: "#eee9dd", padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, background: "#eee9dd", color: "#15140f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700 }}>T</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{SITE.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG, not a page
            <img src={photo} width={240} height={240} alt="" style={{ objectFit: "cover", border: "4px solid #e5582f" }} />
          ) : (
            <div style={{ width: 240, height: 240, background: "#27241b", color: "#eee9dd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, fontWeight: 700, border: "4px solid #e5582f" }}>{initials}</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1.5 }}>{name}</div>
            <div style={{ marginTop: 12, fontSize: 34, lineHeight: 1.25, color: "#d6d0c1" }}>{headline.slice(0, 110)}</div>
            {subjects && <div style={{ marginTop: 20, fontSize: 26, color: "#a49d8c" }}>{subjects}</div>}
            {rating && <div style={{ marginTop: 14, fontSize: 26, color: "#e5582f" }}>{rating}</div>}
          </div>
        </div>
        <div style={{ display: "flex", height: 8, width: 200, background: "#e5582f" }} />
      </div>
    ),
    size,
  );
}
