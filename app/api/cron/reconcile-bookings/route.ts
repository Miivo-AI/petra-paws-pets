/**
 * GET /api/cron/reconcile-bookings
 *
 * Safety net on top of the redirect-confirm route and the Ziina
 * webhook: sweeps every appointment still stuck at pending_payment
 * with a Ziina payment intent attached, and either confirms it (if
 * Ziina says the payment actually completed) or lets
 * confirmBookingIfPaid cancel it once its hold has expired.
 *
 * Covers the case where the customer paid, closed the tab before the
 * redirect landed, and the webhook was never configured or failed to
 * deliver — otherwise a charged customer with no confirmed booking
 * would go unnoticed until they complained.
 *
 * Intended to be hit every few minutes by an external scheduler,
 * authenticated with CRON_SECRET. Vercel Cron is disabled (Hobby plan
 * caps it at once/day) — cron-job.org is the primary trigger for this.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { confirmBookingIfPaid } from "@/lib/booking/confirm";
import { sendBookingConfirmationWhatsApp } from "@/lib/whatsapp/client";
import type { Appointment, Service, ServiceZone } from "@/lib/types";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * How far back the WhatsApp retry sweep looks. A confirmation nobody
 * managed to deliver for two days is stale news, and re-sending it then
 * would confuse the customer more than the silence did.
 */
const WHATSAPP_RETRY_WINDOW_HOURS = 48;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error("[reconcile-bookings] CRON_SECRET is not configured — rejecting");
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();
  const { data: pending, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("status", "pending_payment")
    .not("ziina_payment_id", "is", null);

  if (error) {
    console.error("[reconcile-bookings] query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const results = await Promise.all(
    (pending ?? []).map(async (b) => {
      try {
        const result = await confirmBookingIfPaid(b.id);
        return { id: b.id, outcome: result.outcome };
      } catch (err) {
        console.error(`[reconcile-bookings] failed to reconcile booking ${b.id}:`, err);
        return { id: b.id, outcome: "error" as const };
      }
    })
  );

  const whatsapp = await retryUnsentWhatsApps();

  return NextResponse.json({ checked: results.length, results, whatsapp });
}

/**
 * Second sweep: confirmed bookings whose WhatsApp confirmation never
 * went out. Previously a WhatsApp send that failed on a network blip was
 * simply lost — the only trace was a log line, and the shared
 * confirmation_sent_at flag made retrying it impossible without
 * re-sending the emails too.
 *
 * sendBookingConfirmationWhatsApp only releases its whatsapp_sent_at
 * claim for transient failures, so permanent skips (no opt-in, opted
 * out, unusable number) never reappear here.
 */
async function retryUnsentWhatsApps() {
  const supabase = await createAdminClient();
  const since = new Date(
    Date.now() - WHATSAPP_RETRY_WINDOW_HOURS * 3600 * 1000
  ).toISOString();

  const { data: unsent, error } = await supabase
    .from("appointments")
    .select("*, service:services(id,name,duration_minutes), zone:service_zones(id,name)")
    .eq("status", "confirmed")
    .is("whatsapp_sent_at", null)
    .gte("created_at", since)
    .limit(25);

  if (error) {
    console.error("[reconcile-bookings] whatsapp retry query error:", error.message);
    return { retried: 0 };
  }
  if (!unsent || unsent.length === 0) return { retried: 0 };

  const outcomes = await Promise.all(
    unsent.map(async (booking) => {
      const result = await sendBookingConfirmationWhatsApp({
        appointment: booking as Appointment,
        serviceName: (booking.service as Pick<Service, "name"> | null)?.name ?? null,
        zoneName: (booking.zone as Pick<ServiceZone, "name"> | null)?.name ?? null,
      });
      return { id: booking.id, sent: result.ok };
    })
  );

  return { retried: outcomes.length, sent: outcomes.filter((o) => o.sent).length };
}
