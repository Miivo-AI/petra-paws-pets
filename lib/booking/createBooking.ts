/**
 * Shared booking-creation logic (§3.6) — used by both the public web
 * booking flow (app/api/bookings/route.ts) and the WhatsApp booking bot
 * (lib/whatsapp/flow.ts), so the two channels can never drift on pricing,
 * slot validation, holds, idempotency, or Ziina payment handling.
 *
 * Flow:
 *  1. Validate input.
 *  2. Re-validate slot server-side (never trust the caller's slot list).
 *  3. Look up price from matrix.
 *  4. Create booking with status=pending_payment + hold TTL.
 *  5. Create Ziina payment intent (online) or confirm immediately (pay on arrival).
 *  6. Return the result.
 */

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { validateSlot } from "@/lib/booking/availability";
import {
  lookupPrice,
  calculateTotals,
  generateBookingReference,
} from "@/lib/booking/pricing";
import { createZiinaPayment, isZiinaConfigured } from "@/lib/booking/ziina";
import { sendBookingConfirmation, sendOwnerBookingAlert } from "@/lib/email";
import type {
  Appointment,
  BookingSource,
  CreateBookingRequest,
  PetSize,
  Service,
  ServiceZone,
} from "@/lib/types";
import { HOLD_TTL_MINUTES } from "@/lib/types";

export type CreateBookingResult =
  | {
      ok: true;
      bookingId: string;
      bookingReference: string;
      redirectUrl: string;
      booking: Appointment;
    }
  | { ok: false; status: number; error: string };

export async function createBooking(
  input: CreateBookingRequest,
  source: BookingSource = "web"
): Promise<CreateBookingResult> {
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
  } = input;

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
    return { ok: false, status: 400, error: "Missing required fields" };
  }

  if (!["dog", "cat"].includes(pet_type)) {
    return { ok: false, status: 400, error: "Invalid pet_type" };
  }

  if (pet_type === "dog" && !size) {
    return { ok: false, status: 400, error: "size is required for dogs" };
  }

  if (!["online", "pay_on_arrival"].includes(payment_method)) {
    return { ok: false, status: 400, error: "Invalid payment_method" };
  }

  if (payment_method === "online" && !isZiinaConfigured()) {
    console.error("[createBooking] ZIINA_API_KEY is not configured — refusing online booking");
    return {
      ok: false,
      status: 500,
      error: "Online payment is temporarily unavailable. Please try again later.",
    };
  }

  const supabase = await createAdminClient();

  // ── Fetch service for duration ───────────────────────────────
  const { data: service } = await supabase
    .from("services")
    .select("id, name, duration_minutes, active")
    .eq("id", service_id)
    .eq("active", true)
    .single();

  if (!service) {
    return { ok: false, status: 404, error: "Service not found or inactive" };
  }

  // ── Fetch zone (needed for pay-on-arrival confirmation email) ─
  const { data: zone } = await supabase
    .from("service_zones")
    .select("id, name")
    .eq("id", zone_id)
    .single();

  if (!zone) {
    return { ok: false, status: 404, error: "Zone not found" };
  }

  // ── Fetch prices ─────────────────────────────────────────────
  const { data: prices } = await supabase.from("service_prices").select("*");

  const subtotal = lookupPrice(
    prices ?? [],
    pet_type,
    service_id,
    size as PetSize | undefined
  );

  if (subtotal === null) {
    return { ok: false, status: 400, error: "No price found for this combination" };
  }

  // ── Re-validate slot (§3.6 — server is source of truth) ─────
  const slotValid = await validateSlot({
    date,
    startTime: start_time,
    serviceId: service_id,
    zoneId: zone_id,
  });

  if (!slotValid) {
    return {
      ok: false,
      status: 409,
      error: "That time slot is no longer available. Please choose another.",
    };
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

  // create_booking_atomic (migration 004/005) takes an advisory lock on the
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
      p_source: source,
    });

    if (!rpcErr) {
      booking = data as Appointment;
      break;
    }

    if (rpcErr.message?.includes("slot_taken")) {
      return {
        ok: false,
        status: 409,
        error: "That time slot was just booked by someone else. Please choose another time.",
      };
    }

    // Booking-reference collision (extremely rare) — regenerate and retry.
    if (rpcErr.code === "23505" && rpcErr.message?.includes("booking_reference")) {
      bookingRef = generateBookingReference();
      continue;
    }

    console.error("[createBooking] create_booking_atomic error:", rpcErr);
    return { ok: false, status: 500, error: "Failed to create booking" };
  }

  if (!booking) {
    console.error("[createBooking] create_booking_atomic: exhausted retries on reference collision");
    return { ok: false, status: 500, error: "Failed to create booking" };
  }
  bookingRef = booking.booking_reference;

  // create_booking_atomic returns the existing row on an idempotent
  // replay (same idempotency_key) regardless of its current status. If
  // a prior attempt already cancelled this booking (e.g. its Ziina call
  // failed, or its payment hold expired), resurrecting it here would
  // silently reuse a dead row — confirmBookingIfPaid only ever confirms
  // bookings still in pending_payment, so any payment collected against
  // it would never actually confirm the appointment.
  if (booking.status === "cancelled") {
    console.warn(
      `[createBooking] idempotent replay of cancelled booking ${booking.id} (${bookingRef}) — refusing to reuse it`,
      { idempotencyKey: idempotency_key ?? null }
    );
    return {
      ok: false,
      status: 409,
      error: "This booking attempt was cancelled. Please start a new booking.",
    };
  }

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
      // after() (not a bare fire-and-forget Promise.all) — on Vercel's
      // serverless runtime, the function can be frozen the instant the
      // response below is sent, silently killing an in-flight Resend
      // API call with no error ever logged. after() keeps the instance
      // alive until this settles, without delaying the caller's response.
      after(() =>
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
        ]).catch((err) => console.error("[createBooking] email error:", err))
      );
    }

    return {
      ok: true,
      bookingId: booking.id,
      bookingReference: bookingRef,
      redirectUrl: `${siteUrl}/bookings/${booking.lookup_token}`,
      booking,
    };
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
    const { data: claimed, error: claimErr } = await supabase
      .from("appointments")
      .update({ ziina_claimed_at: new Date().toISOString() })
      .eq("id", booking.id)
      .is("ziina_claimed_at", null)
      .select()
      .single();

    if (!claimed) {
      // Lost the claim — either a genuinely concurrent request is
      // creating the intent right now, or (bug scenario) a prior
      // attempt claimed it and then failed without releasing the
      // claim. Poll briefly for the in-flight case rather than
      // creating a duplicate.
      console.warn(
        `[createBooking] lost ziina claim for booking ${booking.id} (${bookingRef})` +
          (claimErr ? ` — claim update error: ${JSON.stringify(claimErr)}` : " — already claimed by another request"),
        { idempotencyKey: idempotency_key ?? null, bookingStatus: booking.status }
      );

      let existing: Appointment | null = null;
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const { data, error: pollErr } = await supabase
          .from("appointments")
          .select()
          .eq("id", booking.id)
          .single();
        if (pollErr) {
          console.error(`[createBooking] poll error for booking ${booking.id}:`, pollErr);
        }
        if (data?.ziina_redirect_url) {
          existing = data as Appointment;
          break;
        }
      }

      if (!existing) {
        console.error(
          `[createBooking] gave up waiting for Ziina redirect on booking ${booking.id} (${bookingRef}) ` +
            `after 1.5s poll — claim never completed. Booking status: ${booking.status}, ` +
            `ziina_claimed_at was already set with no ziina_redirect_url — likely a prior attempt ` +
            `failed without releasing its claim.`
        );
        return { ok: false, status: 502, error: "Payment gateway error. Please try again." };
      }

      return {
        ok: true,
        bookingId: existing.id,
        bookingReference: existing.booking_reference,
        redirectUrl: existing.ziina_redirect_url!,
        booking: existing,
      };
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
          `[createBooking] failed to save Ziina payment intent for booking ${booking.id} (${bookingRef}):`,
          saveErr
        );
      }

      redirectUrl = ziina.redirect_url;
    } catch (err) {
      console.error(`[createBooking] Ziina error for booking ${booking.id} (${bookingRef}):`, err);

      // Cancel the hold so the slot is released, and clear the claim so
      // a retry with the same idempotency_key can actually attempt
      // Ziina again instead of being stuck forever in the "lost the
      // claim" branch above (which would otherwise poll for a
      // ziina_redirect_url that will now never arrive).
      const { error: cancelErr } = await supabase
        .from("appointments")
        .update({ status: "cancelled", ziina_claimed_at: null })
        .eq("id", booking.id);

      if (cancelErr) {
        console.error(
          `[createBooking] failed to release hold for booking ${booking.id} after Ziina error:`,
          cancelErr
        );
      }

      return { ok: false, status: 502, error: "Payment gateway error. Please try again." };
    }
  }

  return {
    ok: true,
    bookingId: booking.id,
    bookingReference: bookingRef,
    redirectUrl,
    booking,
  };
}
