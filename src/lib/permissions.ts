import type { Booking, Permission, Role, User } from "@/lib/types";
import type { Actor } from "@/lib/booking";

export function hasPermission(user: User | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  if (user.role !== "admin" && user.role !== "support") return false;
  return user.permissions?.includes(perm) ?? false;
}

export function isStaff(user: User | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "support";
}

export function isLearnerAccount(user: User | null | undefined): boolean {
  return user?.role === "student" || user?.role === "parent";
}

/** Which state-machine actor the user is for a booking, or null if they may not act on it at all. */
export function actorFor(user: User | null | undefined, b: Booking): Actor | null {
  if (!user) return null;
  if (user.id === b.bookerId) return "booker";
  if (user.tutorId && user.tutorId === b.tutorId) return "tutor";
  if (hasPermission(user, "bookings.manage")) return "admin";
  return null;
}

export function canViewBooking(user: User | null | undefined, b: Booking): boolean {
  return actorFor(user, b) !== null;
}

/** Dashboard home per role. */
export function homeFor(role: Role): string {
  return role === "admin" || role === "support" ? "/admin" : "/dashboard";
}
