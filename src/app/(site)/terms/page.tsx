import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/Section";
import { LegalDocument, type DocSection } from "@/components/content/LegalDocument";
import { CREDITS_PER_APPLICATION, DEFAULT_POLICY as P, TUTOR_PLANS } from "@/lib/data/platform";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that govern use of ${SITE.name}: accounts and eligibility, bookings and cancellations, payments and commission, conduct, safety and minors, disputes and liability.`,
  alternates: { canonical: "/terms" },
};

const UPDATED = "September 30, 2026";

const commissions = TUTOR_PLANS.map((p) => `${p.name} ${p.commissionBps / 100}%`).join(", ");

const SECTIONS: DocSection[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    content: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) are an agreement between you and {SITE.legalName} (&ldquo;{SITE.name},&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) and govern your use of our websites, apps and services (the &ldquo;Services&rdquo;). By creating an account or using the Services, you agree to these Terms and to our <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Services.
        </p>
        <p>
          <strong>Please read the dispute resolution section carefully.</strong> It describes how disputes with {SITE.name} are resolved.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and accounts",
    content: (
      <>
        <ul>
          <li>You must be at least 18 years old to create an account on your own behalf, including any tutor account.</li>
          <li>Teens aged 13 to 17 may use the Services only with the consent and supervision of a parent or legal guardian, who agrees to these Terms on their behalf.</li>
          <li>Children under 13 may use the Services only through a child profile created and managed by a parent or guardian.</li>
          <li>You agree to give accurate information, keep it up to date, and keep your password secure. You are responsible for activity on your account and must tell us promptly about any unauthorized use.</li>
          <li>The Services are offered to users in the United States.</li>
        </ul>
      </>
    ),
  },
  {
    id: "marketplace",
    title: "Our role as a marketplace",
    content: (
      <>
        <p>
          {SITE.name} provides a platform where families and students (&ldquo;Clients&rdquo;) can find, communicate with, book and pay independent tutors (&ldquo;Tutors&rdquo;). Tutors are independent contractors. They are not employees, agents or representatives of {SITE.name}, and they decide how, when and whether to provide their services.
        </p>
        <p>
          We verify certain information as described on our <Link href="/trust-safety">Trust &amp; Safety</Link> page, and we display a verification badge only after a check is completed. Verification is not an endorsement or guarantee of a Tutor&rsquo;s conduct or results. Clients remain responsible for choosing a Tutor and for supervising minors as appropriate.
        </p>
        <p>
          Search results and match scores are calculated using the factors and weights we disclose. Subscription plans and featured placement do not change ranking or match scores.
        </p>
      </>
    ),
  },
  {
    id: "tutors",
    title: "Tutor terms",
    content: (
      <>
        <ul>
          <li>Keep your profile accurate. List only education, certifications and experience you actually hold, and update them if they change or expire.</li>
          <li>Complete the verification steps we request, including background screening where applicable, and consent to the related checks.</li>
          <li>Set your own rates, availability and policies within the limits of the Services, and honor bookings you accept.</li>
          <li>Follow our <Link href="/safety">Safety Guidelines</Link>, including the safeguards for lessons with minors.</li>
          <li>You are responsible for your own taxes, insurance, licenses and compliance with laws that apply to your tutoring business.</li>
          <li>You authorize us, through Stripe Connect, to collect lesson payments on your behalf, deduct the applicable commission, and pay out the balance to your connected account.</li>
        </ul>
      </>
    ),
  },
  {
    id: "clients",
    title: "Family and student terms",
    content: (
      <ul>
        <li>Give Tutors accurate information about the learner&rsquo;s needs, and treat Tutors with respect.</li>
        <li>Pay for the lessons you book, and follow the cancellation policy shown at checkout.</li>
        <li>For learners under 18, a parent or guardian is responsible for the account, for consenting to lessons, and for appropriate supervision — especially for in-person lessons.</li>
      </ul>
    ),
  },
  {
    id: "bookings",
    title: "Bookings, cancellations and refunds",
    content: (
      <>
        <p>The policy that applies to a booking is shown before you pay and on the lesson page. Unless a different policy is shown at checkout, the following defaults apply:</p>
        <ul>
          <li>Regular lessons may be cancelled free of charge up to {P.freeCancellationHours} hours before the start time. Later cancellations are refunded at {P.lateCancellationRefundPercent}%.</li>
          <li>Trial lessons may be cancelled free of charge up to {P.trialFreeCancellationHours} hours before the start time.</li>
          <li>Lessons may be rescheduled up to {P.rescheduleMinHours} hours before the start time, up to {P.maxReschedulesPerBooking} times per booking.</li>
          <li>If a Tutor cancels, or a Tutor no-show is confirmed, the Client is refunded in full. A no-show may be reported {P.noShowGraceMinutes} minutes after the start time.</li>
          <li>If a student does not attend, the lesson is {P.studentNoShowRefundPercent === 0 ? "not refunded" : `refunded at ${P.studentNoShowRefundPercent}%`}.</li>
          <li>Booking requests that require Tutor approval are authorized when requested and charged when the Tutor confirms.</li>
        </ul>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments, fees and plans",
    content: (
      <>
        <ul>
          <li>Payments are processed by Stripe and are subject to Stripe&rsquo;s terms. We do not store full card numbers.</li>
          <li>Clients pay the lesson price shown at checkout. There is no subscription for Clients.</li>
          <li>{SITE.name} earns a commission on each paid lesson, deducted from the Tutor&rsquo;s earnings. The rate depends on the Tutor&rsquo;s plan ({commissions}) and is shown on our <Link href="/pricing">Pricing</Link> page.</li>
          <li>Paid Tutor plans are billed monthly in advance and renew automatically until cancelled. Cancellation takes effect at the end of the current billing period.</li>
          <li>Lead credits are used to apply to student requirements ({CREDITS_PER_APPLICATION} credit per application). Credits have no cash value and are non-refundable except where required by law.</li>
          <li>Tutor earnings from a completed lesson become available for payout after the {P.disputeWindowDays}-day dispute window closes.</li>
          <li>Promotional codes are subject to their stated conditions and may be withdrawn at any time.</li>
        </ul>
      </>
    ),
  },
  {
    id: "circumvention",
    title: "Keeping payments on the platform",
    content: (
      <p>
        To protect both sides, arrangements that begin on {SITE.name} must be booked and paid through the Services. Do not share or request personal contact details to move lessons or payments off the platform. Contact details in messages are masked automatically. Circumvention may lead to suspension, and off-platform lessons are not covered by our cancellation, refund or dispute protections.
      </p>
    ),
  },
  {
    id: "content",
    title: "Reviews and user content",
    content: (
      <>
        <p>
          You keep ownership of content you submit, such as profiles, messages, lesson notes and reviews. You grant {SITE.name} a non-exclusive, worldwide, royalty-free license to host, display and use that content to operate and improve the Services.
        </p>
        <p>
          Reviews can be left only for completed bookings and must reflect genuine experience. We may remove content that violates these Terms or our guidelines, but we do not edit reviews to change their meaning, and we do not accept payment to remove or alter reviews.
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    title: "Prohibited conduct",
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>harass, threaten, exploit or endanger anyone, especially minors;</li>
          <li>misrepresent your identity, qualifications or affiliation;</li>
          <li>post false, misleading, infringing or unlawful content, or fake reviews;</li>
          <li>complete another person&rsquo;s graded work, exams or assessments in a way that violates academic-integrity rules;</li>
          <li>collect other users&rsquo; personal information or contact them for unrelated purposes;</li>
          <li>interfere with the Services, including by scraping, reverse engineering or introducing malware; or</li>
          <li>use the Services in violation of any law.</li>
        </ul>
      </>
    ),
  },
  {
    id: "safety",
    title: "Safety and minors",
    content: (
      <p>
        Messages about a minor are visible to the minor&rsquo;s parent account. We may review messages and lesson records when investigating a report, subject to restricted, logged staff access. We cooperate with law enforcement and report suspected child exploitation as required by law. See our <Link href="/safety">Safety Guidelines</Link> and <Link href="/trust-safety">Trust &amp; Safety</Link> page.
      </p>
    ),
  },
  {
    id: "disputes-users",
    title: "Problems with a lesson",
    content: (
      <p>
        If something goes wrong with a booking, open a dispute from the lesson page within {P.disputeWindowDays} days of the lesson. We will review information from both sides and may issue a full or partial refund, or confirm the charge. Our decision on a lesson dispute is final as between the parties for purposes of the Services, without limiting any rights you have under law.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    content: (
      <p>
        You may close your account at any time. We may suspend or terminate accounts, remove content, or withhold badges if we reasonably believe someone has violated these Terms, created risk for other users, or engaged in fraud. Where appropriate and safe to do so, we will tell you why and give you a way to respond.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Our intellectual property",
    content: <p>The Services, including software, design, text and trademarks, are owned by {SITE.legalName} or its licensors. We grant you a limited, revocable, non-transferable license to use the Services for their intended purpose.</p>,
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    content: (
      <p>
        THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; TO THE FULLEST EXTENT PERMITTED BY LAW, {SITE.name.toUpperCase()} DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. WE DO NOT GUARANTEE ANY PARTICULAR ACADEMIC OUTCOME, TEST SCORE OR GRADE, AND WE ARE NOT RESPONSIBLE FOR THE CONDUCT OF ANY USER, ONLINE OR OFFLINE.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    content: (
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, {SITE.name.toUpperCase()} WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR LOST PROFITS OR DATA. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICES IS LIMITED TO THE GREATER OF THE AMOUNTS YOU PAID TO {SITE.name.toUpperCase()} IN THE 12 MONTHS BEFORE THE CLAIM AROSE OR $100. SOME STATES DO NOT ALLOW THESE LIMITATIONS, SO THEY MAY NOT APPLY TO YOU.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnification",
    content: <p>You agree to defend and indemnify {SITE.legalName} against claims arising from your content, your use of the Services, your lessons, or your violation of these Terms or the law, to the extent permitted by law.</p>,
  },
  {
    id: "dispute-resolution",
    title: "Dispute resolution and governing law",
    content: (
      <>
        <p>
          Before filing a claim, you agree to contact us at <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> and try to resolve the dispute informally for at least 30 days.
        </p>
        <p>
          [Arbitration agreement, class-action waiver, opt-out procedure and small-claims exception to be finalized by counsel.] These Terms are governed by the laws of [State], without regard to conflict-of-laws rules, except where the law of your state of residence requires otherwise.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    content: <p>We may update these Terms. If a change is material, we will notify you in advance by email or in the Services. Continuing to use the Services after changes take effect means you accept the updated Terms.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        Questions about these Terms: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> or our <Link href="/contact">contact form</Link>. {SITE.legalName}, [mailing address to be added before launch].
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        description={
          <>
            The rules for using {SITE.name} — for families, students and tutors. <span className="mt-2 block text-[15px] font-medium text-ink/70">Last updated {UPDATED}</span>
          </>
        }
      />
      <LegalDocument
        sections={SECTIONS}
        intro={
          <p>
            <strong>In plain terms:</strong> tutors are independent professionals; we run the marketplace, verify what we say we verify, and show every policy before you pay. Keep lessons and payments on the platform, treat people well, and put the safety of young learners first.
          </p>
        }
      />
    </>
  );
}
