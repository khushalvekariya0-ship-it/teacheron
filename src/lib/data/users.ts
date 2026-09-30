import type { Child, Permission, Role, User } from "@/lib/types";

/*
 * SAMPLE DATA — demo accounts for the preview build. Authentication in this build is a local
 * simulation (see store `auth` slice); production uses the NestJS auth service with hashed passwords,
 * email verification and MFA for staff.
 */

const ALL_PERMISSIONS: Permission[] = [
  "users.read", "users.write", "tutors.verify", "bookings.manage", "payments.read", "payments.refund",
  "disputes.manage", "reports.moderate", "conversations.read_flagged", "content.manage", "settings.manage",
  "flags.manage", "audit.read",
];

export const SUPPORT_PERMISSIONS: Permission[] = ["users.read", "bookings.manage", "reports.moderate", "disputes.manage", "payments.read"];

export const DEMO_USERS: User[] = [
  {
    id: "usr_student", role: "student", firstName: "Jordan", lastName: "Lee", email: "jordan.lee@example.com",
    city: "Chicago", state: "IL", zip: "60614", timezone: "America/Chicago", createdAt: "2026-01-08T15:00:00Z",
    emailVerified: true, status: "active",
  },
  {
    id: "usr_parent", role: "parent", firstName: "Dana", lastName: "Whitaker", email: "dana.whitaker@example.com",
    city: "Brooklyn", state: "NY", zip: "11201", timezone: "America/New_York", createdAt: "2025-11-20T15:00:00Z",
    emailVerified: true, status: "active", phone: "(718) 555-0143",
  },
  {
    id: "usr_tutor", role: "tutor", firstName: "Sarah", lastName: "Chen", email: "sarah.chen@example.com",
    city: "New York", state: "NY", zip: "10001", timezone: "America/New_York", createdAt: "2022-08-14T15:00:00Z",
    emailVerified: true, status: "active", tutorId: "tut_sarah_chen",
  },
  {
    id: "usr_admin", role: "admin", firstName: "Morgan", lastName: "Hayes", email: "morgan.hayes@tutorlink.example",
    timezone: "America/New_York", createdAt: "2021-01-04T15:00:00Z", emailVerified: true, status: "active",
    mfaEnabled: true, permissions: ALL_PERMISSIONS,
  },
  {
    id: "usr_support", role: "support", firstName: "Sam", lastName: "Ortiz", email: "sam.ortiz@tutorlink.example",
    timezone: "America/Chicago", createdAt: "2023-03-15T15:00:00Z", emailVerified: true, status: "active",
    mfaEnabled: true, permissions: SUPPORT_PERMISSIONS,
  },
];

/** Other marketplace members referenced by sample jobs, conversations and the admin panel. */
export const OTHER_USERS: User[] = [
  ["usr_m01", "parent", "Emily", "Rhodes", "Austin", "TX", "78701", "America/Chicago"],
  ["usr_m02", "student", "Kevin", "Tran", "San Jose", "CA", "95126", "America/Los_Angeles"],
  ["usr_m03", "parent", "Marisol", "Garcia", "Miami", "FL", "33131", "America/New_York"],
  ["usr_m04", "parent", "Helen", "Foster", "Chicago", "IL", "60614", "America/Chicago"],
  ["usr_m05", "student", "Omar", "Aziz", "Houston", "TX", "77005", "America/Chicago"],
  ["usr_m06", "parent", "Rebecca", "Hall", "Seattle", "WA", "98103", "America/Los_Angeles"],
  ["usr_m07", "parent", "Grace", "Palmer", "Los Angeles", "CA", "90024", "America/Los_Angeles"],
  ["usr_m08", "student", "Riley", "Stone", "Washington", "DC", "20009", "America/New_York"],
  ["usr_m09", "parent", "Tanya", "Wells", "Atlanta", "GA", "30309", "America/New_York"],
  ["usr_m10", "parent", "Wei", "Zhang", "Boston", "MA", "02116", "America/New_York"],
  ["usr_m11", "student", "Luis", "Mendoza", "Phoenix", "AZ", "85016", "America/Phoenix"],
  ["usr_m12", "parent", "Jennifer", "Blake", "Denver", "CO", "80206", "America/Denver"],
].map(([id, role, firstName, lastName, city, state, zip, timezone], i) => ({
  id, role: role as Role, firstName, lastName, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
  city, state, zip, timezone, createdAt: new Date(Date.UTC(2026, i % 9, 3 + i)).toISOString(), emailVerified: i % 5 !== 3,
  status: i === 7 ? "suspended" : "active",
}));

export const ALL_USERS: User[] = [...DEMO_USERS, ...OTHER_USERS];

export const USER_BY_ID: Record<string, User> = Object.fromEntries(ALL_USERS.map((u) => [u.id, u]));

export const DEMO_CHILDREN: Child[] = [
  {
    id: "chd_noah", parentId: "usr_parent", firstName: "Noah", grade: "7", birthYear: 2013,
    learningGoals: ["Rebuild confidence with pre-algebra", "Finish homework independently"], subjects: ["pre-algebra", "study-skills"],
    notes: "Works best with short breaks every 20 minutes.",
  },
  {
    id: "chd_ava", parentId: "usr_parent", firstName: "Ava", grade: "4", birthYear: 2016,
    learningGoals: ["Read chapter books independently", "Conversational Spanish"], subjects: ["reading", "spanish"],
  },
];

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  parent: "Parent",
  tutor: "Tutor",
  admin: "Administrator",
  support: "Support staff",
};

export function userName(u: Pick<User, "firstName" | "lastName">): string {
  return `${u.firstName} ${u.lastName}`;
}
