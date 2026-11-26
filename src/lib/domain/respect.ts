/*
 * Respectful chat. Two small checks on what someone types:
 *
 * - abusiveIn(): strong insults, slurs and threats in English, Hindi and Gujarati (Latin letters, Devanagari
 *   and Gujarati script). A message with one isn't sent; the sender is asked to rephrase (see sendMessage).
 *   Only unambiguous words are listed, matched as whole words, so everyday and school text ("push it",
 *   "Scunthorpe", "chhod do", "BC" in history, the country Niger, "uniformly retarded motion" in physics, the
 *   name Randi, "teri maa ki tabiyat") is never caught. Simple disguises are read through: repeated
 *   letters ("fuuuck"), symbols for vowels ("f*ck", "sh!t"), dots or dashes between letters ("f.u.c.k") and
 *   look-alike digits ("5hit").
 * - honestyReminder(): asking a tutor to do graded homework, assignments or exams ("do my homework for me",
 *   "assignment bana do"), or a tutor offering to. The message is sent; the sender sees a friendly reminder.
 */

/** Latin-letter words, written without double letters ("fagot" also catches "faggot"; letters may repeat). */
const LATIN = [
  // English
  "fuck", "fucker", "fucking", "fuckin", "motherfucker", "fck", "fuk", "shit", "bulshit", "bitch", "bastard", "ashole", "dickhead",
  "cunt", "slut", "whore", "fagot", "kys",
  // Hindi (Latin letters)
  "madarchod", "maderchod", "madharchod", "behenchod", "bhenchod", "benchod", "bhenchot", "chutiya", "chutia", "chutiye",
  "bhosdike", "bhosadike", "bhosdi", "bhosda", "bhosadi", "gandu", "harami", "haramkhor", "lund", "lauda", "lavda", "lawda", "loda",
  "bsdk", "lodu",
  // Gujarati (Latin letters)
  "bhosdina", "bhosadina", "bhosdino", "bhosdini",
];

/** Phrases (words in order, single spaces): threats and the worst insults. */
const PHRASES = ["kill yourself", "kill urself", "go die", "jaan se maar", "maa chod", "ma chod", "son of a bitch", "piece of shit"];

/** Written as patterns: the racial slur needs its double "g" (Niger, the country, is fine). */
const RAW = ["n[i1!*]+g{2,}(?:er|a|ah|uh)s?"];

/** Devanagari and Gujarati script words, matched as whole words. */
const SCRIPT = [
  "मादरचोद", "बहनचोद", "भेनचोद", "बहनचोद", "चूतिया", "चुतिया", "भोसड़ी", "भोसडी", "भोसड़ीके", "गांडू", "गाण्डू", "हरामी", "हरामखोर", "रंडी", "लौड़ा", "लौडा", "लंड",
  "માદરચોદ", "બેનચોદ", "ભોસડી", "ભોસડીના", "ભોસડીનો", "ચૂતિયા", "ચુતિયા", "હરામી", "રંડી",
];

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
/** Between two letters of a word: nothing, or one dot, dash, underscore or star ("f.u.c.k"). Never a space. */
const GAP = "[._*-]?";

/** One letter of a word: repeats allowed ("fuuuck"); a vowel may be hidden behind a symbol ("f*ck", "sh!t"). */
const letter = (ch: string) => (VOWELS.has(ch) ? `(?:${ch}|[*!@#])+` : `${ch}+`);

const wordPattern = (w: string) => w.split("").map(letter).join(GAP);

// Whole words only: no letter right before or after.
const LATIN_RE = new RegExp(`(?<!\\p{L})(?:${[...LATIN.map(wordPattern), ...RAW].join("|")})(?!\\p{L})`, "giu");
const PHRASE_RE = new RegExp(`(?<!\\p{L})(?:${PHRASES.map((p) => p.split(" ").map(wordPattern).join("\\s+")).join("|")})(?!\\p{L})`, "giu");
// The same letter can be stored two ways (ड़ as one character, or ड + ़), so the words and the text are both normalised.
const SCRIPT_RE = new RegExp(`(?<![\\p{L}\\p{M}])(?:${[...new Set(SCRIPT.map((w) => w.normalize("NFC")))].join("|")})(?![\\p{L}\\p{M}])`, "gu");

/** Digits and symbols people use for letters ("5hit", "b1tch", "@ss"). */
const LOOKALIKE: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "$": "s" };

const normalise = (text: string) =>
  text
    .normalize("NFC")
    .replace(/[​-‍⁠﻿]/g, "") // invisible joiners
    .replace(/(?<=\p{L})[0-9$]|[0-9$](?=\p{L})/gu, (c) => LOOKALIKE[c] ?? c)
    .toLowerCase();

export interface AbuseCheck {
  found: boolean;
  /** What matched, as written (for staff only; never shown to the other person). */
  matches: string[];
}

export function abusiveIn(...texts: (string | undefined | null)[]): AbuseCheck {
  const matches: string[] = [];
  for (const raw of texts) {
    if (!raw) continue;
    const text = normalise(raw);
    for (const re of [LATIN_RE, PHRASE_RE, SCRIPT_RE]) for (const m of text.matchAll(re)) matches.push(m[0]);
  }
  return { found: matches.length > 0, matches };
}

export const ABUSE_MESSAGE =
  "Please keep it respectful: this message has words that can hurt or upset someone, so it wasn't sent. Edit it and send it again.";

/* ─── Homework and exam honesty ────────────────────────────────────────────── */

const WORK = "(?:home\\s*work|assignments?|projects?|essays?|exams?|tests?|quiz(?:zes)?|papers?|coursework)";
/** Graded work only: solving a practice "paper" together or walking through a "project" is normal teaching. */
const GRADED = "(?:home\\s*work|assignments?|essays?|exams?|tests?|quiz(?:zes)?|coursework)";
/** A student or parent asking for graded work to be done for them. */
const ASKING = [
  new RegExp(`\\b(?:do|write|finish|complete|solve|make)\\s+(?:my|our|his|her|the)\\s+(?:\\w+\\s+)?${WORK}\\s+for\\s+(?:me|us|him|her)\\b`, "i"),
  new RegExp(`\\b(?:take|attempt|give|write|sit)\\s+(?:my|our|his|her|the)\\s+(?:\\w+\\s+)?(?:exams?|tests?|quiz(?:zes)?|papers?)\\s+(?:for|instead of)\\s+(?:me|us|him|her)\\b`, "i"),
  new RegExp(`\\b(?:can|could|will)\\s+you\\s+(?:do|write|finish|complete)\\s+(?:my|our|his|her)\\s+(?:\\w+\\s+)?${GRADED}\\b`, "i"),
  // Hindi / Gujarati in Latin letters: "homework kar do", "assignment bana do", "homework kari aapo".
  new RegExp(`\\b${WORK}\\s+(?:kar|kari|karke|bana|banaa|banake|likh|lakhi)\\s*(?:do|dena|dijiye|dijie|de|deo|aapo|apo|aapjo|apjo|aapsho|dejo)\\b`, "i"),
];
/** A tutor offering to do it. */
const OFFERING = [
  // "I'll do your homework", "I can take your exam" (not "I'll solve the homework problem with you").
  new RegExp(`\\bi\\s*(?:'ll|will|can|could)\\s+(?:do|write|finish|complete|take|attempt|sit)\\s+your\\s+(?:\\w+\\s+)?${GRADED}\\b`, "i"),
];

/** A friendly reminder to show the sender, or null. Never stops the message. */
export function honestyReminder(text: string, senderIsTutor: boolean): string | null {
  if (senderIsTutor) {
    return OFFERING.some((re) => re.test(text))
      ? "Tutors explain, guide and check work, but don't do graded homework, assignments or exams for students. It's in our community rules."
      : null;
  }
  return ASKING.some((re) => re.test(text))
    ? "Tutors are here to help you learn: they can explain it, work through examples with you and check your answers, but can't do graded homework, assignments or exams for you."
    : null;
}
