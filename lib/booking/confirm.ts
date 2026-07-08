/**
 * Shared payment-confirmation logic for online bookings.
 *
 * Three separate triggers all need to reach the same conclusion about
 * whether a booking got paid, so the logic lives in one place:
 *   - the browser redirect back from Ziina (app/api/bookings/[id]/confirm)
 *   - the Ziina webhook (app/api/webhooks/ziina)
 *   - the reconciliation cron (app/api/cron/reconcile-bookings), which
 *     catches payments that succeeded but never redirected the browser
 *     back (closed tab, dropped connection, webhook delivery failure)
 *
 * Never trusts the caller's claim that a payment succeeded — always
 * re-verifies against the Ziina API before confirming.
 */

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendBookingConfirmation, sendOwnerBookingAlert } from "@/lib/email";
import type { Appointment, Service, ServiceZone } from "@/lib/types";

const ZIINA_API_URL = process.env.ZIINA_API_URL ?? "https://api-v2.ziina.com/api";
const ZIINA_API_KEY = process.env.ZIINA_API_KEY;

export function isZiinaConfigured(): boolean {
  return Boolean(ZIINA_API_KEY);
}

/**
 * Ziina payment_intent statuses (per docs.ziina.com/reference/getpaymentintent):
 * requires_payment_instrument | pending | requires_user_action | completed | failed
 * Only "completed" means the money has actually landed.
 */
export async function isZiinaPaymentComplete(paymentId: string): Promise<boolean> {
  if (!ZIINA_API_KEY || !paymentId) return false;
  try {
    const res = await fetch(`${ZIINA_API_URL}/payment_intent/${paymentId}`, {
      headers: { Authorization: `Bearer ${ZIINA_API_KEY}` },
    });
    if (!res.ok) {
      console.error(
        `[confirm] Ziina payment_intent lookup failed for ${paymentId}: ${res.status} ${await res.text()}`
      );
      return false;
    }
    const data = await res.json();
    return data?.status === "completed";
  } catch (err) {
    console.error(`[confirm] Ziina payment_intent lookup threw for ${paymentId}:`, err);
    return false;
  }
}

export type ConfirmResult =
  | { outcome: "already_confirmed"; lookupToken: string }
  | { outcome: "confirmed"; lookupToken: string }
  | { outcome: "not_found" }
  | { outcome: "hold_expired" }
  | { outcome: "not_paid" };

/**
 * Idempotent — safe to call repeatedly (redirect + webhook + cron may
 * all race to confirm the same booking; only the first one that finds
 * it still pending_payment will flip it).
 */
export async function confirmBookingIfPaid(bookingId: string): Promise<ConfirmResult> {
  try {
    const supabase = await createAdminClient();

    const { data: booking, error: fetchErr } = await supabase
      .from("appointments")
      .select("*, service:services(id,name,duration_minutes), zone:service_zones(id,name)")
      .eq("id", bookingId)
      .single();

    if (fetchErr) {
      console.error(`[confirm] fetch failed for booking ${bookingId}:`, fetchErr);
      return { outcome: "not_found" };
    }
    if (!booking) return { outcome: "not_found" };

    if (booking.status === "confirmed") {
      return { outcome: "already_confirmed", lookupToken: booking.lookup_token };
    }

    if (booking.status !== "pending_payment") {
      return { outcome: "not_found" };
    }

    if (booking.hold_expires_at && booking.hold_expires_at < new Date().toISOString()) {
      const { error: cancelErr } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", bookingId)
        .eq("status", "pending_payment");
      if (cancelErr) {
        console.error(`[confirm] failed to cancel expired hold for booking ${bookingId}:`, cancelErr);
      }
      return { outcome: "hold_expired" };
    }

    if (!booking.ziina_payment_id) return { outcome: "not_paid" };

    const paid = await isZiinaPaymentComplete(booking.ziina_payment_id);
    if (!paid) return { outcome: "not_paid" };

    // Guard the update with .eq("status", "pending_payment") so two
    // concurrent callers (e.g. webhook + cron firing at the same moment)
    // can't both fire the confirmation emails.
    const { data: confirmed, error: confirmErr } = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
        hold_expires_at: null,
        payment_status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("status", "pending_payment")
      .select("*, service:services(id,name,duration_minutes), zone:service_zones(id,name)")
      .single();

    if (confirmErr) {
      console.error(`[confirm] failed to mark booking ${bookingId} as confirmed:`, confirmErr);
    }

    if (confirmed) {
      // after() rather than a bare fire-and-forget Promise.all — on
      // Vercel's serverless runtime the function can be frozen the
      // instant the caller (redirect/webhook/cron route) sends its
      // response, silently killing an in-flight Resend call with no
      // error ever logged. after() keeps the instance alive until this
      // settles, without delaying the caller's response.
      after(() =>
        Promise.all([
          sendBookingConfirmation(
            confirmed as Appointment,
            confirmed.service as Pick<Service, "name">,
            confirmed.zone as Pick<ServiceZone, "name">
          ),
          sendOwnerBookingAlert(
            confirmed as Appointment,
            confirmed.service as Pick<Service, "name">,
            confirmed.zone as Pick<ServiceZone, "name">
          ),
        ]).catch((err) => console.error(`[confirm] email error for booking ${bookingId}:`, err))
      );
      return { outcome: "confirmed", lookupToken: confirmed.lookup_token };
    }

    // Lost the race to another concurrent confirmer — it already confirmed.
    return { outcome: "already_confirmed", lookupToken: booking.lookup_token };
  } catch (err) {
    console.error(`[confirm] unexpected error confirming booking ${bookingId}:`, err);
    return { outcome: "not_paid" };
  }
}
