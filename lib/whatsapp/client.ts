/**
 * Outbound WhatsApp booking confirmations via Meta Cloud API.
 *
 * Credentials resolve from the whatsapp_connection row first (the
 * coexistence / Embedded Signup path — Meta only issues those at
 * runtime, so they cannot live in env) and fall back to WHATSAPP_TOKEN /
 * WHATSAPP_PHONE_NUMBER_ID for a plain API-only number.
 *
 * Every send is gated on three things and recorded either way:
 *   1. a phone number that parses to a valid mobile (lib/whatsapp/phone.ts)
 *   2. recorded opt-in with no STOP on file (lib/whatsapp/contacts.ts)
 *   3. an approved template whose parameters match what we send
 * The outcome lands in whatsapp_messages so a failed confirmation is
 * visible to staff rather than living only in a log line, and so the
 * `statuses` webhook can tell "accepted by Meta" from "delivered".
 *
 * Sends an approved Utility template — plain text fails for customers
 * who haven't messaged the business in the last 24 hours. Under
 * coexistence that window only opens for messages received *after*
 * onboarding, so templates remain the only reliable channel.
 *
 * Docs: developers.facebook.com/docs/whatsapp/cloud-api
 */

import { createAdminClient } from "@/lib/supabase/server";
import { getWhatsAppConnection } from "@/lib/whatsapp/connection";
import { getConsentState } from "@/lib/whatsapp/contacts";
import { parsePhone } from "@/lib/whatsapp/phone";
import { buildTemplateComponents, type TemplateContext } from "@/lib/whatsapp/messages";
import type { Appointment } from "@/lib/types";

export const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;

/**
 * Transient Cloud API failures worth another attempt. Everything else
 * (131026 undeliverable, 132000/132001 template mismatch, 470 expired
 * window) is a permanent condition that retrying only makes noisier.
 */
const RETRYABLE_META_CODES = new Set([1, 2, 4, 80007, 130429, 131056, 133016]);

export type SendConfig = {
  token: string;
  phoneNumberId: string;
  templateName: string;
  templateLanguage: string;
  /** True when creds came from Embedded Signup rather than env. */
  fromConnection: boolean;
};

export type SendSkipReason =
  | "not_configured"
  | "disconnected"
  | "unparseable_phone"
  | "no_consent"
  | "opted_out";

export type SendResult =
  | { ok: true; wamid: string | null }
  | { ok: false; skipped: SendSkipReason; error: string }
  | { ok: false; retryable: boolean; error: string; errorCode?: number };

async function resolveConfig(): Promise<
  { ok: true; config: SendConfig } | { ok: false; skipped: SendSkipReason; error: string }
> {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en";

  if (!templateName) {
    return {
      ok: false,
      skipped: "not_configured",
      error: "WHATSAPP_TEMPLATE_NAME is not set — no approved template to send.",
    };
  }

  const connection = await getWhatsAppConnection();
  if (connection) {
    if (connection.disconnectedAt) {
      return {
        ok: false,
        skipped: "disconnected",
        error:
          `WhatsApp number was disconnected on ${connection.disconnectedAt}` +
          (connection.disconnectReason ? ` (${connection.disconnectReason})` : "") +
          " — reconnect it from /admin/whatsapp.",
      };
    }
    return {
      ok: true,
      config: {
        token: connection.accessToken,
        phoneNumberId: connection.phoneNumberId,
        templateName,
        templateLanguage,
        fromConnection: true,
      },
    };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      skipped: "not_configured",
      error:
        "WhatsApp not configured — connect a number at /admin/whatsapp, or set " +
        "WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
    };
  }

  return {
    ok: true,
    config: { token, phoneNumberId, templateName, templateLanguage, fromConnection: false },
  };
}

export async function isWhatsAppConfigured(): Promise<boolean> {
  const resolved = await resolveConfig();
  return resolved.ok;
}

type MetaError = { code?: number; message?: string };

function parseMetaError(body: string): MetaError {
  try {
    const parsed = JSON.parse(body) as { error?: MetaError };
    return parsed.error ?? {};
  } catch {
    return {};
  }
}

/**
 * One POST /{phone_number_id}/messages, retried only for transient
 * failures. Never logs the payload — it contains customer PII.
 */
async function postTemplate(params: {
  config: SendConfig;
  waId: string;
  components: ReturnType<typeof buildTemplateComponents>;
}): Promise<{ result: SendResult; attempts: number }> {
  const { config, waId, components } = params;

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: waId,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: config.templateLanguage },
      ...(components ? { components } : {}),
    },
  });

  let lastError = "Unknown error";
  let lastCode: number | undefined;
  let retryable = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${GRAPH_BASE}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (res.ok) {
        const json = (await res.json().catch(() => null)) as {
          messages?: { id?: string }[];
        } | null;
        return {
          result: { ok: true, wamid: json?.messages?.[0]?.id ?? null },
          attempts: attempt,
        };
      }

      const text = await res.text();
      const metaError = parseMetaError(text);
      lastCode = metaError.code;
      lastError = metaError.message ?? `HTTP ${res.status}`;
      retryable =
        res.status === 429 ||
        res.status >= 500 ||
        (metaError.code !== undefined && RETRYABLE_META_CODES.has(metaError.code));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastCode = undefined;
      retryable = true;
    }

    if (!retryable || attempt === MAX_ATTEMPTS) {
      return {
        result: { ok: false, retryable, error: lastError, errorCode: lastCode },
        attempts: attempt,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
  }

  return { result: { ok: false, retryable, error: lastError, errorCode: lastCode }, attempts: MAX_ATTEMPTS };
}

async function logMessage(row: {
  appointmentId: string | null;
  toE164: string;
  wamid?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  status: "sent" | "failed" | "skipped";
  skipReason?: SendSkipReason | null;
  errorCode?: number | null;
  errorMessage?: string | null;
  attempts?: number;
}): Promise<void> {
  try {
    const supabase = await createAdminClient();
    const { error } = await supabase.from("whatsapp_messages").insert({
      appointment_id: row.appointmentId,
      to_e164: row.toE164,
      wamid: row.wamid ?? null,
      template_name: row.templateName ?? null,
      template_language: row.templateLanguage ?? null,
      status: row.status,
      skip_reason: row.skipReason ?? null,
      error_code: row.errorCode ?? null,
      error_message: row.errorMessage ?? null,
      attempts: row.attempts ?? 0,
    });
    if (error) console.error("[whatsapp] failed to log message:", error.message);
  } catch (err) {
    // Logging must never be the reason a confirmation doesn't send.
    console.error("[whatsapp] failed to log message:", err instanceof Error ? err.message : err);
  }
}

/**
 * Low-level send. `requireConsent: false` exists only for the admin test
 * message, where the admin is deliberately messaging their own number;
 * it is logged with that intent recorded.
 */
export async function sendTemplateMessage(params: {
  phone: string;
  context?: TemplateContext;
  appointmentId?: string | null;
  requireConsent?: boolean;
}): Promise<SendResult> {
  const { phone, context, appointmentId = null, requireConsent = true } = params;

  const parsed = parsePhone(phone);
  if (!parsed.ok) {
    const error = `Phone number could not be parsed as a valid mobile number (${parsed.reason}).`;
    await logMessage({
      appointmentId,
      // Store what we were given, not a guess — this row is the evidence
      // of why nothing was sent.
      toE164: phone,
      status: "skipped",
      skipReason: "unparseable_phone",
      errorMessage: error,
    });
    return { ok: false, skipped: "unparseable_phone", error };
  }

  const resolved = await resolveConfig();
  if (!resolved.ok) {
    await logMessage({
      appointmentId,
      toE164: parsed.e164,
      status: "skipped",
      skipReason: resolved.skipped,
      errorMessage: resolved.error,
    });
    return resolved;
  }
  const { config } = resolved;

  if (requireConsent) {
    const consent = await getConsentState(parsed.e164);
    if (consent.status !== "allowed") {
      const skipped: SendSkipReason =
        consent.status === "opted_out" ? "opted_out" : "no_consent";
      const error =
        consent.status === "opted_out"
          ? `Customer opted out of WhatsApp on ${consent.optedOutAt}.`
          : "No recorded WhatsApp opt-in for this number.";
      await logMessage({
        appointmentId,
        toE164: parsed.e164,
        templateName: config.templateName,
        templateLanguage: config.templateLanguage,
        status: "skipped",
        skipReason: skipped,
        errorMessage: error,
      });
      return { ok: false, skipped, error };
    }
  }

  const components = context ? buildTemplateComponents(context) : undefined;
  const { result, attempts } = await postTemplate({ config, waId: parsed.waId, components });

  await logMessage({
    appointmentId,
    toE164: parsed.e164,
    wamid: result.ok ? result.wamid : null,
    templateName: config.templateName,
    templateLanguage: config.templateLanguage,
    status: result.ok ? "sent" : "failed",
    errorCode: !result.ok && "errorCode" in result ? result.errorCode ?? null : null,
    errorMessage: result.ok ? null : result.error,
    attempts,
  });

  return result;
}

/**
 * Sends the booking confirmation, claiming appointments.whatsapp_sent_at
 * first so concurrent confirmers (redirect + Ziina webhook + cron) can't
 * double-send.
 *
 * The claim is released again only for transient failures, which is what
 * makes the retry sweep in /api/cron/reconcile-bookings safe: a
 * permanent skip (no consent, opted out, unparseable number) keeps the
 * claim so the sweep doesn't retry it forever.
 */
export async function sendBookingConfirmationWhatsApp(params: {
  appointment: Appointment;
  serviceName?: string | null;
  zoneName?: string | null;
}): Promise<SendResult | { ok: false; skipped: "already_sent"; error: string }> {
  const { appointment, serviceName = null, zoneName = null } = params;
  const supabase = await createAdminClient();

  const { data: claimed } = await supabase
    .from("appointments")
    .update({ whatsapp_sent_at: new Date().toISOString() })
    .eq("id", appointment.id)
    .is("whatsapp_sent_at", null)
    .select("id")
    .single();

  if (!claimed) {
    return {
      ok: false,
      skipped: "already_sent",
      error: "A WhatsApp confirmation was already claimed for this booking.",
    };
  }

  const result = await sendTemplateMessage({
    phone: appointment.customer_phone,
    appointmentId: appointment.id,
    context: { appointment, serviceName, zoneName },
  });

  // "Not configured yet" and "disconnected" are temporary states of the
  // *setup*, not permanent facts about this customer — releasing the
  // claim lets the reconcile sweep deliver the confirmation once the
  // number is connected, instead of writing that booking off forever.
  const isTransient =
    !result.ok &&
    (("retryable" in result && result.retryable) ||
      ("skipped" in result &&
        (result.skipped === "not_configured" || result.skipped === "disconnected")));

  if (isTransient) {
    const { error: releaseErr } = await supabase
      .from("appointments")
      .update({ whatsapp_sent_at: null })
      .eq("id", appointment.id);
    if (releaseErr) {
      console.error(
        `[whatsapp] failed to release send claim for booking ${appointment.id}:`,
        releaseErr.message
      );
    }
  }

  if (!result.ok) {
    console.error(
      `[whatsapp] confirmation not sent for booking ${appointment.booking_reference}: ${result.error}`
    );
  }

  return result;
}
