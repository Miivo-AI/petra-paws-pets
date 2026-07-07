/**
 * GET /api/bookings/[id]/confirm
 *
 * Ziina redirects the customer here after a successful payment.
 * We verify the payment with Ziina, confirm the booking,
 * send emails, and redirect to the customer's status page.
 *
 * This is one of three paths that can confirm a booking — see
 * lib/booking/confirm.ts for why, and for the webhook/cron backstops
 * that cover a customer who never makes it back to this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { confirmBookingIfPaid } from "@/lib/booking/confirm";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await confirmBookingIfPaid(id);

    switch (result.outcome) {
      case "not_found":
        return NextResponse.redirect(`${SITE}/book?error=booking_not_found`);
      case "hold_expired":
        return NextResponse.redirect(`${SITE}/book?error=hold_expired`);
      case "not_paid":
        return NextResponse.redirect(
          `${SITE}/book?error=payment_not_verified&booking_id=${id}`
        );
      case "already_confirmed":
      case "confirmed":
        return NextResponse.redirect(`${SITE}/bookings/${result.lookupToken}`);
    }
  } catch (err) {
    console.error(`[bookings/confirm] unexpected error confirming booking ${id}:`, err);
    return NextResponse.redirect(
      `${SITE}/book?error=payment_not_verified&booking_id=${id}`
    );
  }
}
