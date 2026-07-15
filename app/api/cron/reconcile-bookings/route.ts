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

const CRON_SECRET = process.env.CRON_SECRET;

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

  return NextResponse.json({ checked: results.length, results });
}
