/**
 * Conversation state for the WhatsApp booking bot — one row per phone
 * number with a booking in progress (supabase/migrations/005). Deleted
 * once the booking is created or the customer restarts; this is scratch
 * state for the chat flow, not a message history.
 */

import { createAdminClient } from "@/lib/supabase/server";
import type { PetSize, PetType, PaymentMethod } from "@/lib/types";

export type WhatsAppStep =
  | "start"
  | "pet_type"
  | "service"
  | "size"
  | "zone"
  | "address"
  | "date"
  | "time"
  | "name"
  | "email"
  | "pet_name"
  | "pet_breed"
  | "payment_method"
  | "confirm";

export interface WhatsAppMenuOption {
  id: string;
  label: string;
}

export interface WhatsAppSessionData {
  pet_type?: PetType;
  service_id?: string;
  service_name?: string;
  size?: PetSize;
  zone_id?: string;
  zone_name?: string;
  customer_address?: string;
  date?: string;
  start_time?: string;
  customer_name?: string;
  customer_email?: string;
  pet_name?: string;
  pet_breed?: string;
  payment_method?: PaymentMethod;
  // Re-set on every numbered-list prompt so a reply like "2" can be
  // resolved back to the option it referred to without re-fetching.
  options?: Record<string, WhatsAppMenuOption>;
}

export interface WhatsAppSession {
  phone_number: string;
  step: WhatsAppStep;
  data: WhatsAppSessionData;
  last_message_id: string | null;
}

function defaultSession(phoneNumber: string): WhatsAppSession {
  return { phone_number: phoneNumber, step: "start", data: {}, last_message_id: null };
}

export async function getSession(phoneNumber: string): Promise<WhatsAppSession> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (error) {
    console.error(`[whatsapp] failed to load session for ${phoneNumber}:`, error);
  }

  if (data) {
    return {
      phone_number: data.phone_number,
      step: data.step as WhatsAppStep,
      data: (data.data as WhatsAppSessionData) ?? {},
      last_message_id: data.last_message_id,
    };
  }

  return defaultSession(phoneNumber);
}

export async function saveSession(session: WhatsAppSession): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase.from("whatsapp_sessions").upsert({
    phone_number: session.phone_number,
    step: session.step,
    data: session.data,
    last_message_id: session.last_message_id,
  });

  if (error) {
    console.error(`[whatsapp] failed to save session for ${session.phone_number}:`, error);
  }
}

export async function resetSession(phoneNumber: string): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("whatsapp_sessions")
    .delete()
    .eq("phone_number", phoneNumber);

  if (error) {
    console.error(`[whatsapp] failed to reset session for ${phoneNumber}:`, error);
  }
}
