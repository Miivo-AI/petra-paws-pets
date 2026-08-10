/**
 * Reads/writes the single connected WhatsApp number (whatsapp_connection
 * table, migration 007). This is the number connected at runtime via
 * Embedded Signup on /admin/whatsapp — env vars (WHATSAPP_TOKEN,
 * WHATSAPP_PHONE_NUMBER_ID) are only a fallback for before anything's
 * been connected there.
 */

import { createAdminClient } from "@/lib/supabase/server";

export interface WhatsAppConnection {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  connectedAt: string;
}

export async function getWhatsAppConnection(): Promise<WhatsAppConnection | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_connection")
    .select("waba_id, phone_number_id, access_token, display_phone_number, verified_name, connected_at")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("[whatsapp] failed to read connection:", error);
    return null;
  }
  if (!data) return null;

  return {
    wabaId: data.waba_id,
    phoneNumberId: data.phone_number_id,
    accessToken: data.access_token,
    displayPhoneNumber: data.display_phone_number,
    verifiedName: data.verified_name,
    connectedAt: data.connected_at,
  };
}

export async function saveWhatsAppConnection(params: {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  connectedBy: string | null;
}): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase.from("whatsapp_connection").upsert({
    id: true,
    waba_id: params.wabaId,
    phone_number_id: params.phoneNumberId,
    access_token: params.accessToken,
    display_phone_number: params.displayPhoneNumber,
    verified_name: params.verifiedName,
    connected_by: params.connectedBy,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to save WhatsApp connection: ${error.message}`);
}

export async function clearWhatsAppConnection(): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase.from("whatsapp_connection").delete().eq("id", true);
  if (error) throw new Error(`Failed to clear WhatsApp connection: ${error.message}`);
}
