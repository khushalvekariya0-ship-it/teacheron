# Decisions and assumptions awaiting approval

The preview build had to pick concrete behaviour for every rule. These are **defaults, not approved policy**. Each entry states what the code does today, the realistic options, and a recommendation. Values marked *admin-editable* live in Admin → Platform settings (`updatePolicy`, `setPlatformFee`) and, in production, in `platform_settings`.

**Status key:** Proposed = needs product-owner sign-off · Adopted = architectural decision already reflected in code and schema (confirm or overturn).

| # | Decision | Current default | Status |
|---|---|---|---|
| D1 | Cancellation, reschedule and refund policy | 24 h free (trials 4 h), then 50 %; reschedule ≥ 12 h, max 2 | Proposed |
| D2 | No-show outcomes | Student no-show 0 % refund; tutor no-show 100 % | Proposed |
| D3 | Platform fee and commission | Flat 15 % on every booking | Proposed |
| D4 | Tutor plans | Starter $0 / Professional $29 / Premium $59 | Proposed |
| D5 | Lead credits | 1 credit per application; packs 10/$15, 25/$32, 60/$69 | Proposed |
| D6 | Trial as a booking type | `type: trial`, one per tutor + learner | Adopted |
| D7 | Contact-detail masking | Always masked, everywhere | Proposed |
| D8 | Minors | Under-13 blocked; 13–17 need parental consent | Proposed |
| D9 | Featured placement | Never affects ranking | Adopted |
| D10 | Review eligibility | Booker, completed lesson, one per booking | Proposed |
| D11 | Payout timing | After dispute window (7 days), weekly | Proposed |
| D12 | Stripe authorization window | Authorize at request, capture on confirm | Proposed |
| D13 | Unanswered booking requests | No expiry today | Proposed |
| D14 | Matching weights and rules | Subject 30, grade 15, schedule 15, budget 15, location 10, experience 7, language 4, support 4 | Proposed |
| D15 | Verification requirements | Badges only after completion; 2-year expiry | Proposed |
| D16 | Policy changes vs existing bookings | Live policy applies to all bookings | Proposed |
| D17 | Account deletion and retention | Hard delete in preview | Proposed |
| D18 | Coupons | First-booking and minimum-spend rules; redemptions not returned | Proposed |
| D19 | Rate limits for tutors | Profile $15–$500; applications $10–$500 | Proposed |
| D20 | Lesson completion timing | Tutor may complete any time after start | Proposed |
| D21 | Instant booking | Tutor opt-in + platform flag | Proposed |
| D22 | SMS, referrals, tax | SMS and referrals off | Proposed |

---

## D1. Cancellation, reschedule and refund policy

**Current (admin-editable, `DEFAULT_POLICY`):** booker cancels ≥ 24 h before start → full refund; later → 50 %. Trials: free cancellation up to 4 h before. Tutor or staff cancellation → full refund. Reschedule allowed up to 12 h before start, at most 2 times. Disputes within 7 days of the lesson end. Meeting link visible 15 min before start. These rules are shown before payment (`policySummary`) and on the FAQ.

**Options:** (A) keep as is; (B) stricter — 48 h free, 0 % after (tutor-friendly, common for in-person); (C) tiered — ≥ 24 h 100 %, 2–24 h 50 %, < 2 h 0 %.

**Recommendation:** A for launch; revisit with cancellation data after 90 days. Consider letting tutors choose between two platform-defined policies (Flexible / Standard) rather than free-form.

## D2. No-show outcomes

**Current:** reports allowed 15 min after start. Student no-show → no refund (tutor is paid). Tutor no-show → full refund. `tutorNoShowCreditCents` ($10 goodwill credit) and the two no-show refund percentages exist in the policy but **are not read by the store** — refunds are hard-coded.

**Options:** grant the $10 credit on confirmed tutor no-shows (needs the learner credit ledger, `account_credit_entries`); use meeting-provider attendance to auto-detect no-shows; tutor strike policy (e.g. 3 no-shows in 90 days → profile hidden pending review).

**Recommendation:** wire the policy fields, grant the credit, add strikes, and treat attendance data as evidence for disputes rather than an automatic verdict.

## D3. Platform fee and commission

**Current:** `SITE.platformFeeBps = 1500` (15 %, admin-editable 0–30 %) is applied to every booking's charged amount **after** discount and stored as `platformFeeCents`. Separately, `TUTOR_PLANS` advertise commissions of **18 % (Starter), 15 % (Professional), 12 % (Premium)** — the booking code ignores them. The FAQ tells families they will see "any platform fee" before paying.

**Questions for the product owner:**
1. Is the fee a **tutor commission** (deducted from earnings), a **learner service fee** (added at checkout), or both?
2. Should the tutor's **plan commission** replace the flat 15 %?
3. Who funds **coupon discounts**? Today the fee is computed on the discounted amount, so tutors bear part of every promotion.

**Recommendation:** single all-in price for learners; commission deducted from tutor earnings at the tutor's plan rate, snapshotted on the booking; commission computed on the **pre-discount** price with the platform funding coupons so promotions never reduce tutor earnings. Update pricing copy accordingly.

## D4. Tutor plans

**Current:** Starter $0/mo (18 %, 3 credits/mo), Professional $29/mo (15 %, 20 credits/mo, instant job alerts, priority support), Premium $59/mo (12 %, 50 credits/mo, eligible for featured placement, advanced reports). `changePlan` switches immediately, charges the full month and grants that plan's credits **every time it is called** (no proration, no recurring grant).

**Decide:** credit rollover (none / capped at one month), proration on upgrade/downgrade, annual pricing, what "eligible for featured placement" means (see D9).

**Recommendation:** Stripe Billing with proration on upgrade and change-at-period-end on downgrade; grant credits on each paid invoice; no rollover of plan credits.

## D5. Lead credits

**Current:** applying to a requirement costs 1 credit when the `lead_credits` flag is on. Packs: 10 credits $15, 25 for $32, 60 for $69. Being contacted directly by a family is free. Credits never expire. Withdrawing does not refund; re-applying after withdrawal costs another credit.

**Options:** refund the credit when the family deletes/closes the requirement without viewing the application, or does not view it within N days; expire purchased credits after 12 months (disclose at purchase; check state gift-card laws); cap applications per requirement (e.g. first 10) to protect families from spam.

**Recommendation:** refund on "closed/deleted before viewed"; plan credits expire at period end, purchased credits after 12 months; cap at 15 applications per requirement.

## D6. Trial as a booking type

**Adopted:** trial is `Booking.type = "trial"`, not a status, so trials share the whole state machine, payments, reminders, disputes and reviews ([STATE_MACHINES.md](STATE_MACHINES.md#modeling-decision-trial-is-a-type-not-a-status)). Rules: tutor opt-in; price $0–$200; length 15/20/25/30/45/60 min; one trial per tutor per learner (child or student), counting every trial that is not cancelled; 4-hour free cancellation.

**Open detail:** a trial that ended in `payment_failed` or `refunded` after a tutor no-show still counts today, blocking a second attempt. **Recommendation:** exclude those statuses from the one-trial rule.

## D7. Contact-detail masking

**Current:** emails, US phone numbers and off-platform handles (WhatsApp, Telegram, Snapchat, Instagram, Venmo, Cash App) are replaced with "[contact details hidden]" in messages, application messages, booking notes, reviews, review responses and tutor bio/approach — **always**, including after a booking. The public FAQ says contact details are protected "until a booking exists", which does not match the code. The keyword pattern also masks innocent mentions ("I post worksheets on Instagram").

**Options:** (A) always mask (current code); (B) allow sharing after the first completed paid lesson between the same parties (adults only); (C) never unmask, add in-app calling/number proxy.

**Recommendation:** A for any conversation involving a minor; B for adult learners; fix the FAQ copy whichever option is chosen; production detection should flag for review instead of masking bare platform names.

## D8. Minors

**Current:** under-13s cannot register (age bands offered: 18+ or 13–17). 13–17 students must give a parent/guardian email; their consent stays `pending` and blocks booking and starting conversations. Parents can create child profiles of any age (first name, grade, optional birth year). Conversations started by a parent or a teen are flagged `involvesMinor`. The preview has no way to grant consent, and a teen with pending consent **can still post and publish requirements**.

**Decide:**
1. Consent mechanism — signed email link to the parent (proposed), or require the parent to create an account.
2. Whether pending-consent teens may post requirements (recommendation: drafts yes, publish no).
3. Whether a **passed background check is required** before a tutor can accept any booking for a minor (recommendation: yes), and in-person rules for minors (public place or guardian present).
4. Guardian visibility of teen conversations (recommendation: guardian is a participant and can read, teen is told this up front).

## D9. Featured placement never affects ranking

**Adopted:** match score and search order ignore `featured` and subscription tier; ties break on lessons completed, then last name. Featured tutors appear only in a separate, labelled module (homepage). The `featured_tutors` flag controls that module.

**Decide:** how tutors become featured (editorial, Premium-plan eligibility, paid slot) and the label. If placement is paid, label it "Sponsored" (FTC endorsement guidance) and keep the separate module.

## D10. Review eligibility

**Current:** only the booker (student or parent) may review; booking must be `completed`; one review per booking; rating 1–5; ≥ 20 characters; contact details masked; published immediately. Tutors may respond once (≥ 10 chars). Staff can flag or remove reviews. A tutor's rating is computed from published reviews only, and shows "New · no reviews yet" when there are none. A review stays up even if the lesson is later refunded through a dispute.

**Options:** review window (e.g. 30 days after completion); 14-day edit window; allow reviews after a tutor no-show; hide reviews tied to bookings refunded in full; pre-moderation vs post-moderation.

**Recommendation:** 30-day window, 14-day edits, post-moderation with automated screening, keep reviews on refunded bookings but show "Lesson refunded" to staff only.

## D11. Payout timing

**Proposed:** tutor earnings for a completed lesson become available after lesson end + `disputeWindowDays` (7) if no dispute or chargeback is open; weekly payouts via Stripe Connect Express using separate charges and transfers (so the platform holds funds until they are available); partial refunds after payout are recovered as negative adjustments on the next payout.

**Options:** shorter window (48 h) for tutors with a clean history; daily payouts; instant payouts for a fee.

## D12. Stripe authorization window

**Current preview:** pending (approval-required) bookings are `authorized` and captured when the tutor confirms; instant bookings are paid at once.

**Constraint:** card authorizations generally expire after about 7 days, but bookings may be requested up to `maxAdvanceDays` ahead (7–180, default 45). An authorization placed at request time will often lapse before the lesson or even before the tutor responds.

**Options:**
- (A) **Authorize only when the lesson is ≤ 6 days away.** Otherwise save the card with a SetupIntent and create an off-session PaymentIntent on confirmation (or 72 h before the lesson); on `authentication_required`, move to `payment_failed` and ask the booker to retry.
- (B) **Charge at request**, refund in full if the tutor declines or the request expires (simple, but money leaves the learner's account before acceptance).
- (C) **Cap approval-required bookings at 6 days ahead**; longer horizons only for instant booking.

**Recommendation:** A, with a job that re-authorizes or cancels holds before `authorizationExpiresAt`, plus D13 so requests cannot sit unanswered.

## D13. Unanswered booking requests

**Current:** a `pending` request has no expiry; after the start time it cannot be confirmed and the system has no transition to cancel it.

**Recommendation:** tutors must respond within 24 h or before the start time, whichever comes first; otherwise a system job cancels the request (release the hold, full refund, notify both sides, count against the tutor's response rate). Add a `system` actor to `pending → cancelled_by_tutor` (or a dedicated `expired` status).

## D14. Matching weights and rules

**Current (`DEFAULT_WEIGHTS`, transparent to users):** subject 30, grade 15, schedule 15, budget 15, location & mode 10, experience 7, language 4, learning support 4. Factors the user did not specify are neutral and excluded from the denominator. Not teaching the subject, or a mode mismatch, disqualifies (score capped at 40 % and sorted last). Related subject scores 0.35; budget up to 15 % over scores 0.5; experience below the preference scores 0.6 × ratio. The natural-language concierge parser runs locally (no data leaves the browser) and everything it extracts is shown back for confirmation. `ai_matching` is enabled at 25 % rollout, but rollout percentages are not evaluated in the preview.

**Decide:** approve weights; make them admin-editable in production (versioned); any future LLM assistance may only fill criteria — scoring stays rules-based and explainable, and no personal data is sent without consent.

## D15. Verification requirements

**Current:** four checks (identity, education, certification, background). Badges and the "Verified" search filter reflect only completed checks (`verified` = identity verified; "Certified" = at least one verified certification). Verified checks expire after 730 days. Rejections require a written reason.

**Decide:** which checks are **required to publish** a profile (recommendation: identity), which are required for **in-person** lessons and for **minors** (recommendation: background), the background-check vendor and FCRA adverse-action process, and the re-verification cadence.

## D16. Policy changes vs existing bookings

**Current:** policy edits apply immediately to every booking, including ones already paid under the old terms.

**Recommendation:** snapshot the policy and commission on each booking (`bookings.policySnapshot`) and apply changes to new bookings only.

## D17. Account deletion and data retention

**Current:** `deleteMyAccount` hard-deletes the user record if they have no pending/confirmed bookings **as booker**; tutors with upcoming lessons are not checked, and related records remain.

**Recommendation:** soft delete + anonymize PII; block while any upcoming lesson exists in either role; retain payments, refunds, payouts and audit logs 7 years; messages 2 years after last activity; verification documents deleted 30 days after a decision (keep the outcome); pre-mask message originals (if stored at all) 90 days, encrypted.

## D18. Coupons

**Current:** codes are 4–16 upper-case letters/digits; percent (1–100) or fixed cents; minimum spend; global redemption cap; expiry; "first paid booking only" (any earlier non-cancelled paid booking disqualifies). There is no per-user limit, and the redemption is **not returned** when the booking is cancelled. Discount funding: see D3.

**Recommendation:** per-user limit of 1 by default; return the redemption when a booking is cancelled with a full refund; platform funds discounts.

## D19. Rate limits for tutors

**Current:** tutor profile hourly rate must be $15–$500, but an application's proposed rate may be $10–$500.

**Recommendation:** one range ($15–$500) everywhere, enforced by a shared Zod schema.

## D20. Lesson completion timing

**Current:** the tutor (or staff) may mark a lesson completed any time after it **starts**.

**Recommendation:** allow completion only after the scheduled end (or auto-complete at end + 1 h), so the dispute window and earnings clock start from a real end time.

## D21. Instant booking

**Current:** instant booking requires the tutor to turn off "requires approval" **and** the platform `instant_booking` flag; onboarding defaults new tutors to approval required.

**Decide:** whether instant booking should require identity verification and a minimum track record (recommendation: identity verified + 5 completed lessons).

## D22. SMS, referrals and tax

- **SMS** is off (`sms_notifications` flag). Before enabling: TCPA-compliant opt-in with phone verification, STOP handling, quiet hours (9 pm–8 am recipient time) for non-urgent messages.
- **Referrals** are off (`referrals` flag). Decide reward (e.g. $20 credit to both parties after the referred learner's first completed paid lesson), caps and fraud checks.
- **Tax:** Stripe Connect issues 1099-K forms to tutors; decide whether subscriptions and credit packs need sales-tax collection (e.g. Stripe Tax) and review state rules for tutoring marketplaces before launch.
