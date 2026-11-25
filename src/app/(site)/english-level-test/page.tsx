import type { Metadata } from "next";
import { PageHero, Section } from "@/components/marketing/Section";
import { EnglishLevelTest } from "@/components/content/EnglishLevelTest";

export const metadata: Metadata = {
  title: "Free English level test",
  description: "Check your English level in about 10 minutes: 24 questions from beginner (A1) to proficient (C2), your estimated level, and English tutors for your next step. Free, no sign-up.",
  alternates: { canonical: "/english-level-test" },
};

export default function EnglishLevelTestPage() {
  return (
    <>
      <PageHero
        eyebrow="Free English test"
        title="What's your English level?"
        description="24 short questions, from beginner (A1) to proficient (C2). About 10 minutes, free, no sign-up. At the end you'll see your estimated level and English tutors for your next step."
      />
      <Section className="pt-10 sm:pt-12 lg:pt-14">
        <div className="mx-auto max-w-3xl">
          <EnglishLevelTest />
        </div>
      </Section>
    </>
  );
}
