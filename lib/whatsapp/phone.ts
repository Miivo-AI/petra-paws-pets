/**
 * Phone number parsing for WhatsApp sends and for storage.
 *
 * Replaces a hand-rolled "strip non-digits, swap a leading 0 for 971"
 * rule that produced wrong numbers rather than errors:
 *   00971541996900 → 9710971541996900  (undeliverable)
 *   541996900      → 541996900         (country code 54 — Argentina)
 *   07911 123456   → 9717911123456     (someone else's UAE number)
 *
 * Messaging a stranger is worse than not messaging at all, so anything
 * that can't be resolved to a valid mobile number is rejected outright
 * instead of guessed at.
 */

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Petra Paws operates in the UAE, so bare local numbers are UAE numbers. */
export const DEFAULT_COUNTRY: CountryCode = "AE";

export type ParsedPhone = {
  /** Canonical storage + display form, e.g. "+971541996900". */
  e164: string;
  /** What the Cloud API wants in `to` — digits only, no "+". */
  waId: string;
  country: CountryCode | undefined;
};

export type PhoneParseFailure =
  | "empty"
  | "unparseable"
  | "invalid"
  | "not_mobile";

export type PhoneParseResult =
  | ({ ok: true } & ParsedPhone)
  | { ok: false; reason: PhoneParseFailure };

/**
 * `defaultCountry` only applies to numbers written without a country
 * code. Anything starting with "+" — or with the UAE's "00" IDD prefix —
 * is honoured as written, so tourists booking on a foreign number still
 * get their confirmation.
 */
export function parsePhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): PhoneParseResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };

  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed) return { ok: false, reason: "unparseable" };
  if (!parsed.isValid()) return { ok: false, reason: "invalid" };

  // WhatsApp only reaches mobile numbers. getType() returns undefined
  // for ranges where the metadata can't tell mobile from fixed-line, so
  // only an explicit non-mobile classification is rejected.
  const type = parsed.getType();
  if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") {
    return { ok: false, reason: "not_mobile" };
  }

  return {
    ok: true,
    e164: parsed.number,
    waId: parsed.number.replace(/^\+/, ""),
    country: parsed.country,
  };
}

/** E.164 for storage, or null when the input can't be trusted. */
export function toE164(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): string | null {
  const result = parsePhone(input, defaultCountry);
  return result.ok ? result.e164 : null;
}

export function isValidPhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): boolean {
  return parsePhone(input, defaultCountry).ok;
}

/** Wrapped in "+" so it matches the E.164 stored on appointments. */
export function waIdToE164(waId: string): string {
  return waId.startsWith("+") ? waId : `+${waId.replace(/[^\d]/g, "")}`;
}

export const PHONE_ERROR_MESSAGE =
  "Enter a valid mobile number, including the country code if it isn't a UAE number (e.g. +971 54 199 6900).";
