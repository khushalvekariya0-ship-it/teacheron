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

/** `request`: asking to talk, meet or pay outside TutorLink ("send me your number", "બહાર વાત કરીએ"). */
export type ContactKind = "phone" | "email" | "social" | "link" | "request";
export type ScanMode = "chat" | "file";

/**
 * Rules staff can change (Admin → Chat safety → Settings). They're the same for everyone, so they're kept
 * here once (the server sets them from the database, the browser from the page data).
 */
export interface ContactRules {
  /** Typed text is checked (messages, homework, notes, names). Speech has its own switch (in the class). */
  chat: boolean;
  /** "strict": any mention of WhatsApp, Instagram … in a message counts. "normal": only next to a handle or number, or in a request. */
  sensitivity: "normal" | "strict";
  /** Catch requests to talk, meet or pay outside TutorLink in messages and speech. */
  requests: boolean;
  /** Extra phrases that count as such a request (any language), and phrases that never count. */
  block: string[];
  allow: string[];
  /** How far back one person's short messages are read together for a number sent in pieces (minutes). */
  splitWindowMinutes: number;
}
const cleanPhrase = (p: string) => p.toLowerCase().replace(/\s+/g, " ").trim();
let RULES: ContactRules = { chat: true, sensitivity: "normal", requests: true, block: [], allow: [], splitWindowMinutes: 30 };
export function setContactRules(rules: Partial<ContactRules>) {
  RULES = {
    chat: rules.chat ?? RULES.chat,
    sensitivity: rules.sensitivity === "strict" ? "strict" : rules.sensitivity === "normal" ? "normal" : RULES.sensitivity,
    requests: rules.requests ?? RULES.requests,
    block: (rules.block ?? RULES.block).map(cleanPhrase).filter((p) => p.length >= 3),
    allow: (rules.allow ?? RULES.allow).map(cleanPhrase).filter((p) => p.length >= 3),
    splitWindowMinutes: Math.min(240, Math.max(5, Math.round(rules.splitWindowMinutes ?? RULES.splitWindowMinutes))),
  };
}
export const contactRules = (): ContactRules => RULES;

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
  // Spelled the way they sound ("nain eit sevan siks faiv …")
  nain: "9", nayn: "9", naine: "9", nyn: "9", eit: "8", eyt: "8", siks: "6", sikks: "6", sicks: "6", faiv: "5", fayv: "5", faive: "5",
  thri: "3", threee: "3", sevun: "7", seben: "7", fower: "4", foar: "4", zeero: "0", ziro: "0", zirro: "0", jero: "0",
};

/**
 * Words that are only numbers when there are seven or more number-like words in a row (on their own they're
 * ordinary words: "to", "for", "do", "be", "sat" …). Covers sound-alikes, other languages, Hindi and Gujarati
 * (written in English letters or in their own script, vowel signs removed) and Roman numerals.
 */
const WEAK_WORDS: Record<string, string> = {
  won: "1", wan: "1", to: "2", too: "2", tu: "2", tree: "3", tri: "3", for: "4", fore: "4", foor: "4", ate: "8", ait: "8", nil: "0", naught: "0", nought: "0", oh: "0",
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
// Links that can hide contact details out of sight: shared documents and forms, file sharing, paste sites,
// one-page "link in bio" sites and link shorteners (which hide where they go). Learning links (YouTube,
// Khan Academy, Wikipedia, Desmos…) stay allowed; documents can be attached instead, and attachments are read.
const OUTSIDE_LINK =
  /(?<![a-z0-9.-])(?:https?:\/\/)?(?:www\.)?(?:docs\.google\.com|drive\.google\.com|sites\.google\.com|forms\.gle|forms\.google\.com|goo\.gl|bit\.ly|tinyurl\.com|t\.co|ow\.ly|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|tiny\.cc|rb\.gy|s\.id|bl\.ink|lnkd\.in|dropbox\.com|db\.tt|1drv\.ms|onedrive\.live\.com|[a-z0-9-]+\.sharepoint\.com|(?:app\.)?box\.com|wetransfer\.com|we\.tl|mega\.nz|mediafire\.com|notion\.so|[a-z0-9-]+\.notion\.site|airtable\.com|(?:[a-z0-9-]+\.)?typeform\.com|(?:form\.)?jotform\.com|pastebin\.com|rentry\.co|justpaste\.it|paste\.ee|controlc\.com|privatebin\.net|hastebin\.com|(?:[a-z0-9-]+\.)?carrd\.co|about\.me|bio\.link)\/[^\s]{2,}/g;
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
  const add = (re: RegExp, keep?: (m: RegExpExecArray) => boolean) => {
    re.lastIndex = 0;
    for (let m = re.exec(s); m; m = re.exec(s)) if (m[0] && (!keep || keep(m))) out.push([m.index, m.index + m[0].length]);
  };
  // A long decimal (3.14159265358979) is an answer, unless its digits are really a mobile number.
  add(/(?<![\d.])\d{1,3}\.\d{7,30}(?![\d.])/g, (m) => !mobileLike(m[0].replace(/\D/g, "")));
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
/** An Indian mobile number: 10 digits starting 6–9, maybe after 91, 0091 or 0. */
export const mobileLike = (d: string) => /^(?:0091|91|0)?[6-9]\d{9}$/.test(d);
/**
 * Numbers a lesson labels (roll no, registration, page, question, answer, total, population, PNR, train …).
 * They're allowed unless the digits are a mobile number: a label can't excuse one.
 */
const SCHOOL_LABEL =
  /\b(?:roll|reg(?:istration)?|enrol+(?:ment)?|admission|student id|answer|ans|result|value|total|sum|product|difference|population|area|volume|perimeter|marks?|score|page|pages|question|questions|chapter|exercise|isbn|pin ?code|postal code|zip|pnr|train|flight|invoice|order|ticket|seat|year|amount|price|cost|salary|rs|rupees|inr)\b[\s.:#=-]*(?:(?:no|number|num|is|was|of|code)\b[\s.:#=-]*){0,3}$/;
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
  const joined = live.map((u) => u.digits).join("");
  // Sums and equations (12345 + 67890 = 80235, 98 × 76): maths, unless the numbers before the "=" (or all of
  // them, "9*8*7*6*5*4*3*2*1*0") are a mobile number written as a sum.
  if (units.slice(1).some((u) => /[=×÷*^]/.test(u.sep))) {
    const eq = units.findIndex((u, k) => k > 0 && u.sep.includes("="));
    const before = (eq > 0 ? units.slice(0, eq) : units).filter((u) => !u.exempt).map((u) => u.digits).join("");
    return mobileLike(before) || mobileLike(joined);
  }
  // A labelled school number (roll no 2104567890, page 345, PNR 4512345678) that isn't a mobile number.
  if (SCHOOL_LABEL.test(units[0].gap.slice(-40)) && !mobileLike(joined) && !/\+/.test(units[0].sep)) return false;
  // A round number (1400000000) or one starting with 1 (no phone number's ten digits do) isn't a phone number.
  if (live.length === 1 && (/0{5,}$/.test(joined) || (joined.length === 10 && joined[0] === "1"))) return false;
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
/** The phonetic alphabet: "juliet oscar hotel november" → "john". */
const NATO: Record<string, string> = {
  alpha: "a", alfa: "a", bravo: "b", charlie: "c", delta: "d", echo: "e", foxtrot: "f", golf: "g", hotel: "h", india: "i", juliet: "j", juliett: "j",
  kilo: "k", lima: "l", mike: "m", november: "n", oscar: "o", papa: "p", quebec: "q", romeo: "r", sierra: "s", tango: "t", uniform: "u",
  victor: "v", whiskey: "w", whisky: "w", xray: "x", yankee: "y", zulu: "z",
};
const NATO_WORD = `(?:${Object.keys(NATO).join("|")})`;
function unNato(v: View): View {
  return replaceIn(v, new RegExp(`\\b${NATO_WORD}(?:[\\s,.-]+${NATO_WORD}){2,}\\b`, "g"), (m) => m[0].split(/[\s,.-]+/).map((w) => NATO[w] ?? "").join(""));
}

/** ROT13 ("wbua ng tznvy" → "john at gmail"). */
const rot13 = (t: string) => t.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26) + (c >= "a" ? 97 : 65)));

function unmaskEmail(v: View): View {
  let e = v;
  // "gmail", "at", "dot com" written in Hindi or Gujarati (vowel signs are already removed): જીમેલ, एट, डॉट कॉम
  e = replaceIn(e, /जमल|જમલ/g, "gmail");
  e = replaceIn(e, /(?:डट|ડટ)\s*(?:कम|કમ)/g, " dot com");
  e = replaceIn(e, /(?<!\S)(?:एट|એટ)(?!\S)/g, "at");
  e = replaceIn(e, /(?<!\S)(?:डट|ડટ)(?!\S)/g, "dot");
  // Provider names with their letters split up: "g mail", "gm ail", "g.m.a.i.l", "h o t m a i l", "out look", "ya hoo"
  e = replaceIn(e, /\bg(?:ee)?[\s._-]*m[\s._-]*[a4@][\s._-]*[i1l][\s._-]*l\b/g, "gmail");
  e = replaceIn(e, /\by[\s._-]*[a4@][\s._-]*h[\s._-]*[o0][\s._-]*[o0]\b/g, "yahoo");
  e = replaceIn(e, /\bh[\s._-]*[o0][\s._-]*t[\s._-]*m[\s._-]*[a4@][\s._-]*[i1l][\s._-]*l\b/g, "hotmail");
  e = replaceIn(e, /\b[o0][\s._-]*u[\s._-]*t[\s._-]*l[\s._-]*[o0][\s._-]*[o0][\s._-]*k\b/g, "outlook");
  e = replaceIn(e, /\b[i1][\s._-]*c[\s._-]*l[\s._-]*[o0][\s._-]*u[\s._-]*d\b/g, "icloud");
  e = replaceIn(e, /\bproton[\s._-]*m[\s._-]*[a4@][\s._-]*[i1l][\s._-]*l\b/g, "protonmail");
  // "john underscore smith"
  e = replaceIn(e, /(?<=[a-z0-9])\s+under\s?score\s+(?=[a-z0-9])/g, "_");
  // "john-at-gmail-dot-com", "john_at_gmail", "john 4t gmail", "gmail d0t com"
  e = replaceIn(e, new RegExp(`(?<=[a-z0-9])[\\s_-]*[-_][\\s_-]*(?:at|@t|4t)[\\s_-]*[-_]?[\\s_-]*(?=${PROVIDER})|(?<=[a-z0-9])\\s+(?:@t|4t)\\s+(?=${PROVIDER}|[a-z0-9-]+\\.${TLD_SPACED}\\b)`, "g"), "@");
  e = replaceIn(e, new RegExp(`(${PROVIDER})[\\s_-]*[-_][\\s_-]*(?:dot|d0t)[\\s_-]*[-_]?[\\s_-]*(?=(?:com|net|co|org|in|uk|us)\\b)|(${PROVIDER})\\s+d0t\\s+(?=(?:com|net|co|org|in|uk|us)\\b)`, "g"), (m) => `${m[1] ?? m[2]}.`);
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
  // my gmail is johnsmith, gmail id: johnsmith (but not "gmail is down")
  new RegExp(`\\b${PROVIDER}\\b\\s*(?:\\b(?:id|address|account|username)\\b\\s*)?(?:\\bis\\b|[:=])\\s*(?!(?:not|down|broken|working|full|blocked|fine|ok|okay|the|this|that|same|new|old|private|hidden|below|above|here|there|slow|open|closed|best|better|easier|easy|free|good|great|safer|faster)\\b)[a-z][a-z0-9._-]{2,}`, "g"),
  // johnsmith1990 is my gmail
  new RegExp(`(?<![a-z0-9._-])(?=[a-z0-9._-]*[0-9._])[a-z0-9._-]{3,}\\s+(?:is\\s+)?(?:my\\s+)?${PROVIDER}\\b`, "g"),
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
    if (mode === "chat") spans.push(...rangesOf(w, new RegExp(`\\b(?:my|on|via)\\s+${MY_APPS}\\b(?!\\s+(?:of|to|the)\\b)`, "g")));
    if (mode === "chat" && RULES.sensitivity === "strict") {
      for (const re of APP_NAMES) spans.push(...rangesOf(w, re));
    } else {
      // An app name only counts next to a handle or a number ("WhatsApp was bought by Facebook" is a
      // lesson); asking to talk there is caught as a request (findRequests).
      for (const re of APP_NAMES) {
        spans.push(...rangesOf(w, re, (m) => /^\s*(?:(?:id|is|[:@=-])\s*)*[@+(]?[a-z0-9_.]*\d|^\s*[:@-]\s*@?[a-z0-9_.]{3,}/.test(w.s.slice(m.index + m[0].length, m.index + m[0].length + 40))));
      }
    }
  }
  return spans;
}

/* ─── 5b. Asking to talk, meet or pay outside TutorLink ────────────────────────── */

// English (and Gujarati / Hindi typed in English letters), read on the normalised text.
const REACH = "(?:whats ?app|wa|insta(?:gram)?|ig|snap(?:chat)?|telegram|tg|signal|facebook|fb|messenger|discord|skype|imo|zoom|google meet|g ?meet)";
const ASK_FOR = "(?:number|no|num|phone(?: number)?|mobile(?: number)?|cell|contact(?: number| details)?|contacts|email(?: id| address)?|e-mail|mail id|gmail|id|handle|whats ?app(?: number)?|wa|insta(?:gram)?|ig|snap(?:chat)?|telegram|tg|upi(?: id)?)";
const REQUEST_LATIN: RegExp[] = [
  // "send me your number", "give me ur whatsapp", "can I get your email"
  new RegExp(`\\b(?:send|give|share|tell|text|dm|drop|pass|forward|get|need|want)\\s+(?:me\\s+|us\\s+)?(?:your|ur|yr|ya|ure)\\s+(?:personal\\s+|private\\s+|real\\s+|own\\s+)?${ASK_FOR}\\b`, "g"),
  new RegExp(`\\bwhat(?:s|\\s+is)\\s+(?:your|ur)\\s+(?:personal\\s+|private\\s+)?${ASK_FOR}\\b`, "g"),
  new RegExp(`\\b(?:do|are)\\s+(?:you|u)\\s+(?:have|use|on)\\s+${REACH}\\b`, "g"),
  // "call me after class", "email me directly", "contact me personally"
  /\b(?:call|ring|phone|text|whats ?app|wa|dm|message|msg|ping|email|e-mail|mail|contact|reach|meet)\s+(?:me|us)\s+(?:directly|personally|privately|outside|offline|on\s+(?:my\s+)?(?:personal\s+)?(?:number|phone|mobile|cell|email|gmail))\b/g,
  // "call me after class" (a message after class can be here on TutorLink, so not "message me after class")
  /\b(?:call|ring|phone|whats ?app|wa|email|e-mail|meet|contact)\s+(?:me|us)\s+(?:later\s+)?after\s+(?:the\s+)?(?:class|lesson|session|tuition)\b/g,
  // "let's talk on WhatsApp", "we can chat over Telegram", "continue on insta"
  new RegExp(`\\b(?:talk|chat|connect|speak|call|text|message|msg|continue|meet|contact)\\b[^.!?\\n]{0,15}\\b(?:on|over|via)\\s+(?:the\\s+)?${REACH}\\b`, "g"),
  new RegExp(`\\b(?:send|share|forward)\\s+(?:you|it|them)\\b[^.!?\\n]{0,25}\\b(?:on|over|via)\\s+(?:whats ?app|wa|insta(?:gram)?|telegram|snap(?:chat)?|email|gmail)\\b`, "g"),
  // "follow me on Instagram", "find me on snap", "join my personal telegram"
  new RegExp(`\\b(?:follow|add|find|dm|join|subscribe(?:\\s+to)?)\\s+(?:me|us|my)\\b[^.!?\\n]{0,20}\\b${REACH}\\b`, "g"),
  // "outside TutorLink", "off the app"
  /\b(?:outside|off)\s+(?:of\s+)?(?:tutor ?link|this\s+(?:app|site|platform|website)|the\s+(?:app|site|platform|website))\b/g,
  // "pay me directly", "pay on gpay", "my upi id"
  /\bpay\s+(?:me\s+|us\s+)?(?:directly|outside|in\s+cash|by\s+cash|cash|on\s+(?:g ?pay|google\s+pay|paytm|phone ?pe|upi|bhim)|via\s+(?:g ?pay|google\s+pay|paytm|phone ?pe|upi|bhim))\b/g,
  /\b(?:my|mera|maro)\s+(?:upi|gpay|g pay|paytm|phone ?pe)(?:\s+(?:id|number|no))?\b/g,
  // Gujarati / Hindi in English letters: "maro number lai lo", "tamaro number aapo", "whatsapp karjo", "bahar vaat kariye"
  /\b(?:maro|maru|mero|mera|mere|meri)\s+(?:number|no|num|phone number|mobile number|whats ?app|wa|insta|id|email)\s+(?:lai lo|lai le|lelo|le lo|lo|lakhi lo|likh lo|save (?:karo|kari lo|kar lo)|note (?:karo|kari lo|kar lo))\b/g,
  /\b(?:tamaro|taro|tamaru|taru|apna|aapka|apka|tumhara|tera)\s+(?:number|no|num|whats ?app|wa|insta|id|email)\s+(?:aapo|apo|aapjo|apjo|moklo|mokaljo|do|dena|dijiye|bhejo|bhej do|de do|batao|kaho)\b/g,
  /\b(?:whats ?app|wa|call|phone|miss ?call)\s+(?:karjo|karje|kar dena|kar do|karna|kariye|kijiye|krjo|krna)\b/g,
  /\b(?:class|lesson|tuition|lecture)\s+(?:pachi|pachhi|baad|ke baad|bad)\b[^.!?\n]{0,25}\b(?:call|phone|whats ?app|wa|maliye|malie|milte|milo|malo|baat|vaat)\b/g,
  /\bbahar\s+(?:vaat|vat|baat|maliye|malie|milte|milo|malo|class|tuition)\b/g,
];
// Gujarati and Hindi script, read on the text as typed (normalising drops their vowel signs).
const APP_GU = "(?:વોટ્સએપ|વોટસએપ|વૉટ્સઍપ|વૉટ્સએપ|વોટ્સ એપ|व्हाट्सएप|व्हाट्सऐप|वॉट्सऐप|whats ?app)";
const REQUEST_SCRIPT: RegExp[] = [
  /મારો\s*(?:નંબર|નમ્બર|ફોન\s*નંબર|મોબાઇલ\s*નંબર|વોટ્સએપ|whats ?app)\s*(?:લઈ\s*લો|લઇ\s*લો|લખી\s*લો|નોંધી\s*લો|સેવ\s*કરી\s*લો|લો|લેજો|આપું)/gu,
  /(?:તમારો|તારો|તમારું|તારું|તમારા|તારા)\s*(?:નંબર|નમ્બર|ફોન\s*નંબર|મોબાઇલ\s*નંબર|વોટ્સએપ|whats ?app|ઈમેલ|ઇમેલ|ઇન્સ્ટા|insta)\s*(?:આપો|આપજો|આપ|મોકલો|મોકલજો|મોકલ|આપશો|કહો|શું\s*છે)/gu,
  new RegExp(`${APP_GU}\\s*(?:પર|પે|પણ)?\\s*(?:મેસેજ|વાત|કૉલ|કોલ|ફોન)?\\s*(?:કરજો|કરો|કર|કરીએ|કરશો|કરીશ)`, "gu"),
  /(?:ફોન|કૉલ|કોલ|મિસ\s*કૉલ|મિસ\s*કોલ)\s*(?:કરજો|કરો|કર|કરીશ|કરીશું|કરશો|કરજે)/gu,
  /(?:ક્લાસ|ટ્યુશન|લેક્ચર)\S*\s*(?:પછી|બાદ)[^.!?\n]{0,30}(?:ફોન|કૉલ|કોલ|વોટ્સએપ|whats ?app|મળીએ|મળજો|વાત)/gu,
  /બહાર\s*(?:વાત|મળીએ|મળો|મળજો|મળીશું|ભણાવીશ|ક્લાસ|ટ્યુશન)/gu,
  /(?:ઇન્સ્ટા|ઇન્સ્ટાગ્રામ|insta(?:gram)?)\s*(?:પર)?\s*(?:ફોલો|ફૉલો|follow)/gu,
  /(?:ઈમેલ|ઇમેલ|ઈ-મેલ|ઇ-મેલ|e-?mail|gmail)\s*(?:કરજો|કરો|આપો|મોકલો|આપજો)/gu,
  /(?:જીપે|ગૂગલ\s*પે|પેટીએમ|ફોનપે|g ?pay|paytm|phone ?pe|upi)\s*(?:પર|થી|માં)?\s*(?:પૈસા|ફી|પેમેન્ટ)?\s*(?:આપો|આપજો|મોકલો|મોકલજો|કરો|કરજો)/gu,
  /(?:મેરા|मेरा|मेरे)\s*(?:नंबर|नम्बर|व्हाट्सएप|whats ?app)\s*(?:ले\s*लो|लेलो|लो|लिख\s*लो|सेव\s*कर\s*लो)/gu,
  /(?:अपना|आपका|तुम्हारा|तेरा)\s*(?:नंबर|नम्बर|व्हाट्सएप|whats ?app|ईमेल|इंस्टा)\s*(?:दो|दीजिए|भेजो|भेजिए|बताओ|बताइए)/gu,
  new RegExp(`${APP_GU}\\s*(?:पर|पे)?\\s*(?:मैसेज|बात|कॉल)?\\s*(?:करना|करो|करें|कीजिए|कर\\s*देना)`, "gu"),
  /(?:फोन|फ़ोन|कॉल)\s*(?:करना|करो|करें|कर\s*देना)/gu,
  /बाहर\s*(?:बात|मिलते|मिलो|मिलें)/gu,
];

/** The text as typed (lower case), for patterns in scripts the normaliser would strip. */
function typedView(text: string): View {
  const lower = text.toLowerCase();
  const s = lower.length === text.length ? lower : text;
  const from: number[] = [];
  const to: number[] = [];
  for (let i = 0; i < s.length; i++) {
    from.push(i);
    to.push(i + 1);
  }
  return { s, from, to };
}

/** Spans of `phrases` in the text as typed (staff-added phrases, any language). */
function phraseSpans(typed: string, phrases: string[]): [number, number][] {
  const out: [number, number][] = [];
  const flat = typed.replace(/\s/g, " ");
  for (const p of phrases) for (let at = flat.indexOf(p); at >= 0; at = flat.indexOf(p, at + 1)) out.push([at, at + p.length]);
  return out;
}

function findRequests(v: View, text: string): [number, number][] {
  const typed = typedView(text);
  const spans: [number, number][] = [];
  for (const re of REQUEST_LATIN) spans.push(...rangesOf(v, re));
  for (const re of REQUEST_SCRIPT) spans.push(...rangesOf(typed, re));
  spans.push(...phraseSpans(typed.s, RULES.block));
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
  const spelled = mode === "chat" ? unNato(v) : v;
  const unmasked = unmaskEmail(spelled);
  const rebuilt = [unmasked, joinSpacedLetters(unmasked), unmaskEmail(joinSpacedLetters(spelled))];
  const matches: ContactMatch[] = [];
  const add = (kind: ContactKind, spans: [number, number][]) => {
    for (const [start, end] of spans) if (end > start) matches.push({ kind, start, end });
  };
  const phonesIn = (w: View) => findPhones(w, mode).map(([a, b]) => [w.from[a], w.to[Math.max(a, b - 1)]] as [number, number]);
  add("email", findEmails([v, ...rebuilt]));
  add("phone", phonesIn(v));
  add("social", findSocial([v, rebuilt[2], unmaskLinks(unmasked)], mode));
  for (const w of [v, unmaskLinks(unmasked)]) add("link", rangesOf(w, OUTSIDE_LINK));
  if (mode === "chat" && RULES.requests && depth === 0) add("request", findRequests(v, text));
  // Phrases staff marked as fine ("WhatsApp Business case study") don't count as a request or an app
  // mention; real numbers, emails and handles inside them still do.
  if (RULES.allow.length) {
    const allowed = phraseSpans(typedView(text).s, RULES.allow);
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if ((m.kind === "request" || m.kind === "social") && allowed.some(([a, b]) => m.start >= a && m.end <= b)) matches.splice(i, 1);
    }
  }
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
      // ROT13: "wbua ng tznvy qbg pbz"
      const rotated = scanCore(rot13(text), "chat", depth + 1);
      for (const kind of rotated.kinds) if (kind !== "phone" && !matches.some((m) => m.kind === kind)) matches.push({ kind, start: 0, end: text.length });
    }
  }
  matches.sort((x, y) => x.start - y.start || y.end - x.end);
  return { found: matches.length > 0, kinds: [...new Set(matches.map((m) => m.kind))], matches };
}

/** Looks for phone numbers, email addresses and other-app contact details in `text`. */
export function scanContact(text: string, mode: ScanMode = "chat"): ContactScan {
  if (mode === "chat" && !RULES.chat) return { found: false, kinds: [], matches: [] };
  return scanCore(text, mode, 0);
}

const MASK: Record<ContactKind, string> = { phone: "[phone number hidden]", email: "[email hidden]", social: "[contact details hidden]", link: "[link hidden]", request: "[request to talk outside TutorLink hidden]" };

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

const KIND_LABEL: Record<ContactKind, string> = { phone: "a phone number", email: "an email address", social: "a social media, messaging or payment app contact", link: "a link to an outside document, form or file-sharing page", request: "a request to talk, meet or pay outside TutorLink" };

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
  if (kinds.length > 0 && kinds.every((k) => k === "request")) {
    return `${what} wasn't sent: asking to talk, meet or pay outside TutorLink isn't allowed (WhatsApp, calls, personal email, social media, direct payments). Keep lessons, messages and payments on TutorLink, where both of you are protected. ${fix}`;
  }
  const onlyLink = kinds.length > 0 && kinds.every((k) => k === "link");
  if (onlyLink) {
    return `${what} wasn't sent because it includes ${describeKinds(kinds)}. Those pages can hide contact details, so they can't be shared on TutorLink. ${where === "file" ? fix : "To share a document, attach the file instead: attachments are checked before the other person can open them."}`;
  }
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
  const p = pieceDigits(text);
  return p === null ? null : { digits: p.length };
}

/** The digits a short message adds when it's only a piece of a number ("#" for a letter-coded digit). */
export function pieceDigits(text: string): string | null {
  if (!text.trim() || text.length > 40) return null;
  const v = normalize(text);
  const exempt = new Uint8Array(v.s.length + 1);
  for (const [a, b] of exemptSpans(v.s)) exempt.fill(1, a, b);
  let digits = "";
  let any = false;
  for (const t of v.s.matchAll(/[\p{L}\d]+|[^\p{L}\d]+/gu)) {
    const w = t[0];
    if (!/[\p{L}\d]/u.test(w)) continue;
    if ((w.length === 1 && FIRST_LETTERS.has(w)) || w === "oh") {
      digits += w === "o" || w === "oh" ? "0" : CODE_DIGIT;
      any = true;
      continue;
    }
    const d = chunkDigits(w) ?? (isLetterCode(w) ? { digits: CODE_DIGIT.repeat(w.length) } : null);
    if (d) {
      any = true;
      // A year on its own ("2024") is a date, not part of a number.
      if (!exempt[t.index!] && !isYear(d.digits)) digits += d.digits;
      continue;
    }
    if (GLUE.has(w) || w in REPEAT) continue;
    return null;
  }
  return any ? digits : null;
}

/**
 * A mobile number sent in pieces between the other person's replies ("987" … "ok" … "654" … "3210"):
 * `own` are this person's recent messages in the conversation (oldest first, the other side's left out),
 * `next` the one being sent. Only a real mobile number counts here, so quiz answers sent one by one don't.
 */
export function splitAcrossReplies(own: string[], next: string): { found: boolean; pieces: number[] } {
  const none = { found: false, pieces: [] as number[] };
  const last = pieceDigits(next);
  if (!last) return none;
  let digits = last;
  const pieces: number[] = [];
  for (let i = own.length - 1; i >= 0 && pieces.length < 12 && digits.length < 13; i--) {
    const p = pieceDigits(own[i]);
    if (p === null) continue; // other short messages of theirs don't break it
    if (!p) continue;
    digits = p + digits;
    pieces.unshift(i);
    for (const n of [10, 11, 12, 13]) if (digits.length >= n && mobileLike(digits.slice(-n))) return { found: true, pieces };
  }
  return none;
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
    let skipped = 0;
    for (let i = previous.length - 1; i >= 0; i--) {
      const p = numberPiece(previous[i]);
      if (!p) {
        // A short filler message between the pieces ("ok?", "wait") doesn't break them (two at most).
        if (skipped < 2 && previous[i].trim().length <= 20) {
          skipped++;
          continue;
        }
        break;
      }
      digits += p.digits;
      pieces.unshift(i);
    }
    // Five digits in a row of pieces is already too many; with filler in between, eight.
    if (pieces.length && digits >= (skipped ? 8 : 5)) return { found: true, kinds: ["phone"], pieces };
  }
  // Spelled out across short messages: "j", "o", "h", "n", "@", "g" … or "john", "at", "gmail", "dot", "com".
  if (isShortPiece(next)) {
    const run: number[] = [];
    for (let i = previous.length - 1; i >= 0 && run.length < 40; i--) {
      if (!isShortPiece(previous[i])) break;
      run.unshift(i);
    }
    // An "@" on its own right after letters is an email being spelled out.
    if (run.length >= 2 && /^(?:@|＠|\(at\)|\[at\])$/i.test(next.trim())) return { found: true, kinds: ["email"], pieces: run };
    const glue = [...run.map((i) => previous[i]), next].map((t) => t.replace(/\s+/g, ""));
    // Try from each starting piece, so an address after unrelated short replies is still found.
    for (let from = 0; from < run.length; from++) {
      const parts = glue.slice(from);
      const starts: number[] = [];
      let at = 0;
      for (const part of parts) {
        starts.push(at);
        at += part.length;
      }
      const lastStart = starts[parts.length - 1];
      const hits = scanContact(parts.join(""), "chat").matches.filter((m) => m.kind !== "phone" && m.end > lastStart);
      if (hits.length) {
        const pieces = run.slice(from).filter((_, k) => hits.some((m) => m.start < starts[k] + parts[k].length && m.end > starts[k]));
        return { found: true, kinds: [...new Set(hits.map((m) => m.kind))], pieces: pieces.length ? pieces : run.slice(from) };
      }
    }
  }
  // The messages read together.
  const parts = [...previous.slice(-10), next];
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
  const offset = previous.length - (parts.length - 1);
  const pieces = parts.slice(0, -1).map((_, k) => k).filter((k) => hits.some((m) => m.start < starts[k] + parts[k].length && m.end > starts[k])).map((k) => k + offset);
  return { found: true, kinds: [...new Set(hits.map((m) => m.kind))], pieces };
}

/** A very short message: a few letters, a word or two, or letters typed with spaces ("j o h n"). */
export function isShortPiece(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 24) return false;
  const words = t.split(/\s+/);
  return words.length <= 3 || words.every((w) => w.length === 1);
}

/* ─── 8. Speech in the live class ──────────────────────────────────────────────── */

/** Words that show someone is giving a way to reach them (lessons are full of plain numbers). */
const SPEECH_CUE = /whats ?app|call me|text me|message me|dm me|ping me|my (?:number|phone|mobile|cell|contact|mail|email|gmail|id|insta|handle)|phone|mobile|contact|insta|telegram|snapchat|signal app|gmail|e ?mail|mail id|dial|\+ ?91|ફોન|નંબર|વોટ્સ|फोन|नंबर|मोबाइल|व्हाट्स/i;

/** Digits a sentence holds, in any script or as words ("nine", "નવ", "नौ"). */
function spokenDigits(said: string): number {
  let n = 0;
  for (const w of said.split(/[\s,.;:!?]+/)) n += numberPiece(w)?.digits ?? 0;
  return n;
}

/**
 * Contact details in one finished sentence someone said in class. A number counts as a phone number only
 * with 10 or more digits, or when the sentence says it's a way to reach them ("WhatsApp me", "my number"),
 * because lessons are full of numbers (answers, years, prices).
 */
export function speechContact(said: string): { kinds: ContactKind[]; masked: string } | null {
  const found = scanCore(said, "chat", 0);
  if (!found.found) return null;
  const kinds = found.kinds.filter((k) => k !== "phone" || spokenDigits(said) >= 10 || SPEECH_CUE.test(said));
  if (!kinds.length) return null;
  return { kinds, masked: maskMatches(said, found.matches) };
}

/**
 * Contact details said a piece at a time: "my WhatsApp is 98765" … "43210", or an email spelled over a
 * few sentences. `recent` are the same person's previous sentences from the last minute, oldest first.
 * Only checked when something in them says it's a way to reach them, so a run of answers isn't a number.
 */
export function speechSplitContact(recent: string[], said: string): { kinds: ContactKind[]; masked: string } | null {
  if (!recent.length) return null;
  const all = [...recent.slice(-6), said];
  const joined = all.join(" ");
  if (!SPEECH_CUE.test(joined)) return null;
  const found = scanCore(joined, "chat", 0);
  if (!found.found) return null;
  // It must include what was just said (anything earlier was already checked on its own).
  const lastStart = joined.length - said.length;
  const hits = found.matches.filter((m) => m.end > lastStart);
  if (!hits.length) return null;
  const kinds = [...new Set(hits.map((m) => m.kind))].filter((k) => k !== "phone" || spokenDigits(joined) >= 10);
  if (!kinds.length) return null;
  return { kinds, masked: maskMatches(joined, found.matches) };
}
