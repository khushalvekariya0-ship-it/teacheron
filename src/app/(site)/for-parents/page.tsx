import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Bell, BellOff, CalendarCheck2, ClipboardCheck, CreditCard, Eye, FileText, Flag, Link2, MapPin, MessageSquareLock, NotebookPen, Star,
  UserPlus, Users,
} from "lucide-react";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { CardGrid, Split } from "@/components/marketing/Split";
import { FamilyVignette, MessageVignette, NotificationsVignette, ProgressVignette } from "@/components/marketing/Vignettes";
import { PostCard } from "@/components/content/Blog";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { BLOG_POSTS } from "@/lib/data/content";
import { DEFAULT_POLICY } from "@/lib/data/platform";

export const metadata: Metadata = {
  title: "Tutoring for parents",
  description:
    "Manage every child's tutoring from one parent account: child profiles, visibility into messages about your child, attendance, homework and progress notes, and notification controls.",
  alternates: { canonical: "/for-parents" },
};

export default function ForParentsPage() {
  const reading = BLOG_POSTS.filter((p) => p.category === "Parents").slice(0, 3);
  return (
    <>
      <PageHero
        eyebrow="For parents"
        title="Full visibility into your child's tutoring."
        description="One parent account for every child — with the oversight you'd expect when your kids are learning with someone new."
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/register?role=parent">
                Create a parent account <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/tutors">Browse tutors</Link>
            </Button>
          </>
        }
      />

      <Section>
        <Split
          eyebrow="Child profiles"
          title="Every child, one account."
          description="Add a profile for each child with their grade and goals. Everything you do can be for a specific child."
          features={[
            { icon: <UserPlus />, title: "A profile for each child", body: "Grade level, subjects and learning goals, so tutors know who they'll be working with." },
            { icon: <FileText />, title: "Requirements per child", body: "Post what each child needs and let qualified tutors apply — or search yourself." },
            { icon: <CreditCard />, title: "You book and pay", body: "Lessons are booked and paid from your account. Children never need a card." },
          ]}
          visual={<FamilyVignette />}
        />
      </Section>

      <Section tone="canvas">
        <Split
          reverse
          eyebrow="Oversight of messages"
          title="See every conversation about your child."
          description="Messages about a minor are visible in the parent account. Nothing about your child happens out of view."
          features={[
            { icon: <Eye />, title: "Visible to you", body: "Conversations about your child appear in your inbox, labelled with the child's name." },
            { icon: <MessageSquareLock />, title: "Contact details stay masked", body: "Phone numbers and emails are hidden automatically, so communication stays on the platform." },
            { icon: <Flag />, title: "Report or block in one step", body: "If anything feels off, report the conversation or block the member. Our trust & safety team reviews every report." },
          ]}
          visual={<MessageVignette variant="parent" />}
        />
      </Section>

      <Section>
        <Split
          eyebrow="Attendance, homework and progress"
          title="Know how it's going — without asking."
          description="Tutors record what happened in each lesson. You see the same record they do."
          features={[
            { icon: <ClipboardCheck />, title: "Attendance for every lesson", body: "Completed, rescheduled or missed — each booking keeps its own history." },
            { icon: <NotebookPen />, title: "Lesson notes", body: "A short recap from the tutor after each lesson: topics covered and next steps." },
            { icon: <CalendarCheck2 />, title: "Homework and goals", body: "Assignments with due dates and status, and progress toward the goals you set." },
          ]}
          visual={<ProgressVignette />}
        />
      </Section>

      <Section tone="canvas">
        <Split
          reverse
          eyebrow="Notification controls"
          title="Hear about what matters. Mute the rest."
          description="Choose which updates you receive. Try the switches — this preview doesn't save anything."
          features={[
            { icon: <Bell />, title: "Reminders before lessons", body: "So nobody is scrambling for the meeting link at 4:59." },
            { icon: <BellOff />, title: "Fewer, better updates", body: "Turn off progress notes or homework updates if you'd rather check in on your own schedule." },
            { icon: <Link2 />, title: "Email and in-app", body: "Text message reminders aren't available yet. We'll say so here when they are." },
          ]}
          visual={<NotificationsVignette />}
        />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Safeguards"
          title="Built for families with children."
          description="The protections below apply to every booking — you don't need to turn anything on."
          action={
            <ArrowLink href="/trust-safety">Trust & safety</ArrowLink>
          }
        />
        <CardGrid
          items={[
            { icon: <BadgeCheck />, title: "Verification before badges", body: "Identity, education, certification and background checks show a badge only once they're complete. Nothing is implied for checks in progress." },
            { icon: <Star />, title: "Reviews from real lessons", body: "Only families with a completed booking can review a tutor." },
            { icon: <MapPin />, title: "No home addresses", body: "In-person tutors share an approximate service area. You agree on a meeting place together — a library or your home, your choice." },
            { icon: <Link2 />, title: "Private meeting links", body: `Online meeting links appear on the lesson page ${DEFAULT_POLICY.meetingLinkVisibleMinutesBefore} minutes before the start time and are never posted publicly.` },
            { icon: <CreditCard />, title: "Pay per lesson", body: `No subscription. Free cancellation up to ${DEFAULT_POLICY.freeCancellationHours} hours before a lesson; payments are processed by Stripe.` },
            { icon: <Users />, title: "A team behind every report", body: `Report a problem from the lesson page within ${DEFAULT_POLICY.disputeWindowDays} days. Our trust & safety team reviews every report.` },
          ]}
        />
      </Section>

      {reading.length > 0 && (
        <Section tone="canvas">
          <SectionHeading eyebrow="Guides for parents" title="Choosing well, from the first message." />
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
            {reading.map((p) => (
              <StaggerItem key={p.slug} className="h-full">
                <PostCard post={p} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      <CtaBand
        title="Find the right tutor for each child."
        description="Tell us what each child needs, or browse on your own. Search and messaging are always free."
        primary={{ href: "/concierge", label: "Help me find a tutor" }}
        secondary={{ href: "/post-requirement", label: "Post a requirement" }}
      />
    </>
  );
}
