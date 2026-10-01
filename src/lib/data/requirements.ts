import type { Application, Requirement } from "@/lib/types";
import { SAMPLE_DATA } from "@/lib/sample-data";

/* SAMPLE DATA — fictional tutoring requirements published by sample members. */

type Seed = Omit<Requirement, "status" | "createdAt" | "updatedAt" | "publishedAt" | "languages" | "preferences"> & {
  daysAgo: number;
  status?: Requirement["status"];
  languages?: string[];
  preferences?: string;
};

/**
 * Fixed reference so server-rendered job pages are deterministic. The client store re-anchors these
 * timestamps to the moment the demo is first opened (see initialData in the store).
 */
export const REQUIREMENTS_REFERENCE_TIME = Date.UTC(2026, 8, 30, 15, 0, 0);
const NOW = REQUIREMENTS_REFERENCE_TIME;

const SEEDS: Seed[] = [
  {
    id: "req_001", ownerId: "usr_m01", title: "AP Calculus BC tutor for junior, twice a week", subject: "calculus", grade: "11",
    objectives: "Keep an A in AP Calc BC and prepare for the May exam. Series and parametric units are the current struggle.",
    modes: ["online", "in_person"], city: "Austin", state: "TX", zip: "78701", days: ["Tue", "Thu"], timesOfDay: ["evening"],
    sessionsPerWeek: 2, budgetMinCents: 7000, budgetMaxCents: 11000, minExperienceYears: 3,
    details: "Student is motivated and organized; mostly needs someone to go deeper than class time allows.", daysAgo: 1,
  },
  {
    id: "req_002", ownerId: "usr_m03", title: "Spanish conversation for two siblings (8 and 11)", subject: "spanish", grade: "3",
    objectives: "Heritage speakers who understand Spanish but answer in English. Want them comfortable speaking with family.",
    modes: ["in_person"], city: "Miami", state: "FL", zip: "33131", days: ["Mon", "Wed", "Sat"], timesOfDay: ["afternoon"],
    sessionsPerWeek: 2, budgetMinCents: 4500, budgetMaxCents: 7000, languages: ["Spanish"],
    details: "Sessions at our home; siblings could be taught together.", daysAgo: 2,
  },
  {
    id: "req_003", ownerId: "usr_m05", title: "Organic chemistry help — college sophomore", subject: "chemistry", grade: "college",
    objectives: "Struggling with reaction mechanisms and synthesis problems. Midterm in four weeks.",
    modes: ["online"], city: "Houston", state: "TX", zip: "77005", days: ["Sun", "Tue", "Thu"], timesOfDay: ["evening"],
    sessionsPerWeek: 2, budgetMinCents: 6000, budgetMaxCents: 10000, minExperienceYears: 2,
    details: "Would like to share problem sets ahead of each session.", daysAgo: 3,
  },
  {
    id: "req_004", ownerId: "usr_m06", title: "Reading support for 2nd grader with suspected dyslexia", subject: "dyslexia-support", grade: "2",
    objectives: "School recommended structured literacy. Looking for Orton-Gillingham trained tutor.",
    modes: ["online", "in_person"], city: "Seattle", state: "WA", zip: "98103", days: ["Mon", "Tue", "Wed", "Thu"], timesOfDay: ["afternoon"],
    sessionsPerWeek: 3, budgetMinCents: 6000, budgetMaxCents: 9500, minExperienceYears: 5,
    preferences: "Orton-Gillingham or Wilson training strongly preferred.",
    details: "We have a recent evaluation we can share after the first conversation.", daysAgo: 1,
  },
  {
    id: "req_005", ownerId: "usr_m07", title: "Digital SAT prep — target 1450+, test in December", subject: "sat", grade: "11",
    objectives: "Current practice score 1310. Math is stronger than reading and writing.",
    modes: ["online", "in_person"], city: "Los Angeles", state: "CA", zip: "90024", days: ["Sat", "Sun"], timesOfDay: ["morning", "afternoon"],
    sessionsPerWeek: 1, budgetMinCents: 9000, budgetMaxCents: 15000, minExperienceYears: 4,
    details: "Would like a written study plan and full-length practice test reviews.", daysAgo: 4,
  },
  {
    id: "req_006", ownerId: "usr_m08", title: "Executive function coaching for college freshman", subject: "executive-function", grade: "college",
    objectives: "Build planning habits and stay on top of assignments in first semester.",
    modes: ["online"], city: "Washington", state: "DC", zip: "20009", days: ["Sun", "Wed"], timesOfDay: ["evening"],
    sessionsPerWeek: 1, budgetMinCents: 6000, budgetMaxCents: 10000,
    details: "Has an ADHD diagnosis and campus accommodations.", daysAgo: 6,
  },
  {
    id: "req_007", ownerId: "usr_m09", title: "4th grade math — fractions and multiplication", subject: "elementary-math", grade: "4",
    objectives: "Falling behind on multiplication facts and fractions; homework is stressful.",
    modes: ["in_person", "online"], city: "Atlanta", state: "GA", zip: "30309", days: ["Mon", "Wed"], timesOfDay: ["afternoon"],
    sessionsPerWeek: 2, budgetMinCents: 4000, budgetMaxCents: 6500,
    details: "Patient tutor who can make it fun would be ideal.", daysAgo: 2,
  },
  {
    id: "req_008", ownerId: "usr_m10", title: "Mandarin tutor for heritage learner, age 10", subject: "mandarin", grade: "5",
    objectives: "Speaking confidence and basic characters; grandparents speak Mandarin.",
    modes: ["online", "in_person"], city: "Boston", state: "MA", zip: "02116", days: ["Sat"], timesOfDay: ["morning"],
    sessionsPerWeek: 1, budgetMinCents: 5000, budgetMaxCents: 8000, languages: ["Mandarin"],
    details: "Prefers a warm, story-based approach.", daysAgo: 8,
  },
  {
    id: "req_009", ownerId: "usr_m11", title: "Python for beginners — adult career changer", subject: "python", grade: "adult",
    objectives: "Learn Python fundamentals and build a small data project for a portfolio.",
    modes: ["online"], city: "Phoenix", state: "AZ", zip: "85016", days: ["Tue", "Thu", "Sat"], timesOfDay: ["evening", "morning"],
    sessionsPerWeek: 2, budgetMinCents: 5000, budgetMaxCents: 9000,
    details: "Working full time, so evenings or Saturday mornings.", daysAgo: 5,
  },
  {
    id: "req_010", ownerId: "usr_m12", title: "Piano lessons for 9-year-old beginner", subject: "piano", grade: "4",
    objectives: "Start from scratch with good technique; weekly lessons.",
    modes: ["in_person"], city: "Denver", state: "CO", zip: "80206", days: ["Tue", "Thu"], timesOfDay: ["afternoon"],
    sessionsPerWeek: 1, budgetMinCents: 4000, budgetMaxCents: 7000,
    details: "We have an upright piano at home.", daysAgo: 9,
  },
  {
    id: "req_011", ownerId: "usr_m04", title: "APUSH DBQ writing practice", subject: "us-history", grade: "11",
    objectives: "Improve DBQ and LEQ scores before the unit exams.",
    modes: ["online"], city: "Chicago", state: "IL", zip: "60614", days: ["Sun"], timesOfDay: ["afternoon"],
    sessionsPerWeek: 1, budgetMinCents: 5000, budgetMaxCents: 8000,
    details: "Can share graded essays for feedback.", daysAgo: 11,
  },
  {
    id: "req_012", ownerId: "usr_m02", title: "AP Physics 1 help — kinematics and forces", subject: "physics", grade: "10",
    objectives: "Understand the concepts, not just plug into formulas.",
    modes: ["online", "in_person"], city: "San Jose", state: "CA", zip: "95126", days: ["Mon", "Wed", "Fri"], timesOfDay: ["evening"],
    sessionsPerWeek: 2, budgetMinCents: 6000, budgetMaxCents: 9000,
    details: "", daysAgo: 0,
  },
  // Demo student's own requirement
  {
    id: "req_101", ownerId: "usr_student", title: "Chemistry tutor for AP Chem unit on equilibrium", subject: "chemistry", grade: "12",
    objectives: "Understand equilibrium and acid–base chemistry well enough for the AP exam in May.",
    modes: ["online"], city: "Chicago", state: "IL", zip: "60614", days: ["Tue", "Thu", "Sun"], timesOfDay: ["evening"],
    sessionsPerWeek: 2, budgetMinCents: 6000, budgetMaxCents: 11000, minExperienceYears: 3,
    details: "I learn best with lots of practice problems.", daysAgo: 3,
  },
  // Demo parent's requirements
  {
    id: "req_201", ownerId: "usr_parent", childId: "chd_noah", title: "Pre-algebra support for 7th grader", subject: "pre-algebra", grade: "7",
    objectives: "Rebuild confidence and catch up on ratios, integers and equations.",
    modes: ["online", "in_person"], city: "Brooklyn", state: "NY", zip: "11201", days: ["Mon", "Wed"], timesOfDay: ["afternoon"],
    sessionsPerWeek: 2, budgetMinCents: 5000, budgetMaxCents: 9000,
    details: "Noah does best with short breaks.", daysAgo: 4,
  },
  {
    id: "req_202", ownerId: "usr_parent", childId: "chd_ava", title: "Spanish for 4th grader", subject: "spanish", grade: "4",
    objectives: "Beginner conversational Spanish.",
    modes: ["online"], city: "Brooklyn", state: "NY", zip: "11201", days: ["Sat"], timesOfDay: ["morning"],
    sessionsPerWeek: 1, budgetMinCents: 4000, budgetMaxCents: 7000,
    details: "", daysAgo: 1, status: "draft",
  },
];

const ALL_SAMPLE_REQUIREMENTS: Requirement[] = SEEDS.map(({ daysAgo, status = "published", languages = ["English"], preferences = "", ...rest }) => {
  const created = new Date(NOW - daysAgo * 86_400_000 - 3 * 3_600_000).toISOString();
  return {
    ...rest,
    languages,
    preferences,
    status,
    createdAt: created,
    updatedAt: created,
    ...(status === "published" ? { publishedAt: created } : { draftStep: 3 }),
  };
});

/** Sample jobs (empty when the sample-data switch is off). */
export const SEED_REQUIREMENTS: Requirement[] = SAMPLE_DATA ? ALL_SAMPLE_REQUIREMENTS : [];

/** An example job used ONLY inside the illustrative How-it-works mock-up. */
export const EXAMPLE_JOB: Requirement = ALL_SAMPLE_REQUIREMENTS.find((r) => r.status === "published") ?? ALL_SAMPLE_REQUIREMENTS[0];

const SAMPLE_APPLICATIONS: Application[] = [
  // Applications to the demo student's requirement
  { id: "app_001", requirementId: "req_101", tutorId: "tut_priya_raman", message: "Hi Jordan — equilibrium and acid–base chemistry are where I spend most AP Chem sessions. I'd start with a 30-minute diagnostic (free) and build a plan through May.", proposedRateCents: 11000, status: "shortlisted", createdAt: "2026-09-27T20:00:00Z", updatedAt: "2026-09-28T14:00:00Z" },
  { id: "app_002", requirementId: "req_101", tutorId: "tut_leah_goldberg", message: "I teach AP Chemistry and use a consistent four-step method for equilibrium problems. Tuesday and Thursday evenings work well for me.", proposedRateCents: 9000, status: "viewed", createdAt: "2026-09-28T01:00:00Z", updatedAt: "2026-09-28T13:00:00Z" },
  { id: "app_003", requirementId: "req_101", tutorId: "tut_andre_thomas", message: "Chemistry isn't my primary subject, but I'm strong on the math side of equilibrium problems and happy to help with problem sets.", proposedRateCents: 8000, status: "applied", createdAt: "2026-09-29T16:00:00Z", updatedAt: "2026-09-29T16:00:00Z" },
  // Applications to the demo parent's requirement
  { id: "app_004", requirementId: "req_201", tutorId: "tut_aisha_rahman", message: "Hello Dana — I specialize in rebuilding math confidence in middle schoolers. I build in movement breaks for students who need them.", proposedRateCents: 6000, status: "trial_requested", createdAt: "2026-09-26T18:00:00Z", updatedAt: "2026-09-27T12:00:00Z" },
  { id: "app_005", requirementId: "req_201", tutorId: "tut_carlos_vega", message: "I'd love to help Noah. I keep a mistakes notebook with each student so we can see patterns and progress.", proposedRateCents: 5500, status: "applied", createdAt: "2026-09-27T22:00:00Z", updatedAt: "2026-09-27T22:00:00Z" },
  // Demo tutor's own applications
  { id: "app_101", requirementId: "req_001", tutorId: "tut_sarah_chen", message: "Hi Emily — AP Calc BC is my main subject and series is one of my favorite units to teach. Happy to start with a free 30-minute diagnostic.", proposedRateCents: 9500, status: "viewed", createdAt: "2026-09-29T19:00:00Z", updatedAt: "2026-09-30T10:00:00Z" },
  { id: "app_102", requirementId: "req_005", tutorId: "tut_sarah_chen", message: "I teach Digital SAT Math and can coordinate with a reading/writing tutor if helpful.", proposedRateCents: 9500, status: "shortlisted", createdAt: "2026-09-27T15:00:00Z", updatedAt: "2026-09-28T18:00:00Z" },
  { id: "app_103", requirementId: "req_011", tutorId: "tut_sarah_chen", message: "(Withdrawn — outside my subject area.)", proposedRateCents: 9000, status: "withdrawn", createdAt: "2026-09-20T15:00:00Z", updatedAt: "2026-09-20T18:00:00Z" },
];

export const SEED_APPLICATIONS: Application[] = SAMPLE_DATA ? SAMPLE_APPLICATIONS : [];
