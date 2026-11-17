import type { ContactRules } from "@/lib/domain/contact";

/*
 * Personal-information protection settings (Admin → Chat safety → Settings), saved in platform_settings
 * under "contact_safety". Admins with settings.manage change them; everything that checks messages, files,
 * speech or class pictures reads them. Missing or bad values fall back to the defaults below.
 */

export interface ContactSafety {
  /** Messages, homework and lesson notes are checked (off: typed text isn't checked). */
  chat: boolean;
  /** Requests to talk, meet or pay outside TutorLink count, not only the contact details themselves. */
  requests: boolean;
  /** "strict": any mention of WhatsApp, Instagram … in a message counts; "normal": only next to a handle or number. */
  sensitivity: "normal" | "strict";
  /** Speech is checked in class (by each person's browser), and also on phones. */
  voice: boolean;
  voiceOnPhones: boolean;
  /** Pictures are read (chat and homework images, whiteboard pictures and drawings, shared screens). */
  images: boolean;
  /** Each person's camera picture is read in class. */
  camera: boolean;
  /** PDF, Word and text files are read. */
  documents: boolean;
  /** QR codes in pictures and files are read. */
  qr: boolean;
  /** Gemini also reads class pictures (needs GEMINI_API_KEY; sends the pictures to Google). */
  aiReading: boolean;
  /** In one lesson: from this catch on, the warning is stronger and moderators are told. */
  strongWarningAt: number;
  /** In one lesson: from this catch on, the person's audio doesn't reach the others for muteMinutes. */
  muteAt: number;
  muteMinutes: number;
  /** In one lesson: removed from the class at this catch (0 = never). */
  removeAt: number;
  /** Removed from this many lessons within 90 days: the account is paused for review (0 = never). */
  pauseAccountAfterRemovals: number;
  /** Phrases that count as a request to talk outside TutorLink, and phrases that never do (any language). */
  block: string[];
  allow: string[];
  /** Catches, restrictions and decided appeals older than this are deleted. */
  retentionDays: number;
}

export const DEFAULT_CONTACT_SAFETY: ContactSafety = {
  chat: true,
  requests: true,
  sensitivity: "normal",
  voice: true,
  voiceOnPhones: false,
  images: true,
  camera: true,
  documents: true,
  qr: true,
  aiReading: false,
  strongWarningAt: 2,
  muteAt: 3,
  muteMinutes: 10,
  removeAt: 0,
  pauseAccountAfterRemovals: 0,
  block: [],
  allow: [],
  retentionDays: 180,
};

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};
const phrases = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((p): p is string => typeof p === "string").map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.length >= 3 && p.length <= 120))].slice(0, 200) : [];

/** The saved settings, checked and completed with the defaults. */
export function readContactSafety(raw: unknown): ContactSafety {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ContactSafety, unknown>>;
  const d = DEFAULT_CONTACT_SAFETY;
  const bool = (k: keyof ContactSafety) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (d[k] as boolean));
  const strongWarningAt = int(r.strongWarningAt, 1, 20, d.strongWarningAt);
  const muteAt = int(r.muteAt, 0, 20, d.muteAt);
  return {
    chat: bool("chat"),
    requests: bool("requests"),
    sensitivity: r.sensitivity === "strict" ? "strict" : "normal",
    voice: bool("voice"),
    voiceOnPhones: bool("voiceOnPhones"),
    images: bool("images"),
    camera: bool("camera"),
    documents: bool("documents"),
    qr: bool("qr"),
    aiReading: bool("aiReading"),
    strongWarningAt,
    muteAt,
    muteMinutes: int(r.muteMinutes, 1, 120, d.muteMinutes),
    removeAt: int(r.removeAt, 0, 20, d.removeAt),
    pauseAccountAfterRemovals: int(r.pauseAccountAfterRemovals, 0, 10, d.pauseAccountAfterRemovals),
    block: phrases(r.block),
    allow: phrases(r.allow),
    retentionDays: int(r.retentionDays, 30, 3650, d.retentionDays),
  };
}

/** What the contact-detail rules need from the settings. */
export const rulesOf = (s: ContactSafety): Partial<ContactRules> => ({ chat: s.chat, sensitivity: s.sensitivity, requests: s.requests, block: s.block, allow: s.allow });

/** The settings as members see them (the phrase lists are only for staff). */
export const publicContactSafety = (s: ContactSafety): ContactSafety => ({ ...s, block: [], allow: [] });
