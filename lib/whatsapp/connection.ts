/**
 * The connected WhatsApp number (whatsapp_connection, migration 009).
 *
 * Coexistence credentials cannot come from env vars: Meta only hands
 * them over at runtime, when the owner completes Embedded Signup with
 * featureType "whatsapp_business_app_onboarding". So the DB row is the
 * primary source and env is the fallback for a plain API-only number
 * (or for local development against a test number).
 */

import { createAdminClient } from "@/lib/supabase/server";

export type WhatsAppConnection = {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  isOnBizApp: boolean | null;
  platformType: string | null;
  onboardedAt: string;
  contactsSyncRequestedAt: string | null;
  contactsSyncError: string | null;
  historySyncRequestedAt: string | null;
  historySyncError: string | null;
  historyReceivedAt: string | null;
  disconnectedAt: string | null;
  disconnectReason: string | null;
  connectedAt: string;
};

/** Meta's hard deadline for pulling contacts + history after onboarding. */
export const COEXISTENCE_SYNC_WINDOW_HOURS = 24;

type ConnectionRow = {
  waba_id: string;
  phone_number_id: string;
  access_token: string;
  display_phone_number: string | null;
  verified_name: string | null;
  is_on_biz_app: boolean | null;
  platform_type: string | null;
  onboarded_at: string;
  contacts_sync_requested_at: string | null;
  contacts_sync_error: string | null;
  history_sync_requested_at: string | null;
  history_sync_error: string | null;
  history_received_at: string | null;
  disconnected_at: string | null;
  disconnect_reason: string | null;
  connected_at: string;
};

function fromRow(row: ConnectionRow): WhatsAppConnection {
  return {
    wabaId: row.waba_id,
    phoneNumberId: row.phone_number_id,
    accessToken: row.access_token,
    displayPhoneNumber: row.display_phone_number,
    verifiedName: row.verified_name,
    isOnBizApp: row.is_on_biz_app,
    platformType: row.platform_type,
    onboardedAt: row.onboarded_at,
    contactsSyncRequestedAt: row.contacts_sync_requested_at,
    contactsSyncError: row.contacts_sync_error,
    historySyncRequestedAt: row.history_sync_requested_at,
    historySyncError: row.history_sync_error,
    historyReceivedAt: row.history_received_at,
    disconnectedAt: row.disconnected_at,
    disconnectReason: row.disconnect_reason,
    connectedAt: row.connected_at,
  };
}

export async function getWhatsAppConnection(): Promise<WhatsAppConnection | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_connection")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    // A missing table (migration 009 not applied yet) shouldn't take the
    // site down — the env fallback in client.ts still works.
    console.error("[whatsapp] connection lookup failed:", error.message);
    return null;
  }
  return data ? fromRow(data as ConnectionRow) : null;
}

export async function saveWhatsAppConnection(params: {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  isOnBizApp: boolean | null;
  platformType: string | null;
  connectedBy: string;
}): Promise<void> {
  const supabase = await createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("whatsapp_connection").upsert(
    {
      id: true,
      waba_id: params.wabaId,
      phone_number_id: params.phoneNumberId,
      access_token: params.accessToken,
      display_phone_number: params.displayPhoneNumber,
      verified_name: params.verifiedName,
      is_on_biz_app: params.isOnBizApp,
      platform_type: params.platformType,
      // A reconnect restarts the 24h sync window and clears any prior
      // sync outcome — the previous attempt's state says nothing about
      // this one.
      onboarded_at: now,
      contacts_sync_requested_at: null,
      contacts_sync_error: null,
      history_sync_requested_at: null,
      history_sync_error: null,
      history_received_at: null,
      disconnected_at: null,
      disconnect_reason: null,
      connected_by: params.connectedBy,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`Failed to save WhatsApp connection: ${error.message}`);
}

export async function updateWhatsAppConnection(
  patch: Partial<{
    contacts_sync_requested_at: string | null;
    contacts_sync_error: string | null;
    history_sync_requested_at: string | null;
    history_sync_error: string | null;
    history_received_at: string | null;
    disconnected_at: string | null;
    disconnect_reason: string | null;
    is_on_biz_app: boolean | null;
    platform_type: string | null;
  }>
): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("whatsapp_connection")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) console.error("[whatsapp] connection update failed:", error.message);
}

export async function deleteWhatsAppConnection(): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase.from("whatsapp_connection").delete().eq("id", true);
  if (error) throw new Error(`Failed to disconnect WhatsApp: ${error.message}`);
}

/** Whether there is still time to run the one-shot coexistence syncs. */
export function syncWindowRemainingMs(connection: WhatsAppConnection): number {
  const deadline =
    new Date(connection.onboardedAt).getTime() + COEXISTENCE_SYNC_WINDOW_HOURS * 3600 * 1000;
  return Math.max(0, deadline - Date.now());
}
