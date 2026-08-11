/**
 * Consent ledger for WhatsApp (whatsapp_contacts, migration 009).
 *
 * Every outbound send is gated on this table, and the Meta webhook
 * writes to it when a customer replies STOP. Without it, the promise
 * made on /privacy, /terms and /data-deletion ("reply STOP at any time")
 * is unenforceable — the reply lands on the owner's phone and the next
 * booking messages the customer again anyway.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { WHATSAPP_CONSENT_TEXT, WHATSAPP_CONSENT_VERSION } from "@/lib/whatsapp/consent";

export type ConsentSource = "booking_form" | "inbound_message" | "admin";

export type ConsentState =
  | { status: "allowed" }
  | { status: "no_consent" }
  | { status: "opted_out"; optedOutAt: string };

/**
 * Opting out always wins over a later opt-in from a booking form —
 * someone who said STOP shouldn't be re-subscribed just by booking
 * again. Only an explicit START reply (or an admin action) clears it.
 */
export async function recordOptIn(params: {
  phoneE164: string;
  source: ConsentSource;
  appointmentId?: string | null;
  clearOptOut?: boolean;
}): Promise<void> {
  const supabase = await createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("whatsapp_contacts").upsert(
    {
      phone_e164: params.phoneE164,
      opted_in_at: now,
      opt_in_text: WHATSAPP_CONSENT_TEXT,
      opt_in_version: WHATSAPP_CONSENT_VERSION,
      opt_in_source: params.source,
      opt_in_appointment_id: params.appointmentId ?? null,
      ...(params.clearOptOut ? { opted_out_at: null, opt_out_reason: null } : {}),
      updated_at: now,
    },
    { onConflict: "phone_e164" }
  );

  if (error) {
    // Consent that didn't persist must not be treated as consent, so
    // this is loud: the send will subsequently be skipped as
    // "no_consent" rather than going out unrecorded.
    console.error(`[whatsapp] failed to record opt-in for ${params.phoneE164}:`, error.message);
  }
}

export async function recordOptOut(params: {
  phoneE164: string;
  reason: string;
}): Promise<void> {
  const supabase = await createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("whatsapp_contacts").upsert(
    {
      phone_e164: params.phoneE164,
      opted_out_at: now,
      opt_out_reason: params.reason,
      updated_at: now,
    },
    { onConflict: "phone_e164" }
  );

  if (error) {
    console.error(`[whatsapp] failed to record opt-out for ${params.phoneE164}:`, error.message);
  }
}

/**
 * Fails closed: if the consent lookup itself errors we report
 * "no_consent" rather than assuming permission to message someone.
 */
export async function getConsentState(phoneE164: string): Promise<ConsentState> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_contacts")
    .select("opted_in_at, opted_out_at")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  if (error) {
    console.error(`[whatsapp] consent lookup failed for ${phoneE164}:`, error.message);
    return { status: "no_consent" };
  }
  if (!data) return { status: "no_consent" };
  if (data.opted_out_at) return { status: "opted_out", optedOutAt: data.opted_out_at };
  if (!data.opted_in_at) return { status: "no_consent" };
  return { status: "allowed" };
}
