import type { Metadata } from "next";
import { Suspense } from "react";
import { Panel } from "@/components/marketing/Section";
import { RequirementWizard } from "@/components/requirements/RequirementWizard";

export const metadata: Metadata = {
  title: "Post a requirement",
  description: "Tell tutors what you need — subject, goals, schedule and budget — and let qualified tutors apply. Free for families; only your city and ZIP are shown.",
  alternates: { canonical: "/post-requirement" },
};

function Fallback() {
  return (
    <div className="container-page pb-24 pt-8 sm:pt-12" role="status" aria-label="Loading">
      <div className="skeleton h-3.5 w-32" />
      <div className="skeleton mt-4 h-9 w-80 max-w-full" />
      <div className="skeleton mt-10 h-[460px] rounded-2xl" />
    </div>
  );
}

export default function PostRequirementPage() {
  return (
    <Panel as="div">
      <Suspense fallback={<Fallback />}>
        <RequirementWizard />
      </Suspense>
    </Panel>
  );
}
