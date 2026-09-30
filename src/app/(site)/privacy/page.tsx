import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/Section";
import { LegalDocument, type DocSection } from "@/components/content/LegalDocument";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} collects, uses, shares and protects personal information — including children's privacy (COPPA), payments through Stripe, cookies, retention and your rights under U.S. state privacy laws such as the CCPA.`,
  alternates: { canonical: "/privacy" },
};

const UPDATED = "September 30, 2026";

const mail = (
  <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
);

const SECTIONS: DocSection[] = [
  {
    id: "scope",
    title: "Who we are and what this covers",
    content: (
      <>
        <p>
          {SITE.legalName} (&ldquo;{SITE.name},&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) operates an online marketplace that connects students and families in the United States with independent tutors for online and in-person lessons. This Privacy Policy explains how we handle personal information when you use our websites, apps and related services (the &ldquo;Services&rdquo;).
        </p>
        <p>
          It applies to everyone who uses the Services: parents and guardians, students, tutors and visitors. It does not cover third-party sites or services we link to, which have their own policies.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "Information we collect",
    content: (
      <>
        <h3>Information you give us</h3>
        <ul>
          <li><strong>Account information:</strong> name, email address, password, phone number (optional), ZIP code, time zone and account type.</li>
          <li><strong>Child profiles:</strong> for parent accounts, a child&rsquo;s first name, grade level, subjects, learning goals and any learning-support needs the parent chooses to share.</li>
          <li><strong>Tutor profiles:</strong> photo, headline, biography, subjects, experience, education, certifications, rates, availability and approximate service area.</li>
          <li><strong>Verification information:</strong> for tutors, government ID images, education and certification documents, and — where applicable and with consent — information needed for a background screening.</li>
          <li><strong>Requirements and messages:</strong> tutoring requirements you post, messages you send through the Services, attachments, reviews and reports.</li>
          <li><strong>Lesson records:</strong> bookings, attendance, lesson notes, homework and progress information created by tutors and learners.</li>
          <li><strong>Support requests:</strong> what you tell us when you contact support.</li>
        </ul>
        <h3>Information collected automatically</h3>
        <ul>
          <li><strong>Device and usage data:</strong> IP address, browser type, device identifiers, pages viewed, search filters used, and the date and time of activity.</li>
          <li><strong>Approximate location:</strong> derived from the ZIP code you enter or your IP address. We do not collect precise GPS location.</li>
          <li><strong>Cookies and similar technologies:</strong> see <a href="#cookies">Cookies</a> below.</li>
        </ul>
        <h3>Information from others</h3>
        <ul>
          <li><strong>Payment processor:</strong> Stripe tells us whether a payment succeeded and gives us limited card details (such as brand and last four digits).</li>
          <li><strong>Verification providers:</strong> results of identity checks and background screenings we request with a tutor&rsquo;s consent.</li>
          <li><strong>Other users:</strong> for example, a tutor&rsquo;s lesson notes about a student, or a review a family leaves about a tutor.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use information",
    content: (
      <>
        <ul>
          <li>To provide the Services: create accounts, show tutor profiles, run search and matching, and handle messages, bookings, lessons and payments.</li>
          <li>To verify tutors and display badges only for checks that have been completed.</li>
          <li>To keep people safe: mask contact details in messages, detect fraud and abuse, review reports, and enforce our Terms.</li>
          <li>To send service messages, such as booking confirmations, lesson reminders and security notices, according to your notification settings.</li>
          <li>To provide support and respond to your requests.</li>
          <li>To understand and improve the Services, using aggregated or de-identified data where possible.</li>
          <li>To comply with law, respond to lawful requests, and establish or defend legal claims.</li>
        </ul>
        <p>
          Matching is rules-based and transparent: the factors and weights used to rank tutors are shown to you. We do not use personal information about children for targeted advertising, and we do not make decisions with legal or similarly significant effects based solely on automated processing.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children's privacy (COPPA) and teens",
    content: (
      <>
        <p>
          We take extra care with information about young people and comply with the Children&rsquo;s Online Privacy Protection Act (COPPA).
        </p>
        <ul>
          <li>
            <strong>Under 13:</strong> children may not create their own accounts. A parent or legal guardian creates the account and may add a child profile. By doing so, the parent provides verifiable consent to our collection and use of the limited child information described above, solely to arrange and deliver tutoring.
          </li>
          <li>
            <strong>Ages 13 to 17:</strong> teens may use the Services only with the consent of a parent or guardian. Where a teen&rsquo;s account is linked to a parent account, the parent can see bookings and messages about the teen.
          </li>
          <li>
            <strong>Parental oversight:</strong> messages about a minor are visible to the parent account. Contact details are masked, and staff access to messages is restricted and logged.
          </li>
          <li>
            <strong>Parental rights:</strong> a parent may review, correct or delete information about their child, and may withdraw consent to further collection, by using account settings or contacting us at {mail}. Withdrawing consent may mean we can no longer provide tutoring for that child.
          </li>
        </ul>
        <p>If we learn we have collected personal information from a child under 13 without parental consent, we will delete it promptly.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "How we share information",
    content: (
      <>
        <p>We share personal information only as described here:</p>
        <ul>
          <li><strong>Between families and tutors:</strong> the information needed to arrange and deliver lessons — for example, a family sees a tutor&rsquo;s public profile, and a booked tutor sees the student&rsquo;s first name, grade and goals. Tutors&rsquo; home addresses are never shown; in-person tutors display an approximate service area.</li>
          <li><strong>Service providers:</strong> companies that help us operate, such as payment processing (Stripe), identity verification and background screening providers, cloud hosting, email delivery, customer support tools and analytics. They may use the information only to provide services to us.</li>
          <li><strong>Legal and safety:</strong> when we believe in good faith that disclosure is required by law, or necessary to protect the safety of any person — including reports to law enforcement or child-protection authorities.</li>
          <li><strong>Business transfers:</strong> in connection with a merger, acquisition or sale of assets, subject to this Policy.</li>
          <li><strong>With your consent</strong> or at your direction.</li>
        </ul>
        <p>
          <strong>We do not sell personal information,</strong> and we do not share it for cross-context behavioral advertising, as those terms are defined under California law.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments through Stripe",
    content: (
      <>
        <p>
          Payments are processed by Stripe, Inc. When you pay for a lesson, your card details go directly to Stripe; we do not store full card numbers. Tutor payouts are handled through Stripe Connect, which may collect identity, tax and bank account information from tutors to comply with financial regulations.
        </p>
        <p>
          Stripe&rsquo;s use of your information is governed by Stripe&rsquo;s own privacy policy. We receive and keep payment records — amounts, dates, refunds and the last four digits of a card — to operate bookings, handle disputes and meet accounting obligations.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and similar technologies",
    content: (
      <>
        <ul>
          <li><strong>Essential:</strong> keep you signed in, protect against fraud, and remember security settings. These are always on.</li>
          <li><strong>Preferences:</strong> remember choices such as your time zone, saved tutors and comparison list.</li>
          <li><strong>Analytics:</strong> help us understand how the Services are used so we can improve them. Where required, we ask for your consent first.</li>
        </ul>
        <p>
          You can control cookies through your browser settings; blocking essential cookies may stop parts of the Services from working. We treat a Global Privacy Control (GPC) signal as a request to opt out of any sale or sharing of personal information for your browser.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep information",
    content: (
      <>
        <p>We keep personal information only as long as needed for the purposes described in this Policy:</p>
        <ul>
          <li><strong>Account and profile information:</strong> while your account is active. When you delete your account, we delete or de-identify it within a reasonable period, except as described below.</li>
          <li><strong>Verification documents:</strong> kept only as long as needed to complete and audit the check. We keep a record of the outcome (for example, &ldquo;Identity verified&rdquo; and the date) for as long as the badge is shown and for a limited period after.</li>
          <li><strong>Messages and lesson records:</strong> kept while the account is active and for a limited period afterward so we can investigate safety reports and disputes.</li>
          <li><strong>Payment records:</strong> kept for as long as tax, accounting and anti-fraud laws require.</li>
          <li><strong>Legal holds:</strong> information relevant to an investigation, dispute or legal claim may be kept until it is resolved.</li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    content: (
      <p>
        We use administrative, technical and physical safeguards designed to protect personal information, including encryption in transit, access controls, and restricted staff access to messages and verification documents with audit logs. No system is perfectly secure; if we learn of a breach that affects you, we will notify you as required by law.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights and choices",
    content: (
      <>
        <ul>
          <li><strong>Access and correction:</strong> view and update most information in your account settings, or ask us for a copy.</li>
          <li><strong>Deletion:</strong> delete your account in settings or by contacting us. Some information may be kept as described under <a href="#retention">retention</a>.</li>
          <li><strong>Portability:</strong> request a copy of information you provided in a commonly used format.</li>
          <li><strong>Notifications and marketing:</strong> manage notification settings in your account, and unsubscribe from marketing emails at any time. Service messages about your bookings will still be sent.</li>
        </ul>
        <p>To make a request, email {mail}. We will verify your identity before acting on a request, and respond within the time required by applicable law.</p>
      </>
    ),
  },
  {
    id: "california",
    title: "California and other U.S. state privacy rights",
    content: (
      <>
        <p>
          If you are a California resident, the California Consumer Privacy Act, as amended by the California Privacy Rights Act (together, the &ldquo;CCPA&rdquo;), gives you the right to:
        </p>
        <ul>
          <li>know what personal information we collect, use and disclose, and obtain a copy;</li>
          <li>request deletion of personal information, subject to legal exceptions;</li>
          <li>correct inaccurate personal information;</li>
          <li>opt out of the sale or sharing of personal information (we do not sell or share it);</li>
          <li>limit the use of sensitive personal information (we use it only for permitted purposes, such as identity verification and security); and</li>
          <li>not be discriminated against for exercising these rights.</li>
        </ul>
        <p>
          In the past 12 months we have collected the categories described in <a href="#collect">Information we collect</a>: identifiers, customer records, characteristics such as age range, commercial information, internet activity, approximate geolocation, professional and education information (tutors), and sensitive information limited to government ID and background-check results for tutors. We disclose these categories for business purposes only to the recipients described in <a href="#sharing">How we share information</a>.
        </p>
        <p>
          Residents of other states with comprehensive privacy laws — including Virginia, Colorado, Connecticut, Utah, Texas and Oregon — have similar rights, including the right to appeal a decision about a request. You may use an authorized agent to make a request on your behalf; we may ask the agent for proof of authorization. Email {mail} with the subject &ldquo;Privacy request.&rdquo;
        </p>
      </>
    ),
  },
  {
    id: "international",
    title: "Where information is processed",
    content: <p>The Services are intended for users in the United States. Information is stored and processed in the United States by us and our service providers.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        We may update this Policy from time to time. If changes are material, we will notify you by email or in the Services before they take effect. The &ldquo;Last updated&rdquo; date at the top shows when this Policy last changed.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    content: (
      <>
        <p>
          Questions or requests about privacy: email {mail} or use our <Link href="/contact">contact form</Link> and choose &ldquo;Privacy or data request.&rdquo;
        </p>
        <p>
          {SITE.legalName}
          <br />
          Attn: Privacy
          <br />
          [Mailing address to be added before launch]
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description={
          <>
            How we collect, use and protect personal information — with extra care for children and teens. <span className="mt-2 block text-[15px] font-medium text-ink/70">Last updated {UPDATED}</span>
          </>
        }
      />
      <LegalDocument
        sections={SECTIONS}
        intro={
          <p>
            <strong>The short version:</strong> we collect what we need to connect learners with tutors and keep everyone safe. We don&rsquo;t sell personal information. Parents control their children&rsquo;s information. Payments go through Stripe, and we never store full card numbers.
          </p>
        }
        aside={
          <p className="text-[13px] leading-relaxed text-muted">
            Questions? <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">{SITE.supportEmail}</a>
          </p>
        }
      />
    </>
  );
}
