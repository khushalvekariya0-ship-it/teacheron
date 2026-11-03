import "server-only";
import type { Permission, User } from "@/lib/types";
import type { Data, LoginEvent } from "@/lib/domain/data";
import { hasPermission } from "@/lib/permissions";
import { maskContactInfo } from "@/lib/domain/data";
import { fileNameContact, maskMatches } from "@/lib/domain/contact";
import { db } from "./db";
import { Loader } from "./load";

/*
 * What the browser receives: the public marketplace (listed tutors, published reviews and jobs, the
 * catalog, settings and published website content) plus what the signed-in account may see — its own
 * records, the bookings, conversations and learning records it takes part in, and for staff the
 * queues their permissions cover. Other people's accounts are reduced to a name and role.
 *
 * This is the server-side equivalent of row-level policies: nothing outside these rules leaves the
 * database, whatever the browser asks for.
 */

export type ClientState = Data;

type Id = string | null | undefined;
const uniq = (list: Id[]) => [...new Set(list.filter((x): x is string => !!x))];

/** Another person's account as others see it: name, role and time zone only. */
function stub(u: User): User {
  return {
    id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName, email: "", timezone: u.timezone, createdAt: u.createdAt,
    emailVerified: u.emailVerified, status: u.status, ...(u.tutorId ? { tutorId: u.tutorId } : {}),
  };
}

async function loginEvents(L: Loader, where: string, params: unknown[], limit: number): Promise<LoginEvent[]> {
  const rows = await L.raw(`select user_id, at, device, success from public.login_events where ${where} order by at desc limit ${limit}`, params);
  return rows.map((r) => ({ userId: String(r.user_id), at: (r.at as Date).toISOString(), device: String(r.device), success: !!r.success }));
}

export async function buildState(userId: string | null): Promise<ClientState> {
  return (await db().begin("isolation level repeatable read read only", async (tx) => {
    const L = new Loader(tx);
    const d = L.data;
    await Promise.all([
      L.globals(),
      // Tutors whose account is active are listed publicly.
      L.load("tutors", "not hidden and exists (select 1 from public.users u where u.tutor_id = tutors.id and u.status = 'active')"),
      L.load("reviews", "status = 'published'"),
      L.load("requirements", "status = 'published'", [], 1000),
      L.load("blog_posts", "status = 'published'"),
      L.load("faqs", "published"),
      L.load("testimonials", "published"),
    ]);
    const listed = new Set(d.registeredTutors.map((t) => t.id));
    d.reviews = d.reviews.filter((r) => listed.has(r.tutorId));
    // Job posters appear only as "student" or "parent".
    const publicOwners = uniq(d.requirements.map((r) => r.ownerId));

    let me: User | null = null;
    if (userId) {
      await L.users([userId]);
      me = d.users.find((u) => u.id === userId) ?? null;
    }
    const can = (p: Permission) => hasPermission(me, p);
    const staff = me?.role === "admin" || me?.role === "support";

    if (me) {
      await L.self(me);
      const myTutor = me.tutorId;
      await Promise.all([
        L.load("messages", "id in (select id from public.messages where conversation_id = any($1) order by created_at desc limit 3000)", [d.conversations.map((c) => c.id)]),
        L.load("notifications", "user_id = $1", [me.id], 200),
        loginEvents(L, "user_id = $1", [me.id], 20).then((list) => (d.loginHistory = list)),
        // Jobs a tutor applied to or saved stay visible after they close.
        myTutor ? L.byId("requirements", d.applications.filter((a) => a.tutorId === myTutor).map((a) => a.requirementId)) : null,
        L.byId("requirements", d.savedJobs[me.id] ?? []),
      ]);
      // The other side of every booking, conversation and learning record.
      const learnerIds = uniq([...d.goals, ...d.homework, ...d.progressNotes].map((x) => x.learnerId));
      await Promise.all([
        L.users([...d.bookings.map((b) => b.bookerId), ...d.conversations.map((c) => c.userId), ...d.requirements.filter((r) => r.ownerId !== me!.id).map((r) => r.ownerId), ...learnerIds]),
        L.usersByTutor([...d.bookings.map((b) => b.tutorId), ...d.conversations.map((c) => c.tutorId), ...d.goals.map((g) => g.tutorId), ...d.applications.map((a) => a.tutorId)]),
        L.tutors([...d.bookings.map((b) => b.tutorId), ...d.conversations.map((c) => c.tutorId), ...(d.favorites[me.id] ?? []), ...d.goals.map((g) => g.tutorId), ...d.applications.map((a) => a.tutorId)]),
        L.byId("children", [...d.bookings.map((b) => b.childId), ...d.conversations.map((c) => c.childId), ...learnerIds]),
      ]);

      if (staff) {
        const loads: Promise<unknown>[] = [];
        if (can("users.read")) {
          loads.push(
            L.load("users", "true"), L.load("tutors", "true"), L.load("children", "true"), L.load("requirements", "true", [], 3000),
            L.load("applications", "true", [], 3000),
            loginEvents(L, "true", [], 500).then((list) => (d.loginHistory = list)),
          );
        }
        if (can("bookings.manage") || can("payments.read") || can("disputes.manage")) loads.push(L.load("bookings", "true", [], 3000), L.load("tutors", "true"));
        if (can("payments.read")) {
          loads.push(L.load("payments", "true", [], 3000), L.load("wallet_transactions", "true", [], 3000), L.load("lead_transactions", "true", [], 3000), L.load("payouts", "true", [], 3000), L.load("subscriptions", "true"));
        }
        if (can("disputes.manage")) loads.push(L.load("disputes", "true", [], 2000));
        if (can("reports.moderate")) loads.push(L.load("reports", "true", [], 2000), L.load("reviews", "true", [], 3000), L.load("contact_flags", "true", [], 3000));
        if (can("tutors.verify")) loads.push(L.load("verification_requests", "true", [], 2000), L.load("tutors", "true"));
        if (can("conversations.read_flagged")) loads.push(L.load("conversations", "reported or exists (select 1 from public.disputes x join public.bookings b on b.id = x.booking_id where b.tutor_id = conversations.tutor_id and b.booker_id = conversations.user_id)"));
        if (can("audit.read")) loads.push(L.load("audit_logs", "true", [], 500));
        if (can("settings.manage")) loads.push(L.load("coupons", "true"));
        if (can("content.manage")) loads.push(L.load("blog_posts", "true"), L.load("faqs", "true"), L.load("testimonials", "true"));
        await Promise.all(loads);
        // Names for everyone the staff queues mention.
        await L.users([
          ...d.bookings.map((b) => b.bookerId), ...d.disputes.map((x) => x.openedBy), ...d.reports.map((x) => x.reporterId), ...d.payments.map((p) => p.userId),
          ...d.conversations.map((c) => c.userId), ...d.auditLogs.map((a) => a.actorId), ...d.contactFlags.flatMap((f) => [f.userId, f.recipientId]),
        ]);
        await L.usersByTutor(d.registeredTutors.map((t) => t.id));
      }
    }
    await L.users(publicOwners);

    /* ─── Redaction ─────────────────────────────────────────── */
    const myId = me?.id;
    const fullUsers = can("users.read");
    const moderator = can("reports.moderate");
    // Chat moderators also see warnings and pauses (Admin → Chat safety).
    d.users = d.users.map((u) => (u.id === myId || fullUsers ? u : moderator && u.chatModeration ? { ...stub(u), chatModeration: u.chatModeration } : stub(u)));
    if (!moderator) d.contactFlags = [];
    if (!can("payments.read")) {
      d.payments = d.payments.filter((p) => p.userId === myId);
      d.walletTransactions = d.walletTransactions.filter((t) => t.userId === myId);
    }
    if (!can("disputes.manage")) {
      // The other person in a dispute doesn't see contact details in it: they're masked in the description,
      // and evidence files that show them can only be opened by staff and the person who added them.
      d.disputes = d.disputes.map((x) =>
        x.openedBy === myId
          ? { ...x, adminNotes: [] }
          : { ...x, adminNotes: [], details: maskContactInfo(x.details).text, evidence: x.evidence.map((f) => ({ ...(f.staffOnly ? { sizeKb: f.sizeKb, staffOnly: true } : f), name: maskMatches(f.name, fileNameContact(f.name).matches, "[hidden]") })) },
      );
    }
    // A hidden tutor stays visible only to staff, to the tutor, and to people already booking or talking with them.
    if (!staff) {
      const related = new Set([me?.tutorId, ...d.bookings.map((b) => b.tutorId), ...d.conversations.map((c) => c.tutorId)]);
      d.registeredTutors = d.registeredTutors.filter((t) => !t.hidden || related.has(t.id));
    }
    // Personal records (learning profile, drafts, preferences, favorites, saved items) are only ever the viewer's own.
    for (const key of ["studentProfiles", "notificationPrefs", "onboarding", "favorites", "savedJobs"] as const) {
      const own = (d[key] as Record<string, unknown>)[myId ?? ""];
      (d as unknown as Record<string, unknown>)[key] = own ? { [myId!]: own } : {};
    }
    d.savedSearches = d.savedSearches.filter((s) => s.userId === myId);
    if (!can("reports.moderate")) d.reports = d.reports.filter((r) => r.reporterId === myId);
    // Messages are sent only for the viewer's own conversations. Staff load a flagged conversation's
    // messages through logConversationAccess, which records the reason in the audit log first.
    const myConversations = new Set(d.conversations.filter((c) => c.userId === myId || (me?.tutorId && c.tutorId === me.tutorId)).map((c) => c.id));
    d.messages = d.messages.filter((m) => myConversations.has(m.conversationId));
    d.notifications = d.notifications.filter((n) => n.userId === myId);
    d.sessionUserId = myId ?? null;
    return d;
  })) as ClientState;
}
