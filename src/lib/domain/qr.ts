import { scanContact, type ContactKind } from "./contact";

/*
 * Contact details in what a QR code holds (shared: the server reads QR codes in files, pictures and shared
 * screens; each person's own browser reads them on their camera).
 */

// Links that open a call, message, email, chat app or payment straight away.
const CONTACT_SCHEME = /^(?:whatsapp|tg|telegram|instagram|fb|fb-messenger|skype|viber|weixin|line|imo|upi|paytmmp|phonepe|gpay|tez):/i;

/** Contact details in what a QR code holds. */
export function qrKinds(payload: string): ContactKind[] {
  const kinds = new Set<ContactKind>(scanContact(payload, "file").kinds);
  if (/^(?:tel|sms|smsto|mms|facetime):/i.test(payload)) kinds.add("phone");
  if (/^(?:mailto|matmsg):/i.test(payload)) kinds.add("email");
  if (CONTACT_SCHEME.test(payload)) kinds.add("social");
  if (/^(?:BEGIN:VCARD|MECARD:)/i.test(payload) && /\b(?:TEL|EMAIL|N|FN)[;:]/i.test(payload) && !kinds.size) kinds.add("social");
  return [...kinds];
}
