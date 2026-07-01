/**
 * GET /api/bookings/lookup?ref=PP-XXXXXX&email=customer@example.com
 *
 * Fallback lookup for customers who don't have the magic link email (§6).
 * Returns the lookup_token so the client can redirect to /bookings/[token].
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref")?.toUpperCase().trim();
  const email = searchParams.get("email")?.toLowerCase().trim();

  if (!ref || !email) {
    return NextResponse.json(
      { error: "ref and email are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from("appointments")
    .select("booking_reference, lookup_token, status, date, start_time")
    .eq("customer_email", email)
    .eq("booking_reference", ref)
    .limit(1);

  if (!bookings || bookings.length === 0) {
    return NextResponse.json(
      { error: "No booking found with that reference and email" },
      { status: 404 }
    );
  }

  const booking = bookings[0];
  return NextResponse.json({
    lookup_token: booking.lookup_token,
    status: booking.status,
    date: booking.date,
    start_time: booking.start_time,
  });
}
