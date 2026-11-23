"use client";

/**
 * A guest (no account) proves who they are to the class checks with the claim the host's "let in" answered
 * (GuestJoin keeps it in this tab and sets it here once the guest is let in). The safety and screen checks send
 * it along, so what a guest says, draws, shows on camera or shares is checked like everyone else's.
 */
let guestClaim: string | null = null;

export function setGuestClaim(claim: string | null) {
  guestClaim = claim;
}

/** Added to a check's body: `{ guest: claim }` for a guest, nothing for someone signed in. */
export function guestPass(): { guest?: string } {
  return guestClaim ? { guest: guestClaim } : {};
}
