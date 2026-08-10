/**
 * WhatsApp Cloud API webhook receiver.
 *
 * Exists purely to satisfy Meta's prerequisite for "coexistence" —
 * Embedded Signup won't offer the "connect your existing WhatsApp
 * Business account" screen at all until the app has a *working* webhook
 * subscribed to the history / smb_app_state_sync / smb_message_echoes
 * fields (App Dashboard → WhatsApp → Configuration → Webhooks). We have
 * no use for these events yet — we only send outbound booking
 * confirmations (lib/whatsapp/client.ts) — so this just verifies,
 * authenticates, and acknowledges. Nothing here is acted on.
 *
 * GET handles Meta's one-time verification handshake when the webhook
 * URL is registered; POST handles the actual event deliveries.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (APP_SECRET) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!isValidSignature(rawBody, signature, APP_SECRET)) {
      console.error("[whatsapp webhook] rejected: invalid signature");
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  console.log("[whatsapp webhook]", rawBody);

  // Ack fast with 200 regardless of payload shape — Meta retries (and
  // eventually disables) subscriptions that don't get a prompt 200.
  return new NextResponse("OK", { status: 200 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
