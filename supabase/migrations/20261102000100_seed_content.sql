-- Starting content: the original subject list, FAQs, editorial blog posts and feature flags.
-- All of it is editable in the admin panel (Admin → Subjects, Content, Feature flags).
-- Re-running is safe: existing rows are left as they are.

insert into public.subject_categories (slug, name, description, hidden, position) values
  ('math', 'Mathematics', 'From early numeracy to calculus and statistics.', false, 0),
  ('science', 'Science', 'Biology, chemistry, physics and earth science.', false, 1),
  ('english', 'English & Writing', 'Reading, writing, literature and composition.', false, 2),
  ('test-prep', 'Test Prep', 'SAT, ACT, AP and graduate admissions tests.', false, 3),
  ('languages', 'World Languages', 'Spanish, French, Mandarin and more.', false, 4),
  ('computer-science', 'Computer Science', 'Programming, data and computational thinking.', false, 5),
  ('social-studies', 'History & Social Studies', 'US and world history, government, economics.', false, 6),
  ('arts', 'Music & Arts', 'Instruments, voice, drawing and design.', false, 7),
  ('learning-support', 'Learning Support', 'Study skills, executive function and specialized support.', false, 8)
on conflict do nothing;

insert into public.subjects (slug, name, category, summary, popular, hidden, position) values
  ('elementary-math', 'Elementary Math', 'math', 'Number sense, operations, fractions and early problem solving.', false, false, 0),
  ('pre-algebra', 'Pre-Algebra', 'math', 'Ratios, integers, expressions and the bridge to algebra.', false, false, 1),
  ('algebra', 'Algebra', 'math', 'Linear equations, functions, systems and polynomials.', true, false, 2),
  ('geometry', 'Geometry', 'math', 'Proofs, congruence, similarity, trigonometry and area.', false, false, 3),
  ('precalculus', 'Precalculus', 'math', 'Functions, trigonometry and limits in preparation for calculus.', false, false, 4),
  ('calculus', 'Calculus', 'math', 'Limits, derivatives, integrals, AP Calculus AB and BC.', true, false, 5),
  ('statistics', 'Statistics', 'math', 'Probability, distributions, inference and AP Statistics.', false, false, 6),
  ('biology', 'Biology', 'science', 'Cells, genetics, ecology and AP Biology.', true, false, 7),
  ('chemistry', 'Chemistry', 'science', 'Stoichiometry, bonding, reactions and AP Chemistry.', true, false, 8),
  ('physics', 'Physics', 'science', 'Mechanics, electricity, waves and AP Physics.', true, false, 9),
  ('earth-science', 'Earth Science', 'science', 'Geology, weather, climate and astronomy.', false, false, 10),
  ('reading', 'Reading', 'english', 'Phonics, fluency and reading comprehension.', false, false, 11),
  ('writing', 'Writing', 'english', 'Grammar, structure, argument and revision.', true, false, 12),
  ('english-literature', 'English Literature', 'english', 'Close reading, analysis and AP Literature.', false, false, 13),
  ('college-essays', 'College Essays', 'english', 'Personal statements and supplemental essays.', false, false, 14),
  ('sat', 'SAT Prep', 'test-prep', 'Digital SAT math, reading and writing strategy.', true, false, 15),
  ('act', 'ACT Prep', 'test-prep', 'English, math, reading and science sections.', true, false, 16),
  ('ap-exams', 'AP Exams', 'test-prep', 'Subject-specific preparation for AP exams.', false, false, 17),
  ('gre', 'GRE', 'test-prep', 'Quantitative, verbal and analytical writing.', false, false, 18),
  ('lsat', 'LSAT', 'test-prep', 'Logical reasoning and reading comprehension.', false, false, 19),
  ('spanish', 'Spanish', 'languages', 'Conversation, grammar and AP Spanish.', true, false, 20),
  ('french', 'French', 'languages', 'Conversation, grammar and AP French.', false, false, 21),
  ('mandarin', 'Mandarin Chinese', 'languages', 'Pinyin, characters, speaking and listening.', false, false, 22),
  ('esl', 'English as a Second Language', 'languages', 'Conversational and academic English for learners.', false, false, 23),
  ('python', 'Python', 'computer-science', 'Programming fundamentals, data and automation.', true, false, 24),
  ('java', 'Java', 'computer-science', 'Object-oriented programming and AP Computer Science A.', false, false, 25),
  ('web-development', 'Web Development', 'computer-science', 'HTML, CSS, JavaScript and modern frameworks.', false, false, 26),
  ('ap-computer-science', 'AP Computer Science', 'computer-science', 'AP CSA and AP CS Principles.', false, false, 27),
  ('us-history', 'US History', 'social-studies', 'APUSH, primary sources and document-based questions.', false, false, 28),
  ('world-history', 'World History', 'social-studies', 'Global history and AP World History.', false, false, 29),
  ('economics', 'Economics', 'social-studies', 'Micro and macroeconomics, AP Economics.', false, false, 30),
  ('government', 'Government & Civics', 'social-studies', 'US government, politics and AP Gov.', false, false, 31),
  ('piano', 'Piano', 'arts', 'Technique, theory and repertoire for all levels.', false, false, 32),
  ('guitar', 'Guitar', 'arts', 'Acoustic and electric, chords, theory and style.', false, false, 33),
  ('drawing', 'Drawing', 'arts', 'Fundamentals, observation and portfolio work.', false, false, 34),
  ('study-skills', 'Study Skills', 'learning-support', 'Organization, note-taking and test preparation habits.', false, false, 35),
  ('executive-function', 'Executive Function Coaching', 'learning-support', 'Planning, prioritization and follow-through.', false, false, 36),
  ('dyslexia-support', 'Dyslexia Support', 'learning-support', 'Structured literacy approaches such as Orton-Gillingham.', false, false, 37)
on conflict do nothing;

insert into public.faqs (id, audience, question, answer, published, position) values
  ('faq_01', 'families', 'How do I find the right tutor?', 'Search by subject, grade, location and schedule, then compare up to three tutors side by side. If you''d rather not search, use Help Me Find a Tutor — describe what you need and we''ll show a shortlist with a clear explanation of why each tutor matches.', true, 0),
  ('faq_02', 'families', 'Is it free to search and message tutors?', 'Yes. Creating an account, searching, posting a requirement and messaging tutors is free. You pay only when you book a lesson.', true, 1),
  ('faq_03', 'families', 'What is a trial lesson?', 'Many tutors offer a short trial — free or at a reduced price — so you can confirm the fit before committing. Trial terms are set by each tutor and shown on their profile before you book.', true, 2),
  ('faq_04', 'families', 'Can I book lessons for my child?', 'Yes. Parent accounts can add child profiles, post requirements for each child, book and pay for lessons, and see attendance, homework and progress notes. Messages about a minor are visible to the parent account.', true, 3),
  ('faq_05', 'families', 'Do you offer in-person tutoring?', 'Yes. Tutors who teach in person set a service radius in miles. We show the approximate area they cover — never a precise home address — and you agree on a meeting place together.', true, 4),
  ('faq_06', 'tutors', 'How do I become a tutor?', 'Create an account, complete the guided onboarding (subjects, experience, education, pricing and availability) and submit your verification documents. You can save progress and come back at any time.', true, 5),
  ('faq_07', 'tutors', 'What does verification involve?', 'We review identity, education and teaching certifications, and offer a background screening workflow where applicable. Badges appear on your profile only after each check is actually completed.', true, 6),
  ('faq_08', 'tutors', 'How do tutors get paid?', 'Payouts are handled through Stripe Connect. Earnings from a completed lesson become available after the dispute window closes and are paid to your connected bank account on the payout schedule.', true, 7),
  ('faq_09', 'tutors', 'What are lead credits?', 'Credits are used to apply to student requirements (tutor jobs). Each plan includes monthly credits, and you can buy more. Being contacted directly by a family never costs credits.', true, 8),
  ('faq_10', 'payments', 'How are payments processed?', 'Payments are processed by Stripe. We never store full card numbers. Families pay only the tutor''s lesson price — there are no booking fees. You''ll see the full price and the cancellation policy before you confirm.', true, 9),
  ('faq_11', 'payments', 'What is the cancellation policy?', 'By default, lessons can be cancelled free of charge up to 24 hours before the start time; later cancellations are refunded at 50%. Trial lessons can be cancelled free up to 4 hours before. The exact policy is shown before you pay.', true, 10),
  ('faq_12', 'payments', 'What happens if a tutor doesn''t show up?', 'Report it from the lesson page. A confirmed tutor no-show is refunded in full, and you can open a dispute for any other booking issue within 7 days.', true, 11),
  ('faq_13', 'safety', 'How do you keep students safe?', 'Verification before badges, phone numbers and emails automatically hidden in messages, messaging that can be reported and blocked, safeguarding rules for conversations involving minors, and a trust & safety team that reviews every report.', true, 12),
  ('faq_14', 'safety', 'Why are phone numbers and emails hidden in messages?', 'Keeping communication on the platform protects both families and tutors — it gives us a record if something goes wrong and prevents off-platform scams. Contact details are automatically masked in messages.', true, 13)
on conflict do nothing;

insert into public.blog_posts (slug, title, excerpt, category, author, published_on, read_minutes, body, status) values
  ('how-to-choose-a-tutor', 'How to choose a tutor: a practical checklist for parents', 'Qualifications matter, but fit matters more. Here''s how to evaluate tutors before and after a trial lesson.', 'Parents', 'TutorLink Editorial', '2026-09-10', 6, '[{"p":"Most families start by comparing credentials and price. Those matter — but the best predictor of progress is whether your child feels understood and challenged in the first few sessions."},{"h":"Before you book","p":"Write down one specific goal (for example, ''raise the algebra grade from C to B by the end of the semester''). Share it in your first message. A good tutor will respond with questions, not just availability."},{"h":"During the trial","p":"Watch for a diagnostic approach. Strong tutors spend the first session figuring out where the real gaps are rather than re-teaching whatever was covered in class that week."},{"h":"After the trial","p":"Ask your child two questions: did the tutor explain things in a way that made sense, and would you want to go back? Then check whether the tutor sent a short recap and a plan."}]'::jsonb, 'published'),
  ('digital-sat-study-plan', 'A 10-week Digital SAT study plan that actually fits a school schedule', 'A realistic week-by-week plan with full-length practice, error logs and targeted review.', 'Test prep', 'TutorLink Editorial', '2026-08-22', 8, '[{"p":"Ten weeks is enough time to make meaningful gains on the Digital SAT if the plan is consistent and focused on your specific errors."},{"h":"Weeks 1–2: Baseline","p":"Take one full-length adaptive practice test under real conditions. Log every missed question by type, not just by section."},{"h":"Weeks 3–8: Targeted practice","p":"Spend most of your time on the three question types that cost the most points. Take a timed module every weekend."},{"h":"Weeks 9–10: Simulation","p":"Two more full-length tests, spaced a week apart, with careful review of every error and every guess."}]'::jsonb, 'published'),
  ('online-vs-in-person-tutoring', 'Online or in-person tutoring? How to decide', 'Both work well. The right choice depends on the learner, the subject and your schedule.', 'Parents', 'TutorLink Editorial', '2026-07-30', 5, '[{"p":"Online tutoring widens your choice of tutors dramatically and removes travel time. In-person tutoring can help younger children and hands-on subjects."},{"h":"When online works best","p":"Older students, test prep, writing, languages and programming all translate well to online sessions with a shared whiteboard or document."},{"h":"When in person helps","p":"Early readers, students who struggle to focus on screens, and music lessons often benefit from being in the same room."}]'::jsonb, 'published'),
  ('building-a-tutoring-business', 'Building a sustainable tutoring practice: pricing, scheduling and retention', 'Advice for tutors on setting rates, protecting your calendar and keeping families for the long term.', 'Tutors', 'TutorLink Editorial', '2026-07-12', 7, '[{"p":"Tutors who build sustainable practices treat their calendar, communication and pricing as seriously as their teaching."},{"h":"Set rates with intention","p":"Research rates for your subject and area, then price for the value of your specialty. Offer a trial to reduce risk for families rather than discounting your regular rate."},{"h":"Protect your time","p":"Use buffers between sessions and minimum notice for bookings. Clear cancellation policies reduce awkward conversations."}]'::jsonb, 'published'),
  ('executive-function-at-home', 'Five executive function habits you can practice at home', 'Small routines that help students plan, start and finish their work.', 'Students', 'TutorLink Editorial', '2026-06-18', 4, '[{"p":"Executive function skills — planning, prioritizing, starting and finishing — can be taught and practiced like any other skill."},{"h":"A weekly review","p":"Fifteen minutes every Sunday: look at the week ahead, list every assignment and pick when each will be done."},{"h":"A start-up routine","p":"The same three steps before every homework session: clear the desk, open the planner, choose the first small task."}]'::jsonb, 'published')
on conflict do nothing;

insert into public.feature_flags (key, label, description, enabled, rollout_percent, position) values
  ('trial_lessons', 'Trial lessons', 'Allow tutors to offer free or paid trial lessons.', true, 100, 0),
  ('instant_booking', 'Instant booking', 'Let tutors accept bookings without manual approval.', true, 100, 1),
  ('online_lessons', 'Online lessons', 'Integrated online lesson page with meeting links.', true, 100, 2),
  ('lead_credits', 'Lead credits', 'Tutors spend credits to apply to student jobs.', true, 100, 3),
  ('ai_matching', 'AI-assisted matching', 'Natural-language concierge input. Rules-based scoring remains the source of truth.', true, 25, 4),
  ('coupons', 'Coupons', 'Promotional codes at checkout.', true, 100, 5),
  ('referrals', 'Referrals', 'Referral codes and credits.', false, 0, 6),
  ('parent_accounts', 'Parent accounts', 'Parent accounts with child profiles.', true, 100, 7),
  ('progress_tracking', 'Progress tracking', 'Learning goals, homework and progress notes.', true, 100, 8),
  ('sms_notifications', 'SMS notifications', 'Send reminders by SMS via Twilio.', false, 0, 9),
  ('featured_tutors', 'Featured tutors', 'Show featured placement on the homepage and search.', true, 100, 10)
on conflict do nothing;
