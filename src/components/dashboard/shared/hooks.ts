"use client";

import { useMemo } from "react";
import type { Tutor } from "@/lib/types";
import { useTutors } from "@/lib/store/hooks";

/** Tutors keyed by id (overrides and live ratings applied). */
export function useTutorMap(): Map<string, Tutor> {
  const tutors = useTutors();
  return useMemo(() => new Map(tutors.map((t) => [t.id, t])), [tutors]);
}

export function tutorFullName(t: Pick<Tutor, "firstName" | "lastName"> | undefined): string {
  return t ? `${t.firstName} ${t.lastName}` : "Tutor";
}

/** Triggers a browser download of JSON data. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
