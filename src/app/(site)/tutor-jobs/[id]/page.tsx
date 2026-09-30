import type { Metadata } from "next";
import { Panel } from "@/components/marketing/Section";
import { SEED_REQUIREMENTS } from "@/lib/data/requirements";
import { GRADE_LABEL, subjectName } from "@/lib/data/catalog";
import { truncate } from "@/lib/utils";
import { JobDetail } from "@/components/jobs/JobDetail";
import { budgetRange, locationLabel, modesLabel } from "@/components/jobs/jobUtils";

type Props = { params: Promise<{ id: string }> };

/** Only public, published sample jobs are pre-rendered. Jobs posted in this browser render on demand. */
const PUBLISHED = SEED_REQUIREMENTS.filter((r) => r.status === "published");

export function generateStaticParams() {
  return PUBLISHED.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = PUBLISHED.find((r) => r.id === id);
  if (!job) {
    return { title: "Tutor job", description: "A tutoring requirement posted on TutorLink.", robots: { index: false } };
  }
  // Public fields only — never the owner's name or contact details.
  const summary = `${subjectName(job.subject)} · ${GRADE_LABEL[job.grade]} · ${modesLabel(job.modes)} · ${locationLabel(job)} · ${budgetRange(job)}`;
  return {
    title: job.title,
    description: truncate(`${summary}. ${job.objectives}`, 158),
    alternates: { canonical: `/tutor-jobs/${job.id}` },
    openGraph: { title: job.title, description: summary, type: "article" },
  };
}

export default async function TutorJobPage({ params }: Props) {
  const { id } = await params;
  return (
    <Panel as="div">
      <JobDetail id={id} />
    </Panel>
  );
}
