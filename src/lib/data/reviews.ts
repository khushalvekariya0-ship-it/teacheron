import type { Review } from "@/lib/types";
import { SAMPLE_DATA } from "@/lib/sample-data";

/*
 * SAMPLE DATA — fictional reviews for the preview build. In production, a review can only be
 * created from a completed booking by the account that booked it (see store `submitReview`).
 */

type R = [tutorId: string, author: string, role: "student" | "parent", rating: Review["rating"], subject: string, date: string, body: string, response?: string];

const RAW: R[] = [
  ["tut_sarah_chen", "Emily R.", "parent", 5, "calculus", "2026-08-21", "Sarah figured out in the first session that my daughter's problem wasn't calculus, it was algebra habits from two years ago. Her unit test grades went from the low 70s to 90s by November.", "Thank you — she did the hard work of redoing those foundations!"],
  ["tut_sarah_chen", "Kevin T.", "student", 5, "sat", "2026-07-02", "Very organized. Every session had a clear plan and a recap email. My SAT math went up 90 points between March and June."],
  ["tut_sarah_chen", "Laura M.", "parent", 5, "precalculus", "2026-05-14", "Patient, direct and reliable. My son actually looks forward to his sessions."],
  ["tut_sarah_chen", "Daniel P.", "student", 4, "calculus", "2026-03-30", "Great explanations of related rates and optimization. Scheduling can be tight in spring because she's popular — book early."],
  ["tut_sarah_chen", "Anita S.", "parent", 5, "algebra", "2026-02-11", "Clear communication with parents and real progress. Highly recommend."],

  ["tut_james_okafor", "Marisol G.", "parent", 5, "college-essays", "2026-09-03", "James helped my son find a topic that was genuinely his. He never wrote a sentence for him, but the final essay was so much stronger."],
  ["tut_james_okafor", "Tyler B.", "student", 5, "writing", "2026-06-18", "I finally understand how to structure an argument. My AP Lang essays went from 3s to 5s on the practice rubric."],
  ["tut_james_okafor", "Chris W.", "parent", 4, "reading", "2026-04-09", "Thoughtful and kind with my 7th grader. Would love slightly more homework between sessions."],
  ["tut_james_okafor", "Priya K.", "student", 5, "english-literature", "2026-01-27", "Knows the texts deeply and asks great questions."],

  ["tut_priya_raman", "Josh L.", "student", 5, "chemistry", "2026-08-30", "Saved my organic chemistry grade. She explains mechanisms like a story, which is the only way they have ever made sense to me."],
  ["tut_priya_raman", "Helen F.", "parent", 5, "chemistry", "2026-06-05", "My daughter got a 5 on AP Chem. Priya was structured, warm and always prepared."],
  ["tut_priya_raman", "Omar A.", "student", 5, "biology", "2026-03-12", "Really good at connecting biology to chemistry concepts. Worth every dollar."],

  ["tut_marcus_bell", "Nate C.", "student", 5, "python", "2026-09-12", "We built a working budgeting app in six weeks. I learned more than in a semester-long course."],
  ["tut_marcus_bell", "Sandra V.", "parent", 4, "ap-computer-science", "2026-05-22", "Excellent teacher. Evenings only, so plan around that."],
  ["tut_marcus_bell", "Leo M.", "student", 5, "java", "2026-02-19", "Clear, patient, and great at debugging with me instead of for me."],

  ["tut_elena_morales", "Rebecca H.", "parent", 5, "spanish", "2026-09-08", "My kids (8 and 11) love Elena. They're speaking more Spanish at home than ever."],
  ["tut_elena_morales", "Mark D.", "student", 5, "spanish", "2026-07-15", "As an adult learner I was nervous to speak. Elena made it comfortable from day one."],
  ["tut_elena_morales", "Julia N.", "parent", 5, "french", "2026-04-28", "Fantastic AP French prep, very organized."],
  ["tut_elena_morales", "Sam K.", "student", 4, "spanish", "2026-01-10", "Great conversation practice. Grammar explanations sometimes go quickly — ask her to slow down, she will."],

  ["tut_david_kim", "Grace P.", "parent", 5, "sat", "2026-08-02", "David's error log system changed how my son studies. Score went from 1320 to 1480."],
  ["tut_david_kim", "Brandon Y.", "student", 4, "act", "2026-05-30", "Very effective, very data-driven. Not a lot of small talk, which I actually liked."],
  ["tut_david_kim", "Michelle O.", "parent", 5, "sat", "2026-03-03", "Professional and clear about what to expect from week to week."],

  ["tut_hannah_weiss", "Amanda C.", "parent", 5, "dyslexia-support", "2026-09-15", "After a year with Hannah, my son reads chapter books on his own. I can't overstate what that means for our family.", "It has been a joy watching him grow into a reader."],
  ["tut_hannah_weiss", "Derek F.", "parent", 5, "reading", "2026-06-24", "Structured, calm and incredibly knowledgeable. The home activities are short and actually doable."],
  ["tut_hannah_weiss", "Lisa T.", "parent", 5, "reading", "2026-03-18", "Hannah explained our daughter's evaluation better than the school did."],

  ["tut_andre_thomas", "Kyle J.", "student", 5, "physics", "2026-07-20", "Free-body diagrams finally make sense. Got an A in Physics C Mechanics."],
  ["tut_andre_thomas", "Nora B.", "parent", 4, "physics", "2026-04-02", "Very knowledgeable. Sometimes slow to reply to messages, but sessions are excellent."],

  ["tut_grace_liu", "Wei Z.", "parent", 5, "mandarin", "2026-08-11", "Our kids understand Mandarin from grandparents but wouldn't speak it. Grace got them talking."],
  ["tut_grace_liu", "Ashley R.", "student", 5, "mandarin", "2026-05-06", "Engaging lessons, great materials, and she remembers everything I tell her about my interests."],

  ["tut_michael_obrien", "Ian P.", "student", 5, "us-history", "2026-05-01", "Got a 5 on APUSH. His DBQ framework is gold."],
  ["tut_michael_obrien", "Karen S.", "parent", 4, "government", "2026-02-22", "Knowledgeable and funny. Responses to messages can take a day."],

  ["tut_aisha_rahman", "Tanya W.", "parent", 5, "elementary-math", "2026-09-01", "My 4th grader used to cry over math homework. Now she asks for 'Ms. Aisha problems'."],
  ["tut_aisha_rahman", "Jorge L.", "parent", 5, "pre-algebra", "2026-06-12", "Endlessly patient and very good with my son, who has ADHD."],
  ["tut_aisha_rahman", "Beth M.", "parent", 5, "algebra", "2026-03-25", "Clear progress updates every few weeks. Highly recommend."],

  ["tut_ryan_patel", "Hannah L.", "student", 5, "statistics", "2026-05-09", "Explained hypothesis testing better than my professor."],
  ["tut_ryan_patel", "Victor E.", "student", 4, "economics", "2026-03-01", "Helpful for econometrics problem sets. Limited availability during his own exam weeks."],

  ["tut_olivia_brooks", "Diane K.", "parent", 5, "piano", "2026-07-28", "Our daughter performed in her first recital this spring. Olivia is encouraging but holds a high standard."],
  ["tut_olivia_brooks", "Paul G.", "student", 5, "piano", "2026-04-14", "Started lessons at 52. Olivia's practice plans make it easy to keep going."],

  ["tut_carlos_vega", "Alicia R.", "parent", 5, "algebra", "2026-08-19", "Carlos explains things in English and Spanish, which helped my son a lot."],
  ["tut_carlos_vega", "Matt H.", "student", 4, "geometry", "2026-04-30", "Good at proofs. The mistakes notebook is annoying but it works."],

  ["tut_naomi_fischer", "Jennifer B.", "parent", 5, "executive-function", "2026-09-10", "Homework battles at our house are basically over. Naomi taught our son systems he actually uses."],
  ["tut_naomi_fischer", "Riley S.", "student", 5, "study-skills", "2026-05-27", "Helped me survive my first semester of college. The weekly review habit is life-changing."],
  ["tut_naomi_fischer", "Craig D.", "parent", 4, "executive-function", "2026-02-08", "Very effective. On the expensive side, but worth it for us."],

  ["tut_sophia_nguyen", "Ellen W.", "parent", 5, "college-essays", "2026-01-15", "Sophia asked my daughter the questions that unlocked her essay. It sounded exactly like her."],
  ["tut_sophia_nguyen", "Andrew T.", "student", 5, "english-literature", "2026-04-20", "Great close-reading practice for AP Lit."],

  ["tut_jonah_levy", "Rachel F.", "student", 5, "lsat", "2026-06-29", "Went from 158 to 169. Jonah is methodical and honest about what's working."],
  ["tut_jonah_levy", "Tom C.", "student", 4, "gre", "2026-02-12", "Solid verbal strategies. Pricey, but efficient."],

  ["tut_maya_johnson", "Carmen P.", "parent", 5, "reading", "2026-08-08", "My first grader adores Maya. Reading level jumped two levels over the summer."],
  ["tut_maya_johnson", "Steve A.", "parent", 5, "elementary-math", "2026-04-17", "Warm, fun and organized."],

  ["tut_ethan_wright", "Jake N.", "student", 5, "guitar", "2026-07-11", "Learning songs I actually want to play. Ethan is a great teacher and a great player."],
  ["tut_ethan_wright", "Monica L.", "parent", 4, "guitar", "2026-03-09", "My teen is motivated for the first time. Occasionally reschedules because of gigs."],

  ["tut_leah_goldberg", "Adam S.", "student", 5, "chemistry", "2026-06-02", "Her four-step method for stoichiometry is foolproof."],
  ["tut_leah_goldberg", "Nina V.", "parent", 5, "chemistry", "2026-03-14", "Went from a C to an A- in honors chem."],

  ["tut_isabel_reyes", "Luis M.", "student", 5, "esl", "2026-08-25", "I passed TOEFL with 104. Isabel is a wonderful teacher."],
  ["tut_isabel_reyes", "Ana P.", "student", 5, "writing", "2026-05-19", "My academic writing improved so much. Clear feedback every time."],

  ["tut_owen_park", "Eli G.", "student", 5, "web-development", "2026-07-07", "Built and deployed my portfolio site in a month."],

  ["tut_rachel_adams", "Sophie B.", "parent", 5, "geometry", "2026-06-15", "Rachel is exceptional. Clear, rigorous and kind."],
  ["tut_rachel_adams", "Henry W.", "student", 5, "sat", "2026-04-04", "Went up 80 points on SAT math in two months."],
  ["tut_rachel_adams", "Diana M.", "parent", 4, "algebra", "2026-01-22", "Great teacher; slots fill quickly."],
];

export const REVIEWS: Review[] = (SAMPLE_DATA ? RAW : []).map(([tutorId, authorName, authorRole, rating, subject, date, body, response], i) => ({
  id: `rev_${String(i + 1).padStart(3, "0")}`,
  tutorId,
  bookingId: `bk_hist_${String(i + 1).padStart(3, "0")}`,
  authorName,
  authorRole,
  rating,
  subject,
  body,
  createdAt: `${date}T15:00:00Z`,
  status: "published",
  ...(response ? { tutorResponse: { body: response, createdAt: `${date}T21:00:00Z` } } : {}),
}));

export function reviewsForTutor(tutorId: string): Review[] {
  return REVIEWS.filter((r) => r.tutorId === tutorId && r.status === "published").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ratingBreakdown(tutorId: string): Record<1 | 2 | 3 | 4 | 5, number> {
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const r of reviewsForTutor(tutorId)) out[r.rating]++;
  return out;
}
