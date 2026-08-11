/**
 * WhatsApp Cloud API webhook receiver.
 *
 * Required for coexistence, not optional: Embedded Signup won't offer
 * the "connect your existing WhatsApp Business account" screen until the
 * app has a working webhook subscribed to the history /
 * smb_app_state_sync / smb_message_echoes fields (App Dashboard →
 * WhatsApp → Configuration → Webhooks).
 *
 * Unlike the earlier ack-only version, this one actually acts on four
 * things:
 *   messages.statuses  → real delivery state on whatsapp_messages, so
 *                        "Meta accepted it" stops being mistaken for
 *                        "the customer got it".
 *   messages (inbound) → STOP/START keywords, which is what makes the
 *                        promise on /privacy, /terms and /data-deletion
 *                        enforceable instead of decorative.
 *   account_update     → PARTNER_REMOVED, so a number the owner
 *                        disconnected from their phone stops being
 *                        silently retried forever.
 *   history / sync     → records that the one-shot coexistence syncs
 *                        actually landed inside the 24h window.
 *
 * Deliberately never logs raw payloads. Under coexistence these carry
 * customer phone numbers, message bodies, contact lists and up to six
 * months of chat history — dumping that into platform logs would
 * contradict our own privacy policy.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { detectConsentKeyword } from "@/lib/whatsapp/consent";
import { recordOptIn, recordOptOut } from "@/lib/whatsapp/contacts";
import { updateWhatsAppConnection } from "@/lib/whatsapp/connection";
import { waIdToE164 } from "@/lib/whatsapp/phone";

// crypto + service-role DB access — must not run on the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error(
      "[whatsapp webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set — refusing verification"
    );
    return new NextResponse("Not configured", { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && timingSafeEqualStrings(token, verifyToken)) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;

  // Fails closed. The previous version gated verification on
  // `if (APP_SECRET)`, so a missing env var silently turned this into an
  // unauthenticated endpoint that anyone could post forged opt-outs and
  // delivery failures to.
  if (!appSecret) {
    console.error("[whatsapp webhook] META_APP_SECRET is not set — rejecting delivery");
    return new NextResponse("Not configured", { status: 500 });
  }

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    console.error("[whatsapp webhook] rejected: invalid signature");
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Everything past this point returns 200 no matter what. Meta retries
  // non-200s and eventually disables the subscription outright — which
  // under coexistence would break the sync pipeline, not just drop an
  // event.
  try {
    await handlePayload(rawBody);
  } catch (err) {
    console.error(
      "[whatsapp webhook] handler error:",
      err instanceof Error ? err.message : String(err)
    );
  }

  return new NextResponse("OK", { status: 200 });
}

// ── Payload handling ─────────────────────────────────────────────

type InboundMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string } };
};

type StatusUpdate = {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string }[];
};

type ChangeValue = {
  messages?: InboundMessage[];
  statuses?: StatusUpdate[];
  event?: string;
  disconnection_info?: { reason?: string; initiated_by?: string };
  history?: { errors?: { code?: number; message?: string }[] }[];
};

type WebhookPayload = {
  entry?: { id?: string; changes?: { field?: string; value?: ChangeValue }[] }[];
};

async function handlePayload(rawBody: string): Promise<void> {
  const payload = JSON.parse(rawBody) as WebhookPayload;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      switch (change.field) {
        case "messages":
          await handleStatuses(value.statuses ?? []);
          await handleInboundMessages(value.messages ?? []);
          break;

        case "account_update":
          await handleAccountUpdate(value);
          break;

        case "history":
          await handleHistory(value);
          break;

        case "smb_app_state_sync":
        case "smb_message_echoes":
          // Nothing to mirror — this app has no inbox. Counted only, so
          // "is the coexistence pipeline alive?" is answerable without
          // recording message contents we have no use for.
          console.log(
            `[whatsapp webhook] ${change.field}: ${countItems(value)} item(s) received`
          );
          break;

        default:
          console.log(`[whatsapp webhook] unhandled field: ${change.field ?? "unknown"}`);
      }
    }
  }
}

function countItems(value: ChangeValue): number {
  return (value.messages?.length ?? 0) + (value.history?.length ?? 0);
}

/**
 * Delivery state, ranked so an out-of-order webhook can't walk a
 * message backwards from `read` to `sent`.
 */
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

async function handleStatuses(statuses: StatusUpdate[]): Promise<void> {
  if (statuses.length === 0) return;
  const supabase = await createAdminClient();

  for (const status of statuses) {
    const wamid = status.id;
    const next = status.status;
    if (!wamid || !next || !(next in STATUS_RANK)) continue;

    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select("id, status")
      .eq("wamid", wamid)
      .maybeSingle();

    if (!existing) continue;
    if ((STATUS_RANK[existing.status] ?? 0) > STATUS_RANK[next]) continue;

    const firstError = status.errors?.[0];
    const { error } = await supabase
      .from("whatsapp_messages")
      .update({
        status: next,
        error_code: firstError?.code ?? null,
        error_message: firstError?.message ?? firstError?.title ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error(`[whatsapp webhook] failed to update message status:`, error.message);
    }
  }
}

/** Reads the message body for keyword matching, then discards it. */
function extractBody(message: InboundMessage): string | null {
  return (
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    null
  );
}

async function handleInboundMessages(messages: InboundMessage[]): Promise<void> {
  for (const message of messages) {
    if (!message.from) continue;

    const keyword = detectConsentKeyword(extractBody(message));
    if (!keyword) continue;

    const phoneE164 = waIdToE164(message.from);

    if (keyword === "opt_out") {
      await recordOptOut({ phoneE164, reason: "customer replied with an opt-out keyword" });
      console.log("[whatsapp webhook] recorded opt-out from an inbound keyword");
    } else {
      // clearOptOut so an accidental STOP isn't permanent.
      await recordOptIn({ phoneE164, source: "inbound_message", clearOptOut: true });
      console.log("[whatsapp webhook] recorded opt-in from an inbound keyword");
    }
  }
}

async function handleAccountUpdate(value: ChangeValue): Promise<void> {
  if (value.event !== "PARTNER_REMOVED" && value.event !== "DISABLED_UPDATE") {
    console.log(`[whatsapp webhook] account_update: ${value.event ?? "unknown event"}`);
    return;
  }

  const reason = value.disconnection_info?.reason ?? value.event;
  const initiatedBy = value.disconnection_info?.initiated_by;

  // A coexistence number can't be deregistered through the API — the
  // owner disconnects from Settings → Account → Business Platform on
  // their phone. This webhook is the only notice we get, so without
  // recording it the app would keep sending against dead credentials.
  await updateWhatsAppConnection({
    disconnected_at: new Date().toISOString(),
    disconnect_reason: initiatedBy ? `${reason} (initiated by ${initiatedBy})` : reason,
  });

  console.error(
    `[whatsapp webhook] number disconnected from Cloud API — reason: ${reason}. ` +
      `Booking confirmations will not send until it is reconnected at /admin/whatsapp.`
  );
}

async function handleHistory(value: ChangeValue): Promise<void> {
  const errorCode = value.history?.[0]?.errors?.[0]?.code;

  // 2593109 is Meta's way of saying the owner declined to share chat
  // history. Not a failure of ours, and not worth alarming anyone over.
  if (errorCode === 2593109) {
    await updateWhatsAppConnection({
      history_sync_error: "The owner chose not to share WhatsApp Business app chat history.",
    });
    return;
  }

  await updateWhatsAppConnection({
    history_received_at: new Date().toISOString(),
    history_sync_error: null,
  });
  console.log(`[whatsapp webhook] history chunk received (${value.history?.length ?? 0} entries)`);
}

// ── Signature verification ──────────────────────────────────────

function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualStrings(signatureHeader.slice("sha256=".length), expected);
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
