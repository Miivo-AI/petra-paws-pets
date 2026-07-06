/**
 * POST /api/webhooks/ziina
 *
 * Backstop for the case where a customer pays on Ziina's hosted page
 * but never makes it back to /api/bookings/[id]/confirm (closed tab,
 * dropped connection, etc). Without this, that booking would sit at
 * pending_payment until the hold TTL expires and cancels it — even
 * though Ziina successfully charged the card.
 *
 * Per docs.ziina.com/api-reference/webhook: Ziina POSTs
 * { event: "payment_intent.status.updated", data: { id, status, ... } }
 * and signs the raw body with HMAC-SHA256 (hex) in the
 * X-Hmac-Signature header, using the secret configured when the
 * webhook URL was registered (POST /webhook to Ziina's API — a
 * one-time setup step against your live Ziina account, not something
 * this app does for you).
 *
 * We still re-verify payment status against the Ziina API before
 * confirming (via confirmBookingIfPaid) rather than trusting the
 * webhook payload's status directly — same "never trust the caller"
 * rule as the redirect-confirm route.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { confirmBookingIfPaid } from "@/lib/booking/confirm";

const ZIINA_WEBHOOK_SECRET = process.env.ZIINA_WEBHOOK_SECRET;

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!ZIINA_WEBHOOK_SECRET || !signature) return false;

  const expected = crypto
    .createHmac("sha256", ZIINA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

export async function POST(req: NextRequest) {
  if (!ZIINA_WEBHOOK_SECRET) {
    console.error("[ziina webhook] ZIINA_WEBHOOK_SECRET is not configured — rejecting");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hmac-signature");

  if (!verifySignature(rawBody, signature)) {
    console.error("[ziina webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { event?: string; data?: { id?: string; status?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event !== "payment_intent.status.updated") {
    // Ack unrecognized event types (e.g. refund.status.updated) so
    // Ziina doesn't retry something we deliberately ignore.
    return NextResponse.json({ received: true });
  }

  const paymentId = payload.data?.id;
  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment intent id" }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: booking } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("ziina_payment_id", paymentId)
    .maybeSingle();

  if (!booking) {
    // Not one of ours, or already cleaned up — ack so Ziina stops retrying.
    return NextResponse.json({ received: true });
  }

  if (payload.data?.status === "completed") {
    await confirmBookingIfPaid(booking.id);
  } else if (payload.data?.status === "failed" && booking.status === "pending_payment") {
    await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .eq("status", "pending_payment");
  }

  return NextResponse.json({ received: true });
}
