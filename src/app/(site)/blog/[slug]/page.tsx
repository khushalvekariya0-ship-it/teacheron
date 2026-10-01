import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { ArrowLink, CtaBand, Panel, Section, SectionHeading } from "@/components/marketing/Section";
import { PostCard, PostCover, PostMeta } from "@/components/content/Blog";
import { BLOG_POSTS, type BlogPost } from "@/lib/data/content";
import { SITE } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Article not found", robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    authors: [{ name: post.author }],
    openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.date, authors: [post.author], siteName: SITE.name, locale: "en_US" },
  };
}

const CTA: Record<BlogPost["category"], { title: string; description: string; primary: { href: string; label: string }; secondary: { href: string; label: string } }> = {
  Parents: { title: "Ready to find a tutor?", description: "Search is free. Every recommendation explains why it matches.", primary: { href: "/concierge", label: "Help me find a tutor" }, secondary: { href: "/for-parents", label: "Parent accounts" } },
  Students: { title: "Want help staying on track?", description: "Find a tutor who teaches exactly what you're studying.", primary: { href: "/tutors", label: "Find a tutor" }, secondary: { href: "/subjects/study-skills", label: "Study skills tutors" } },
  "Test prep": { title: "Build your plan with a tutor.", description: "Test prep specialists can turn a practice score into a week-by-week plan.", primary: { href: "/tutors?subject=sat", label: "SAT tutors" }, secondary: { href: "/subjects/act", label: "ACT tutors" } },
  Tutors: { title: "Teach on your terms.", description: "Set your rates and schedule, and get paid through Stripe Connect.", primary: { href: "/become-a-tutor", label: "Become a tutor" }, secondary: { href: "/pricing#tutors", label: "Plans & commission" } },
};

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = [...BLOG_POSTS.filter((p) => p.slug !== post.slug && p.category === post.category), ...BLOG_POSTS.filter((p) => p.slug !== post.slug && p.category !== post.category)].slice(0, 3);
  const url = `${SITE.url}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: post.category,
    url,
  };
  const [lead, ...body] = post.body;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article>
        <header className="bg-brand-soft">
          <div className="container-page pb-14 pt-10 sm:pb-16 sm:pt-12 lg:pb-20 lg:pt-14">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13.5px] text-ink/70">
                  <Link href="/blog" className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-4 hover:underline">
                    <ArrowLeft className="size-3.5" aria-hidden /> Blog
                  </Link>
                  <span aria-hidden>/</span>
                  <span>{post.category}</span>
                </nav>
              </Reveal>
              <WordReveal
                text={post.title}
                className="mt-6 font-heading text-[2.4rem] font-bold leading-[1] tracking-[-0.025em] text-ink sm:text-5xl lg:text-[3.6rem]"
              />
              <Reveal delay={0.2}>
                <p className="mt-6 text-lg leading-relaxed text-ink/80 sm:text-xl">{post.excerpt}</p>
                <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink/70">
                  <span className="font-semibold text-ink">{post.author}</span>
                  <span aria-hidden>·</span>
                  <PostMeta post={post} />
                </div>
              </Reveal>
            </div>
          </div>
        </header>

        <Panel as="div">
          <div className="container-page py-12 sm:py-16 lg:py-20">
            <Reveal className="mx-auto mb-12 max-w-3xl overflow-hidden rounded-2xl border border-line">
              <PostCover post={post} className="aspect-[3/1] border-b-0" />
            </Reveal>
            <div className="prose-page mx-auto text-[17px]">
              {lead && <p className="text-[19px] leading-relaxed text-ink">{lead.p}</p>}
              {body.map((b, i) => (
                <Reveal key={i} amount={0.2}>
                  {b.h && <h2>{b.h}</h2>}
                  <p>{b.p}</p>
                </Reveal>
              ))}
              <hr className="my-10 border-line" />
              <p className="text-sm text-muted">
                Written by {post.author}. General guidance only — every learner is different, so talk with your tutor about what fits.
              </p>
            </div>
          </div>
        </Panel>
      </article>

      {related.length > 0 && (
        <Section tone="canvas">
          <SectionHeading
            eyebrow="Keep reading"
            title="Related articles"
            action={<ArrowLink href="/blog">All articles</ArrowLink>}
          />
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
            {related.map((p) => (
              <StaggerItem key={p.slug} className="h-full">
                <PostCard post={p} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      <CtaBand {...CTA[post.category]} />
    </>
  );
}
