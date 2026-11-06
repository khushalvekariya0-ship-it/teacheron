import type * as React from "react";
import type { StudentProfile, User } from "@/lib/types";
import { GRADE_LABEL, MODE_LABEL, TIMES_OF_DAY, TUTOR_CATEGORY_LABEL, subjectName } from "@/lib/data/catalog";
import { formatMoney, type Currency } from "@/lib/money";
import { countryName } from "@/lib/location";
import type { TutorSearch } from "@/lib/search";
import { DAY_ORDER } from "@/components/jobs/jobUtils";
import { EXPERIENCE_OPTIONS, GENDER_LABEL, PAYER_LABEL, PAY_METHOD_NAME, START_LABEL, TUTOR_GENDER_LABEL } from "./schema";

/** One line of a profile summary (review step and My profile). */
export interface SummaryRow {
  label: string;
  value: React.ReactNode;
}

const list = (items: string[], empty: string) => (items.length ? items.join(", ") : empty);

export function basicRows(me: User, p: StudentProfile): SummaryRow[] {
  return [
    { label: "Name", value: `${me.firstName} ${me.lastName}` },
    { label: "Age", value: p.age ? `${p.age} years` : "Not added" },
    { label: "Gender", value: p.gender ? GENDER_LABEL[p.gender] : "Not added" },
    { label: "Location", value: me.city ? `${me.city}, ${me.state ?? ""} ${me.zip ?? ""}`.trim() + (me.country && me.country !== "US" ? `, ${countryName(me.country)}` : "") : "Not added" },
    { label: "Photo", value: p.photoUrl ? "Added" : "Not added" },
  ];
}

export function learningRows(p: StudentProfile): SummaryRow[] {
  return [
    { label: "Grade or level", value: p.grade ? GRADE_LABEL[p.grade] : "Not added" },
    { label: "Subjects", value: list(p.subjects.map(subjectName), "Not added") },
    { label: "Goals", value: list(p.goals, "Not added") },
    { label: "More details", value: p.details ? <span className="whitespace-pre-line">{p.details}</span> : "None" },
    { label: "Learning support", value: list(p.learningSupport, "None") },
  ];
}

export function preferenceRows(p: StudentProfile): SummaryRow[] {
  const format = p.modes
    .map((m, i) => {
      const label = i === 0 ? MODE_LABEL[m] : MODE_LABEL[m].toLowerCase();
      return m === "in_person" ? `${label} (within ${p.travelMiles} miles)` : label;
    })
    .join(" or ");
  return [
    { label: "Lessons", value: format || "Not added" },
    { label: "Tutor gender", value: TUTOR_GENDER_LABEL[p.tutorGender] },
    { label: "Languages", value: list(p.tutorLanguages, "Any") },
    { label: "Type of tutor", value: list(p.tutorCategories.map((c) => TUTOR_CATEGORY_LABEL[c]), "Any type") },
    { label: "Experience", value: EXPERIENCE_OPTIONS.find((o) => o.value === String(p.minExperienceYears))?.label ?? `${p.minExperienceYears}+ years` },
  ];
}

export function scheduleRows(p: StudentProfile): SummaryRow[] {
  return [
    { label: "Days", value: list(DAY_ORDER.filter((d) => p.days.includes(d)), "Not added") },
    { label: "Times", value: list(TIMES_OF_DAY.filter((t) => p.timesOfDay.includes(t.value as never)).map((t) => `${t.label} (${t.range})`), "Not added") },
    { label: "How often", value: `${p.sessionsPerWeek} × ${p.lessonMinutes}-minute ${p.sessionsPerWeek === 1 ? "lesson" : "lessons"} a week` },
    { label: "Start", value: START_LABEL[p.startWhen] },
  ];
}

/** `currency`: the learner's own (useViewerCurrency); US dollars when not given. */
export function budgetRows(p: StudentProfile, currency?: Currency): SummaryRow[] {
  const week = (cents: number) => Math.round(cents * (p.lessonMinutes / 60) * p.sessionsPerWeek);
  const money = (minor: number) => formatMoney(minor, currency);
  return [
    { label: "Budget", value: `${money(p.budgetMinCents)}–${money(p.budgetMaxCents)} an hour` },
    { label: "About", value: `${money(week(p.budgetMinCents))}–${money(week(p.budgetMaxCents))} a week` },
    { label: "Who pays", value: PAYER_LABEL[p.payer] },
    { label: "Payment method", value: PAY_METHOD_NAME[p.payMethod] },
  ];
}

/** Tutor search filters that match the profile: first subject, grade, format, area and budget. */
export function tutorSearchFor(me: User, p: StudentProfile): TutorSearch {
  const inPersonOnly = p.modes.length === 1 && p.modes[0] === "in_person";
  return {
    subject: p.subjects[0],
    grade: p.grade,
    mode: p.modes.length === 1 ? p.modes[0] : undefined,
    location: inPersonOnly ? me.zip : undefined,
    radius: inPersonOnly ? p.travelMiles : undefined,
    maxRate: Math.round(p.budgetMaxCents / 100),
    exp: p.minExperienceYears || undefined,
    lang: p.tutorLanguages.find((l) => l !== "English"),
  };
}
