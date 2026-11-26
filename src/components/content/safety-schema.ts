import { z } from "zod";

/*
 * The Trust & safety page's form, for people who aren't logged in (shared by the form and POST /api/safety):
 * - "report": a concern about someone or something on TutorLink, with an email to reply to;
 * - "appeal": a suspended account asks for its suspension to be looked at again (suspended accounts can't log in).
 * Both land in Admin → Reports.
 */

export const SAFETY_CATEGORIES = [
  { value: "harassment", label: "Harassment, threats or bullying" },
  { value: "child", label: "A safety concern involving a child" },
  { value: "outside", label: "Asked to talk or pay outside TutorLink" },
  { value: "scam", label: "Scam, fake profile or fraud" },
  { value: "inappropriate", label: "Inappropriate or offensive content" },
  { value: "other", label: "Something else" },
] as const;

/** The reason a suspension appeal is filed under (Admin → Reports; a decision tells the account). */
export const APPEAL_REASON = "Appeal: account suspension";

const email = z.string().trim().min(1, "Enter your email so we can reply").max(200, "That email is too long").email("Enter a valid email address");
/** Left empty by people; bots fill every field. */
const trap = z.string().max(0).optional();

export const safetySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("report"),
    email,
    category: z.enum(["harassment", "child", "outside", "scam", "inappropriate", "other"], { errorMap: () => ({ message: "Choose what it's about" }) }),
    who: z.string().trim().max(200, "Keep this under 200 characters").optional(),
    what: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(2000, "Keep it under 2,000 characters"),
    website: trap,
  }),
  z.object({
    kind: z.literal("appeal"),
    email,
    what: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(1000, "Keep it under 1,000 characters"),
    website: trap,
  }),
]);
export type SafetyInput = z.infer<typeof safetySchema>;
