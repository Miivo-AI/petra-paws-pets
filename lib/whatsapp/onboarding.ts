/**
 * Post-Embedded-Signup onboarding for a coexistence number.
 *
 * Shared by the connect route (which runs it immediately, because the
 * clock starts the moment the owner finishes the flow) and the admin
 * "retry sync" action (because a failed first attempt must be
 * recoverable while there's still time left in the window).
 *
 * Each sync is one-shot per onboarding, so anything already requested is
 * never requested a second time — a retry would be rejected and would
 * make the state harder to reason about, not easier.
 */

import {
  getWhatsAppConnection,
  syncWindowRemainingMs,
  updateWhatsAppConnection,
  type WhatsAppConnection,
} from "@/lib/whatsapp/connection";
import { requestSmbSync, subscribeAppToWaba } from "@/lib/whatsapp/coexistence";

export type OnboardingStep = {
  step: "subscribe" | "contacts_sync" | "history_sync";
  ok: boolean;
  skipped?: "already_requested" | "window_expired";
  error?: string;
};

export type OnboardingOutcome = {
  ok: boolean;
  steps: OnboardingStep[];
  windowRemainingMs: number;
};

/** Two attempts — the subscription is load-bearing, not best-effort. */
async function subscribeWithRetry(connection: WhatsAppConnection): Promise<OnboardingStep> {
  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await subscribeAppToWaba({
      wabaId: connection.wabaId,
      token: connection.accessToken,
    });
    if (result.ok) return { step: "subscribe", ok: true };

    lastError = result.error;
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { step: "subscribe", ok: false, error: lastError };
}

export async function runCoexistenceOnboarding(): Promise<OnboardingOutcome> {
  const connection = await getWhatsAppConnection();
  if (!connection) {
    return {
      ok: false,
      steps: [{ step: "subscribe", ok: false, error: "No WhatsApp connection is stored." }],
      windowRemainingMs: 0,
    };
  }

  const steps: OnboardingStep[] = [];
  const windowRemainingMs = syncWindowRemainingMs(connection);

  // Without this, none of the coexistence webhooks (history,
  // smb_app_state_sync, smb_message_echoes) are ever delivered, so the
  // syncs below would appear to succeed and then produce nothing.
  const subscribeStep = await subscribeWithRetry(connection);
  steps.push(subscribeStep);
  if (!subscribeStep.ok) {
    return { ok: false, steps, windowRemainingMs };
  }

  if (windowRemainingMs === 0) {
    steps.push({ step: "contacts_sync", ok: false, skipped: "window_expired" });
    steps.push({ step: "history_sync", ok: false, skipped: "window_expired" });
    return { ok: false, steps, windowRemainingMs };
  }

  // Contacts first, then history — the order Meta's onboarding guide
  // prescribes.
  if (connection.contactsSyncRequestedAt) {
    steps.push({ step: "contacts_sync", ok: true, skipped: "already_requested" });
  } else {
    const result = await requestSmbSync({
      phoneNumberId: connection.phoneNumberId,
      token: connection.accessToken,
      syncType: "smb_app_state_sync",
    });
    await updateWhatsAppConnection({
      contacts_sync_requested_at: result.ok ? new Date().toISOString() : null,
      contacts_sync_error: result.ok ? null : result.error,
    });
    steps.push({ step: "contacts_sync", ok: result.ok, error: result.ok ? undefined : result.error });
  }

  if (connection.historySyncRequestedAt) {
    steps.push({ step: "history_sync", ok: true, skipped: "already_requested" });
  } else {
    const result = await requestSmbSync({
      phoneNumberId: connection.phoneNumberId,
      token: connection.accessToken,
      syncType: "history",
    });
    await updateWhatsAppConnection({
      history_sync_requested_at: result.ok ? new Date().toISOString() : null,
      history_sync_error: result.ok ? null : result.error,
    });
    steps.push({ step: "history_sync", ok: result.ok, error: result.ok ? undefined : result.error });
  }

  return {
    ok: steps.every((s) => s.ok),
    steps,
    windowRemainingMs: syncWindowRemainingMs(connection),
  };
}
