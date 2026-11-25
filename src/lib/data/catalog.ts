import type { Grade, Level, Subject, SubjectCategory, TeachingMode, TutorCategory } from "@/lib/types";

/*
 * The subject catalog: main subjects ("categories", e.g. Mathematics) and their sub-categories
 * ("subjects", e.g. Algebra). Admins manage it in Admin → Subjects; the edited copy lives in the
 * store, which keeps the live registry below in sync, so every page reads the same list:
 * React components use `useCatalog()` (re-renders on change); plain modules use `getCatalog()`,
 * `getSubject()` and `subjectName()`. Server-only code (static params, metadata) uses the defaults.
 *
 * The site ships with the STARTER_* list (13 subjects, 213 sub-categories); admins edit, hide or delete
 * any of it and add their own. "Use the starter list" in admin restores anything missing from it.
 */

export const STARTER_SUBJECT_CATEGORIES: SubjectCategory[] = [
  { slug: "math", name: "Mathematics", description: "From early numeracy to calculus and statistics." },
  { slug: "science", name: "Science", description: "Biology, chemistry, physics and earth science." },
  { slug: "english", name: "English & Writing", description: "Reading, writing, literature and composition." },
  { slug: "test-prep", name: "Test Prep", description: "SAT, ACT, AP, IELTS, TOEFL and other exams." },
  { slug: "languages", name: "World Languages", description: "Spanish, French, Mandarin and more." },
  { slug: "computer-science", name: "Computer Science", description: "Programming, data and computational thinking." },
  { slug: "social-studies", name: "History & Social Studies", description: "US and world history, government, economics." },
  { slug: "arts", name: "Music & Arts", description: "Instruments, voice, drawing and design." },
  { slug: "learning-support", name: "Learning Support", description: "Study skills, executive function and specialized support." },
  { slug: "business", name: "Business & Finance", description: "Accounting, economics, management and finance." },
  { slug: "engineering", name: "Engineering & Technology", description: "Engineering, electronics and the maths behind them." },
  { slug: "health", name: "Medicine & Health", description: "Anatomy, nursing, pharmacology and health sciences." },
  { slug: "early-years", name: "Early Years", description: "Preschool and kindergarten learning through play." },
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
  // math (added 2026-11-25)
  { slug: "discrete-math", name: "Discrete Math", category: "math", summary: "Logic, sets, counting, graphs and proofs." },
  { slug: "applied-mathematics", name: "Applied Mathematics", category: "math", summary: "Maths for real problems in science, engineering and finance." },
  { slug: "pure-mathematics", name: "Pure Mathematics", category: "math", summary: "Proof-based university maths: analysis, algebra and number theory." },
  // science (added 2026-11-25)
  { slug: "general-science", name: "General Science", category: "science", summary: "Core ideas across biology, chemistry and physics." },
  { slug: "physical-science", name: "Physical Science", category: "science", summary: "Matter, energy, forces and motion." },
  { slug: "organic-chemistry", name: "Organic Chemistry", category: "science", summary: "Carbon compounds, reactions, mechanisms and synthesis." },
  { slug: "biochemistry", name: "Biochemistry", category: "science", summary: "The chemistry of living things: proteins, enzymes and metabolism." },
  { slug: "mechanics", name: "Mechanics", category: "science", summary: "Forces, motion, energy and momentum." },
  { slug: "microbiology", name: "Microbiology", category: "science", summary: "Bacteria, viruses and fungi, and how they affect health." },
  { slug: "genetics", name: "Genetics", category: "science", summary: "DNA, genes, inheritance and variation." },
  { slug: "ecology", name: "Ecology", category: "science", summary: "How living things interact with each other and their environment." },
  { slug: "geology", name: "Geology", category: "science", summary: "Rocks, minerals, landforms and the history of the Earth." },
  { slug: "neuroscience", name: "Neuroscience", category: "science", summary: "The brain and nervous system, and how they shape behaviour." },
  // english (added 2026-11-25)
  { slug: "conversational-english", name: "Conversational English", category: "english", summary: "Speaking practice for everyday confidence and fluency." },
  { slug: "english-grammar", name: "English Grammar", category: "english", summary: "Tenses, sentence building and punctuation, explained clearly." },
  { slug: "business-english", name: "Business English", category: "english", summary: "Emails, meetings, presentations and workplace vocabulary." },
  { slug: "academic-english", name: "Academic English", category: "english", summary: "Essays, reports and reading for school and university." },
  { slug: "accent-reduction", name: "Accent Reduction", category: "english", summary: "Clear pronunciation, including American and British accents." },
  { slug: "english-for-kids", name: "English for Kids", category: "english", summary: "Playful English lessons for young learners." },
  { slug: "creative-writing", name: "Creative Writing", category: "english", summary: "Stories, poems and personal writing with feedback." },
  { slug: "phonics", name: "Phonics", category: "english", summary: "Letter sounds and blending for early readers." },
  { slug: "debate", name: "Debate", category: "english", summary: "Building arguments, rebuttals and confident public speaking." },
  { slug: "legal-english", name: "Legal English", category: "english", summary: "English for law: contracts, cases and legal terms." },
  { slug: "medical-english", name: "Medical English", category: "english", summary: "English for doctors, nurses and health workers." },
  // test-prep (added 2026-11-25)
  { slug: "ielts", name: "IELTS", category: "test-prep", summary: "Listening, reading, writing and speaking for the IELTS exam." },
  { slug: "toefl", name: "TOEFL", category: "test-prep", summary: "Strategy and practice for every section of the TOEFL test." },
  { slug: "pte", name: "PTE Academic", category: "test-prep", summary: "Practice and strategy for the Pearson English test." },
  { slug: "oet", name: "OET", category: "test-prep", summary: "The English test for healthcare professionals." },
  { slug: "toeic", name: "TOEIC", category: "test-prep", summary: "Workplace English, as tested by TOEIC." },
  { slug: "celpip", name: "CELPIP", category: "test-prep", summary: "Canadian English test practice." },
  { slug: "cael", name: "CAEL", category: "test-prep", summary: "Canadian academic English test practice." },
  { slug: "cambridge-english", name: "Cambridge English (FCE, CAE)", category: "test-prep", summary: "Preparation for Cambridge B2 First and C1 Advanced." },
  { slug: "bec", name: "BEC (Business English Certificate)", category: "test-prep", summary: "Cambridge business English exam practice." },
  { slug: "languagecert", name: "LanguageCert", category: "test-prep", summary: "English certificate exam practice." },
  { slug: "ocr-english", name: "OCR English", category: "test-prep", summary: "OCR English language and literature exam practice." },
  { slug: "tefl", name: "TEFL", category: "test-prep", summary: "Training for people who want to teach English." },
  { slug: "delf-dalf", name: "DELF / DALF", category: "test-prep", summary: "French language diplomas from A1 to C2." },
  { slug: "tcf-tef", name: "TCF / TEF", category: "test-prep", summary: "French tests for study, work and immigration." },
  { slug: "tfi", name: "TFI", category: "test-prep", summary: "French test for international work." },
  { slug: "siele", name: "SIELE", category: "test-prep", summary: "Spanish language certificate preparation." },
  { slug: "torfl", name: "TORFL", category: "test-prep", summary: "Russian as a foreign language exam preparation." },
  { slug: "celpe-bras", name: "CELPE-Bras", category: "test-prep", summary: "Brazilian Portuguese proficiency exam." },
  { slug: "ciple-deple", name: "CIPLE / DEPLE", category: "test-prep", summary: "European Portuguese language exams." },
  { slug: "osd", name: "ÖSD", category: "test-prep", summary: "Austrian German language diploma." },
  { slug: "nt2", name: "NT2", category: "test-prep", summary: "Dutch as a second language exam." },
  { slug: "bjt", name: "BJT", category: "test-prep", summary: "Business Japanese proficiency test." },
  { slug: "cnavt", name: "CNAVT", category: "test-prep", summary: "Luxembourgish language certificate." },
  { slug: "yki", name: "YKI", category: "test-prep", summary: "Finnish and Swedish language proficiency test." },
  { slug: "swedex-tisus", name: "Swedex / TISUS", category: "test-prep", summary: "Swedish language exams for work and study." },
  { slug: "tys", name: "TYS", category: "test-prep", summary: "Turkish language proficiency exam." },
  { slug: "ib", name: "IB (International Baccalaureate)", category: "test-prep", summary: "IB Diploma subjects, internal assessments and exams." },
  { slug: "igcse", name: "IGCSE", category: "test-prep", summary: "International GCSE subjects and exam practice." },
  { slug: "gcse", name: "GCSE", category: "test-prep", summary: "UK GCSE subjects and exam practice." },
  { slug: "a-level", name: "A-Level", category: "test-prep", summary: "UK A-Level subjects and exam practice." },
  { slug: "concursos", name: "Concursos", category: "test-prep", summary: "Preparation for Brazilian public service exams." },
  // languages (added 2026-11-25)
  { slug: "hindi", name: "Hindi", category: "languages", summary: "Speak, read and write Hindi with a tutor, at your own level." },
  { slug: "gujarati", name: "Gujarati", category: "languages", summary: "Speak, read and write Gujarati with a tutor, at your own level." },
  { slug: "marathi", name: "Marathi", category: "languages", summary: "Speak, read and write Marathi with a tutor, at your own level." },
  { slug: "tamil", name: "Tamil", category: "languages", summary: "Speak, read and write Tamil with a tutor, at your own level." },
  { slug: "telugu", name: "Telugu", category: "languages", summary: "Speak, read and write Telugu with a tutor, at your own level." },
  { slug: "kannada", name: "Kannada", category: "languages", summary: "Speak, read and write Kannada with a tutor, at your own level." },
  { slug: "malayalam", name: "Malayalam", category: "languages", summary: "Speak, read and write Malayalam with a tutor, at your own level." },
  { slug: "bengali", name: "Bengali", category: "languages", summary: "Speak, read and write Bengali with a tutor, at your own level." },
  { slug: "punjabi", name: "Punjabi", category: "languages", summary: "Speak, read and write Punjabi with a tutor, at your own level." },
  { slug: "urdu", name: "Urdu", category: "languages", summary: "Speak, read and write Urdu with a tutor, at your own level." },
  { slug: "sanskrit", name: "Sanskrit", category: "languages", summary: "Speak, read and write Sanskrit with a tutor, at your own level." },
  { slug: "nepali", name: "Nepali", category: "languages", summary: "Speak, read and write Nepali with a tutor, at your own level." },
  { slug: "sindhi", name: "Sindhi", category: "languages", summary: "Speak, read and write Sindhi with a tutor, at your own level." },
  { slug: "sinhala", name: "Sinhala", category: "languages", summary: "Speak, read and write Sinhala with a tutor, at your own level." },
  { slug: "german", name: "German", category: "languages", summary: "Speak, read and write German with a tutor, at your own level." },
  { slug: "italian", name: "Italian", category: "languages", summary: "Speak, read and write Italian with a tutor, at your own level." },
  { slug: "portuguese", name: "Portuguese", category: "languages", summary: "Speak, read and write Portuguese with a tutor, at your own level." },
  { slug: "japanese", name: "Japanese", category: "languages", summary: "Speak, read and write Japanese with a tutor, at your own level." },
  { slug: "korean", name: "Korean", category: "languages", summary: "Speak, read and write Korean with a tutor, at your own level." },
  { slug: "arabic", name: "Arabic", category: "languages", summary: "Speak, read and write Arabic with a tutor, at your own level." },
  { slug: "russian", name: "Russian", category: "languages", summary: "Speak, read and write Russian with a tutor, at your own level." },
  { slug: "polish", name: "Polish", category: "languages", summary: "Speak, read and write Polish with a tutor, at your own level." },
  { slug: "dutch", name: "Dutch", category: "languages", summary: "Speak, read and write Dutch with a tutor, at your own level." },
  { slug: "greek", name: "Greek", category: "languages", summary: "Speak, read and write Greek with a tutor, at your own level." },
  { slug: "turkish", name: "Turkish", category: "languages", summary: "Speak, read and write Turkish with a tutor, at your own level." },
  { slug: "hebrew", name: "Hebrew", category: "languages", summary: "Speak, read and write Hebrew with a tutor, at your own level." },
  { slug: "ukrainian", name: "Ukrainian", category: "languages", summary: "Speak, read and write Ukrainian with a tutor, at your own level." },
  { slug: "czech", name: "Czech", category: "languages", summary: "Speak, read and write Czech with a tutor, at your own level." },
  { slug: "indonesian", name: "Indonesian", category: "languages", summary: "Speak, read and write Indonesian with a tutor, at your own level." },
  { slug: "norwegian", name: "Norwegian", category: "languages", summary: "Speak, read and write Norwegian with a tutor, at your own level." },
  { slug: "swedish", name: "Swedish", category: "languages", summary: "Speak, read and write Swedish with a tutor, at your own level." },
  { slug: "danish", name: "Danish", category: "languages", summary: "Speak, read and write Danish with a tutor, at your own level." },
  { slug: "vietnamese", name: "Vietnamese", category: "languages", summary: "Speak, read and write Vietnamese with a tutor, at your own level." },
  { slug: "thai", name: "Thai", category: "languages", summary: "Speak, read and write Thai with a tutor, at your own level." },
  { slug: "persian", name: "Persian (Farsi)", category: "languages", summary: "Speak, read and write Persian (Farsi) with a tutor, at your own level." },
  { slug: "dari", name: "Dari", category: "languages", summary: "Speak, read and write Dari with a tutor, at your own level." },
  { slug: "serbian", name: "Serbian", category: "languages", summary: "Speak, read and write Serbian with a tutor, at your own level." },
  { slug: "croatian", name: "Croatian", category: "languages", summary: "Speak, read and write Croatian with a tutor, at your own level." },
  { slug: "bosnian", name: "Bosnian", category: "languages", summary: "Speak, read and write Bosnian with a tutor, at your own level." },
  { slug: "slovenian", name: "Slovenian", category: "languages", summary: "Speak, read and write Slovenian with a tutor, at your own level." },
  { slug: "macedonian", name: "Macedonian", category: "languages", summary: "Speak, read and write Macedonian with a tutor, at your own level." },
  { slug: "albanian", name: "Albanian", category: "languages", summary: "Speak, read and write Albanian with a tutor, at your own level." },
  { slug: "latvian", name: "Latvian", category: "languages", summary: "Speak, read and write Latvian with a tutor, at your own level." },
  { slug: "lithuanian", name: "Lithuanian", category: "languages", summary: "Speak, read and write Lithuanian with a tutor, at your own level." },
  { slug: "icelandic", name: "Icelandic", category: "languages", summary: "Speak, read and write Icelandic with a tutor, at your own level." },
  { slug: "maltese", name: "Maltese", category: "languages", summary: "Speak, read and write Maltese with a tutor, at your own level." },
  { slug: "luxembourgish", name: "Luxembourgish", category: "languages", summary: "Speak, read and write Luxembourgish with a tutor, at your own level." },
  { slug: "catalan", name: "Catalan", category: "languages", summary: "Speak, read and write Catalan with a tutor, at your own level." },
  { slug: "basque", name: "Basque", category: "languages", summary: "Speak, read and write Basque with a tutor, at your own level." },
  { slug: "yiddish", name: "Yiddish", category: "languages", summary: "Speak, read and write Yiddish with a tutor, at your own level." },
  { slug: "armenian", name: "Armenian", category: "languages", summary: "Speak, read and write Armenian with a tutor, at your own level." },
  { slug: "georgian", name: "Georgian", category: "languages", summary: "Speak, read and write Georgian with a tutor, at your own level." },
  { slug: "azerbaijani", name: "Azerbaijani", category: "languages", summary: "Speak, read and write Azerbaijani with a tutor, at your own level." },
  { slug: "kazakh", name: "Kazakh", category: "languages", summary: "Speak, read and write Kazakh with a tutor, at your own level." },
  { slug: "mongolian", name: "Mongolian", category: "languages", summary: "Speak, read and write Mongolian with a tutor, at your own level." },
  { slug: "tibetan", name: "Tibetan", category: "languages", summary: "Speak, read and write Tibetan with a tutor, at your own level." },
  { slug: "burmese", name: "Burmese", category: "languages", summary: "Speak, read and write Burmese with a tutor, at your own level." },
  { slug: "khmer", name: "Khmer", category: "languages", summary: "Speak, read and write Khmer with a tutor, at your own level." },
  { slug: "lao", name: "Lao", category: "languages", summary: "Speak, read and write Lao with a tutor, at your own level." },
  { slug: "malay", name: "Malay", category: "languages", summary: "Speak, read and write Malay with a tutor, at your own level." },
  { slug: "tagalog", name: "Tagalog", category: "languages", summary: "Speak, read and write Tagalog with a tutor, at your own level." },
  { slug: "cebuano", name: "Cebuano", category: "languages", summary: "Speak, read and write Cebuano with a tutor, at your own level." },
  { slug: "amharic", name: "Amharic", category: "languages", summary: "Speak, read and write Amharic with a tutor, at your own level." },
  { slug: "yoruba", name: "Yoruba", category: "languages", summary: "Speak, read and write Yoruba with a tutor, at your own level." },
  { slug: "zulu", name: "Zulu", category: "languages", summary: "Speak, read and write Zulu with a tutor, at your own level." },
  { slug: "xhosa", name: "Xhosa", category: "languages", summary: "Speak, read and write Xhosa with a tutor, at your own level." },
  { slug: "afrikaans", name: "Afrikaans", category: "languages", summary: "Speak, read and write Afrikaans with a tutor, at your own level." },
  { slug: "kinyarwanda", name: "Kinyarwanda", category: "languages", summary: "Speak, read and write Kinyarwanda with a tutor, at your own level." },
  { slug: "luganda", name: "Luganda", category: "languages", summary: "Speak, read and write Luganda with a tutor, at your own level." },
  { slug: "tamazight", name: "Tamazight", category: "languages", summary: "Speak, read and write Tamazight with a tutor, at your own level." },
  { slug: "crimean-tatar", name: "Crimean Tatar", category: "languages", summary: "Speak, read and write Crimean Tatar with a tutor, at your own level." },
  { slug: "latin", name: "Latin", category: "languages", summary: "Latin grammar, translation and classical texts." },
  { slug: "ancient-greek", name: "Ancient Greek", category: "languages", summary: "Grammar and translation of classical Greek texts." },
  { slug: "sign-language", name: "Sign Language", category: "languages", summary: "Signing to communicate with deaf and hard-of-hearing people." },
  // computer-science (added 2026-11-25)
  { slug: "general-computer-science", name: "General Computer Science", category: "computer-science", summary: "How computers, programs and algorithms work." },
  { slug: "cpp", name: "C++", category: "computer-science", summary: "Pointers, memory, object-oriented code and algorithms in C++." },
  { slug: "django", name: "Django", category: "computer-science", summary: "Building web apps and APIs with Python's Django." },
  { slug: "information-technology", name: "Information Technology", category: "computer-science", summary: "Computers, software, networks and everyday digital skills." },
  { slug: "networking", name: "Networking", category: "computer-science", summary: "How networks work: TCP/IP, routing and security basics." },
  { slug: "excel", name: "Excel", category: "computer-science", summary: "Spreadsheets, formulas, charts and data analysis." },
  // social-studies (added 2026-11-25)
  { slug: "history", name: "History", category: "social-studies", summary: "Key events and ideas from ancient times to today." },
  { slug: "ancient-history", name: "Ancient History", category: "social-studies", summary: "Early civilisations: Egypt, Greece, Rome and beyond." },
  { slug: "european-history", name: "European History", category: "social-studies", summary: "Europe from the Middle Ages to the modern era." },
  { slug: "geography", name: "Geography", category: "social-studies", summary: "Places, people, climate and the physical world." },
  { slug: "social-studies-general", name: "Social Studies", category: "social-studies", summary: "Society, culture, government and citizenship." },
  { slug: "sociology", name: "Sociology", category: "social-studies", summary: "How societies, groups and institutions work." },
  { slug: "psychology", name: "Psychology", category: "social-studies", summary: "The mind, behaviour, learning and development." },
  { slug: "philosophy", name: "Philosophy", category: "social-studies", summary: "Big questions, arguments and the great thinkers." },
  { slug: "logic", name: "Logic", category: "social-studies", summary: "Reasoning, arguments and formal logic." },
  { slug: "political-science", name: "Political Science", category: "social-studies", summary: "Governments, power, policy and political ideas." },
  { slug: "law", name: "Law", category: "social-studies", summary: "Legal systems, cases and legal reasoning." },
  { slug: "criminology", name: "Criminology", category: "social-studies", summary: "Crime, its causes and society's response." },
  { slug: "criminal-justice", name: "Criminal Justice", category: "social-studies", summary: "Police, courts, corrections and how justice works." },
  { slug: "archaeology", name: "Archaeology", category: "social-studies", summary: "Studying the past through what people left behind." },
  { slug: "classical-civilisation", name: "Classical Civilisation", category: "social-studies", summary: "The culture, literature and history of Greece and Rome." },
  { slug: "religious-studies", name: "Religious Studies", category: "social-studies", summary: "World religions, beliefs and ethics." },
  { slug: "humanities", name: "Humanities", category: "social-studies", summary: "History, literature, philosophy and the arts together." },
  // arts (added 2026-11-25)
  { slug: "singing", name: "Singing", category: "arts", summary: "Voice technique, breathing and songs you love." },
  { slug: "drums", name: "Drums", category: "arts", summary: "Rhythm, technique and grooves on the drum kit." },
  { slug: "art", name: "Art", category: "arts", summary: "Painting, sketching and art techniques." },
  { slug: "acting", name: "Acting", category: "arts", summary: "Voice, movement, scenes and auditions." },
  // business (added 2026-11-25)
  { slug: "accounting", name: "Accounting", category: "business", summary: "Bookkeeping, financial statements and cost accounting." },
  { slug: "business-management", name: "Business & Management", category: "business", summary: "How organisations are run, planned and led." },
  { slug: "business-studies", name: "Business Studies", category: "business", summary: "School and college business courses and exams." },
  { slug: "macroeconomics", name: "Macroeconomics", category: "business", summary: "Growth, inflation, unemployment and government policy." },
  { slug: "microeconomics", name: "Microeconomics", category: "business", summary: "Markets, prices, supply and demand." },
  { slug: "econometrics", name: "Econometrics", category: "business", summary: "Statistics and models for economic data." },
  { slug: "cfa", name: "CFA", category: "business", summary: "Preparation for the Chartered Financial Analyst exams." },
  // engineering (added 2026-11-25)
  { slug: "general-engineering", name: "General Engineering", category: "engineering", summary: "Engineering principles, problem solving and design." },
  { slug: "mechanical-engineering", name: "Mechanical Engineering", category: "engineering", summary: "Statics, dynamics, thermodynamics and machine design." },
  { slug: "electrical-engineering", name: "Electrical Engineering", category: "engineering", summary: "Circuits, power and electrical systems." },
  { slug: "electronics", name: "Electronics", category: "engineering", summary: "Components, circuits and how devices work." },
  // health (added 2026-11-25)
  { slug: "anatomy", name: "Anatomy", category: "health", summary: "The structure of the human body." },
  { slug: "physiology", name: "Physiology", category: "health", summary: "How the body's systems work together." },
  { slug: "nursing", name: "Nursing", category: "health", summary: "Nursing theory, practice and exam preparation." },
  { slug: "pharmacology", name: "Pharmacology", category: "health", summary: "How medicines work in the body." },
  { slug: "pathology", name: "Pathology", category: "health", summary: "The causes and effects of disease." },
  { slug: "epidemiology", name: "Epidemiology", category: "health", summary: "How diseases spread in populations, and how to study it." },
  // early-years (added 2026-11-25)
  { slug: "preschool", name: "Preschool", category: "early-years", summary: "Early learning through play: letters, numbers, shapes and colours." },
  { slug: "kindergarten", name: "Kindergarten", category: "early-years", summary: "Reading readiness, early maths and classroom skills." },
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

/** What a new site starts with: the full starter list. */
export const DEFAULT_SUBJECT_CATEGORIES: SubjectCategory[] = STARTER_SUBJECT_CATEGORIES;
export const DEFAULT_SUBJECTS: Subject[] = STARTER_SUBJECTS;

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

/** Languages tutors teach in and learners look for, most used first (LanguagePicker shows the first ones as chips). */
export const LANGUAGES = ["English", "Hindi", "Gujarati", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Punjabi", "Urdu", "Spanish", "French", "German", "Arabic", "Mandarin", "Nepali", "Sindhi", "Sinhala", "Italian", "Portuguese", "Japanese", "Korean", "Russian", "Polish", "Dutch", "Greek", "Turkish", "Hebrew", "Ukrainian", "Czech", "Indonesian", "Norwegian", "Swedish", "Danish", "Vietnamese", "Thai", "Persian (Farsi)", "Dari", "Serbian", "Croatian", "Bosnian", "Slovenian", "Macedonian", "Albanian", "Latvian", "Lithuanian", "Icelandic", "Maltese", "Luxembourgish", "Catalan", "Basque", "Yiddish", "Armenian", "Georgian", "Azerbaijani", "Kazakh", "Mongolian", "Tibetan", "Burmese", "Khmer", "Lao", "Malay", "Tagalog", "Cebuano", "Amharic", "Yoruba", "Zulu", "Xhosa", "Afrikaans", "Kinyarwanda", "Luganda", "Tamazight", "Crimean Tatar", "Sign Language"];

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
