import type { Permission, Role } from "@/lib/types";

/** Every staff permission. An administrator created with `npm run db:make-admin` gets all of them. */
export const ALL_PERMISSIONS: Permission[] = [
  "users.read", "users.write", "tutors.verify", "bookings.manage", "payments.read", "payments.refund",
  "disputes.manage", "reports.moderate", "conversations.read_flagged", "content.manage", "settings.manage",
  "flags.manage", "audit.read",
];

/** A sensible starting set for support staff (see `npm run db:make-admin -- --support`). */
export const SUPPORT_PERMISSIONS: Permission[] = ["users.read", "bookings.manage", "reports.moderate", "disputes.manage", "payments.read"];

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  parent: "Parent",
  tutor: "Tutor",
  admin: "Administrator",
  support: "Support staff",
};

export function userName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`;
}
