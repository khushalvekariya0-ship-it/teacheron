"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { UserRoundX } from "lucide-react";
import type { BookingType, Tutor } from "@/lib/types";
import { useFlag, useHydrated, useTutor } from "@/lib/store/hooks";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { BookingFlow, type BookingRequest } from "@/components/booking/BookingFlow";
import { ProfileHeader } from "./ProfileHeader";
import { SectionNav } from "./SectionNav";
import { AboutSection, ExperienceSection, SubjectsSection } from "./ProfileSections";
import { AvailabilitySection } from "./AvailabilitySection";
import { ReviewsSection } from "./ReviewsSection";
import { TrustSection } from "./TrustSection";
import { BookingPanel, MobileBookingBar } from "./BookingPanel";

/**
 * Opens the booking flow when the URL carries ?book=trial|regular (e.g. from a tutor card or after
 * signing in), then removes the parameter so a refresh or "back" doesn't reopen it.
 * Lives in its own Suspense boundary so the rest of the profile can be prerendered.
 */
function BookingUrlTrigger({ onTrigger }: { onTrigger: (t: BookingType) => void }) {
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const book = searchParams.get("book");
  React.useEffect(() => {
    if (!hydrated || (book !== "trial" && book !== "regular")) return;
    onTrigger(book);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const url = new URL(window.location.href);
    url.searchParams.delete("book");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [hydrated, book, onTrigger]);
  return null;
}

function ProfileSkeleton() {
  return (
    <div className="container-page pb-24 pt-8 lg:pt-12" role="status" aria-label="Loading tutor profile">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <div>
          <Skeleton className="mb-6 h-4 w-40" />
          <div className="flex flex-col gap-6 sm:flex-row">
            <Skeleton className="size-24 rounded-full sm:size-28" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-5 w-96 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </div>
          <Skeleton className="mt-10 h-12 w-full" />
          <div className="mt-8 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

function TutorNotFound() {
  return (
    <div className="container-page py-16 sm:py-24">
      <div data-spotlight className="mx-auto max-w-lg rounded-2xl border border-line bg-canvas/50">
        <EmptyState
          icon={<UserRoundX />}
          title="We couldn't find this tutor"
          description="The profile may have been removed, or the link is mistyped. Browse tutors to find someone who fits."
          action={
            <>
              <Button asChild>
                <Link href="/tutors">Browse tutors</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/concierge">Help me find a tutor</Link>
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}

function Profile({ tutor }: { tutor: Tutor }) {
  const instantFlag = useFlag("instant_booking");
  const trialFlag = useFlag("trial_lessons");
  const instant = !tutor.rules.requiresApproval && instantFlag;
  const trialOffered = tutor.trial.enabled && trialFlag;

  const [flowOpen, setFlowOpen] = React.useState(false);
  const [request, setRequest] = React.useState<BookingRequest>({ id: 0, type: "regular" });
  const openFlow = React.useCallback((type: BookingType) => {
    setRequest((r) => ({ id: r.id + 1, type }));
    setFlowOpen(true);
  }, []);

  return (
    <>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-line-grid opacity-50 mask-fade-b" aria-hidden />
        <div className="container-page relative grid gap-x-12 gap-y-8 pb-32 pt-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-24 lg:pt-12">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <ProfileHeader tutor={tutor} instant={instant} />
          </div>

          <aside id="book" aria-label={`Book ${tutor.firstName}`} className="scroll-mt-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="lg:sticky lg:top-24">
              <BookingPanel tutor={tutor} instant={instant} trialOffered={trialOffered} onBook={openFlow} />
            </div>
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <SectionNav reviewCount={tutor.reviewCount} />
            <AboutSection tutor={tutor} />
            <SubjectsSection tutor={tutor} />
            <ExperienceSection tutor={tutor} />
            <AvailabilitySection tutor={tutor} onBook={() => openFlow("regular")} />
            <ReviewsSection tutor={tutor} />
            <TrustSection tutor={tutor} />
          </div>
        </div>
      </div>

      <MobileBookingBar tutor={tutor} trialOffered={trialOffered} onBook={openFlow} />
      <BookingFlow tutor={tutor} open={flowOpen} onOpenChange={setFlowOpen} request={request} />
      <React.Suspense fallback={null}>
        <BookingUrlTrigger onTrigger={openFlow} />
      </React.Suspense>
    </>
  );
}

export function TutorProfileView({ slug }: { slug: string }) {
  const tutor = useTutor(slug);
  const hydrated = useHydrated();
  if (!tutor) return hydrated ? <TutorNotFound /> : <ProfileSkeleton />;
  return <Profile tutor={tutor} />;
}
