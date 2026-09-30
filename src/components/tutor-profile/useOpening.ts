"use client";

import * as React from "react";
import type { Tutor } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useHydrated, useNow, useViewerTimezone } from "@/lib/store/hooks";
import { nextOpening, type Slot } from "@/lib/time";

/**
 * Next bookable slot for a tutor, in the viewer's time zone.
 * `undefined` until the store has hydrated (bookings and time are client-only), `null` when none.
 */
export function useNextOpening(tutor: Tutor): Slot | null | undefined {
  const hydrated = useHydrated();
  const bookings = useApp((s) => s.bookings);
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  return React.useMemo(() => (hydrated ? nextOpening(tutor, bookings, tz, now) : undefined), [hydrated, tutor, bookings, tz, now]);
}
