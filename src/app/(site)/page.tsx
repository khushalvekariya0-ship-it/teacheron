import type { Metadata } from "next";
import { Hero, TrustBar, SubjectTiles, HowItWorks, GetMatched, FeaturedTutors, WhyTutorLink, Stories, BecomeTutor, HomeFaq, ClosingCta } from "@/components/home/Sections";
import { SubjectMarquee, Programs, LessonModes, Audiences, Resources } from "@/components/home/MoreSections";
import { FAQS } from "@/lib/data/content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — Find the Right Tutor. Learn With Confidence.` },
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      areaServed: "US",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url,
      potentialAction: { "@type": "SearchAction", target: `${SITE.url}/tutors?q={query}`, "query-input": "required name=query" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.filter((f) => f.audience !== "tutors").slice(0, 7).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero />
      <SubjectMarquee />
      <TrustBar />
      <SubjectTiles />
      <HowItWorks />
      <GetMatched />
      <Programs />
      <LessonModes />
      <FeaturedTutors />
      <WhyTutorLink />
      <Audiences />
      <BecomeTutor />
      <Stories />
      <Resources />
      <HomeFaq />
      <ClosingCta />
    </>
  );
}
