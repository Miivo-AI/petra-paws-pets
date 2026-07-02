/**
 * GET /api/bookings/[id]/confirm
 *
 * Ziina redirects the customer here after a successful payment.
 * We verify the payment with Ziina, confirm the booking,
 * send emails, and redirect to the customer's status page.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendBookingConfirmation, sendOwnerBookingAlert } from "@/lib/email";
import type { Appointment, Service, ServiceZone } from "@/lib/types";

const ZIINA_API_URL = process.env.ZIINA_API_URL ?? "https://api-v2.ziina.com/api";
const ZIINA_API_KEY = process.env.ZIINA_API_KEY ?? "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function verifyZiinaPayment(paymentId: string): Promise<boolean> {
  if (!ZIINA_API_KEY || !paymentId) return false;
  try {
    const res = await fetch(`${ZIINA_API_URL}/payment_intent/${paymentId}`, {
      headers: { Authorization: `Bearer ${ZIINA_API_KEY}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    // Ziina uses "completed" or "succeeded" depending on API version
    return ["completed", "succeeded", "paid"].includes(data?.status ?? "");
  } catch {
    return false;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createAdminClient();

  const { data: booking } = await supabase
    .from("appointments")
    .select("*, service:services(id,name,duration_minutes), zone:service_zones(id,name)")
    .eq("id", id)
    .single();

  if (!booking) {
    return NextResponse.redirect(`${SITE}/book?error=booking_not_found`);
  }

  // Already confirmed — idempotent redirect
  if (booking.status === "confirmed") {
    return NextResponse.redirect(`${SITE}/bookings/${booking.lookup_token}`);
  }

  // Expired hold
  if (
    booking.status === "pending_payment" &&
    booking.hold_expires_at &&
    booking.hold_expires_at < new Date().toISOString()
  ) {
    await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    return NextResponse.redirect(`${SITE}/book?error=hold_expired`);
  }

  // Verify payment with Ziina
  const paid = await verifyZiinaPayment(booking.ziina_payment_id ?? "");
  if (!paid) {
    return NextResponse.redirect(
      `${SITE}/book?error=payment_not_verified&booking_id=${id}`
    );
  }

  // Confirm the booking
  const { data: confirmed } = await supabase
    .from("appointments")
    .update({
      status: "confirmed",
      hold_expires_at: null,
      payment_status: "paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*, service:services(id,name,duration_minutes), zone:service_zones(id,name)")
    .single();

  if (confirmed) {
    // Fire-and-forget emails (don't block the redirect)
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
    ]).catch((err) => console.error("[confirm] email error:", err));
  }

  return NextResponse.redirect(`${SITE}/bookings/${booking.lookup_token}`);
}
