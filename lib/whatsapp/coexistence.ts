/**
 * Coexistence onboarding calls (Meta's "Onboard WhatsApp Business app
 * users" flow).
 *
 * Two things here are unforgiving and were previously best-effort or
 * absent entirely:
 *
 *  1. Subscribing the app to the customer's WABA. For a send-only
 *     integration a failed subscription is harmless, so the old connect
 *     route fired it with a bare .catch(). Under coexistence it is
 *     load-bearing: without the subscription no history /
 *     smb_app_state_sync / smb_message_echoes webhook ever arrives, and
 *     the 24-hour sync window burns down while everything looks fine.
 *
 *  2. The syncs themselves. Meta allows exactly one attempt at each, and
 *     only within 24 hours of onboarding. Miss the window and the owner
 *     must disconnect and redo the entire Embedded Signup flow.
 *
 * Docs: developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users
 */

import { GRAPH_BASE } from "@/lib/whatsapp/client";

export type GraphCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: number };

async function graphRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; token: string; body?: unknown }
): Promise<GraphCallResult<T>> {
  try {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${init.token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });

    const text = await res.text();
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      let code: number | undefined;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string; code?: number } };
        message = parsed.error?.message ?? message;
        code = parsed.error?.code;
      } catch {
        // Non-JSON error body — the status line is all we have.
      }
      return { ok: false, error: message, code };
    }

    return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Exchanges the one-time Embedded Signup `code` for a business
 * integration system user access token. Must happen server-side —
 * META_APP_SECRET can never reach the browser.
 */
export async function exchangeCodeForToken(params: {
  appId: string;
  appSecret: string;
  code: string;
}): Promise<GraphCallResult<string>> {
  const query = new URLSearchParams({
    client_id: params.appId,
    client_secret: params.appSecret,
    code: params.code,
  });

  const result = await graphRequest<{ access_token?: string }>(
    `/oauth/access_token?${query.toString()}`,
    { method: "GET", token: "" }
  );

  if (!result.ok) return result;
  if (!result.data.access_token) {
    return { ok: false, error: "Meta returned no access token for that signup code." };
  }
  return { ok: true, data: result.data.access_token };
}

export type PhoneNumberDetails = {
  id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  /** True once the number runs on both the Business app and Cloud API. */
  is_on_biz_app: boolean | null;
  platform_type: string | null;
};

const PHONE_FIELDS =
  "id,display_phone_number,verified_name,quality_rating,is_on_biz_app,platform_type";

export async function getPhoneNumberDetails(params: {
  phoneNumberId: string;
  token: string;
}): Promise<GraphCallResult<PhoneNumberDetails>> {
  return graphRequest<PhoneNumberDetails>(`/${params.phoneNumberId}?fields=${PHONE_FIELDS}`, {
    method: "GET",
    token: params.token,
  });
}

/**
 * The coexistence flow returns only a waba_id — the number isn't newly
 * selected, so no phone_number_id comes back and it has to be looked up.
 */
export async function getFirstPhoneNumber(params: {
  wabaId: string;
  token: string;
}): Promise<GraphCallResult<PhoneNumberDetails>> {
  const result = await graphRequest<{ data?: PhoneNumberDetails[] }>(
    `/${params.wabaId}/phone_numbers?fields=${PHONE_FIELDS}`,
    { method: "GET", token: params.token }
  );

  if (!result.ok) return result;
  const first = result.data.data?.[0];
  if (!first?.id) {
    return {
      ok: false,
      error: "Connected to Meta, but that WhatsApp Business Account has no phone number on it.",
    };
  }
  return { ok: true, data: first };
}

/**
 * Awaited, and a failure fails the whole connect: see the file header.
 */
export async function subscribeAppToWaba(params: {
  wabaId: string;
  token: string;
}): Promise<GraphCallResult<{ success?: boolean }>> {
  return graphRequest<{ success?: boolean }>(`/${params.wabaId}/subscribed_apps`, {
    method: "POST",
    token: params.token,
  });
}

export type SyncType = "smb_app_state_sync" | "history";

/**
 * One-shot per onboarding. `smb_app_state_sync` pulls the owner's
 * contacts; `history` pulls up to 6 months of 1:1 chat history, but only
 * if the owner ticked the sharing box in the WhatsApp Business app — if
 * they didn't, Meta answers success here and then delivers a `history`
 * webhook carrying error 2593109 instead.
 */
export async function requestSmbSync(params: {
  phoneNumberId: string;
  token: string;
  syncType: SyncType;
}): Promise<GraphCallResult<{ request_id?: string }>> {
  return graphRequest<{ request_id?: string }>(`/${params.phoneNumberId}/smb_app_data`, {
    method: "POST",
    token: params.token,
    body: { messaging_product: "whatsapp", sync_type: params.syncType },
  });
}
