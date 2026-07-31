/**
 * GET/POST /api/whatsapp
 *
 * Meta's WhatsApp Cloud API webhook. GET handles the one-time webhook
 * verification handshake done when registering this URL in the Meta App
 * Dashboard; POST receives incoming customer messages and drives the
 * text-prompt booking flow in lib/whatsapp/flow.ts.
 *
 * Every POST's signature is verified against WHATSAPP_APP_SECRET (the
 * Meta app's App Secret, NOT the access token) before the body is
 * trusted — same "never trust the caller" posture as the Ziina webhook
 * (app/api/webhooks/ziina/route.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { handleIncomingMessage } from "@/lib/whatsapp/flow";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          id: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

// ── GET: Meta webhook verification ──────────────────────────
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!WHATSAPP_VERIFY_TOKEN) {
    console.error("[whatsapp webhook] WHATSAPP_VERIFY_TOKEN is not configured — rejecting");
    return new Response("Webhook not configured", { status: 500 });
  }

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!WHATSAPP_APP_SECRET || !signatureHeader?.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", WHATSAPP_APP_SECRET).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// ── POST: incoming messages ─────────────────────────────────
export async function POST(req: NextRequest) {
  if (!WHATSAPP_APP_SECRET) {
    console.error("[whatsapp webhook] WHATSAPP_APP_SECRET is not configured — rejecting");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    console.error("[whatsapp webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const text =
        message.text?.body ??
        `[unsupported message type: ${message.type} — please reply with text]`;

      const reply = await handleIncomingMessage(message.from, text, message.id);
      if (reply) {
        await sendWhatsAppMessage(message.from, reply);
      }
    }
    // Status callbacks (delivered/read receipts) have no `messages`
    // array — nothing to do, just ack below.
  } catch (err) {
    console.error("[whatsapp webhook] error handling incoming message:", err);
    // Still ack with 200 — Meta retries aggressively on non-200, and a
    // bug here shouldn't cause the same message to be redelivered
    // indefinitely.
  }

  return NextResponse.json({ received: true });
}
