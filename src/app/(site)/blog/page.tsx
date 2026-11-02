import type { Metadata } from "next";
import { PageHero, Section } from "@/components/marketing/Section";
import { Reveal } from "@/components/motion";
import { BlogIndex } from "@/components/content/BlogIndex";
import { publishedPosts } from "@/server/public";

/** Figures and content come from the database; the page is rebuilt at most once a minute. */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog & resources",
  description: "Practical guides for parents, students and tutors: choosing a tutor, test prep study plans, online vs in-person lessons, and building a tutoring practice.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = [...(await publishedPosts())].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHero eyebrow="Blog & resources" title="Practical guides for better learning." description="Straightforward advice for parents, students and tutors — from choosing a tutor to planning for test day." />
      <Section className="pt-12 sm:pt-14 lg:pt-16">
        <Reveal>
          <BlogIndex posts={posts} />
        </Reveal>
      </Section>
    </>
  );
}
