/* CMS content for the preview build. In production this is served by the CMS module. */
import { SAMPLE_DATA } from "@/lib/sample-data";

export interface Faq {
  q: string;
  a: string;
  audience: "families" | "tutors" | "payments" | "safety";
}

export const FAQS: Faq[] = [
  { audience: "families", q: "How do I find the right tutor?", a: "Search by subject, grade, location and schedule, then compare up to three tutors side by side. If you'd rather not search, use Help Me Find a Tutor — describe what you need and we'll show a shortlist with a clear explanation of why each tutor matches." },
  { audience: "families", q: "Is it free to search and message tutors?", a: "Yes. Creating an account, searching, posting a requirement and messaging tutors is free. You pay only when you book a lesson." },
  { audience: "families", q: "What is a trial lesson?", a: "Many tutors offer a short trial — free or at a reduced price — so you can confirm the fit before committing. Trial terms are set by each tutor and shown on their profile before you book." },
  { audience: "families", q: "Can I book lessons for my child?", a: "Yes. Parent accounts can add child profiles, post requirements for each child, book and pay for lessons, and see attendance, homework and progress notes. Messages about a minor are visible to the parent account." },
  { audience: "families", q: "Do you offer in-person tutoring?", a: "Yes. Tutors who teach in person set a service radius in miles. We show the approximate area they cover — never a precise home address — and you agree on a meeting place together." },
  { audience: "tutors", q: "How do I become a tutor?", a: "Create an account, complete the guided onboarding (subjects, experience, education, pricing and availability) and submit your verification documents. You can save progress and come back at any time." },
  { audience: "tutors", q: "What does verification involve?", a: "We review identity, education and teaching certifications, and offer a background screening workflow where applicable. Badges appear on your profile only after each check is actually completed." },
  { audience: "tutors", q: "How do tutors get paid?", a: "Payouts are handled through Stripe Connect. Earnings from a completed lesson become available after the dispute window closes and are paid to your connected bank account on the payout schedule." },
  { audience: "tutors", q: "What are lead credits?", a: "Credits are used to apply to student requirements (tutor jobs). Each plan includes monthly credits, and you can buy more. Being contacted directly by a family never costs credits." },
  { audience: "payments", q: "How are payments processed?", a: "Payments are processed by Stripe. We never store full card numbers. Families pay only the tutor's lesson price — there are no booking fees. You'll see the full price and the cancellation policy before you confirm." },
  { audience: "payments", q: "What is the cancellation policy?", a: "By default, lessons can be cancelled free of charge up to 24 hours before the start time; later cancellations are refunded at 50%. Trial lessons can be cancelled free up to 4 hours before. The exact policy is shown before you pay." },
  { audience: "payments", q: "What happens if a tutor doesn't show up?", a: "Report it from the lesson page. A confirmed tutor no-show is refunded in full, and you can open a dispute for any other booking issue within 7 days." },
  { audience: "safety", q: "How do you keep students safe?", a: "Verification before badges, phone numbers and emails automatically hidden in messages, messaging that can be reported and blocked, safeguarding rules for conversations involving minors, and a trust & safety team that reviews every report." },
  { audience: "safety", q: "Why are phone numbers and emails hidden in messages?", a: "Keeping communication on the platform protects both families and tutors — it gives us a record if something goes wrong and prevents off-platform scams. Contact details are automatically masked in messages." },
];

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: "Parents" | "Students" | "Tutors" | "Test prep";
  author: string;
  date: string;
  readMinutes: number;
  body: { h?: string; p: string }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-choose-a-tutor",
    title: "How to choose a tutor: a practical checklist for parents",
    excerpt: "Qualifications matter, but fit matters more. Here's how to evaluate tutors before and after a trial lesson.",
    category: "Parents", author: "TutorLink Editorial", date: "2026-09-10", readMinutes: 6,
    body: [
      { p: "Most families start by comparing credentials and price. Those matter — but the best predictor of progress is whether your child feels understood and challenged in the first few sessions." },
      { h: "Before you book", p: "Write down one specific goal (for example, 'raise the algebra grade from C to B by the end of the semester'). Share it in your first message. A good tutor will respond with questions, not just availability." },
      { h: "During the trial", p: "Watch for a diagnostic approach. Strong tutors spend the first session figuring out where the real gaps are rather than re-teaching whatever was covered in class that week." },
      { h: "After the trial", p: "Ask your child two questions: did the tutor explain things in a way that made sense, and would you want to go back? Then check whether the tutor sent a short recap and a plan." },
    ],
  },
  {
    slug: "digital-sat-study-plan",
    title: "A 10-week Digital SAT study plan that actually fits a school schedule",
    excerpt: "A realistic week-by-week plan with full-length practice, error logs and targeted review.",
    category: "Test prep", author: "TutorLink Editorial", date: "2026-08-22", readMinutes: 8,
    body: [
      { p: "Ten weeks is enough time to make meaningful gains on the Digital SAT if the plan is consistent and focused on your specific errors." },
      { h: "Weeks 1–2: Baseline", p: "Take one full-length adaptive practice test under real conditions. Log every missed question by type, not just by section." },
      { h: "Weeks 3–8: Targeted practice", p: "Spend most of your time on the three question types that cost the most points. Take a timed module every weekend." },
      { h: "Weeks 9–10: Simulation", p: "Two more full-length tests, spaced a week apart, with careful review of every error and every guess." },
    ],
  },
  {
    slug: "online-vs-in-person-tutoring",
    title: "Online or in-person tutoring? How to decide",
    excerpt: "Both work well. The right choice depends on the learner, the subject and your schedule.",
    category: "Parents", author: "TutorLink Editorial", date: "2026-07-30", readMinutes: 5,
    body: [
      { p: "Online tutoring widens your choice of tutors dramatically and removes travel time. In-person tutoring can help younger children and hands-on subjects." },
      { h: "When online works best", p: "Older students, test prep, writing, languages and programming all translate well to online sessions with a shared whiteboard or document." },
      { h: "When in person helps", p: "Early readers, students who struggle to focus on screens, and music lessons often benefit from being in the same room." },
    ],
  },
  {
    slug: "building-a-tutoring-business",
    title: "Building a sustainable tutoring practice: pricing, scheduling and retention",
    excerpt: "Advice for tutors on setting rates, protecting your calendar and keeping families for the long term.",
    category: "Tutors", author: "TutorLink Editorial", date: "2026-07-12", readMinutes: 7,
    body: [
      { p: "Tutors who build sustainable practices treat their calendar, communication and pricing as seriously as their teaching." },
      { h: "Set rates with intention", p: "Research rates for your subject and area, then price for the value of your specialty. Offer a trial to reduce risk for families rather than discounting your regular rate." },
      { h: "Protect your time", p: "Use buffers between sessions and minimum notice for bookings. Clear cancellation policies reduce awkward conversations." },
    ],
  },
  {
    slug: "executive-function-at-home",
    title: "Five executive function habits you can practice at home",
    excerpt: "Small routines that help students plan, start and finish their work.",
    category: "Students", author: "TutorLink Editorial", date: "2026-06-18", readMinutes: 4,
    body: [
      { p: "Executive function skills — planning, prioritizing, starting and finishing — can be taught and practiced like any other skill." },
      { h: "A weekly review", p: "Fifteen minutes every Sunday: look at the week ahead, list every assignment and pick when each will be done." },
      { h: "A start-up routine", p: "The same three steps before every homework session: clear the desk, open the planner, choose the first small task." },
    ],
  },
];

export interface Testimonial {
  quote: string;
  name: string;
  context: string;
}

/**
 * ILLUSTRATIVE ONLY. These are sample stories written for the preview build and must be replaced
 * with consented, verified customer testimonials (managed in Admin → CMS) before launch.
 */
const ILLUSTRATIVE_TESTIMONIALS: Testimonial[] = [
  { quote: "The comparison view made it easy to explain to my husband why we chose the tutor we did. We booked a free trial the same evening.", name: "Parent of a 7th grader", context: "Brooklyn, NY · Pre-algebra" },
  { quote: "I liked that I could see exactly why each tutor was recommended. No mystery ranking — just subject, schedule and budget fit.", name: "College sophomore", context: "Houston, TX · Organic chemistry" },
  { quote: "Posting a requirement brought me four thoughtful applications in two days. I hired the second tutor after a trial.", name: "Parent of a high school junior", context: "Austin, TX · AP Calculus" },
];
export const SAMPLE_TESTIMONIALS: Testimonial[] = SAMPLE_DATA ? ILLUSTRATIVE_TESTIMONIALS : [];
