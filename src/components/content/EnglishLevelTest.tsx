"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Controls";
import { TEST_QUESTIONS, levelFor } from "@/lib/data/english-test";

/** The free English level test: one question at a time, then the estimated level and tutors to look at. */
export function EnglishLevelTest() {
  const total = TEST_QUESTIONS.length;
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => TEST_QUESTIONS.map(() => null));
  const [i, setI] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const topRef = React.useRef<HTMLDivElement>(null);
  const q = TEST_QUESTIONS[i];
  const chosen = answers[i];

  const go = (n: number) => {
    setI(n);
    topRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const restart = () => {
    setAnswers(TEST_QUESTIONS.map(() => null));
    setI(0);
    setDone(false);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  if (done) {
    const correct = answers.filter((a, k) => a === TEST_QUESTIONS[k].answer).length;
    const r = levelFor(correct);
    return (
      <div ref={topRef} className="space-y-6" data-test-result={r.level}>
        <div className="border border-line bg-surface p-6 sm:p-8">
          <p className="mono-label">Your estimated level</p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-heading text-[3.5rem] leading-none text-ink">{r.level}</span>
            <span className="text-xl font-medium text-ink">{r.name}</span>
          </p>
          <p className="mt-2 text-[15px] text-muted">
            {correct} of {total} right
          </p>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">{r.meaning}</p>
          <p className="mt-6 text-sm font-semibold text-ink">Find a tutor for your next step</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {r.next.map((n) => (
              <Button key={n.slug} asChild variant="secondary" size="sm">
                <Link href={`/tutors?subject=${n.slug}`}>
                  <Search /> {n.label} tutors
                </Link>
              </Button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={restart} variant="ghost" size="sm">
              <RotateCcw /> Take the test again
            </Button>
          </div>
          <p className="mt-5 text-[12.5px] text-muted">A quick estimate, not an official certificate. Your answers stay in this browser; nothing is saved or sent.</p>
        </div>

        <section aria-label="Your answers" className="border border-line bg-surface">
          <p className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">Your answers</p>
          <ol className="divide-y divide-line">
            {TEST_QUESTIONS.map((t, k) => {
              const right = answers[k] === t.answer;
              return (
                <li key={k} className="flex gap-3 px-5 py-3.5 text-[14px]">
                  <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center", right ? "bg-success text-white" : "bg-danger text-white")} aria-label={right ? "Right" : "Wrong"}>
                    {right ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink">
                      <span className="mono-label mr-2">{t.level}</span>
                      {t.prompt.replace("___", `“${t.options[t.answer]}”`)}
                    </p>
                    {!right && (
                      <p className="mt-0.5 text-muted">
                        You chose “{answers[k] === null ? "nothing" : t.options[answers[k]!]}”. {t.why}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    );
  }

  return (
    <div ref={topRef} className="border border-line bg-surface p-6 sm:p-8" data-test-question={i + 1}>
      <div className="flex items-center justify-between gap-4 text-[13px] text-muted">
        <span>
          Question {i + 1} of {total}
        </span>
        <span>{answers.filter((a) => a !== null).length} answered</span>
      </div>
      <Progress value={Math.round(((i + (chosen !== null ? 1 : 0)) / total) * 100)} label="Test progress" className="mt-2" />
      <p className="mt-7 text-xl leading-snug text-ink sm:text-2xl" id="question-text">
        {q.prompt.split("___").map((part, k, all) => (
          <React.Fragment key={k}>
            {part}
            {k < all.length - 1 && <span className="mx-1 inline-block min-w-16 border-b-2 border-brand text-center text-brand">{chosen !== null ? q.options[chosen] : " "}</span>}
          </React.Fragment>
        ))}
      </p>
      <div role="radiogroup" aria-labelledby="question-text" className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {q.options.map((o, k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={chosen === k}
            onClick={() => setAnswers((a) => a.map((x, n) => (n === i ? k : x)))}
            className={cn(
              "flex items-center gap-3 border px-4 py-3 text-left text-[15.5px] transition-colors",
              chosen === k ? "border-brand bg-brand-soft text-ink" : "border-line-strong text-ink-2 hover:border-ink hover:text-ink",
            )}
          >
            <span className={cn("grid size-6 shrink-0 place-items-center border text-[12px] font-semibold", chosen === k ? "border-brand bg-brand text-on-brand" : "border-line-strong")}>{"ABCD"[k]}</span>
            {o}
          </button>
        ))}
      </div>
      <div className="mt-7 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(i - 1)} disabled={i === 0}>
          <ArrowLeft /> Back
        </Button>
        {i < total - 1 ? (
          <Button onClick={() => go(i + 1)} disabled={chosen === null}>
            Next <ArrowRight />
          </Button>
        ) : (
          <Button onClick={() => setDone(true)} disabled={answers.some((a) => a === null)} data-test-finish="">
            See my level <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
