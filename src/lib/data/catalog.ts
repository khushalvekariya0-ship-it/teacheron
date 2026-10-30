import type { Grade, Level, Subject, SubjectCategory, TeachingMode, TutorCategory } from "@/lib/types";
import { SAMPLE_DATA } from "@/lib/sample-data";

/*
 * The subject catalog: main subjects ("categories", e.g. Mathematics) and their sub-categories
 * ("subjects", e.g. Algebra). Admins manage it in Admin → Subjects; the edited copy lives in the
 * store, which keeps the live registry below in sync, so every page reads the same list:
 * React components use `useCatalog()` (re-renders on change); plain modules use `getCatalog()`,
 * `getSubject()` and `subjectName()`. Server-only code (static params, metadata) uses the defaults.
 *
 * The site starts with NO subjects: the owner adds real ones. STARTER_* is an optional ready-made list
 * an admin can load with one click (and the demo build's sample tutors are built on it).
 */

export const STARTER_SUBJECT_CATEGORIES: SubjectCategory[] = [
  { slug: "math", name: "Mathematics", description: "From early numeracy to calculus and statistics." },
  { slug: "science", name: "Science", description: "Biology, chemistry, physics and earth science." },
  { slug: "english", name: "English & Writing", description: "Reading, writing, literature and composition." },
  { slug: "test-prep", name: "Test Prep", description: "SAT, ACT, AP and graduate admissions tests." },
  { slug: "languages", name: "World Languages", description: "Spanish, French, Mandarin and more." },
  { slug: "computer-science", name: "Computer Science", description: "Programming, data and computational thinking." },
  { slug: "social-studies", name: "History & Social Studies", description: "US and world history, government, economics." },
  { slug: "arts", name: "Music & Arts", description: "Instruments, voice, drawing and design." },
  { slug: "learning-support", name: "Learning Support", description: "Study skills, executive function and specialized support." },
];

export const STARTER_SUBJECTS: Subject[] = [
  // Math
  { slug: "elementary-math", name: "Elementary Math", category: "math", summary: "Number sense, operations, fractions and early problem solving.", popular: false },
  { slug: "pre-algebra", name: "Pre-Algebra", category: "math", summary: "Ratios, integers, expressions and the bridge to algebra." },
  { slug: "algebra", name: "Algebra", category: "math", summary: "Linear equations, functions, systems and polynomials.", popular: true },
  { slug: "geometry", name: "Geometry", category: "math", summary: "Proofs, congruence, similarity, trigonometry and area." },
  { slug: "precalculus", name: "Precalculus", category: "math", summary: "Functions, trigonometry and limits in preparation for calculus." },
  { slug: "calculus", name: "Calculus", category: "math", summary: "Limits, derivatives, integrals, AP Calculus AB and BC.", popular: true },
  { slug: "statistics", name: "Statistics", category: "math", summary: "Probability, distributions, inference and AP Statistics." },
  // Science
  { slug: "biology", name: "Biology", category: "science", summary: "Cells, genetics, ecology and AP Biology.", popular: true },
  { slug: "chemistry", name: "Chemistry", category: "science", summary: "Stoichiometry, bonding, reactions and AP Chemistry.", popular: true },
  { slug: "physics", name: "Physics", category: "science", summary: "Mechanics, electricity, waves and AP Physics.", popular: true },
  { slug: "earth-science", name: "Earth Science", category: "science", summary: "Geology, weather, climate and astronomy." },
  // English
  { slug: "reading", name: "Reading", category: "english", summary: "Phonics, fluency and reading comprehension." },
  { slug: "writing", name: "Writing", category: "english", summary: "Grammar, structure, argument and revision.", popular: true },
  { slug: "english-literature", name: "English Literature", category: "english", summary: "Close reading, analysis and AP Literature." },
  { slug: "college-essays", name: "College Essays", category: "english", summary: "Personal statements and supplemental essays." },
  // Test prep
  { slug: "sat", name: "SAT Prep", category: "test-prep", summary: "Digital SAT math, reading and writing strategy.", popular: true },
  { slug: "act", name: "ACT Prep", category: "test-prep", summary: "English, math, reading and science sections.", popular: true },
  { slug: "ap-exams", name: "AP Exams", category: "test-prep", summary: "Subject-specific preparation for AP exams." },
  { slug: "gre", name: "GRE", category: "test-prep", summary: "Quantitative, verbal and analytical writing." },
  { slug: "lsat", name: "LSAT", category: "test-prep", summary: "Logical reasoning and reading comprehension." },
  // Languages
  { slug: "spanish", name: "Spanish", category: "languages", summary: "Conversation, grammar and AP Spanish.", popular: true },
  { slug: "french", name: "French", category: "languages", summary: "Conversation, grammar and AP French." },
  { slug: "mandarin", name: "Mandarin Chinese", category: "languages", summary: "Pinyin, characters, speaking and listening." },
  { slug: "esl", name: "English as a Second Language", category: "languages", summary: "Conversational and academic English for learners." },
  // CS
  { slug: "python", name: "Python", category: "computer-science", summary: "Programming fundamentals, data and automation.", popular: true },
  { slug: "java", name: "Java", category: "computer-science", summary: "Object-oriented programming and AP Computer Science A." },
  { slug: "web-development", name: "Web Development", category: "computer-science", summary: "HTML, CSS, JavaScript and modern frameworks." },
  { slug: "ap-computer-science", name: "AP Computer Science", category: "computer-science", summary: "AP CSA and AP CS Principles." },
  // Social studies
  { slug: "us-history", name: "US History", category: "social-studies", summary: "APUSH, primary sources and document-based questions." },
  { slug: "world-history", name: "World History", category: "social-studies", summary: "Global history and AP World History." },
  { slug: "economics", name: "Economics", category: "social-studies", summary: "Micro and macroeconomics, AP Economics." },
  { slug: "government", name: "Government & Civics", category: "social-studies", summary: "US government, politics and AP Gov." },
  // Arts
  { slug: "piano", name: "Piano", category: "arts", summary: "Technique, theory and repertoire for all levels." },
  { slug: "guitar", name: "Guitar", category: "arts", summary: "Acoustic and electric, chords, theory and style." },
  { slug: "drawing", name: "Drawing", category: "arts", summary: "Fundamentals, observation and portfolio work." },
  // Learning support
  { slug: "study-skills", name: "Study Skills", category: "learning-support", summary: "Organization, note-taking and test preparation habits." },
  { slug: "executive-function", name: "Executive Function Coaching", category: "learning-support", summary: "Planning, prioritization and follow-through." },
  { slug: "dyslexia-support", name: "Dyslexia Support", category: "learning-support", summary: "Structured literacy approaches such as Orton-Gillingham." },
];

export interface Catalog {
  /** Subject areas shown on the site, in display order (hidden areas left out). */
  categories: SubjectCategory[];
  /** Subjects shown on the site: not hidden and inside a shown area, in display order. */
  subjects: Subject[];
  /** Every area and subject, hidden ones included (admin lists). */
  allCategories: SubjectCategory[];
  allSubjects: Subject[];
  /** Lookups over every subject and area, hidden ones included, so old bookings and profiles still show a name. */
  bySlug: Record<string, Subject>;
  categoryBySlug: Record<string, SubjectCategory>;
}

export function buildCatalog(categories: SubjectCategory[], subjects: Subject[]): Catalog {
  const shownAreas = categories.filter((c) => !c.hidden);
  const shownAreaSlugs = new Set(shownAreas.map((c) => c.slug));
  // Subjects follow their area's order, then their own.
  const ordered = shownAreas.flatMap((c) => subjects.filter((s) => s.category === c.slug));
  return {
    categories: shownAreas,
    subjects: ordered.filter((s) => !s.hidden && shownAreaSlugs.has(s.category)),
    allCategories: categories,
    allSubjects: subjects,
    bySlug: Object.fromEntries(subjects.map((s) => [s.slug, s])),
    categoryBySlug: Object.fromEntries(categories.map((c) => [c.slug, c])),
  };
}

/** What a new site starts with: empty for a real launch; the starter list in the demo (sample tutors teach it). */
export const DEFAULT_SUBJECT_CATEGORIES: SubjectCategory[] = SAMPLE_DATA ? STARTER_SUBJECT_CATEGORIES : [];
export const DEFAULT_SUBJECTS: Subject[] = SAMPLE_DATA ? STARTER_SUBJECTS : [];

export const DEFAULT_CATALOG: Catalog = buildCatalog(DEFAULT_SUBJECT_CATEGORIES, DEFAULT_SUBJECTS);

let live: Catalog = DEFAULT_CATALOG;

/** Called by the store whenever the catalog changes (and when it loads). */
export function setLiveCatalog(catalog: Catalog): void {
  live = catalog;
}

/** The current catalog, for code outside React components. Components should use `useCatalog()`. */
export function getCatalog(): Catalog {
  return live;
}

export function getSubject(slug: string): Subject | undefined {
  return live.bySlug[slug];
}

export function subjectName(slug: string): string {
  return live.bySlug[slug]?.name ?? slug;
}

export function categoryName(slug: string): string {
  return live.categoryBySlug[slug]?.name ?? slug;
}

/** Shown subjects grouped by shown area, ready for a grouped dropdown. */
export function subjectGroups(catalog: Catalog): { label: string; options: { value: string; label: string }[] }[] {
  return catalog.categories
    .map((c) => ({ label: c.name, options: catalog.subjects.filter((s) => s.category === c.slug).map((s) => ({ value: s.slug, label: s.name })) }))
    .filter((g) => g.options.length > 0);
}

/** "Music & Arts" → "music-arts". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const GRADES: { value: Grade; label: string; level: Level }[] = [
  { value: "K", label: "Kindergarten", level: "elementary" },
  { value: "1", label: "1st grade", level: "elementary" },
  { value: "2", label: "2nd grade", level: "elementary" },
  { value: "3", label: "3rd grade", level: "elementary" },
  { value: "4", label: "4th grade", level: "elementary" },
  { value: "5", label: "5th grade", level: "elementary" },
  { value: "6", label: "6th grade", level: "middle" },
  { value: "7", label: "7th grade", level: "middle" },
  { value: "8", label: "8th grade", level: "middle" },
  { value: "9", label: "9th grade", level: "high" },
  { value: "10", label: "10th grade", level: "high" },
  { value: "11", label: "11th grade", level: "high" },
  { value: "12", label: "12th grade", level: "high" },
  { value: "college", label: "College", level: "college" },
  { value: "adult", label: "Adult learner", level: "adult" },
];

export const GRADE_LABEL: Record<Grade, string> = Object.fromEntries(GRADES.map((g) => [g.value, g.label])) as Record<Grade, string>;

export function gradeToLevel(grade: Grade): Level {
  return GRADES.find((g) => g.value === grade)?.level ?? "high";
}

export const LEVELS: { value: Level; label: string; short: string }[] = [
  { value: "elementary", label: "Elementary (K–5)", short: "Elementary" },
  { value: "middle", label: "Middle school (6–8)", short: "Middle school" },
  { value: "high", label: "High school (9–12)", short: "High school" },
  { value: "college", label: "College", short: "College" },
  { value: "adult", label: "Adult learners", short: "Adult" },
];

export const LEVEL_LABEL: Record<Level, string> = Object.fromEntries(LEVELS.map((l) => [l.value, l.short])) as Record<Level, string>;

export const MODE_LABEL: Record<TeachingMode, string> = {
  online: "Online",
  in_person: "In person",
};

export const TUTOR_CATEGORIES: { value: TutorCategory; label: string }[] = [
  { value: "certified_teacher", label: "Certified teacher" },
  { value: "subject_expert", label: "Subject expert" },
  { value: "test_prep_specialist", label: "Test prep specialist" },
  { value: "graduate_student", label: "Graduate student" },
  { value: "learning_specialist", label: "Learning specialist" },
];

export const TUTOR_CATEGORY_LABEL: Record<TutorCategory, string> = Object.fromEntries(
  TUTOR_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<TutorCategory, string>;

export const LEARNING_SUPPORT = ["ADHD", "Dyslexia", "Autism spectrum", "Gifted & talented", "English learners", "Test anxiety"];

export const LANGUAGES = ["English", "Spanish", "Mandarin", "French", "Hindi", "Korean", "Vietnamese", "Arabic", "Portuguese", "Russian"];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const TIMES_OF_DAY = [
  { value: "morning", label: "Morning", range: "8 AM – 12 PM", start: 8, end: 12 },
  { value: "afternoon", label: "Afternoon", range: "12 PM – 5 PM", start: 12, end: 17 },
  { value: "evening", label: "Evening", range: "5 PM – 9 PM", start: 17, end: 21 },
] as const;

export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

export const US_STATES: { value: string; label: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"],
  ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([value, label]) => ({ value, label }));
