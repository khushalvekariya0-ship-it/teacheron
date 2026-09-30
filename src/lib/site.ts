export const SITE = {
  name: "TutorLink",
  legalName: "TutorLink, Inc.",
  tagline: "Find the Right Tutor. Learn With Confidence.",
  description:
    "Connect with qualified tutors for personalized online and in-person learning across the United States.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supportEmail: "support@tutorlink.example",
  /** Default commission (Starter plan) on each booking, in basis points (1800 = 18%). Paid plans use their own rate; admin-configurable. */
  platformFeeBps: 1800,
  defaultTimezone: "America/New_York",
} as const;

/** Shown in the preview banner. Everything in this build runs on sample data. */
export const IS_PREVIEW = true;
