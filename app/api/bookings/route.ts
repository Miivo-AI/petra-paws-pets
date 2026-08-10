/**
 * POST /api/bookings
 *
 * Thin HTTP wrapper — all the actual booking logic (validation, slot
 * re-check, pricing, atomic insert, Ziina payment intent) lives in
 * lib/booking/createBooking.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createBooking } from "@/lib/booking/createBooking";
import type { CreateBookingRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: CreateBookingRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await createBooking(body, "web");

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      bookingId: result.bookingId,
      bookingReference: result.bookingReference,
      redirectUrl: result.redirectUrl,
    });
  } catch (err) {
    console.error("[bookings] unexpected error creating booking:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
