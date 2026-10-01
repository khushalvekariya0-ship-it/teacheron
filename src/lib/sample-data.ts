/**
 * Sample (dummy) marketplace data switch.
 *
 * OFF by default: the site runs empty — no sample tutors, reviews, jobs, bookings, messages, payments,
 * children, coupons or testimonials — exactly as it would on launch day, so every place that still
 * needs real content or a real backend is visible. Only one owner/admin account is kept so the admin
 * area stays reachable.
 *
 * Set NEXT_PUBLIC_SAMPLE_DATA=true (in .env.local, or in Vercel's environment variables) and rebuild to
 * bring the full demo back for client walkthroughs.
 */
export const SAMPLE_DATA = process.env.NEXT_PUBLIC_SAMPLE_DATA === "true";
