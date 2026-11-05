"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Message, Role, SignInMethods } from "@/lib/types";
import type { DomainActions } from "@/lib/domain/actions";
import { emptyData, fail, ok, type ClientConfig, type Data, type Result } from "@/lib/domain/data";
import { DEFAULT_FLAGS, DEFAULT_POLICY } from "@/lib/data/platform";
import { DEFAULT_SUBJECTS, DEFAULT_SUBJECT_CATEGORIES, buildCatalog, setLiveCatalog } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";

/*
 * The browser's copy of what the signed-in viewer may see, filled from the server (GET /api/state).
 * Every action is sent to the server (POST /api/actions), which checks permissions and business
 * rules inside a database transaction and answers with the result and the refreshed state. Nothing
 * here can change data on its own — the server decides.
 *
 * Only UI preferences (the compare tray) are kept in this browser.
 */

export type { Result } from "@/lib/domain/data";
export { DEFAULT_NOTIFICATION_PREFS, emptyStudentProfile, maskContactInfo, resolveTutor } from "@/lib/domain/data";
export type { CreateBookingInput, TutorOnboardingDraft } from "@/lib/domain/data";

type Async<T> = { [K in keyof T]: T[K] extends (...a: infer A) => infer R ? (...a: A) => Promise<R> : never };
type ServerActions = Async<DomainActions>;

export interface SignUpInput {
  role: Extract<Role, "student" | "parent" | "tutor">;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** ISO country code ("US", "IN"). */
  country?: string;
  zip: string;
  ageBand?: "18+" | "13-17";
  parentEmail?: string;
  next?: string;
}

export interface SignUpOutcome {
  needsConfirmation: boolean;
  /** How the email is confirmed: a 6-digit code typed on the site, or a link from Supabase's email. */
  verifyBy?: "code" | "link";
  email?: string;
  consent?: { sent: boolean; error?: string };
}

interface ClientOnly {
  hydrated: boolean;
  setHydrated(): void;
  /** Which backend services are connected (from the server). */
  config: ClientConfig;
  /** Tutors in the compare tray (kept in this browser only). */
  compare: string[];
  toggleCompare(tutorId: string): Result<boolean>;
  clearCompare(): void;
  /** Reloads everything from the server. */
  refresh(): Promise<void>;
  // Sign-in (Supabase Auth through /api/auth)
  /** With two-step login on, `mfaRequired` is true and verifyMfa() must follow. */
  signIn(email: string, password: string): Promise<Result<{ firstName: string; role: Role; mfaRequired?: boolean }> & { code?: string }>;
  /** True when the browser is signed in with a password but still owes a two-step code. */
  mfaRequired: boolean;
  /**
   * Enter a code from the authenticator app: after the password, or to finish setting it up (with factorId);
   * finishing setup also returns the 10 backup codes, shown once.
   */
  verifyMfa(code: string, factorId?: string): Promise<Result<{ firstName: string; role: Role; recoveryCodes?: string[] }>>;
  /** Starts two-step login: returns the QR code and secret to add to an authenticator app. */
  enrollMfa(): Promise<Result<{ factorId: string; qrCode: string; secret: string }>>;
  disableMfa(code: string): Promise<Result>;
  /** New backup codes (confirmed with the app's code); the old ones stop working. */
  newRecoveryCodes(code: string): Promise<Result<{ recoveryCodes: string[] }>>;
  /** Lost phone: a backup code instead of the app's code, after the password. Turns two-step login off. */
  recoverMfa(code: string): Promise<Result<{ firstName?: string; role?: Role; signInAgain?: boolean }>>;
  /** An administrator clears another account's two-step login (lost phone and backup codes). */
  resetStaffMfa(userId: string): Promise<Result>;
  signUp(input: SignUpInput): Promise<Result<SignUpOutcome>>;
  /** Signs out of this browser, or of every device with `everywhere`. */
  logout(everywhere?: boolean): Promise<void>;
  requestPasswordReset(email: string): Promise<Result>;
  /** The 6-digit code from the reset email, swapped for a link token that opens /reset-password. */
  verifyResetCode(email: string, code: string): Promise<Result<{ token: string }>>;
  /** Whether a reset link (its token) still works: "valid", "expired", "used", "replaced" (a newer email was sent) or "invalid". */
  checkResetLink(token: string): Promise<Result<{ status: "valid" | "expired" | "used" | "replaced" | "invalid" }>>;
  /** Sets a new password from a reset link. Afterwards the person signs in with it. */
  resetPassword(token: string, password: string): Promise<Result>;
  changePassword(current: string, next: string): Promise<Result>;
  /** An account made with Google / Facebook / Apple sets its first password (no current one to enter). */
  setPassword(next: string): Promise<Result>;
  /** Disconnects a Google / Facebook / Apple sign-in; answers with the account's sign-in methods. */
  unlinkSignIn(identityId: string): Promise<Result<SignInMethods>>;
  /** Changing the sign-in email: the password (when the account has one), then a code sent to the new address. */
  startEmailChange(email: string, password?: string): Promise<Result<{ email: string }> & { code?: string }>;
  confirmEmailChange(code: string): Promise<Result<{ email: string }>>;
  resendConfirmation(email: string): Promise<Result>;
  /** Checks the 6-digit sign-up code on the server and confirms the email (doesn't sign in). */
  verifyEmail(email: string, code: string): Promise<Result>;
  /**
   * A Google / Facebook / Apple sign-in attached to an existing account waits for the code emailed to that
   * account (`linkRequired`); confirmLink() enters it, cancelLink() removes that sign-in method instead.
   */
  linkRequired: { provider: string; email: string } | null;
  confirmLink(code: string): Promise<Result<{ mfaRequired?: boolean; role?: Role; needsRole?: boolean }>>;
  resendLinkCode(): Promise<Result>;
  cancelLink(): Promise<Result>;
  /** A first-time social account chooses its role (once). `next` is where its setup continues. */
  completeSignup(input: { role: "student" | "parent" | "tutor"; ageBand?: "18+" | "13-17" | "under13"; parentEmail?: string; country: string; zip?: string; terms: true; next?: string }): Promise<Result<{ next: string; consent?: { sent: boolean; error?: string } }> & { deleted?: boolean }>;
  /** A social account without an email adds one: a code goes to it, then finishAddEmail() confirms it. */
  startAddEmail(email: string): Promise<Result>;
  finishAddEmail(code: string): Promise<Result>;
  resendParentalConsent(): Promise<Result>;
}

export type AppState = Data & ServerActions & ClientOnly;

export const STORE_KEY = "tutorlink-ui";

const DEFAULTS = {
  flags: DEFAULT_FLAGS,
  policy: DEFAULT_POLICY,
  platformFeeBps: SITE.platformFeeBps,
  catalog: { categories: DEFAULT_SUBJECT_CATEGORIES, subjects: DEFAULT_SUBJECTS },
};

const OFFLINE = "We couldn't reach the server. Check your connection and try again.";

/** Names of the server actions, so each gets a client wrapper. */
const ACTIONS: (keyof DomainActions)[] = [
  "updateMe", "saveStudentProfile", "deleteMyAccount", "toggleFavorite", "saveSearch", "updateSavedSearch", "deleteSavedSearch", "toggleSavedJob",
  "saveRequirementDraft", "publishRequirement", "setRequirementStatus", "deleteRequirement", "applyToJob", "setApplicationStatus", "createBooking",
  "transitionBooking", "rescheduleBooking", "setLessonVideo", "removeLessonVideo", "setLessonRecording","validateCoupon", "topUpWallet", "submitReview", "respondToReview", "startConversation", "sendMessage",
  "markConversationRead", "toggleBlock", "report", "markNotificationRead", "markAllNotificationsRead", "setNotificationPref", "saveChild", "removeChild",
  "addProgressNote", "assignHomework", "submitHomework", "reviewHomework", "setTopicStatus", "addGoal", "updateTutorProfile", "setAvailability",
  "setExceptions", "setBookingRules", "setTrial", "saveOnboarding", "submitOnboarding", "submitVerification", "buyCredits", "changePlan", "openDispute",
  "addDisputeNote", "setDisputeStatus", "resolveDispute", "reviewVerification", "setUserStatus", "setReportStatus", "moderateReview", "setFlag",
  "updatePolicy", "setPlatformFee", "saveCoupon", "saveSubjectArea", "deleteSubjectArea", "saveSubject", "deleteSubject", "moveCatalogItem",
  "loadStarterCatalog", "logConversationAccess", "contactLearner", "warnChatUser", "restrictChat", "setContactFlagStatus", "requestChatUnlock", "declineChatUnlock", "setStaffAccess", "updateUserDetails", "deleteAccount", "setTutorListing", "takeDownRequirement", "sendAnnouncement", "saveBlogPost", "deleteBlogPost", "saveFaq", "deleteFaq", "moveFaq", "saveTestimonial", "deleteTestimonial",
];
/** Actions the scheduler or a public link run; the browser never calls them. */
const SERVER_ONLY = new Set<keyof DomainActions>(["confirmParentalConsent", "runScheduledJobs", "recordContactFlag"]);

async function post(url: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> | null }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return { status: 0, body: null };
  }
}

const statusError = (status: number, body: Record<string, unknown> | null) =>
  typeof body?.error === "string" ? (body.error as string) : status === 429 ? "Too many attempts. Please wait a moment and try again." : OFFLINE;

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      /*
       * Answers can arrive out of order, and with a distant database a save takes a second or two.
       *   - A save's answer always includes that save, so it's shown, and it outranks every background
       *     refresh that started before it arrived (unless a newer save's answer is already shown).
       *   - A background refresh is shown only if no save is on its way: it may have read the database
       *     before that save landed, and showing it would briefly undo what the person just did.
       *   - Otherwise the newest request wins.
       */
      let requested = 0;
      let applied = 0;
      let lastSave = 0;
      let saving = 0;
      const apply = (seq: number, body: Record<string, unknown> | null, isSave = false) => {
        if (body?.config) set({ config: body.config as ClientConfig });
        if (body && "mfaRequired" in body) set({ mfaRequired: body.mfaRequired === true });
        if (body && "linkRequired" in body) set({ linkRequired: (body.linkRequired as { provider: string; email: string } | null) ?? null });
        if (!body?.state) return;
        if (isSave) {
          if (seq < lastSave) return; // an older save answered after a newer one
          lastSave = seq;
          applied = ++requested;
        } else {
          if (saving > 0 || seq < applied) return;
          applied = seq;
        }
        set({ ...(body.state as Data), hydrated: true });
      };
      const inflight = new Map<string, Promise<unknown>>();

      const call = (name: keyof DomainActions, args: unknown[]): Promise<unknown> => {
        const key = `${name}:${JSON.stringify(args)}`;
        const running = inflight.get(key);
        if (running) return running; // a double click sends one request
        const seq = ++requested;
        saving++;
        const p = post("/api/actions", { action: name, args }).then(({ status, body }) => {
          apply(seq, body, true);
          const result = (body?.result as Result<unknown> | undefined) ?? fail(statusError(status, body));
          if (name === "logConversationAccess" && result.ok) {
            const released = result.data as Message[];
            set((s) => ({ messages: [...s.messages.filter((m) => !released.some((r) => r.id === m.id)), ...released] }));
          }
          return result;
        });
        inflight.set(key, p);
        void p.finally(() => {
          inflight.delete(key);
          saving--;
        });
        return p;
      };

      const serverActions = Object.fromEntries(
        ACTIONS.filter((a) => !SERVER_ONLY.has(a)).map((name) => [name, (...args: unknown[]) => call(name, args)]),
      ) as unknown as ServerActions;

      const auth = async <T,>(op: string, body: unknown): Promise<Result<T> & { code?: string }> => {
        const seq = ++requested;
        saving++;
        try {
          const { status, body: res } = await post(`/api/auth/${op}`, body);
          if (!res?.ok) return { ...fail(statusError(status, res)), ...(typeof res?.code === "string" ? { code: res.code } : {}) };
          apply(seq, res, true);
          return ok(res as T);
        } finally {
          saving--;
        }
      };

      return {
        ...emptyData(DEFAULTS),
        ...serverActions,
        hydrated: false,
        setHydrated: () => set({ hydrated: true }),
        config: { configured: true, paymentsEnabled: false, uploads: true, email: true },
        mfaRequired: false,
        linkRequired: null,
        compare: [],
        toggleCompare(tutorId) {
          const list = get().compare;
          if (list.includes(tutorId)) {
            set({ compare: list.filter((x) => x !== tutorId) });
            return ok(false);
          }
          if (list.length >= 3) return fail("You can compare up to 3 tutors. Remove one to add another.");
          set({ compare: [...list, tutorId] });
          return ok(true);
        },
        clearCompare: () => set({ compare: [] }),
        async refresh() {
          const seq = ++requested;
          try {
            const res = await fetch("/api/state", { cache: "no-store", credentials: "same-origin" });
            apply(seq, (await res.json().catch(() => null)) as Record<string, unknown> | null);
          } catch {
            /* offline: keep what's shown */
          }
          if (!get().hydrated) set({ hydrated: true });
        },

        async signIn(email, password) {
          const r = await auth<{ user: { firstName: string; role: Role }; mfaRequired?: boolean }>("sign-in", { email, password });
          if (r.ok) set({ mfaRequired: !!r.data.mfaRequired, linkRequired: (r.data as { linkRequired?: { provider: string; email: string } }).linkRequired ?? null });
          return r.ok ? ok({ ...r.data.user, mfaRequired: !!r.data.mfaRequired }) : r;
        },
        async verifyMfa(code, factorId) {
          const r = await auth<{ user: { firstName: string; role: Role }; recoveryCodes?: string[] }>("mfa-verify", { code, factorId });
          if (r.ok) set({ mfaRequired: false });
          return r.ok ? ok({ ...r.data.user, recoveryCodes: r.data.recoveryCodes }) : r;
        },
        async newRecoveryCodes(code) {
          const r = await auth<{ recoveryCodes: string[] }>("mfa-new-codes", { code });
          return r.ok ? ok({ recoveryCodes: r.data.recoveryCodes }) : r;
        },
        async recoverMfa(code) {
          const r = await auth<{ user?: { firstName: string; role: Role }; signInAgain?: boolean }>("mfa-recover", { code });
          if (r.ok) set({ mfaRequired: false });
          return r.ok ? ok({ firstName: r.data.user?.firstName, role: r.data.user?.role, signInAgain: !!r.data.signInAgain }) : r;
        },
        async enrollMfa() {
          const r = await auth<{ factorId: string; qrCode: string; secret: string }>("mfa-enroll", {});
          return r.ok ? ok({ factorId: r.data.factorId, qrCode: r.data.qrCode, secret: r.data.secret }) : r;
        },
        disableMfa: async (code) => {
          const r = await auth("mfa-disable", { code });
          return r.ok ? ok(undefined) : r;
        },
        resetStaffMfa: async (userId) => {
          const r = await auth("mfa-reset", { userId });
          return r.ok ? ok(undefined) : r;
        },
        async signUp(input) {
          const timezone = (() => {
            try {
              return Intl.DateTimeFormat().resolvedOptions().timeZone;
            } catch {
              return undefined;
            }
          })();
          const r = await auth<SignUpOutcome>("sign-up", { ...input, timezone });
          return r.ok ? ok({ needsConfirmation: !!r.data.needsConfirmation, verifyBy: r.data.verifyBy, email: r.data.email, consent: r.data.consent }) : r;
        },
        async logout(everywhere) {
          await auth("sign-out", { scope: everywhere === true ? "global" : "local" });
          set({ compare: [], mfaRequired: false, linkRequired: null });
        },
        requestPasswordReset: async (email) => {
          const r = await auth("forgot", { email });
          return r.ok ? ok(undefined) : r;
        },
        async verifyResetCode(email, code) {
          const r = await auth<{ token: string }>("reset-code", { email, code });
          return r.ok ? ok({ token: r.data.token }) : r;
        },
        async checkResetLink(token) {
          const r = await auth<{ status: "valid" | "expired" | "used" | "replaced" | "invalid" }>("reset-check", { token });
          return r.ok ? ok({ status: r.data.status }) : r;
        },
        async resetPassword(token, password) {
          const r = await auth("reset", { token, password });
          return r.ok ? ok(undefined) : r;
        },
        changePassword: async (current, next) => {
          const r = await auth("password", { current, next });
          return r.ok ? ok(undefined) : r;
        },
        setPassword: async (next) => {
          const r = await auth("password", { next });
          return r.ok ? ok(undefined) : r;
        },
        async unlinkSignIn(identityId) {
          const r = await auth<SignInMethods>("unlink", { identityId });
          return r.ok ? ok(r.data) : r;
        },
        async startEmailChange(email, password) {
          const r = await auth<{ email: string }>("change-email", { email, password });
          return r.ok ? ok({ email: r.data.email }) : r;
        },
        async confirmEmailChange(code) {
          const r = await auth<{ email: string }>("change-email-verify", { code });
          return r.ok ? ok({ email: r.data.email }) : r;
        },
        resendConfirmation: async (email) => {
          const r = await auth("resend", { email });
          return r.ok ? ok(undefined) : r;
        },
        verifyEmail: async (email, code) => {
          const r = await auth("verify-email", { email, code });
          return r.ok ? ok(undefined) : r;
        },
        confirmLink: async (code) => {
          const r = await auth<{ mfaRequired?: boolean; user?: { role: Role; needsRole?: boolean } }>("link-verify", { code });
          if (!r.ok) return r;
          set({ linkRequired: null, mfaRequired: !!r.data.mfaRequired });
          return ok({ mfaRequired: !!r.data.mfaRequired, role: r.data.user?.role, needsRole: r.data.user?.needsRole });
        },
        resendLinkCode: async () => {
          const r = await auth("link-resend", {});
          return r.ok ? ok(undefined) : r;
        },
        cancelLink: async () => {
          const r = await auth("link-cancel", {});
          if (r.ok) set({ linkRequired: null });
          return r.ok ? ok(undefined) : r;
        },
        completeSignup: async (input) => {
          const timezone = (() => {
            try {
              return Intl.DateTimeFormat().resolvedOptions().timeZone;
            } catch {
              return undefined;
            }
          })();
          const r = await auth<{ next: string; consent?: { sent: boolean; error?: string }; deleted?: boolean }>("complete-signup", { ...input, timezone });
          return r.ok ? ok({ next: r.data.next, consent: r.data.consent }) : r;
        },
        startAddEmail: async (email) => {
          const r = await auth("add-email", { email });
          return r.ok ? ok(undefined) : r;
        },
        finishAddEmail: async (code) => {
          const r = await auth("add-email-verify", { code });
          return r.ok ? ok(undefined) : r;
        },
        resendParentalConsent: async () => {
          const r = await auth("consent", {});
          return r.ok ? ok(undefined) : r;
        },
      };
    },
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ compare: s.compare }) as unknown as AppState,
      merge: (persisted, current) => ({ ...current, compare: ((persisted as Partial<AppState> | undefined)?.compare ?? []).slice(0, 3) }),
    },
  ),
);

/* The catalog registry that plain modules read (getCatalog / subjectName) follows the store. */
const syncCatalog = (c: Data["catalog"]) => setLiveCatalog(buildCatalog(c.categories, c.subjects));
syncCatalog(useApp.getState().catalog);
useApp.subscribe((state, prev) => {
  if (state.catalog !== prev.catalog) syncCatalog(state.catalog);
});
