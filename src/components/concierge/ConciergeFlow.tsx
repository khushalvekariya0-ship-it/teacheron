"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, ClipboardList, Lock, Pencil, Plus, RotateCcw, Search, SearchX, Sparkles, Wand2, X } from "lucide-react";
import { parseNaturalLanguage, rankTutors } from "@/lib/matching";
import { subjectName } from "@/lib/data/catalog";
import { useFlag, useTutors } from "@/lib/store/hooks";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Segmented } from "@/components/ui/Controls";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { motion, AnimatePresence, EASE } from "@/components/motion";
import { cn } from "@/lib/utils";
import {
  EMPTY_ANSWERS, answersSchema, answersToCriteria, answersToParams, buildSuggestions, criteriaToAnswers, paramsToAnswers, postRequirementHref, summarize, tutorsHref,
  type AnswerKey, type Answers,
} from "./model";
import { ANSWER_LABEL, AnswerField } from "./AnswerFields";
import { ResultCard } from "./ResultCard";
import { ScoringDialog } from "./ScoringDialog";
import { Eyebrow } from "@/components/marketing/Section";

type Stage = "input" | "review" | "results";
type Way = "describe" | "guided";

const EXAMPLES = [
  "My 8th grader needs algebra help twice a week after school, under $70/hr, online",
  "SAT prep for my junior on weekends, in person near 90024, up to $150 an hour",
  "Chemistry help for my 11th grader on Monday and Wednesday evenings, tutor with 5+ years of experience",
  "Reading support for my 2nd grader with dyslexia, weekday afternoons near 98103",
  "Python for an adult career changer, weekday evenings, online, up to $90 an hour",
];

const REVIEW_ORDER: AnswerKey[] = ["subject", "grade", "mode", "zip", "days", "timesOfDay", "budgetMax", "minExperience", "language", "support"];
const EMPTY_FOR: Record<AnswerKey, Answers[AnswerKey]> = EMPTY_ANSWERS;

const panelMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

function hasValue(a: Answers, k: AnswerKey): boolean {
  const v = a[k];
  return Array.isArray(v) ? v.length > 0 : !!v;
}

export function ConciergeFlow() {
  const nlEnabled = useFlag("ai_matching");
  const params = useSearchParams();
  const router = useRouter();
  const tutors = useTutors();

  // Restore results from the URL once (e.g. coming back from a tutor profile).
  const [boot] = React.useState(() => {
    const p = new URLSearchParams(params.toString());
    if (p.get("view") !== "results") return null;
    const answers = paramsToAnswers(p);
    return answers.subject ? { answers, from: (p.get("from") === "describe" ? "describe" : "guided") as Way } : null;
  });

  const [stage, setStage] = React.useState<Stage>(boot ? "results" : "input");
  const [way, setWay] = React.useState<Way>(boot?.from ?? "describe");
  const [text, setText] = React.useState("");
  const [textError, setTextError] = React.useState<string | null>(null);
  const [found, setFound] = React.useState<AnswerKey[]>(boot ? REVIEW_ORDER.filter((k) => hasValue(boot.answers, k)) : []);
  const [shown, setShown] = React.useState<AnswerKey[]>(found);
  const [results, setResults] = React.useState<Answers | null>(boot?.answers ?? null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  const activeWay: Way = nlEnabled ? way : "guided";

  const form = useForm<Answers>({ resolver: zodResolver(answersSchema), defaultValues: boot?.answers ?? EMPTY_ANSWERS, mode: "onTouched" });
  const { control, formState, handleSubmit, reset, setValue, getValues } = form;

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const syncUrl = (a: Answers | null, from: Way) => {
    if (!a) {
      router.replace("/concierge", { scroll: false });
      return;
    }
    const p = answersToParams(a);
    p.set("view", "results");
    p.set("from", from);
    router.replace(`/concierge?${p.toString()}`, { scroll: false });
  };

  const understand = () => {
    const t = text.trim();
    if (t.length < 8) {
      setTextError("Tell us a little more — at least the subject and who it's for.");
      textRef.current?.focus();
      return;
    }
    const { answers, found: keys } = criteriaToAnswers(parseNaturalLanguage(t));
    reset(answers);
    setFound(keys);
    setShown(keys.length ? keys : ["subject"]);
    setStage("review");
    scrollTop();
  };

  const onValid = (values: Answers) => {
    setResults(values);
    setStage("results");
    syncUrl(values, activeWay);
    scrollTop();
  };
  const onInvalid = (errs: FieldErrors<Answers>) => {
    const keys = Object.keys(errs) as AnswerKey[];
    setShown((s) => REVIEW_ORDER.filter((k) => s.includes(k) || keys.includes(k)));
  };
  const submit = (e: React.FormEvent) => handleSubmit(onValid, onInvalid)(e);

  const adjust = () => {
    const current = getValues();
    if (activeWay === "describe") {
      setShown(REVIEW_ORDER.filter((k) => hasValue(current, k) || found.includes(k)));
      setStage("review");
    } else setStage("input");
    syncUrl(null, activeWay);
    scrollTop();
  };

  const startOver = () => {
    reset(EMPTY_ANSWERS);
    setText("");
    setFound([]);
    setShown([]);
    setResults(null);
    setStage("input");
    syncUrl(null, activeWay);
    scrollTop();
  };

  const applySuggestion = (patch: Partial<Answers>) => {
    if (!results) return;
    const next = { ...results, ...patch };
    (Object.keys(patch) as AnswerKey[]).forEach((k) => setValue(k, patch[k] as never, { shouldDirty: true }));
    setResults(next);
    syncUrl(next, activeWay);
  };

  const steps = activeWay === "describe" ? (["Describe", "Confirm", "Matches"] as const) : (["Answer", "Matches"] as const);
  const stepIndex = stage === "results" ? steps.length - 1 : stage === "review" ? 1 : 0;

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progress */}
      <ol className="mx-auto mb-8 flex max-w-md items-center justify-center gap-2 sm:mb-10" aria-label="Progress">
        {steps.map((label, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "todo";
          return (
            <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
              <span className={cn("relative inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition-colors", state === "current" ? "text-ink" : state === "done" ? "text-ink-2" : "text-subtle")}>
                {state === "current" && <motion.span layoutId="cg-step" className="absolute inset-0 rounded-lg bg-brand-soft" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <span className={cn("relative grid size-5 place-items-center rounded-md text-[11px] font-bold tabular-nums", state === "current" || state === "done" ? "bg-ink text-on-ink" : "border border-line-strong")}>{i + 1}</span>
                <span className="relative">{label}</span>
                <span className="sr-only">{state === "done" ? "(completed)" : state === "current" ? "(current step)" : ""}</span>
              </span>
              {i < steps.length - 1 && <span className="h-px w-6 bg-line-strong sm:w-10" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        {stage === "input" && (
          <motion.div key={`input-${activeWay}`} {...panelMotion} className="mx-auto max-w-3xl">
            {nlEnabled && (
              <div className="mb-6 flex justify-center">
                <Segmented<Way>
                  label="How would you like to start?"
                  value={activeWay}
                  onChange={setWay}
                  options={[
                    { value: "describe", label: "Describe it" },
                    { value: "guided", label: "Answer a few questions" },
                  ]}
                />
              </div>
            )}

            {activeWay === "describe" ? (
              <div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    understand();
                  }}
                  className={cn("rounded-2xl border-2 bg-surface p-1.5 transition-colors", textError ? "border-danger" : "border-line-strong focus-within:border-ink")}
                >
                  <label htmlFor="cg-text" className="block px-4 pt-3.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Describe what you&apos;re looking for
                  </label>
                  <textarea
                    ref={textRef}
                    id="cg-text"
                    value={text}
                    maxLength={600}
                    rows={4}
                    onChange={(e) => {
                      setText(e.target.value);
                      setTextError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        understand();
                      }
                    }}
                    aria-invalid={!!textError}
                    aria-describedby={textError ? "cg-text-error" : "cg-privacy"}
                    placeholder="Who is it for, which subject, when, where and your budget…"
                    className="block min-h-36 w-full resize-none bg-transparent px-4 py-2.5 text-[17px] leading-relaxed text-ink outline-none placeholder:text-subtle"
                  />
                  <div className="flex flex-col gap-3 border-t border-line px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:pl-4">
                    <p id="cg-privacy" className="flex items-center gap-2 text-[12.5px] text-muted">
                      <Lock className="size-3.5 shrink-0 text-ink" aria-hidden />
                      Processed in your browser. Nothing you type is sent to an AI provider.
                    </p>
                    <Button type="submit" className="shrink-0">
                      <Wand2 /> Find my matches
                    </Button>
                  </div>
                </form>
                <AnimatePresence>
                  {textError && (
                    <motion.p id="cg-text-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 px-1 text-[13px] text-danger">
                      {textError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <p className="mt-8 text-[13px] font-medium text-muted">Try an example</p>
                <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {EXAMPLES.map((ex) => (
                    <motion.li key={ex} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}>
                      <button
                        type="button"
                        onClick={() => {
                          setText(ex);
                          setTextError(null);
                          textRef.current?.focus();
                        }}
                        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-left text-[13.5px] leading-snug text-ink-2 transition-colors hover:border-ink hover:text-ink sm:w-auto sm:py-2"
                      >
                        “{ex}”
                      </button>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-surface">
                <GuidedSection title="The basics" description="The subject is all we need — everything else sharpens the match.">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <AnswerField name="subject" control={control} errors={formState.errors} />
                    <AnswerField name="grade" control={control} errors={formState.errors} />
                  </div>
                  <AnswerField name="goal" control={control} errors={formState.errors} />
                </GuidedSection>
                <GuidedSection title="Format & location">
                  <AnswerField name="mode" control={control} errors={formState.errors} />
                  <AnswerField name="zip" control={control} errors={formState.errors} />
                </GuidedSection>
                <GuidedSection title="Schedule">
                  <AnswerField name="days" control={control} errors={formState.errors} />
                  <AnswerField name="timesOfDay" control={control} errors={formState.errors} />
                </GuidedSection>
                <GuidedSection title="Budget & preferences">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <AnswerField name="budgetMax" control={control} errors={formState.errors} />
                    <AnswerField name="minExperience" control={control} errors={formState.errors} />
                  </div>
                  <AnswerField name="language" control={control} errors={formState.errors} />
                  <AnswerField name="support" control={control} errors={formState.errors} />
                </GuidedSection>
                <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-line bg-canvas px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <p className="text-[12.5px] text-muted">No account needed to see matches.</p>
                  <Button type="submit" size="lg">
                    Show my matches <ArrowRight />
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        )}

        {stage === "review" && (
          <motion.div key="review" {...panelMotion} className="mx-auto max-w-3xl">
            <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-surface">
              <div className="border-b border-line px-5 py-5 sm:px-7 sm:py-6">
                <h2 className="font-heading text-2xl font-extrabold tracking-[-0.035em] text-ink sm:text-[1.75rem]">{text.trim() ? "Here's what we understood" : "Your answers"}</h2>
                {text.trim() ? (
                  <blockquote className="mt-3 border-l-[3px] border-brand pl-3 text-[14.5px] leading-relaxed text-ink-2">“{text.trim()}”</blockquote>
                ) : (
                  <p className="mt-1.5 text-sm text-muted">Edit anything below, or describe what you need in your own words.</p>
                )}
                <button type="button" onClick={() => setStage("input")} className="mt-3 inline-flex h-9 items-center gap-1.5 text-[13px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                  <Pencil className="size-3.5" aria-hidden /> {text.trim() ? "Edit description" : "Describe it instead"}
                </button>
              </div>

              <div className="space-y-6 px-5 py-6 sm:px-7">
                {found.length === 0 && (
                  <InlineAlert tone="info" title="We couldn't pick out specific details">
                    Choose a subject below and add anything else that matters. We never fill in details you didn&apos;t give us.
                  </InlineAlert>
                )}
                <AnimatePresence initial={false}>
                  {shown.map((k) => (
                    <motion.div
                      key={k}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
                      className="relative"
                    >
                      <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5">
                        {text.trim() && <Badge tone={found.includes(k) ? "accent" : "neutral"} size="sm">{found.includes(k) ? "From your text" : "Added by you"}</Badge>}
                        {k !== "subject" && (
                          <button
                            type="button"
                            onClick={() => {
                              setShown((s) => s.filter((x) => x !== k));
                              setValue(k, EMPTY_FOR[k] as never, { shouldDirty: true });
                            }}
                            className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
                            aria-label={`Remove ${ANSWER_LABEL[k].toLowerCase()}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <AnswerField name={k} control={control} errors={formState.errors} idPrefix="rv" compact />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {REVIEW_ORDER.some((k) => !shown.includes(k)) && (
                <div className="border-t border-line bg-canvas px-5 py-5 sm:px-7">
                  <p className="text-sm font-bold text-ink">Not mentioned</p>
                  <p className="mt-0.5 text-[13px] text-muted">Add anything that matters to you — we don&apos;t guess.</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {REVIEW_ORDER.filter((k) => !shown.includes(k)).map((k) => (
                      <li key={k}>
                        <button
                          type="button"
                          onClick={() => setShown((s) => REVIEW_ORDER.filter((x) => s.includes(x) || x === k))}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
                        >
                          <Plus className="size-3.5" aria-hidden /> {k === "minExperience" ? "Experience" : k === "language" ? "Language" : ANSWER_LABEL[k]}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <Button type="button" variant="ghost" onClick={() => setStage("input")}>
                  <ArrowLeft /> Back
                </Button>
                <Button type="submit" size="lg">
                  Show my matches <ArrowRight />
                </Button>
              </div>
            </form>
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-[12.5px] text-muted">
              <Lock className="size-3.5 text-ink" aria-hidden /> Processed in your browser. Nothing you type is sent to an AI provider.
            </p>
          </motion.div>
        )}

        {stage === "results" && results && (
          <motion.div key="results" {...panelMotion}>
            <Results answers={results} tutors={tutors} onAdjust={adjust} onStartOver={startOver} onSuggestion={applySuggestion} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GuidedSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border-b border-line px-5 py-6 last-of-type:border-b-0 sm:px-7">
      <div>
        <h2 className="text-[16px] font-bold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/* ─── Results ───────────────────────────────────────────────────────────────── */

function Results({
  answers,
  tutors,
  onAdjust,
  onStartOver,
  onSuggestion,
}: {
  answers: Answers;
  tutors: ReturnType<typeof useTutors>;
  onAdjust: () => void;
  onStartOver: () => void;
  onSuggestion: (patch: Partial<Answers>) => void;
}) {
  const criteria = React.useMemo(() => answersToCriteria(answers), [answers]);
  const qualified = React.useMemo(() => rankTutors(tutors, criteria).filter((r) => !r.disqualified), [tutors, criteria]);
  const top = qualified.slice(0, 5);
  const weak = top.length > 0 && top[0].percent < 75;
  const suggestions = React.useMemo(() => (top.length === 0 || weak ? buildSuggestions(tutors, answers) : []), [tutors, answers, top.length, weak]);
  const chips = summarize(answers);

  return (
    <div>
      <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Eyebrow className="mb-4 text-ink">Your shortlist</Eyebrow>
          <h2 className="font-heading text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink sm:text-[2.25rem]">
            {top.length ? `Top ${top.length === 1 ? "match" : `${top.length} matches`} for ${subjectName(answers.subject)}` : `No ${subjectName(answers.subject)} tutors match yet`}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Scored {pluralize(tutors.length, "tutor")} against your answers · {pluralize(qualified.length, "qualified tutor")}
          </p>
          {answers.goal.trim() && <p className="mt-2 text-sm text-ink-2"><span className="text-muted">Goal:</span> {answers.goal.trim()}</p>}
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Your answers">
            {chips.map((c) => (
              <li key={c.key}>
                <Badge tone="neutral">{c.label}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ScoringDialog />
          <Button variant="secondary" size="sm" onClick={onAdjust}>
            <Pencil /> Adjust answers
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
        <div className="min-w-0">
          {top.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong">
              <EmptyState
                icon={<SearchX />}
                title="No tutors fit all of that yet"
                description="No tutor on TutorLink teaches this subject area in the format you need. Try one of these changes, or post a requirement so tutors can come to you."
                action={
                  <>
                    {suggestions.map((s) => (
                      <Button key={s.id} variant="secondary" onClick={() => onSuggestion(s.patch)}>
                        {s.label} <span className="text-muted">· {pluralize(s.count, "tutor")}</span>
                      </Button>
                    ))}
                    <Button asChild>
                      <Link href={postRequirementHref(answers)}>Post this as a requirement</Link>
                    </Button>
                  </>
                }
              />
            </div>
          ) : (
            <ol className="space-y-5">
              {top.map((r, i) => (
                <motion.li key={r.tutor.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE, delay: 0.08 + i * 0.07 }}>
                  <ResultCard result={r} rank={i + 1} criteria={criteria} />
                </motion.li>
              ))}
            </ol>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Next steps">
          {weak && suggestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-warning-200 bg-warning-50 p-5">
              <p className="flex items-center gap-2 text-[15px] font-bold text-ink">
                <Sparkles className="size-4 text-warning" aria-hidden /> Want closer matches?
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">The best score is {top[0].percent}%. These changes would help:</p>
              <ul className="mt-3 space-y-2">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSuggestion(s.patch)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-warning-200 bg-surface px-3 py-2.5 text-left text-[13px] font-medium text-ink transition-colors hover:border-warning"
                    >
                      <span>{s.label}</span>
                      <span className="shrink-0 tabular-nums text-muted">top {s.top}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-heading text-lg font-extrabold tracking-[-0.02em] text-ink">Keep going</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild>
                <Link href={tutorsHref(answers)}>
                  <Search /> See all matching tutors
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={postRequirementHref(answers)}>
                  <ClipboardList /> Post this as a requirement
                </Link>
              </Button>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Posting lets tutors apply to you. It&apos;s free, and only your city and ZIP are shown.</p>
            <button type="button" onClick={onStartOver} className="mt-4 inline-flex h-9 items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
              <RotateCcw className="size-3.5" aria-hidden /> Start over
            </button>
          </div>
          <p className="px-1 text-[12.5px] leading-relaxed text-muted">
            Scores are rules-based and transparent. Featured placement and subscription plans never affect them.{" "}
            <ScoringDialog trigger={<button type="button" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">How scoring works</button>} />
          </p>
        </aside>
      </div>
    </div>
  );
}
