/**
 * Shared Ziina payment-gateway helpers.
 *
 * Used by both the booking-creation flow (create the payment intent) and
 * the confirmation flow (verify it before marking a booking as paid), so
 * "is Ziina configured" and "is this payment actually complete" are
 * answered the same way regardless of which channel (web, WhatsApp) or
 * trigger (redirect, webhook, cron) is asking.
 */

const ZIINA_API_URL = process.env.ZIINA_API_URL ?? "https://api-v2.ziina.com/api";
const ZIINA_API_KEY = process.env.ZIINA_API_KEY;
// Server-only toggle (docs.ziina.com/api-reference/payment-intent/create) —
// creates a test payment_intent that accepts Ziina's test cards
// (docs.ziina.com/test-cards) and never actually charges anyone. Never
// exposed to the client; flip via env var only, and never enable it in
// production.
const ZIINA_TEST_MODE = process.env.ZIINA_TEST_MODE === "true";
if (ZIINA_TEST_MODE) {
  // Loud and repeated on purpose — this must never stay on for real
  // customers. Logs on every cold start so it can't go unnoticed in
  // Vercel's function logs.
  console.warn(
    "[ziina] ZIINA_TEST_MODE is enabled — all online payments are test payments (no real charges). Do not leave this on in production."
  );
}

export function isZiinaConfigured(): boolean {
  return Boolean(ZIINA_API_KEY);
}

export async function createZiinaPayment(params: {
  amount: number; // in AED (converted to fils below)
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
      ...(ZIINA_TEST_MODE ? { test: true } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ziina error ${res.status}: ${body}`);
  }

  return res.json() as Promise<{ id: string; redirect_url: string; status: string }>;
}

/**
 * Ziina payment_intent statuses (per docs.ziina.com/reference/getpaymentintent):
 * requires_payment_instrument | pending | requires_user_action | completed | failed
 * Only "completed" means the money has actually landed.
 */
export async function isZiinaPaymentComplete(paymentId: string): Promise<boolean> {
  if (!ZIINA_API_KEY || !paymentId) return false;
  try {
    const res = await fetch(`${ZIINA_API_URL}/payment_intent/${paymentId}`, {
      headers: { Authorization: `Bearer ${ZIINA_API_KEY}` },
    });
    if (!res.ok) {
      console.error(
        `[ziina] payment_intent lookup failed for ${paymentId}: ${res.status} ${await res.text()}`
      );
      return false;
    }
    const data = await res.json();
    return data?.status === "completed";
  } catch (err) {
    console.error(`[ziina] payment_intent lookup threw for ${paymentId}:`, err);
    return false;
  }
}
