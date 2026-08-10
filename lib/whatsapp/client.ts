/**
 * Thin wrapper around the WhatsApp Cloud API's send-message endpoint
 * (Meta Graph API). `to` is normalized to a digits-only international
 * wa_id (no leading "+", no spaces/dashes) before sending, since it
 * comes from the free-text `customer_phone` a customer types into the
 * booking form rather than a pre-formatted webhook payload.
 *
 * Credentials come from whichever number is connected via
 * /admin/whatsapp (whatsapp_connection table — see lib/whatsapp/connection.ts),
 * falling back to WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID env vars if
 * nothing's been connected there yet.
 */

import { getWhatsAppConnection } from "@/lib/whatsapp/connection";

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

// UAE-only business — a local "0" prefix (e.g. "050 123 4567") is
// assumed to be a domestic number and gets the country code substituted
// in. Numbers already in international form (with or without "+") pass
// through unchanged.
const DEFAULT_COUNTRY_CODE = "971";

async function resolveCredentials(): Promise<{ token: string; phoneNumberId: string } | null> {
  const connection = await getWhatsAppConnection();
  if (connection) {
    return { token: connection.accessToken, phoneNumberId: connection.phoneNumberId };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

export async function isWhatsAppConfigured(): Promise<boolean> {
  return (await resolveCredentials()) !== null;
}

export function normalizeWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.startsWith("0") ? DEFAULT_COUNTRY_CODE + digits.slice(1) : digits;
}

export type SendWhatsAppResult = { ok: true } | { ok: false; error: string };

/**
 * Result-returning send, for callers that need to know whether it
 * actually worked (e.g. the /admin/whatsapp "send test message" button).
 * `sendWhatsAppMessage` below wraps this for the fire-and-forget booking
 * flow, which only ever logs failures.
 */
export async function sendWhatsAppMessageResult(to: string, text: string): Promise<SendWhatsAppResult> {
  const credentials = await resolveCredentials();
  if (!credentials) {
    return {
      ok: false,
      error: "No number connected (/admin/whatsapp) and no WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID fallback configured.",
    };
  }

  const normalizedTo = normalizeWhatsAppNumber(to);

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedTo,
          type: "text",
          text: { body: text, preview_url: true },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `${res.status} ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const result = await sendWhatsAppMessageResult(to, text);
  if (!result.ok) {
    console.error(`[whatsapp] send failed for ${to}: ${result.error}`);
  }
}
