/*
 * The free English level test (/english-level-test): 24 questions written for TutorLink, four per CEFR level
 * from A1 to C2, in order of difficulty. The score gives a rough level (an estimate, not a certificate);
 * answers are checked in the browser and never sent anywhere.
 */

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface TestQuestion {
  level: Cefr;
  /** The sentence, with ___ for the gap. */
  prompt: string;
  options: [string, string, string, string];
  /** Index of the right option. */
  answer: 0 | 1 | 2 | 3;
  /** Why, in one line (shown when reviewing answers). */
  why: string;
}

export const TEST_QUESTIONS: TestQuestion[] = [
  { level: "A1", prompt: "Hello, my name ___ Priya.", options: ["are", "is", "am", "be"], answer: 1, why: "“My name” is one thing, so it takes “is”." },
  { level: "A1", prompt: "They ___ from Gujarat.", options: ["is", "am", "are", "be"], answer: 2, why: "“They” always takes “are”." },
  { level: "A1", prompt: "There are two ___ on the table.", options: ["book", "books", "bookes", "a book"], answer: 1, why: "Two of something needs the plural: “books”." },
  { level: "A1", prompt: "I ___ tea every morning.", options: ["drinks", "drinking", "am drink", "drink"], answer: 3, why: "Habits use the present simple; with “I” there is no -s." },

  { level: "A2", prompt: "Yesterday we ___ to the market.", options: ["went", "go", "goes", "gone"], answer: 0, why: "“Yesterday” is finished time: past simple “went”." },
  { level: "A2", prompt: "She is ___ than her brother.", options: ["tall", "taller", "tallest", "more tall"], answer: 1, why: "Comparing two people: short adjective + -er + “than”." },
  { level: "A2", prompt: "Is there ___ milk in the fridge?", options: ["many", "a", "any", "few"], answer: 2, why: "Questions about uncountable things use “any”." },
  { level: "A2", prompt: "I'm going ___ my cousin on Sunday.", options: ["visit", "visiting", "visited", "to visit"], answer: 3, why: "“Going to” + base verb talks about a plan." },

  { level: "B1", prompt: "If it rains tomorrow, we ___ at home.", options: ["will stay", "stay", "would stay", "stayed"], answer: 0, why: "A real future possibility: “if” + present, then “will”." },
  { level: "B1", prompt: "I have lived in Pune ___ 2019.", options: ["for", "from", "since", "during"], answer: 2, why: "“Since” + a starting point; “for” + a length of time." },
  { level: "B1", prompt: "The exam was ___ difficult that nobody finished it.", options: ["such", "so", "too", "very"], answer: 1, why: "“so” + adjective + “that” shows the result." },
  { level: "B1", prompt: "She said she ___ tired, so she went to bed early.", options: ["is", "has been", "be", "was"], answer: 3, why: "Reported speech moves the verb back: “I am tired” → “she was tired”." },

  { level: "B2", prompt: "By the time we arrived, the film ___.", options: ["already started", "has already started", "had already started", "was already start"], answer: 2, why: "Something finished before another past moment: past perfect “had started”." },
  { level: "B2", prompt: "I wish I ___ more time to study.", options: ["had", "have", "will have", "would have"], answer: 0, why: "A wish about the present uses the past form: “I wish I had”." },
  { level: "B2", prompt: "You ___ have told me earlier! I could have helped.", options: ["must", "can", "should", "would"], answer: 2, why: "“Should have” + past participle criticises something that didn't happen." },
  { level: "B2", prompt: "The meeting was ___ because the manager was ill.", options: ["called up", "called off", "called on", "called out"], answer: 1, why: "To “call off” an event means to cancel it." },

  { level: "C1", prompt: "Hardly ___ the house when it started to rain.", options: ["I had left", "I left", "did I leave", "had I left"], answer: 3, why: "After “Hardly” at the start, the subject and auxiliary swap: “had I left”." },
  { level: "C1", prompt: "The investigation was thorough: it left no stone ___.", options: ["unturned", "untouched", "unmoved", "unknown"], answer: 0, why: "The idiom is “leave no stone unturned”: try everything possible." },
  { level: "C1", prompt: "Not only ___ late, but he also forgot the tickets.", options: ["he was", "he is", "was he", "did he"], answer: 2, why: "“Not only” at the start brings inversion: “was he”." },
  { level: "C1", prompt: "Had I known about the traffic, I ___ earlier.", options: ["would leave", "would have left", "will leave", "had left"], answer: 1, why: "An imagined past: “Had I known …, I would have left”." },

  { level: "C2", prompt: "The minister's answer was deliberately ___, so nobody knew what he really meant.", options: ["eloquent", "emphatic", "equivocal", "explicit"], answer: 2, why: "“Equivocal” means open to more than one meaning, often on purpose." },
  { level: "C2", prompt: "The new rules will only ___ the problem rather than solve it.", options: ["alleviate", "exacerbate", "mitigate", "ameliorate"], answer: 1, why: "“Rather than solve it” points to making it worse: “exacerbate”." },
  { level: "C2", prompt: "It's high time we ___ a decision.", options: ["make", "will make", "have made", "made"], answer: 3, why: "“It's high time” + past form says something should already be happening." },
  { level: "C2", prompt: "Her proposal, ___ ambitious, was approved without a single objection.", options: ["albeit", "despite", "whereas", "notwithstanding that"], answer: 0, why: "“Albeit” (= although) goes straight before an adjective." },
];

export interface LevelResult {
  level: Cefr;
  name: string;
  meaning: string;
  /** Subjects to look for a tutor in (slugs in the subject list). */
  next: { slug: string; label: string }[];
}

const RESULTS: Record<Cefr, Omit<LevelResult, "level">> = {
  A1: { name: "Beginner", meaning: "You know everyday words and very simple sentences. A tutor can build your basics step by step.", next: [{ slug: "esl", label: "English as a Second Language" }, { slug: "conversational-english", label: "Conversational English" }] },
  A2: { name: "Elementary", meaning: "You can handle simple, familiar situations. Next: more grammar and speaking with confidence.", next: [{ slug: "english-grammar", label: "English Grammar" }, { slug: "conversational-english", label: "Conversational English" }] },
  B1: { name: "Intermediate", meaning: "You can get by in most everyday situations. Practice will make you fluent and more accurate.", next: [{ slug: "conversational-english", label: "Conversational English" }, { slug: "english-grammar", label: "English Grammar" }, { slug: "ielts", label: "IELTS" }] },
  B2: { name: "Upper-intermediate", meaning: "You speak and write clearly on many topics. A good level for exams like IELTS and for work.", next: [{ slug: "ielts", label: "IELTS" }, { slug: "business-english", label: "Business English" }, { slug: "academic-english", label: "Academic English" }] },
  C1: { name: "Advanced", meaning: "You use English flexibly for study and work. A tutor can polish style, accuracy and exam scores.", next: [{ slug: "ielts", label: "IELTS" }, { slug: "toefl", label: "TOEFL" }, { slug: "academic-english", label: "Academic English" }] },
  C2: { name: "Proficient", meaning: "Your English is close to a highly educated native speaker. Keep it sharp with demanding practice.", next: [{ slug: "business-english", label: "Business English" }, { slug: "academic-english", label: "Academic English" }, { slug: "debate", label: "Debate" }] },
};

/** The estimated level for a number of right answers out of 24. */
export function levelFor(correct: number): LevelResult {
  const level: Cefr = correct <= 5 ? "A1" : correct <= 9 ? "A2" : correct <= 13 ? "B1" : correct <= 17 ? "B2" : correct <= 21 ? "C1" : "C2";
  return { level, ...RESULTS[level] };
}
