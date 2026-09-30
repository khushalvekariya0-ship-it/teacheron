"use client";

import { useSyncExternalStore } from "react";

/*
 * Lets the onboarding layout's "Save & exit" button call into the wizard that's currently mounted,
 * without the layout needing to know about form state.
 */

type Handler = () => void;

let handler: Handler | null = null;
const listeners = new Set<() => void>();

export function setSaveExitHandler(next: Handler | null): void {
  handler = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useSaveExitHandler(): Handler | null {
  return useSyncExternalStore(subscribe, () => handler, () => null);
}
