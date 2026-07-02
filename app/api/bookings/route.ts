/**
 * POST /api/bookings
 *
 * Flow (§3.6):
 *  1. Validate request body.
 *  2. Re-validate slot server-side (never trust client's slot list).
 *  3. Look up price from matrix.
 *  4. Create booking with status=pending_payment + hold TTL.
 *  5. Create Ziina payment intent.
 *  6. Return { bookingId, redirectUrl }.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateSlot } from "@/lib/booking/availability";
import {
  lookupPrice,
  calculateTotals,
  generateBookingReference,
} from "@/lib/booking/pricing";
import { sendBookingConfirmation, sendOwnerBookingAlert } from "@/lib/email";
import type { Appointment, CreateBookingRequest, PetSize, Service, ServiceZone } from "@/lib/types";
import { HOLD_TTL_MINUTES } from "@/lib/types";

const ZIINA_API_URL = process.env.ZIINA_API_URL ?? "https://api-v2.ziina.com/api";
const ZIINA_API_KEY = process.env.ZIINA_API_KEY ?? "";

async function createZiinaPayment(params: {
  amount: number; // in fils / smallest currency unit (AED × 100)
  bookingId: string;
  bookingRef: string;
  customerEmail: string;
  successUrl: string;
  failureUrl: string;
}) {
  const res = await fetch(`${ZIINA_API_URL}/payment_intent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ZIINA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100), // AED → fils
      currency_code: "AED",
      message: `Petra Paws — ${params.bookingRef}`,
      success_url: params.successUrl,
      failure_url: params.failureUrl,
      cancel_url: params.failureUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ziina error ${res.status}: ${body}`);
  }

  return res.json() as Promise<{ id: string; redirect_url: string }>;
}

export async function POST(req: NextRequest) {
  let body: CreateBookingRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    date,
    start_time,
    pet_type,
    service_id,
    size,
    zone_id,
    customer_address,
    customer_name,
    customer_email,
    customer_phone,
    pet_name,
    pet_breed,
    special_notes,
    payment_method,
  } = body;

  // ── Basic validation ─────────────────────────────────────────
  if (
    !date ||
    !start_time ||
    !pet_type ||
    !service_id ||
    !zone_id ||
    !customer_name ||
    !customer_email ||
    !customer_phone ||
    !pet_name
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["dog", "cat"].includes(pet_type)) {
    return NextResponse.json({ error: "Invalid pet_type" }, { status: 400 });
  }

  if (pet_type === "dog" && !size) {
    return NextResponse.json({ error: "size is required for dogs" }, { status: 400 });
  }

  if (!["online", "pay_on_arrival"].includes(payment_method)) {
    return NextResponse.json({ error: "Invalid payment_method" }, { status: 400 });
  }

  const supabase = await createClient();

  // ── Fetch service for duration ───────────────────────────────
  const { data: service } = await supabase
    .from("services")
    .select("id, name, duration_minutes, active")
    .eq("id", service_id)
    .eq("active", true)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Service not found or inactive" }, { status: 404 });
  }

  // ── Fetch zone (needed for pay-on-arrival confirmation email) ─
  const { data: zone } = await supabase
    .from("service_zones")
    .select("id, name")
    .eq("id", zone_id)
    .single();

  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  // ── Fetch prices ─────────────────────────────────────────────
  const { data: prices } = await supabase
    .from("service_prices")
    .select("*");

  const subtotal = lookupPrice(
    prices ?? [],
    pet_type,
    service_id,
    size as PetSize | undefined
  );

  if (subtotal === null) {
    return NextResponse.json(
      { error: "No price found for this combination" },
      { status: 400 }
    );
  }

  // ── Re-validate slot (§3.6 — server is source of truth) ─────
  const slotValid = await validateSlot({
    date,
    startTime: start_time,
    serviceId: service_id,
    zoneId: zone_id,
  });

  if (!slotValid) {
    return NextResponse.json(
      { error: "That time slot is no longer available. Please choose another." },
      { status: 409 }
    );
  }

  // ── Calculate end_time ───────────────────────────────────────
  const [sh, sm] = start_time.split(":").map(Number);
  const endMin = sh * 60 + sm + service.duration_minutes;
  const end_time = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

  const { subtotal: sub, vat, total } = calculateTotals(subtotal);
  const isPayOnArrival = payment_method === "pay_on_arrival";

  // Pay-on-arrival bookings need no payment hold — they're confirmed
  // immediately. Online bookings hold the slot while the customer pays.
  const holdExpiresAt = isPayOnArrival
    ? null
    : new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000).toISOString();

  let bookingRef = generateBookingReference();
  // Retry on reference collision (extremely rare)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("booking_reference", bookingRef)
      .maybeSingle();
    if (!existing) break;
    bookingRef = generateBookingReference();
  }

  const { data: booking, error: insertErr } = await supabase
    .from("appointments")
    .insert({
      booking_reference: bookingRef,
      date,
      start_time,
      end_time,
      pet_type,
      service_id,
      size: pet_type === "cat" ? null : size,
      zone_id,
      customer_address: customer_address ?? null,
      customer_name,
      customer_email,
      customer_phone,
      pet_name,
      pet_breed: pet_breed ?? null,
      special_notes: special_notes ?? null,
      subtotal: sub,
      vat,
      total,
      status: isPayOnArrival ? "confirmed" : "pending_payment",
      hold_expires_at: holdExpiresAt,
      payment_method,
      payment_status: "unpaid",
    })
    .select()
    .single();

  if (insertErr || !booking) {
    console.error("[bookings] insert error:", insertErr);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // ── Pay on arrival: confirmed immediately, no payment gateway ─
  if (isPayOnArrival) {
    Promise.all([
      sendBookingConfirmation(
        booking as Appointment,
        service as Pick<Service, "name">,
        zone as Pick<ServiceZone, "name">
      ),
      sendOwnerBookingAlert(
        booking as Appointment,
        service as Pick<Service, "name">,
        zone as Pick<ServiceZone, "name">
      ),
    ]).catch((err) => console.error("[bookings] email error:", err));

    return NextResponse.json({
      bookingId: booking.id,
      bookingReference: bookingRef,
      redirectUrl: `${siteUrl}/bookings/${booking.lookup_token}`,
    });
  }

  // ── Online: create Ziina payment intent ───────────────────────
  let redirectUrl: string;

  try {
    const ziina = await createZiinaPayment({
      amount: total,
      bookingId: booking.id,
      bookingRef: bookingRef,
      customerEmail: customer_email,
      successUrl: `${siteUrl}/api/bookings/${booking.id}/confirm`,
      failureUrl: `${siteUrl}/book?error=payment_failed&booking_id=${booking.id}`,
    });

    // Store Ziina payment ID
    await supabase
      .from("appointments")
      .update({ ziina_payment_id: ziina.id })
      .eq("id", booking.id);

    redirectUrl = ziina.redirect_url;
  } catch (err) {
    console.error("[bookings] Ziina error:", err);
    // Cancel the hold so the slot is released
    await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    return NextResponse.json(
      { error: "Payment gateway error. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    bookingId: booking.id,
    bookingReference: bookingRef,
    redirectUrl,
  });
}
