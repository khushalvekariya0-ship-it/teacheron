/** A lesson's caption transcript (and snapshots) as a PDF, made in the browser. */
export interface Snapshot {
  at: string;
  title: string;
  /** A JPEG data URL. */
  image: string;
}

const LINE = /^\[(.*?)\] (.*?): (.*)$/;

export async function downloadTranscriptPdf(opts: { title: string; transcript: string; snapshots: Snapshot[] }) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Charcoal header, TutorLink orange accent.
  pdf.setFillColor(21, 20, 15);
  pdf.rect(0, 0, pageW, 46, "F");
  pdf.setFillColor(229, 88, 47);
  pdf.rect(0, 46, pageW, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(238, 233, 221);
  pdf.text("LESSON TRANSCRIPT", 20, 26);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(180, 172, 156);
  pdf.text(opts.title.slice(0, 80), 20, 37);
  pdf.text(`Made ${new Date().toLocaleString()}`, pageW - 20, 37, { align: "right" });

  let y = 62;
  pdf.setTextColor(21, 20, 15);
  pdf.setFontSize(10);
  for (const line of opts.transcript.split("\n").filter(Boolean)) {
    const m = LINE.exec(line);
    if (!m) continue;
    const [, time, speaker, text] = m;
    if (y > pageH - 30) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(207, 74, 37);
    pdf.text(speaker, 20, y);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(150, 145, 135);
    pdf.text(`[${time}]`, 20 + pdf.getTextWidth(speaker) + 4, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(40, 38, 32);
    for (const t of pdf.splitTextToSize(text, pageW - 45) as string[]) {
      if (y > pageH - 20) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(t, 25, y);
      y += 5;
    }
    y += 4;
  }

  if (opts.snapshots.length) {
    pdf.addPage();
    pdf.setFillColor(21, 20, 15);
    pdf.rect(0, 0, pageW, 36, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(238, 233, 221);
    pdf.text("SNAPSHOTS", 20, 23);
    y = 50;
    for (const s of opts.snapshots) {
      if (y > pageH - 110) {
        pdf.addPage();
        y = 22;
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(100, 96, 88);
      pdf.text(`${s.title} · ${s.at}`, 20, y);
      try {
        pdf.addImage(s.image, "JPEG", 20, y + 4, pageW - 40, 85);
        y += 100;
      } catch {
        y += 10;
      }
    }
  }
  pdf.save(`Lesson-transcript-${new Date().toISOString().slice(0, 10)}.pdf`);
}
