/*
 * Finds contact details that would let people move a conversation off TutorLink: phone numbers,
 * email addresses, and handles or links for other messaging, social and payment apps.
 *
 * It sees through the usual disguises: digits split by spaces, dots, emoji or words ("917 then 555"),
 * numbers written as words ("nine one seven", "double five"), look-alike letters and other alphabets'
 * digits, "john at gmail dot com", spaced-out letters ("j o h n @ g m a i l"), hidden characters, and
 * names like "whats app" or "1nsta". Dates, times, prices, years, scores, sums, ISBNs, ZIP codes and
 * counting lists are left alone so ordinary tutoring messages still go through.
 *
 * `chat` mode is for what people type. `file` mode is for text read out of files and images (OCR),
 * which are often worksheets full of numbers, so there only number groups shaped like a phone number
 * (or introduced with "call me", "phone:" …) count as phone numbers.
 *
 * The server runs this on every message and file before anything is saved; the browser never decides.
 */

export type ContactKind = "phone" | "email" | "social";
export type ScanMode = "chat" | "file";

/** Where contact details were found, as positions in the original text. */
export interface ContactMatch {
  kind: ContactKind;
  start: number;
  end: number;
}

export interface ContactScan {
  found: boolean;
  kinds: ContactKind[];
  matches: ContactMatch[];
}

/* ─── 1. Normalising, while remembering where each character came from ─────────── */

/** A transformed copy of the text; `from[i]`/`to[i]` give the original range behind character i. */
interface View {
  s: string;
  from: number[];
  to: number[];
}

// Invisible characters people slip between digits or letters (and apostrophes, so "what's" reads "whats").
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ'’‘`´]/u;

// Letters from other alphabets that look like Latin ones, and dot-like marks.
const LOOKALIKE: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", ѕ: "s", і: "i", ї: "i", ј: "j",
  ԁ: "d", һ: "h", ӏ: "l", ո: "n", ս: "u", ɡ: "g", ɑ: "a", ı: "i", ℓ: "l", ⅼ: "l", α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", ν: "v",
  ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x", ω: "w", "。": ".", "｡": ".", "·": ".", "∙": ".", "⋅": ".", "•": ".", "․": ".",
  // Armenian and IPA look-alikes, and small capitals (ɢᴍᴀɪʟ)
  օ: "o", ɩ: "i", ᴀ: "a", ʙ: "b", ᴄ: "c", ᴅ: "d", ᴇ: "e", ꜰ: "f", ɢ: "g", ʜ: "h", ɪ: "i", ᴊ: "j", ᴋ: "k", ʟ: "l", ᴍ: "m", ɴ: "n",
  ᴏ: "o", ᴘ: "p", ǫ: "q", ʀ: "r", ꜱ: "s", ᴛ: "t", ᴜ: "u", ᴠ: "v", ᴡ: "w", ʏ: "y", ᴢ: "z",
};

/** Symbols Unicode doesn't simplify on its own: ❾ ➒ ⓫ 🔟 digits, 🇬🇲🇦🇮🇱 flag letters, 🅶🅼 boxed letters. */
function special(cp: number): string | null {
  if (cp >= 0x2776 && cp <= 0x277f) return String(cp - 0x2775); // ❶ … ❿
  if (cp >= 0x2780 && cp <= 0x2789) return String(cp - 0x277f); // ➀ … ➉
  if (cp >= 0x278a && cp <= 0x2793) return String(cp - 0x2789); // ➊ … ➓
  if (cp >= 0x24eb && cp <= 0x24f4) return String(cp - 0x24eb + 11); // ⓫ … ⓴
  if (cp >= 0x24f5 && cp <= 0x24fe) return String(cp - 0x24f4); // ⓵ … ⓾
  if (cp === 0x24ff) return "0"; // ⓿
  if (cp === 0x1f51f) return "10"; // 🔟
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return String.fromCharCode(97 + cp - 0x1f1e6); // 🇦 … 🇿
  if (cp >= 0x1f130 && cp <= 0x1f149) return String.fromCharCode(97 + cp - 0x1f130); // 🄰 … 🅉
  if (cp >= 0x1f150 && cp <= 0x1f169) return String.fromCharCode(97 + cp - 0x1f150); // 🅐 … 🅩
  if (cp >= 0x1f170 && cp <= 0x1f189) return String.fromCharCode(97 + cp - 0x1f170); // 🅰 … 🆉
  return null;
}

/** The value of a digit from any script (Devanagari ९, Gujarati ૯, Arabic ٩ …). */
function digitValue(ch: string): string {
  const cp = ch.codePointAt(0)!;
  let start = cp;
  // Unicode keeps every script's digits in runs of ten, 0 to 9.
  while (start > cp - 80 && /\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
  return String((cp - start) % 10);
}

function normalize(text: string): View {
  const s: string[] = [];
  const from: number[] = [];
  const to: number[] = [];
  let i = 0;
  for (const ch of text) {
    const start = i;
    i += ch.length;
    if (INVISIBLE.test(ch)) continue;
    // NFKD splits accents off ("gmáil" → "gmail") and turns fancy forms (𝟗, ９, ①, ﬁ) into plain ones.
    for (let c of special(ch.codePointAt(0)!) ?? ch.normalize("NFKD").toLowerCase()) {
      if (/\p{M}/u.test(c)) continue; // accents, stacked marks, keycap marks
      c = LOOKALIKE[c] ?? c;
      if (c > "\u007f" && /\p{Nd}/u.test(c)) c = digitValue(c);
      s.push(c);
      // One entry per UTF-16 unit, so positions line up with the joined string (emoji take two).
      for (let k = 0; k < c.length; k++) {
        from.push(start);
        to.push(i);
      }
    }
  }
  return { s: s.join(""), from, to };
}

/** Replaces every match of `re` (global) in a view, keeping the original positions. */
function replaceIn(v: View, re: RegExp, replacement: string | ((m: RegExpExecArray) => string)): View {
  // Nothing to replace: keep the same view (most rules don't apply to most messages).
  re.lastIndex = 0;
  const any = re.test(v.s);
  re.lastIndex = 0;
  if (!any) return v;
  const s: string[] = [];
  const from: number[] = [];
  const to: number[] = [];
  let last = 0;
  const keep = (a: number, b: number) => {
    for (let k = a; k < b; k++) {
      s.push(v.s[k]);
      from.push(v.from[k]);
      to.push(v.to[k]);
    }
  };
  re.lastIndex = 0;
  for (let m = re.exec(v.s); m; m = re.exec(v.s)) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    keep(last, m.index);
    const rep = typeof replacement === "string" ? replacement : replacement(m);
    const a = v.from[m.index];
    const b = v.to[m.index + m[0].length - 1];
    for (const c of rep) {
      s.push(c);
      from.push(a);
      to.push(b);
    }
    last = m.index + m[0].length;
  }
  keep(last, v.s.length);
  return { s: s.join(""), from, to };
}

/** Joins characters typed one at a time ("j o h n @ g m a i l . c o m" → "john@gmail.com"). */
function joinSpacedLetters(v: View): View {
  return replaceIn(v, /(?<!\S)\S(?:[ \t]+\S(?!\S)){3,}/g, (m) => m[0].replace(/[ \t]+/g, ""));
}

/** Runs a global regex over a view and returns the original ranges it matched. */
function rangesOf(w: View, re: RegExp, keep?: (m: RegExpExecArray) => boolean): [number, number][] {
  const out: [number, number][] = [];
  re.lastIndex = 0;
  for (let m = re.exec(w.s); m; m = re.exec(w.s)) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    if (!keep || keep(m)) out.push([w.from[m.index], w.to[m.index + m[0].length - 1]]);
  }
  return out;
}

/* ─── 2. Vocabulary ───────────────────────────────────────────────────────────── */

const UNIT_WORDS: Record<string, string> = {
  zero: "0", zer0: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", niner: "9",
  // Spanish (and Portuguese "tres")
  cero: "0", uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9",
  // Common misspellings
  nien: "9", nyne: "9", sevn: "7", sevan: "7", fiv: "5", fyve: "5", thre: "3", sixx: "6", zro: "0", wun: "1", eigth: "8", eigt: "8",
};

/**
 * Words that are only numbers when there are seven or more number-like words in a row (on their own they're
 * ordinary words: "to", "for", "do", "be", "sat" …). Covers sound-alikes, other languages, Hindi and Gujarati
 * (written in English letters or in their own script, vowel signs removed) and Roman numerals.
 */
const WEAK_WORDS: Record<string, string> = {
  won: "1", to: "2", too: "2", tu: "2", tree: "3", for: "4", fore: "4", foor: "4", ate: "8", nil: "0", naught: "0", nought: "0", oh: "0",
  // French, German, Italian, Portuguese
  un: "1", deux: "2", trois: "3", quatre: "4", cinq: "5", sept: "7", huit: "8", neuf: "9",
  null: "0", eins: "1", zwei: "2", drei: "3", vier: "4", funf: "5", fuenf: "5", sechs: "6", sieben: "7", acht: "8", neun: "9",
  due: "2", tre: "3", quattro: "4", cinque: "5", sei: "6", sette: "7", otto: "8", nove: "9", um: "1", dois: "2", sete: "7", oito: "8",
  // Hindi and Gujarati in English letters
  shunya: "0", shoonya: "0", sunya: "0", ek: "1", do: "2", be: "2", teen: "3", tin: "3", tran: "3", char: "4", chaar: "4",
  paanch: "5", panch: "5", pach: "5", chhe: "6", chhah: "6", chah: "6", chha: "6", che: "6", saat: "7", sat: "7", aath: "8", ath: "8",
  nau: "9", nav: "9", das: "10",
  // Hindi (Devanagari) and Gujarati script
  शनय: "0", एक: "1", द: "2", तन: "3", चर: "4", पच: "5", छह: "6", छ: "6", सत: "7", आठ: "8", न: "9",
  શનય: "0", એક: "1", બ: "2", તરણ: "3", ચર: "4", પચ: "5", છ: "6", સત: "7", આઠ: "8", નવ: "9",
  // Roman numerals
  ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9",
};
const DIGIT_WORDS: Record<string, string> = {
  ...UNIT_WORDS,
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
  twenty: "20", thirty: "30", forty: "40", fourty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
  hundred: "00", thousand: "000",
};
const TENS = new Set(["twenty", "thirty", "forty", "fourty", "fifty", "sixty", "seventy", "eighty", "ninety"]);
const NUMBER_WORDS = Object.keys(DIGIT_WORDS).sort((a, b) => b.length - a.length);
const UNITS = Object.keys(UNIT_WORDS).filter((w) => UNIT_WORDS[w] !== "0").sort((a, b) => b.length - a.length);

/** Words allowed between number groups without splitting them ("917 then 555 dash 0123"). */
const GLUE = new Set(["and", "n", "then", "dash", "hyphen", "dot", "point", "space", "comma", "plus", "slash", "underscore", "next", "after", "followed", "by", "is", "y"]);
const REPEAT: Record<string, number> = { double: 2, dbl: 2, triple: 3, tripple: 3 };
/** First letters of the number words (zero, one, two/three, four/five, six/seven, eight, nine): "n z o s f …". */
const FIRST_LETTERS = new Set(["z", "o", "t", "f", "s", "e", "n"]);
/** "nzosfszznz": a long run of those letters with few vowels, which no ordinary word is. */
const isLetterCode = (w: string) => /^[zotfsen]{10,13}$/.test(w) && (w.match(/[oe]/g)?.length ?? 0) / w.length < 0.4;
/** Stands in for a digit written as a letter code (its value isn't known, only that it's a digit). */
const CODE_DIGIT = "#";

// Email providers, allowing for 0/o, 1/i/l, 4/a and 3/e swaps.
const PROVIDER =
  "(?:g[o0]{2}gl[e3]m[a4@][i1!l|]l|gm[a4@][i1!l|][l1|i]|y[a4@]h[o0]{2}|ym[a4@][i1l]l|h[o0]tm[a4@][i1l]l|[o0]utl[o0]{2}k|[i1]cl[o0]ud|[a4]ol|pr[o0]t[o0]nm[a4][i1]l|pr[o0]t[o0]n|gmx|z[o0]h[o0]|y[a4]nd[e3]x|r[e3]d[i1]ffm[a4][i1]l|r[o0]ck[e3]tm[a4][i1]l|f[a4]stm[a4][i1]l|tut[a4]n[o0]t[a4]|msn|n[a4]v[e3]r)";
const PROVIDER_ONLY = new RegExp(`^${PROVIDER}$`);
// Endings recognised when written with spaces ("gmail . com", "dot net"). Words like "in" and "me" are left out.
const TLD_SPACED = "(?:com|net|org|edu|gov|io|info|biz|xyz|uk|ca|au|ru|de|fr|cn)";

// Other apps people use to swap contacts or payments.
const APP_NAMES: RegExp[] = [
  /\bw+h*[a4@]+t+s+ ?[-_.]? ?[a4@]+p+\b/g, // whatsapp, whats app, watsapp, wh4tsap
  /\bwts ?app?\b/g,
  /\bt[e3]l[e3] ?gr[a4@]m\b/g,
  /\b[i1!|]ns?t[a4@] ?(?:gr[a4@]m+)?\b/g, // insta, instagram
  /\bsn[a4@]p ?ch[a4@]t\b/g,
  /\bf[a4@]c[e3] ?b[o0]{2}k\b/g,
  /\bsk[y]p[e3]?\b/g,
  /\bd[i1]sc[o0]rd\b/g,
  /\bw[e3]ch[a4@]t\b/g,
  /\bv[i1]b[e3]r\b/g,
  /\bk[i1]k\b/g,
  /\bt[i1]k ?t[o0]k\b/g,
  /\b[i1]-?m[e3]ss[a4@]g[e3]s?\b/g,
  /\bf[a4@]c[e3]t[i1]m[e3]\b/g,
  /\bg[o0]{2}gl[e3] ?v[o0][i1]c[e3]\b/g,
  /\btw[i1]tt[e3]r\b/g,
  /\bl[i1]nk[e3]d ?[i1]n\b/g,
  /\bv[e3]nm[o0]\b/g,
  /\bc[a4@]sh ?[a4@]pp?\b/g,
  /\bz[e3]ll[e3]\b/g,
  /\bp[a4@]y ?p[a4@]l\b/g,
  /\b(?:wapp|whtsapp|whtsap|wtsapp|watsap+|whatsap)\b/g,
  /\bk[a4]k[a4][o0](?:t[a4]lk)?\b/g, // KakaoTalk
  /\bline\s*id\b/g,
  /\b(?:on|via|my)\s+(?:the\s+)?gram\b/g, // "on the gram" = Instagram
  /(?<![a-z0-9_.])[a-z0-9_.]{2,32}#\d{4}\b/g, // Discord tag jane#1234
  /\bwxid_[a-z0-9]{4,}\b/g, // WeChat ID
];
const SHORT_APPS = "(?:snap|sc|ig|fb|signal|tg|wa|insta|messenger|telegram|whatsapp)";
const MY_APPS = "(?:snap|ig|fb|insta|messenger)";
const CONTACT_LINK =
  /(?<![a-z0-9.-])(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)*(?:wa\.me|whatsapp\.com|t\.me|telegram\.(?:me|org|dog)|instagram\.com|instagr\.am|facebook\.com|fb\.(?:com|me)|m\.me|messenger\.com|snapchat\.com|tiktok\.com|twitter\.com|x\.com|linkedin\.com|discord\.(?:gg|com)|signal\.(?:me|group)|skype\.com|line\.me|wechat\.com|viber\.com|kik\.me|calendly\.com|linktr\.ee|beacons\.ai|venmo\.com|cash\.app|paypal\.(?:me|com)|threads\.net|bsky\.app)\b(?:\/[^\s]*)?/g;
// Online-lesson links, whose long meeting numbers aren't phone numbers.
const MEETING_LINK = /(?<![a-z0-9.-])(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:zoom\.us|zoom\.com|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com)\/[^\s]*/g;
// Asking to be called or texted; any 7+ digits shortly after count as a phone number.
const INTENT =
  /\b(?:call|ring|text|txt|sms|reach|contact|dial|whatsapp|wa|ping)\s+(?:me|us)\b|\bmy\s+(?:number|no|num|cell|mobile|mob|phone|digits|contact|whatsapp|wa)\b|\b(?:phone|cell|mobile|contact|whatsapp)\s+(?:number|no|num)\b|\b(?:ph|tel|mob|cell|phone|mobile)\s*[:#]/g;

/* ─── 3. Phone numbers ────────────────────────────────────────────────────────── */

interface Unit {
  digits: string;
  start: number; // in the normalised text
  end: number;
  /** Part of a date, time, price, ISBN, decimal or meeting link. */
  exempt: boolean;
  /** Punctuation and glue words since the previous number in the same run. */
  sep: string;
  /** Ordinary words since the previous number. */
  gapWords: number;
  /** Written as words ("nine") rather than digits. */
  spelled: boolean;
  /** Line number (files: a phone number sits on one line). */
  line: number;
  /** All the text since the previous number (words and punctuation). */
  gap: string;
}

const PHONE_SHAPES = [[3, 3, 4], [1, 3, 3, 4], [2, 3, 3, 4], [5, 5], [2, 5, 5], [4, 3, 3], [4, 6], [5, 6], [2, 4, 4], [3, 4, 4], [2, 4, 6], [3, 7], [1, 10], [2, 10]];
const CROSS_WORD_SHAPES = [[3, 3, 4], [1, 3, 3, 4], [2, 3, 3, 4]];

/** Reads a word made only of number words ("ninefiveone" → "951", "twentyfive" → "25"); null otherwise. */
function spellDigits(word: string): string | null {
  if (word in DIGIT_WORDS) return DIGIT_WORDS[word];
  if (word.length < 6) return null;
  const memo = new Map<number, string | null>();
  const go = (k: number): string | null => {
    if (k === word.length) return "";
    if (memo.has(k)) return memo.get(k)!;
    let out: string | null = null;
    for (const w of NUMBER_WORDS) {
      if (w.length < 3 || !word.startsWith(w, k)) continue;
      if (TENS.has(w)) {
        const unit = UNITS.find((u) => word.startsWith(u, k + w.length));
        const rest = unit ? go(k + w.length + unit.length) : null;
        if (unit && rest !== null) {
          out = DIGIT_WORDS[w][0] + UNIT_WORDS[unit] + rest;
          break;
        }
      }
      const rest = go(k + w.length);
      if (rest !== null) {
        out = DIGIT_WORDS[w] + rest;
        break;
      }
    }
    memo.set(k, out);
    return out;
  };
  return go(0);
}

const UNLEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b" };
/** Letters that look like digits, used inside numbers: 9I7-5SS-OI23. */
const LETTER_DIGIT: Record<string, string> = { o: "0", l: "1", i: "1", z: "2", e: "3", a: "4", s: "5", g: "9", t: "7", b: "8" };

const chunkCache = new Map<string, { digits: string; spelled: boolean } | null>();

/** The digits a run of letters and digits stands for ("9one7", "f1ve", "55o"), or null for an ordinary word. */
function chunkDigits(chunk: string): { digits: string; spelled: boolean } | null {
  if (/^\d+$/.test(chunk)) return { digits: chunk, spelled: false };
  if (chunkCache.has(chunk)) return chunkCache.get(chunk)!;
  const result = readChunk(chunk);
  if (chunkCache.size > 5000) chunkCache.clear();
  chunkCache.set(chunk, result);
  return result;
}

function readChunk(chunk: string): { digits: string; spelled: boolean } | null {
  const parts = chunk.match(/\D+|\d+/g) ?? [];
  let digits = "";
  let ok = true;
  for (const p of parts) {
    if (/^\d/.test(p)) digits += p;
    else {
      const d = spellDigits(p);
      if (d === null) {
        ok = false;
        break;
      }
      digits += d;
    }
  }
  if (ok) return { digits, spelled: true };
  // Number words with digits for letters: f1ve, s3ven, n1ne, 0ne.
  if (/\d/.test(chunk)) {
    const spelled = spellDigits(chunk.replace(/[0134578]/g, (c) => UNLEET[c]));
    if (spelled !== null) return { digits: spelled, spelled: true };
  }
  // A letter standing in for a digit inside a number: 9l7, 55o, O123.
  if (/\d.*\d/.test(chunk) && /^[\doli]+$/.test(chunk)) return { digits: chunk.replace(/o/g, "0").replace(/[li]/g, "1"), spelled: false };
  // More look-alikes (S=5, B=8, Z=2 …) in a short group that has a digit: 5SS, 8B4. Ordinals (1st, 2nd) are left alone.
  if (chunk.length <= 6 && /\d/.test(chunk) && /^[\dolizsbgtae]+$/.test(chunk) && !/^\d+(?:st|nd|rd|th)$/.test(chunk) && (chunk.match(/\d/g)?.length ?? 0) * 3 >= chunk.length) {
    return { digits: chunk.replace(/[olizsbgtae]/g, (c) => LETTER_DIGIT[c]), spelled: false };
  }
  return null;
}

/** Ranges of the normalised text holding dates, times, prices, decimals, ISBNs and meeting links. */
function exemptSpans(s: string): [number, number][] {
  const out: [number, number][] = [];
  const add = (re: RegExp) => {
    re.lastIndex = 0;
    for (let m = re.exec(s); m; m = re.exec(s)) if (m[0]) out.push([m.index, m.index + m[0].length]);
  };
  add(/\b(?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\d|3[01])[/.-](?:(?:19|20)\d{2}|\d{2})\b/g); // 12/15/2026
  add(/\b(?:0?[1-9]|[12]\d|3[01])[/.](?:0?[1-9]|1[0-2])[/.](?:19|20)\d{2}\b/g); // 15.12.2026
  add(/\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g); // 2026-12-15
  add(/(?<![\d/])(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])(?![\d/])/g); // 3/11
  add(/\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/g); // 4:30
  add(/\$\s?\d{1,3}(?:,\d{3}){0,2}(?:\.\d{1,2})?(?![\d,])|\$\s?\d{1,7}(?:\.\d{1,2})?(?!\d)/g); // $1,250.00
  add(/(?<![\d,])\d{1,3}(?:,\d{3}){1,2}(?![\d,])/g); // 1,048,576
  add(/(?<![\d.])(?:\d{1,2}\.\d{1,6}|\d{3,4}\.\d{1,2})(?![\d.])/g); // 3.14159, 1250.75
  add(/\bisbn(?:-1[03])?:?\s*[\dx][\dx\s-]{8,20}[\dx]\b/g);
  add(/\b97[89][-\s]\d{1,5}[-\s]\d{1,7}[-\s]\d{1,7}[-\s]\d\b/g);
  add(MEETING_LINK);
  return out;
}

const isYear = (d: string) => /^(?:19|20)\d\d$/.test(d);
const listSep = (sep: string) => /[,;]|\band\b/.test(sep);
const sum = (units: Unit[]) => units.reduce((n, u) => n + u.digits.length, 0);
const sameLength = (units: Unit[]) => units.every((u) => u.digits.length === units[0].digits.length);

function shapeAt(lengths: number[], shapes: number[][]): [number, number] | null {
  for (const shape of shapes) {
    for (let a = 0; a + shape.length <= lengths.length; a++) {
      if (shape.every((n, k) => lengths[a + k] === n)) return [a, a + shape.length];
    }
  }
  return null;
}

/** Whether one run of numbers (joined only by punctuation and glue words) is a phone number. */
function runIsPhone(all: Unit[], mode: ScanMode): boolean {
  // In files, a leading "3)" or "3." is a list number, not part of what follows.
  const units = mode === "file" && all.length > 1 && all[0].digits.length <= 2 && /^\s*[).]/.test(all[1].sep) && !/[(+]/.test(all[0].sep) ? all.slice(1) : all;
  const live = units.filter((u) => !u.exempt);
  if (!live.length) return false;
  // Shaped like a phone number: 917-555-0123, +1 917 555 0123, 98765 43210.
  const shaped = shapeAt(units.map((u) => u.digits.length), PHONE_SHAPES);
  if (shaped) {
    const part = units.slice(shaped[0], shaped[1]);
    const listy = part.slice(1).every((u) => listSep(u.sep));
    // "60614, 60615" is two ZIP codes and "1350, 1420, 1390" three scores; dates and prices don't count.
    if (part.some((u) => !u.exempt) && !(listy && (sameLength(part) || part.filter((u) => isYear(u.digits)).length >= 2))) return true;
  }
  // One long number: 9175550123, +919876543210.
  if (live.some((u) => u.digits.length >= 10 && u.digits.length <= 15)) return true;
  const isList = live.length > 1 && live.slice(1).every((u) => listSep(u.sep));
  // Sums and equations: 1234 + 5678 = 6912.
  if (units.some((u) => /[=×÷*^]/.test(u.sep))) return false;
  if (mode === "file") {
    // Worksheets are full of numbers: only groups that look like a phone number's parts count.
    const total = sum(live);
    return !isList && !sameLength(live) && live.length <= 5 && total >= 8 && total <= 15 && live.slice(1).every((u) => u.digits.length >= 2) && live.filter((u) => u.digits.length >= 3).length >= 2;
  }
  // Counting: "problems 1, 3, 5, 7, 9, 11", "one two three four five six seven", "1 1 2 3 5 8 13 21".
  const values = live.map((u) => Number(u.digits));
  if (live.length >= 3 && live.every((u) => u.digits.length <= 4) && values.every((v, k) => k === 0 || v >= values[k - 1])) return false;
  if (isList) {
    if (live.every((u) => u.digits.length === 5)) return false; // ZIP codes
    if (sameLength(live) && live[0].digits.length >= 3) return false; // 1350, 1420, 1390
    if (live.every((u) => u.digits.length === 2 && u.digits[0] !== "0")) return sum(live) >= 12; // 85, 90, 78, 92
  }
  const counted = live.filter((u) => !isYear(u.digits));
  const digits = sum(counted);
  if (digits >= 10) return true;
  if (digits >= 7) {
    if (counted.every((u) => u.digits.length === 1)) return true; // 5 5 5 0 1 2 3
    if (counted.some((u) => u.spelled)) return true; // five five five oh one two three
    const local = shapeAt(counted.map((u) => u.digits.length), [[3, 4]]);
    if (local && /^[\s.-]*$/.test(counted[local[0] + 1].sep)) return true; // 555-0123
  }
  // Part of the number dressed up as a date or a price: "9/17/55 51234".
  return sum(units) >= 10 && digits >= 5;
}

/** "917x555x0123" → its digit groups, when the letters in between are just one or two characters. */
function mixedPieces(tok: string, start: number): { digits: string; start: number; end: number; sep: string }[] | null {
  const parts = [...tok.matchAll(/\d+|\D+/g)];
  const digitParts = parts.filter((p) => /^\d/.test(p[0]));
  if (digitParts.length < 2 || parts.some((p) => !/^\d/.test(p[0]) && p[0].length > 2)) return null;
  const out: { digits: string; start: number; end: number; sep: string }[] = [];
  let between = "";
  for (const p of parts) {
    if (!/^\d/.test(p[0])) {
      between += p[0];
      continue;
    }
    out.push({ digits: p[0], start: start + p.index!, end: start + p.index! + p[0].length, sep: between });
    between = "";
  }
  return out;
}

function findPhones(v: View, mode: ScanMode): [number, number][] {
  const s = v.s;
  // Characters inside a date, time, price … (a lookup table keeps long texts fast).
  const exempt = new Uint8Array(s.length + 1);
  for (const [a, b] of exemptSpans(s)) exempt.fill(1, a, b);
  const isExempt = (a: number, b: number) => {
    for (let k = a; k < b; k++) if (!exempt[k]) return false;
    return true;
  };
  const tokens = [...s.matchAll(/[\p{L}\d]+|[^\p{L}\d]+/gu)];
  const words = tokens.map((t) => t[0]);
  const isWordy = (w: string) => /[\p{L}\d]/u.test(w);
  const units: Unit[] = [];
  const runs: Unit[][] = [];
  let run: Unit[] = [];
  let sep = "";
  let gapWords = 0;
  let repeat = 1;
  let line = 0;
  let between = "";
  const endRun = () => {
    if (run.length) runs.push(run);
    run = [];
  };
  const addUnit = (digits: string, spelled: boolean, a: number, b: number) => {
    // A new line between numbers in a file starts a new number.
    if (mode === "file" && sep.includes("\n")) endRun();
    if (repeat > 1) digits = digits[0].repeat(repeat) + digits.slice(1);
    repeat = 1;
    const unit: Unit = { digits, start: a, end: b, exempt: isExempt(a, b), sep, gapWords, spelled, line, gap: between };
    units.push(unit);
    run.push(unit);
    sep = "";
    gapWords = 0;
    between = "";
  };

  // Single letters standing for number words ("n z o s f s z z n z") and words that are only sometimes
  // numbers ("ek do teen", "to", "for", "ix") count as digits when there are seven or more number-like words
  // in a row: ordinary text never looks like that.
  const coded = new Map<number, string>();
  if (mode === "chat") {
    let stretch: [number, string][] = [];
    let count = 0;
    const close = () => {
      if (count >= 7) for (const [i, d] of stretch) coded.set(i, d);
      stretch = [];
      count = 0;
    };
    for (let k = 0; k < tokens.length; k++) {
      const w = words[k];
      if (!isWordy(w)) continue;
      const weak = WEAK_WORDS[w] ?? (w.length === 1 && FIRST_LETTERS.has(w) ? CODE_DIGIT : undefined);
      if (chunkDigits(w)) count += 1;
      else if (isLetterCode(w)) coded.set(k, CODE_DIGIT.repeat(w.length));
      else if (weak !== undefined) {
        stretch.push([k, weak]);
        count++;
      } else if (!GLUE.has(w) && !(w in REPEAT)) close();
    }
    close();
  }

  for (let k = 0; k < tokens.length; k++) {
    const tok = words[k];
    const start = tokens[k].index!;
    between += tok;
    if (!isWordy(tok)) {
      sep += tok; // punctuation, spaces and emoji keep a run going
      for (const c of tok) if (c === "\n") line++;
      continue;
    }
    if (mode === "chat" && tok in REPEAT) {
      repeat = REPEAT[tok];
      continue;
    }
    let parsed = mode === "chat" ? chunkDigits(tok) : /\d/.test(tok) && /^[\doli]+$/.test(tok) ? chunkDigits(tok) : null;
    if (!parsed && coded.has(k)) parsed = { digits: coded.get(k)!, spelled: true };
    // "oh"/"o" is a zero only between other numbers.
    if (!parsed && mode === "chat" && (tok === "oh" || tok === "o") && run.length) {
      const next = words.slice(k + 1, k + 5).find(isWordy);
      if (next && (chunkDigits(next) || next === "oh" || next === "o")) parsed = { digits: "0", spelled: true };
    }
    if (parsed) {
      const prev = run[run.length - 1];
      // "twenty five" → 25
      if (prev && parsed.spelled && parsed.digits.length === 1 && TENS.has(words[k - 2] ?? "") && /^[\s-]*$/.test(sep)) {
        prev.digits = prev.digits.slice(0, -1) + parsed.digits;
        prev.end = start + tok.length;
        sep = "";
        continue;
      }
      between = between.slice(0, -tok.length);
      addUnit(parsed.digits, parsed.spelled, start, start + tok.length);
      continue;
    }
    const pieces = /\d/.test(tok) ? mixedPieces(tok, start) : null;
    if (pieces) {
      between = between.slice(0, -tok.length);
      for (const p of pieces) {
        sep += p.sep;
        addUnit(p.digits, false, p.start, p.end);
      }
      continue;
    }
    if (mode === "chat" && run.length && GLUE.has(tok)) {
      sep += ` ${tok} `;
      continue;
    }
    // An ordinary word ends the run.
    endRun();
    sep = "";
    gapWords++;
    repeat = 1;
  }
  endRun();

  const spans: [number, number][] = [];
  for (const r of runs) if (runIsPhone(r, mode)) spans.push([r[0].start, r[r.length - 1].end]);

  // Groups split by unrelated words: "917 apple 555 banana 0123".
  const live = units.filter((u) => !u.exempt && !isYear(u.digits));
  for (let a = 0; a < live.length; a++) {
    for (const shape of CROSS_WORD_SHAPES) {
      const group = live.slice(a, a + shape.length);
      if (
        group.length === shape.length &&
        shape.every((n, k) => group[k].digits.length === n) &&
        group.slice(1).every((u) => u.gapWords <= 3 && (mode === "chat" || u.line === group[0].line))
      ) {
        spans.push([group[0].start, group[group.length - 1].end]);
      }
    }
  }

  // Digits spread out with filler words: "9 hi 1 hi 7 hi 5 hi 5 …". A labelled list ("math 4, reading 3,
  // art 5 …": commas and different words) and counting up are fine.
  if (mode === "chat") {
    let chain: Unit[] = [];
    const flush = () => {
      const singles = chain.filter((u) => u.digits.length === 1).length;
      const total = sum(chain);
      const values = chain.map((u) => Number(u.digits));
      const counting = values.every((v, k) => k === 0 || v >= values[k - 1]);
      const fillers = chain.slice(1).map((u) => u.gap.replace(/[^\p{L}]+/gu, " ").trim()).filter(Boolean);
      const labelled = chain.slice(1).every((u) => /[,;\n]/.test(u.gap)) && new Set(fillers).size === fillers.length;
      if ((singles >= 9 || (total >= 10 && chain.length >= 5)) && chain.slice(1).some((u) => u.gapWords > 0) && !counting && !labelled) {
        spans.push([chain[0].start, chain[chain.length - 1].end]);
      }
      chain = [];
    };
    for (const u of live) {
      if (chain.length && (u.gapWords > 2 || u.digits.length > 2)) flush();
      if (u.digits.length <= 2) chain.push(u);
    }
    flush();
  }

  // "Call me … 9 1 7 …": 7+ digits shortly after asking to be called or texted.
  INTENT.lastIndex = 0;
  for (let m = INTENT.exec(s); m; m = INTENT.exec(s)) {
    const from = m.index + m[0].length;
    const near = units.filter((u) => u.start >= from && u.start <= from + 80 && !u.exempt);
    if (sum(near) >= 7) spans.push([near[0].start, near[near.length - 1].end]);
  }
  return spans;
}

/* ─── 4. Email addresses ──────────────────────────────────────────────────────── */

/** Undoes "(at)", "[dot]", " at gmail", "gmail . com" and the like. */
function unmaskEmail(v: View): View {
  let e = v;
  // Provider names split up: "g mail", "hot-mail", "out look", "ya hoo", "i cloud", "proton mail".
  e = replaceIn(e, /\bg(?:ee)?[\s._-]+m[a4@][i1l]l\b|\bhot[\s._-]+m[a4@][i1l]l\b|\bout[\s._-]+look\b|\bya[\s._-]+hoo\b|\bi[\s._-]+cloud\b|\bproton[\s._-]+m[a4@][i1l]l\b|\by[\s._-]+m[a4@][i1l]l\b/g, (m) => m[0].replace(/[\s._-]+/g, "").replace(/^gee/, "g"));
  // "gmaildotcom", "gmail dot co dot uk"
  e = replaceIn(e, new RegExp(`(${PROVIDER})\\s*dot\\s*(?=(?:com|net|co|org|in|uk|us)\\b)`, "g"), (m) => `${m[1]}.`);
  e = replaceIn(e, /\s*[([{<]\s*(?:at|@)\s*[)\]}>]\s*/g, "@");
  e = replaceIn(e, /\s*[([{<]\s*(?:dot|\.)\s*[)\]}>]\s*/g, ".");
  e = replaceIn(e, /\s+(?:at the rate(?: of)?|atrate|at sign|at symbol)\s+/g, "@");
  e = replaceIn(e, new RegExp(`\\s+(?:dot|period|point)\\s+(?=${TLD_SPACED}\\b)`, "g"), ".");
  e = replaceIn(e, new RegExp(`\\s*\\.\\s+(?=${TLD_SPACED}\\b)|\\s+\\.\\s*(?=${TLD_SPACED}\\b)`, "g"), ".");
  e = replaceIn(e, new RegExp(`(?<=[a-z0-9])\\s+(?:at|@)\\s+(?=${PROVIDER}|[a-z0-9-]+\\.${TLD_SPACED}\\b)`, "g"), "@");
  // Other symbols used for @: "john#gmail.com", "john(a)gmail.com", "john & gmail"
  e = replaceIn(e, new RegExp(`(?<=[a-z0-9])\\s*(?:[#&%*~^]|\\(a\\)|\\[a\\]|\\{a\\})\\s*(?=${PROVIDER}|[a-z0-9-]+\\.${TLD_SPACED}\\b)`, "g"), "@");
  e = replaceIn(e, new RegExp(`(?<=[a-z0-9])\\s*@\\s+(?=[a-z])|(?<=[a-z0-9])\\s+@\\s*(?=${PROVIDER}\\b|[a-z0-9-]+\\.[a-z]{2,}\\b)`, "g"), "@");
  // After an @domain any "dot" is a dot: "john@school dot in", "@gmail dot co dot uk".
  e = replaceIn(e, /@[a-z0-9-]+(?:(?:\s*(?:\bdot\b|\(dot\)|\[dot\])\s*|\s\.\s?|\.)[a-z][a-z0-9-]+)+/g, (m) => m[0].replace(/\s*(?:\bdot\b|\(dot\)|\[dot\])\s*|\s\.\s?/g, "."));
  return e;
}

/** Spelled-out web addresses: "t dot me slash jane", "wa dot me". */
function unmaskLinks(v: View): View {
  let e = replaceIn(v, /\s*(?:\bdot\b|\(dot\)|\[dot\]|\[\.\])\s*(?=[a-z])/g, ".");
  e = replaceIn(e, /\s*(?:\bslash\b|\(slash\))\s*/g, "/");
  return e;
}

const EMAIL = /(?<![a-z0-9._%+-])[a-z0-9][a-z0-9._%+-]*@([a-z][a-z0-9-]*)((?:\.[a-z0-9-]+)*)/g;
const EMAIL_EXTRA = [
  // johnATgmailDOTcom
  new RegExp(`(?<![a-z0-9._-])[a-z0-9._-]{2,}at${PROVIDER}(?:dot|\\.)?(?:com|net|co)?\\b`, "g"),
  // jsmith99 on gmail, john.doe gmail
  new RegExp(`(?<![a-z0-9._-])(?=[a-z0-9._-]*[0-9_.])[a-z0-9._-]+\\s*(?:on|at|in|-|:)?\\s*${PROVIDER}\\b`, "g"),
  // gmail: jsmith99, my gmail id is john.doe
  new RegExp(`\\b${PROVIDER}\\b(?:\\s*(?:\\bid\\b|\\baddress\\b|\\bis\\b|[:=-]))*\\s*(?=[a-z0-9._-]*[0-9._])[a-z0-9._-]+`, "g"),
  // john doe gmail com
  new RegExp(`(?<![a-z0-9._-])[a-z0-9._-]{3,}\\s+${PROVIDER}\\s+(?:com|net|co)\\b`, "g"),
];

function findEmails(views: View[]): [number, number][] {
  const [v, ...rebuilt] = views;
  // Written normally, "john@school" counts; a rebuilt one needs a real ending or a known provider.
  const spans = rangesOf(v, EMAIL);
  for (const w of rebuilt) spans.push(...rangesOf(w, EMAIL, (m) => /\.[a-z]{2,}/.test(m[2]) || PROVIDER_ONLY.test(m[1])));
  for (const re of EMAIL_EXTRA) spans.push(...rangesOf(v, re));
  return spans;
}

/* ─── 5. Other apps, handles and links ────────────────────────────────────────── */

function findSocial(views: View[], mode: ScanMode): [number, number][] {
  const spans: [number, number][] = [];
  for (const w of views) {
    spans.push(...rangesOf(w, CONTACT_LINK));
    spans.push(...rangesOf(w, /(?<![a-z0-9._%+-])@[a-z_][a-z0-9_.]{2,}/g)); // @handles
    spans.push(...rangesOf(w, new RegExp(`\\b${SHORT_APPS}\\b(?:\\s*(?:\\bid\\b|\\bis\\b|[:@=-]))+\\s*@?[a-z0-9_.]{3,}`, "g"))); // ig: jane_doe
    // "snap jordan_99": an app name right before a handle with a digit or underscore
    spans.push(...rangesOf(w, new RegExp(`\\b${SHORT_APPS}\\b\\s+@?(?=[a-z0-9_.]*[a-z])(?=[a-z0-9_.]*[0-9_])[a-z0-9_.]{4,}`, "g")));
    spans.push(...rangesOf(w, new RegExp(`\\b(?:add|follow|text|msg|message|dm|ping|find|reach|contact|hmu|hit)\\s+(?:me|us)\\s+(?:up\\s+)?(?:on|at|via|in)\\s+${SHORT_APPS}\\b`, "g")));
    if (mode === "chat") {
      spans.push(...rangesOf(w, new RegExp(`\\b(?:my|on|via)\\s+${MY_APPS}\\b(?!\\s+(?:of|to|the)\\b)`, "g")));
      for (const re of APP_NAMES) spans.push(...rangesOf(w, re));
    } else {
      // In a file, an app name only counts next to a handle or a number.
      for (const re of APP_NAMES) {
        spans.push(...rangesOf(w, re, (m) => /^\s*(?:(?:id|is|[:@=-])\s*)*[@+(]?[a-z0-9_.]*\d|^\s*[:@-]\s*@?[a-z0-9_.]{3,}/.test(w.s.slice(m.index + m[0].length, m.index + m[0].length + 40))));
      }
    }
  }
  return spans;
}

/* ─── 6. Public API ───────────────────────────────────────────────────────────── */

/** Base64 text that decodes to readable text ("am9obkBnbWFpbC5jb20=" → "john@gmail.com"), else null. */
function decodeBase64(token: string): string | null {
  if (!/[A-Z]/.test(token) || !/[a-z]/.test(token) || typeof atob !== "function") return null;
  try {
    const clean = token.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const text = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, "="));
    return /^[\x20-\x7e\t\r\n]{6,}$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

/** Hex text that decodes to readable text ("6a6f686e40…" → "john@…"), else null. */
function decodeHex(token: string): string | null {
  if (!/[a-f]/i.test(token)) return null;
  const text = token.replace(/../g, (h) => String.fromCharCode(parseInt(h, 16)));
  return /^[\x20-\x7e\t\r\n]{6,}$/.test(text) ? text : null;
}

function scanCore(text: string, mode: ScanMode, depth: number): ContactScan {
  if (!text || !text.trim()) return { found: false, kinds: [], matches: [] };
  const v = normalize(text.length > 200_000 ? text.slice(0, 200_000) : text);
  const unmasked = unmaskEmail(v);
  const rebuilt = [unmasked, joinSpacedLetters(unmasked), unmaskEmail(joinSpacedLetters(v))];
  const matches: ContactMatch[] = [];
  const add = (kind: ContactKind, spans: [number, number][]) => {
    for (const [start, end] of spans) if (end > start) matches.push({ kind, start, end });
  };
  const phonesIn = (w: View) => findPhones(w, mode).map(([a, b]) => [w.from[a], w.to[Math.max(a, b - 1)]] as [number, number]);
  add("email", findEmails([v, ...rebuilt]));
  add("phone", phonesIn(v));
  add("social", findSocial([v, rebuilt[2], unmaskLinks(unmasked)], mode));
  if (mode === "chat") {
    // Number words typed one letter at a time: "n i n e o n e s e v e n …"
    add("phone", phonesIn(replaceIn(v, /(?<!\S)\p{L}(?:[ \t]+\p{L}(?!\S)){3,}/gu, (m) => m[0].replace(/[ \t]+/g, ""))));
    if (depth === 0) {
      // Encoded: base64 or hex that decodes to contact details.
      for (const m of text.matchAll(/[A-Za-z0-9+/_-]{12,}={0,2}|(?:[0-9a-fA-F]{2}){6,}/g)) {
        const decoded = decodeBase64(m[0]) ?? (/^[0-9a-fA-F]+$/.test(m[0]) && m[0].length % 2 === 0 ? decodeHex(m[0]) : null);
        const inner = decoded ? scanCore(decoded, "chat", depth + 1) : null;
        for (const kind of inner?.kinds ?? []) matches.push({ kind, start: m.index!, end: m.index! + m[0].length });
      }
      // Written backwards: "moc.liamg@nhoj", "moc tod liamg ta nhoj".
      const reversed = scanCore(Array.from(text).reverse().join(""), "chat", depth + 1);
      for (const kind of reversed.kinds) if (kind !== "phone" && !matches.some((m) => m.kind === kind)) matches.push({ kind, start: 0, end: text.length });
    }
  }
  matches.sort((x, y) => x.start - y.start || y.end - x.end);
  return { found: matches.length > 0, kinds: [...new Set(matches.map((m) => m.kind))], matches };
}

/** Looks for phone numbers, email addresses and other-app contact details in `text`. */
export function scanContact(text: string, mode: ScanMode = "chat"): ContactScan {
  return scanCore(text, mode, 0);
}

const MASK: Record<ContactKind, string> = { phone: "[phone number hidden]", email: "[email hidden]", social: "[contact details hidden]" };

/** The text with every match replaced by a label (overlapping matches are merged). */
export function maskMatches(text: string, matches: ContactMatch[], label?: string): string {
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  let out = "";
  let at = 0;
  for (let k = 0; k < sorted.length; k++) {
    let end = sorted[k].end;
    if (end <= at) continue;
    const start = Math.max(sorted[k].start, at);
    const kind = sorted[k].kind;
    while (k + 1 < sorted.length && sorted[k + 1].start < end) end = Math.max(end, sorted[++k].end);
    out += text.slice(at, start) + (label ?? MASK[kind]);
    at = end;
  }
  return out + text.slice(at);
}

const KIND_LABEL: Record<ContactKind, string> = { phone: "a phone number", email: "an email address", social: "a social media, messaging or payment app contact" };

/** "a phone number and an email address" */
export function describeKinds(kinds: ContactKind[]): string {
  const parts = kinds.map((k) => KIND_LABEL[k]);
  return parts.length <= 1 ? (parts[0] ?? "contact details") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** A short excerpt for the moderation log, with the contact details themselves removed. */
export function redactedExcerpt(text: string, matches: ContactMatch[], max = 300): string {
  const masked = maskMatches(text, matches).replace(/\s+/g, " ").trim();
  return masked.length > max ? `${masked.slice(0, max - 1)}…` : masked;
}

/** The message shown when something is blocked. */
export function blockedMessage(kinds: ContactKind[], where: "message" | "file" | "note" | "split" = "message"): string {
  if (where === "split") {
    return `Your message wasn't sent because, together with your last messages, it looks like ${describeKinds(kinds)} sent a few pieces at a time. Those earlier pieces have been hidden too. To keep everyone safe, contact details can't be shared on TutorLink. If these were answers or scores, send them together in one message with a few words.`;
  }
  const what = where === "file" ? "This file" : where === "note" ? "This note" : "Your message";
  const fix = where === "file" ? "Remove or cover those details and attach it again." : "Edit it and send again.";
  return `${what} wasn't sent because it looks like it includes ${describeKinds(kinds)}. To keep everyone safe, phone numbers, email addresses and social media or messaging app details can't be shared on TutorLink. ${fix}`;
}

/** Shown when a name (account, child) includes contact details. */
export const NAME_RULE = "Names can't include phone numbers, email addresses or social media handles. Use just your name.";

/** Whether any of these short texts (names, titles) has contact details. */
export function contactIn(...texts: (string | undefined | null)[]): ContactScan {
  return scanContact(texts.filter((t): t is string => !!t && !!t.trim()).join("\n"), "chat");
}

/**
 * Contact details in a file name ("917-555-0123.pdf", "jane@gmail.com.docx"). Camera and screenshot time
 * stamps ("IMG_20261103_143512", "Screenshot 2026-11-03 at 14.35.12") and app names ("WhatsApp Image") are ignored.
 */
export function fileNameContact(name: string): ContactScan {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  const blank = (m: string) => " ".repeat(m.length);
  const cleaned = base
    .replace(/_+/g, (m) => " ".repeat(m.length))
    .replace(/(?:19|20)\d{2}[-.\s]?(?:0[1-9]|1[0-2])[-.\s]?(?:0[1-9]|[12]\d|3[01])(?:[-.\sT]*(?:at\s*)?[0-2]\d[-.:h\s]?[0-5]\d(?:[-.:m\s]?[0-5]\d)?(?:[-.\s]?\d{1,3})?)?/gi, blank)
    .replace(/(?<![+\d])\d{13}(?!\d)/g, blank);
  const matches = scanContact(cleaned, "file").matches.filter((m) => m.kind !== "social");
  return { found: matches.length > 0, kinds: [...new Set(matches.map((m) => m.kind))], matches };
}

/* ─── 7. Numbers sent a piece at a time ───────────────────────────────────────── */

/**
 * If a short message is only a piece of a number ("9", "917", "nine", "n z", "- 0123"), how many digits it
 * adds. Dates, times and prices don't count. Null for anything else ("ok", "see you at 5").
 */
export function numberPiece(text: string): { digits: number } | null {
  if (!text.trim() || text.length > 40) return null;
  const v = normalize(text);
  const exempt = new Uint8Array(v.s.length + 1);
  for (const [a, b] of exemptSpans(v.s)) exempt.fill(1, a, b);
  let digits = 0;
  let any = false;
  for (const t of v.s.matchAll(/[\p{L}\d]+|[^\p{L}\d]+/gu)) {
    const w = t[0];
    if (!/[\p{L}\d]/u.test(w)) continue;
    if ((w.length === 1 && FIRST_LETTERS.has(w)) || w === "oh") {
      digits += 1;
      any = true;
      continue;
    }
    const d = chunkDigits(w) ?? (isLetterCode(w) ? { digits: CODE_DIGIT.repeat(w.length) } : null);
    if (d) {
      any = true;
      if (!exempt[t.index!]) digits += d.digits.length;
      continue;
    }
    if (GLUE.has(w) || w in REPEAT) continue;
    return null;
  }
  return any ? { digits } : null;
}

/**
 * Contact details split across one person's recent messages: "9", "1", "7" … or "my number is 917" then
 * "555 0123". `previous` are that person's latest messages in the conversation, oldest first, with no
 * reply from the other side in between. `pieces` are the indexes of earlier messages that are part of it.
 */
export function scanSplitMessages(previous: string[], next: string): { found: boolean; kinds: ContactKind[]; pieces: number[] } {
  const none = { found: false, kinds: [] as ContactKind[], pieces: [] as number[] };
  if (!previous.length) return none;
  // Pieces of a number in a row: five digits between them is already too many.
  const last = numberPiece(next);
  if (last) {
    let digits = last.digits;
    const pieces: number[] = [];
    for (let i = previous.length - 1; i >= 0; i--) {
      const p = numberPiece(previous[i]);
      if (!p) break;
      digits += p.digits;
      pieces.unshift(i);
    }
    if (pieces.length && digits >= 5) return { found: true, kinds: ["phone"], pieces };
  }
  // The messages read together.
  const parts = [...previous, next];
  const starts: number[] = [];
  let at = 0;
  for (const part of parts) {
    starts.push(at);
    at += part.length + 1;
  }
  const scan = scanContact(parts.join("\n"), "chat");
  const nextStart = starts[parts.length - 1];
  const hits = scan.matches.filter((m) => m.end > nextStart);
  if (!hits.length) return none;
  const pieces = previous.map((_, i) => i).filter((i) => hits.some((m) => m.start < starts[i] + previous[i].length && m.end > starts[i]));
  return { found: true, kinds: [...new Set(hits.map((m) => m.kind))], pieces };
}
