"use client";

import * as React from "react";
import { useSession } from "@/lib/store/hooks";

/** Renders the tutor or learner (student/parent) variant of a shared dashboard page. */
export function ByRole({ tutor, learner }: { tutor: React.ReactNode; learner: React.ReactNode }) {
  const me = useSession();
  if (!me) return null;
  return <>{me.role === "tutor" ? tutor : learner}</>;
}
