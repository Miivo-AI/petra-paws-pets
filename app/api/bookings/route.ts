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
const ZIINA_API_KEY = process.env.ZIINA_API_KEY;

async function createZiinaPayment(params: {
  amount: number; // in fils / smallest currency unit (AED × 100)
  bookingId: string;
  bookingRef: string;
  customerEmail: string;
  successUrl: string;
  failureUrl: string;
}) {
  // Fail fast and loudly rather than sending "Authorization: Bearer "
  // and getting a generic 401 back that looks like a Ziina outage.
  if (!ZIINA_API_KEY) {
    throw new Error("ZIINA_API_KEY is not configured");
  }

  const res = await fetch(`${ZIINA_API_URL}/payment_intent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ZIINA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100), // AED → fils (min. 2 AED per Ziina docs)
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

  return res.json() as Promise<{ id: string; redirect_url: string; status: string }>;
}

export async function POST(req: NextRequest) {
  try {
    return await handleBookingRequest(req);
  } catch (err) {
    console.error("[bookings] unexpected error creating booking:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

async function handleBookingRequest(req: NextRequest): Promise<NextResponse> {
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
    idempotency_key,
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

  if (payment_method === "online" && !ZIINA_API_KEY) {
    console.error("[bookings] ZIINA_API_KEY is not configured — refusing online booking");
    return NextResponse.json(
      { error: "Online payment is temporarily unavailable. Please try again later." },
      { status: 500 }
    );
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

  // create_booking_atomic (migration 004) takes an advisory lock on the
  // date, re-validates for overlapping active bookings, and inserts —
  // all inside one DB transaction. This closes the race where two
  // concurrent requests both pass the validateSlot() check above and
  // both get inserted. It also de-dupes on idempotency_key so a
  // network retry of this same request returns the original booking
  // instead of creating a second one + a second Ziina payment intent.
  let booking: Appointment | null = null;
  let bookingRef = generateBookingReference();

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error: rpcErr } = await supabase.rpc("create_booking_atomic", {
      p_booking_reference: bookingRef,
      p_idempotency_key: idempotency_key ?? null,
      p_date: date,
      p_start_time: start_time,
      p_end_time: end_time,
      p_pet_type: pet_type,
      p_service_id: service_id,
      p_size: pet_type === "cat" ? null : size,
      p_zone_id: zone_id,
      p_customer_address: customer_address ?? null,
      p_customer_name: customer_name,
      p_customer_email: customer_email,
      p_customer_phone: customer_phone,
      p_pet_name: pet_name,
      p_pet_breed: pet_breed ?? null,
      p_special_notes: special_notes ?? null,
      p_subtotal: sub,
      p_vat: vat,
      p_total: total,
      p_payment_method: payment_method,
      p_status: isPayOnArrival ? "confirmed" : "pending_payment",
      p_hold_expires_at: holdExpiresAt,
    });

    if (!rpcErr) {
      booking = data as Appointment;
      break;
    }

    if (rpcErr.message?.includes("slot_taken")) {
      return NextResponse.json(
        {
          error:
            "That time slot was just booked by someone else. Please choose another time.",
        },
        { status: 409 }
      );
    }

    // Booking-reference collision (extremely rare) — regenerate and retry.
    if (rpcErr.code === "23505" && rpcErr.message?.includes("booking_reference")) {
      bookingRef = generateBookingReference();
      continue;
    }

    console.error("[bookings] create_booking_atomic error:", rpcErr);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }

  if (!booking) {
    console.error("[bookings] create_booking_atomic: exhausted retries on reference collision");
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
  bookingRef = booking.booking_reference;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // ── Pay on arrival: confirmed immediately, no payment gateway ─
  if (isPayOnArrival) {
    // Claim the right to send the confirmation emails. If this is an
    // idempotent replay (or a genuinely concurrent duplicate request)
    // of the same booking, confirmation_sent_at is already set and we
    // skip re-sending them.
    const { data: claimed } = await supabase
      .from("appointments")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", booking.id)
      .is("confirmation_sent_at", null)
      .select()
      .single();

    if (claimed) {
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
    }

    return NextResponse.json({
      bookingId: booking.id,
      bookingReference: bookingRef,
      redirectUrl: `${siteUrl}/bookings/${booking.lookup_token}`,
    });
  }

  // ── Online: create Ziina payment intent ───────────────────────
  let redirectUrl: string;

  if (booking.ziina_redirect_url) {
    // Idempotent replay — a payment intent already exists for this
    // booking. Reuse it instead of creating a second one with Ziina.
    redirectUrl = booking.ziina_redirect_url;
  } else {
    // Atomically claim the right to create the Ziina intent, so two
    // concurrent requests sharing the same idempotency key can't both
    // call Ziina and end up with two payment intents for one booking.
    const { data: claimed } = await supabase
      .from("appointments")
      .update({ ziina_claimed_at: new Date().toISOString() })
      .eq("id", booking.id)
      .is("ziina_claimed_at", null)
      .select()
      .single();

    if (!claimed) {
      // Lost the claim — another request is creating the intent right
      // now. Poll briefly for it to finish rather than creating a
      // duplicate.
      let existing: Appointment | null = null;
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const { data } = await supabase
          .from("appointments")
          .select()
          .eq("id", booking.id)
          .single();
        if (data?.ziina_redirect_url) {
          existing = data as Appointment;
          break;
        }
      }

      if (!existing) {
        return NextResponse.json(
          { error: "Payment gateway error. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        bookingId: existing.id,
        bookingReference: existing.booking_reference,
        redirectUrl: existing.ziina_redirect_url,
      });
    }

    try {
      const ziina = await createZiinaPayment({
        amount: total,
        bookingId: booking.id,
        bookingRef: bookingRef,
        customerEmail: customer_email,
        successUrl: `${siteUrl}/api/bookings/${booking.id}/confirm`,
        failureUrl: `${siteUrl}/book?error=payment_failed&booking_id=${booking.id}`,
      });

      const { error: saveErr } = await supabase
        .from("appointments")
        .update({ ziina_payment_id: ziina.id, ziina_redirect_url: ziina.redirect_url })
        .eq("id", booking.id);

      if (saveErr) {
        console.error(
          `[bookings] failed to save Ziina payment intent for booking ${booking.id} (${bookingRef}):`,
          saveErr
        );
      }

      redirectUrl = ziina.redirect_url;
    } catch (err) {
      console.error(
        `[bookings] Ziina error for booking ${booking.id} (${bookingRef}):`,
        err
      );

      // Cancel the hold so the slot is released
      const { error: cancelErr } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", booking.id);

      if (cancelErr) {
        console.error(
          `[bookings] failed to release hold for booking ${booking.id} after Ziina error:`,
          cancelErr
        );
      }

      return NextResponse.json(
        { error: "Payment gateway error. Please try again." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    bookingId: booking.id,
    bookingReference: bookingRef,
    redirectUrl,
  });
}
