/**
 * The single source of truth for WhatsApp opt-in wording.
 *
 * Meta's Business Messaging Policy requires opt-in that makes two
 * things unmistakable: that the customer will be messaged *on WhatsApp*,
 * and *by whom*. App Review asks to see exactly where that happens, so
 * the booking form renders this text and the server records this same
 * text verbatim against the phone number — the client never gets to
 * decide what the customer supposedly agreed to.
 *
 * Bump CONSENT_VERSION whenever the wording changes so existing rows
 * keep evidencing the version they were actually collected under.
 */

export const WHATSAPP_CONSENT_VERSION = "2026-08-1";

export const WHATSAPP_CONSENT_TEXT =
  "I agree to receive booking confirmations and appointment updates from " +
  "Petra Paws Pets on WhatsApp at the number above. Reply STOP at any time " +
  "to stop receiving them.";

/**
 * Keywords that opt a number out. Deliberately excludes "CANCEL" — for
 * a grooming business that overwhelmingly means "cancel my appointment",
 * and silently muting that customer instead of reading their message
 * would be worse than useless.
 */
export const OPT_OUT_KEYWORDS = [
  "stop",
  "stop all",
  "unsubscribe",
  "opt out",
  "optout",
  "no more messages",
  "توقف",
  "إلغاء الاشتراك",
];

/** Re-subscribe keywords, so an accidental STOP isn't a dead end. */
export const OPT_IN_KEYWORDS = ["start", "unstop", "subscribe", "اشتراك"];

function normalizeKeyword(body: string): string {
  return body
    .trim()
    .toLowerCase()
    .replace(/[.!,;:؟?]+$/g, "")
    .replace(/\s+/g, " ");
}

export type ConsentKeyword = "opt_out" | "opt_in" | null;

/**
 * Only an exact keyword match counts. Substring matching would opt out
 * anyone who wrote "please stop by at 4pm".
 */
export function detectConsentKeyword(body: string | null | undefined): ConsentKeyword {
  if (!body) return null;
  const normalized = normalizeKeyword(body);
  if (!normalized) return null;
  if (OPT_OUT_KEYWORDS.includes(normalized)) return "opt_out";
  if (OPT_IN_KEYWORDS.includes(normalized)) return "opt_in";
  return null;
}
