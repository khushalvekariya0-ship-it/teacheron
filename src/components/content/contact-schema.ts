import { z } from "zod";

/* Shared by the contact form (client) and POST /api/contact (server) so both validate identically. */

export const CONTACT_ROLES = [
  { value: "parent", label: "A parent or guardian" },
  { value: "student", label: "A student" },
  { value: "tutor", label: "A tutor" },
  { value: "other", label: "Something else" },
] as const;

export const CONTACT_TOPICS = [
  { value: "finding_tutor", label: "Finding a tutor" },
  { value: "booking", label: "A booking or lesson" },
  { value: "payments", label: "Payments and refunds" },
  { value: "account", label: "My account" },
  { value: "becoming_tutor", label: "Becoming a tutor" },
  { value: "verification", label: "Tutor verification" },
  { value: "safety", label: "Safety concern" },
  { value: "privacy", label: "Privacy or data request" },
  { value: "other", label: "Something else" },
] as const;

type RoleValue = (typeof CONTACT_ROLES)[number]["value"];
type TopicValue = (typeof CONTACT_TOPICS)[number]["value"];

const roleValues = CONTACT_ROLES.map((r) => r.value) as [RoleValue, ...RoleValue[]];
const topicValues = CONTACT_TOPICS.map((t) => t.value) as [TopicValue, ...TopicValue[]];

export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 2000;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100, "Please keep your name under 100 characters."),
  email: z.string().trim().min(1, "Please enter your email address.").email("Please enter a valid email address.").max(200),
  role: z.enum(roleValues, { errorMap: () => ({ message: "Please tell us who you are." }) }),
  topic: z.enum(topicValues, { errorMap: () => ({ message: "Please choose a topic." }) }),
  message: z
    .string()
    .trim()
    .min(MESSAGE_MIN, `Please write at least ${MESSAGE_MIN} characters so we can help.`)
    .max(MESSAGE_MAX, `Please keep your message under ${MESSAGE_MAX} characters.`),
  /** Honeypot. Hidden from people; if a bot fills it, the server quietly discards the message. */
  website: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

export type ContactResponse =
  | { ok: true; ticketId: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof ContactInput, string[]>> };
