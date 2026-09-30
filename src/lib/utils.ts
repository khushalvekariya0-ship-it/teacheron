import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length).trimEnd()}…` : str;
}

/** Stable idempotency key for a user action (e.g. one booking attempt). */
export function idempotencyKey(prefix = "idem"): string {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}
