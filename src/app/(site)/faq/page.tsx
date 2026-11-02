import type { Metadata } from "next";
import { PageHero, Section, CtaBand } from "@/components/marketing/Section";
import { Reveal } from "@/components/motion";
import { FaqView } from "@/components/content/FaqView";
import { publishedFaqs } from "@/server/public";

/** Figures and content come from the database; the page is rebuilt at most once a minute. */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about finding a tutor, trial lessons, parent accounts, tutor verification, payouts, lead credits, payments, cancellations and safety on TutorLink.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const faqs = await publishedFaqs();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero eyebrow="FAQ" title="Questions, answered." description="Everything families and tutors ask most — about finding a tutor, payments, verification and safety. Search, or browse by topic." />
      <Section className="pt-12 sm:pt-14 lg:pt-16">
        <Reveal>
          <FaqView faqs={faqs} />
        </Reveal>
      </Section>
      <CtaBand title="Still have a question?" description="Our team reads every message and replies by email." primary={{ href: "/contact", label: "Contact support" }} secondary={{ href: "/how-it-works", label: "How it works" }} />
    </>
  );
}
