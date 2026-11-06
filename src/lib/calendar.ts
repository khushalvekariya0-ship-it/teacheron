/*
 * "Add to calendar" for a lesson: a Google Calendar link, and an .ics file that Apple Calendar, Outlook
 * and phone calendars open. Only the lesson's title, time and a link back to its TutorLink page go in:
 * no meeting links, passcodes or contact details (people join from the lesson page).
 */

export interface CalendarEvent {
  /** Stable id, so adding the same lesson again updates the entry instead of duplicating it. */
  uid: string;
  title: string;
  startUtc: string;
  durationMin: number;
  details: string;
  /** The lesson's page on TutorLink. */
  url: string;
}

/** 20261108T103000Z */
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const endOf = (e: CalendarEvent) => new Date(new Date(e.startUtc).getTime() + e.durationMin * 60_000);

export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(new Date(e.startUtc))}/${stamp(endOf(e))}`,
    details: `${e.details}\n\n${e.url}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Text values in .ics need \ ; , and line breaks escaped. */
const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 bytes are folded (continued on the next line after a space), as the format requires. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function icsFile(e: CalendarEvent, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TutorLink//Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@tutorlink`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(new Date(e.startUtc))}`,
    `DTEND:${stamp(endOf(e))}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(`${e.details}\n\n${e.url}`)}`,
    `URL:${e.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Saves the .ics file in the browser. */
export function downloadIcs(e: CalendarEvent, filename = "tutorlink-lesson.ics") {
  const url = URL.createObjectURL(new Blob([icsFile(e)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
