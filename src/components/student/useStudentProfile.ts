"use client";

import { useMemo } from "react";
import type { StudentProfile } from "@/lib/types";
import { emptyStudentProfile, useApp } from "@/lib/store";

/** The student's saved learning profile, or an empty one before they've filled anything in. */
export function useStudentProfile(userId: string | undefined): StudentProfile {
  const saved = useApp((s) => (userId ? s.studentProfiles[userId] : undefined));
  return useMemo(() => saved ?? emptyStudentProfile(userId ?? ""), [saved, userId]);
}
