/**
 * The WhatsApp booking bot — a menu-driven step machine.
 *
 * Every prompt is a numbered list; customers reply with a digit. This
 * mirrors the deterministic, strictly-validated style of the rest of the
 * booking engine (lib/booking/*) rather than free-text/LLM parsing, so
 * there's no ambiguity between what the bot offers and what
 * getAvailableSlots()/lookupPrice() actually allow.
 *
 * Conversation state lives in whatsapp_sessions (lib/whatsapp/session.ts).
 * The actual booking is created via lib/booking/createBooking.ts — the
 * exact same function the website's /api/bookings route calls — so
 * pricing, slot validation, holds and Ziina payment handling are
 * identical across both channels.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { getAvailableSlots } from "@/lib/booking/availability";
import { lookupPrice, calculateTotals } from "@/lib/booking/pricing";
import { createBooking } from "@/lib/booking/createBooking";
import {
  getSession,
  saveSession,
  resetSession,
  type WhatsAppSession,
  type WhatsAppMenuOption,
} from "@/lib/whatsapp/session";
import type { PetSize, PetType, ServicePrice } from "@/lib/types";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

const RESTART_WORDS = new Set(["restart", "cancel", "start over", "cancel booking"]);

const GREETING =
  "🐾 Welcome to Petra Paws! Let's book your pet's grooming appointment.\n\n" +
  "Is this for a dog or a cat?\n1. Dog\n2. Cat\n\n(Reply \"restart\" any time to start over.)";

function numberList(items: WhatsAppMenuOption[]): {
  text: string;
  options: Record<string, WhatsAppMenuOption>;
} {
  const options: Record<string, WhatsAppMenuOption> = {};
  const lines = items.map((item, i) => {
    const n = String(i + 1);
    options[n] = item;
    return `${n}. ${item.label}`;
  });
  return { text: lines.join("\n"), options };
}

function parseOption(
  text: string,
  options: Record<string, WhatsAppMenuOption> | undefined
): WhatsAppMenuOption | null {
  if (!options) return null;
  return options[text.trim()] ?? null;
}

async function promptZone(
  supabase: AdminClient,
  session: WhatsAppSession,
  messageId: string
): Promise<string> {
  const { data: zones } = await supabase
    .from("service_zones")
    .select("id, name")
    .eq("active", true)
    .order("name");

  if (!zones?.length) {
    return "Sorry, we don't have any serviceable areas configured right now. Please try again later.";
  }

  const { text: listText, options } = numberList(
    zones.map((z) => ({ id: z.id, label: z.name }))
  );
  session.data.options = options;
  session.step = "zone";
  session.last_message_id = messageId;
  await saveSession(session);
  return `Which area are you in?\n\n${listText}`;
}

/**
 * Handles one incoming WhatsApp message and returns the reply to send
 * back, or null if nothing should be sent (a redelivered/duplicate
 * webhook for a message already processed).
 */
export async function handleIncomingMessage(
  waId: string,
  rawText: string,
  messageId: string
): Promise<string | null> {
  const text = (rawText ?? "").trim();
  let session = await getSession(waId);

  if (session.last_message_id === messageId) {
    // Meta redelivered the same webhook — don't re-advance the flow.
    return null;
  }

  if (RESTART_WORDS.has(text.toLowerCase())) {
    await resetSession(waId);
    session = { phone_number: waId, step: "pet_type", data: {}, last_message_id: messageId };
    await saveSession(session);
    return GREETING;
  }

  if (session.step === "start") {
    session.step = "pet_type";
    session.last_message_id = messageId;
    await saveSession(session);
    return GREETING;
  }

  const supabase = await createAdminClient();

  switch (session.step) {
    case "pet_type": {
      const choice = text === "1" ? "dog" : text === "2" ? "cat" : null;
      if (!choice) return "Please reply 1 for Dog or 2 for Cat.";
      session.data.pet_type = choice as PetType;

      const { data: services } = await supabase
        .from("services")
        .select("id, name")
        .eq("active", true)
        .order("sort_order");

      if (!services?.length) {
        return "Sorry, no services are available to book right now. Please try again later.";
      }

      const { text: listText, options } = numberList(
        services.map((s) => ({ id: s.id, label: s.name }))
      );
      session.data.options = options;
      session.step = "service";
      session.last_message_id = messageId;
      await saveSession(session);
      return `Great! Which service would you like?\n\n${listText}`;
    }

    case "service": {
      const choice = parseOption(text, session.data.options);
      if (!choice) return "Please reply with the number of one of the services listed.";
      session.data.service_id = choice.id;
      session.data.service_name = choice.label;

      if (session.data.pet_type === "dog") {
        const { text: listText, options } = numberList([
          { id: "small", label: "Small" },
          { id: "medium", label: "Medium" },
          { id: "large", label: "Large" },
        ]);
        session.data.options = options;
        session.step = "size";
        session.last_message_id = messageId;
        await saveSession(session);
        return `What size is your dog?\n\n${listText}`;
      }

      return await promptZone(supabase, session, messageId);
    }

    case "size": {
      const choice = parseOption(text, session.data.options);
      if (!choice) return "Please reply 1, 2 or 3 for your dog's size.";
      session.data.size = choice.id as PetSize;
      return await promptZone(supabase, session, messageId);
    }

    case "zone": {
      const choice = parseOption(text, session.data.options);
      if (!choice) return "Please reply with the number of one of the areas listed.";
      session.data.zone_id = choice.id;
      session.data.zone_name = choice.label;
      session.step = "address";
      session.last_message_id = messageId;
      await saveSession(session);
      return "What's the full address we should come to (building, street, area)?";
    }

    case "address": {
      if (!text) return "Please share the address for the appointment.";
      session.data.customer_address = text;
      session.step = "date";
      session.last_message_id = messageId;
      await saveSession(session);
      return (
        "What date would you like? Reply in YYYY-MM-DD format, e.g. 2026-08-05.\n" +
        "(We're closed Mondays.)"
      );
    }

    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return "Please send the date as YYYY-MM-DD, e.g. 2026-08-05.";
      }

      const slots = await getAvailableSlots({
        date: text,
        serviceId: session.data.service_id!,
        zoneId: session.data.zone_id!,
      });

      if (!slots.length) {
        return `Sorry, there are no available times on ${text}. Please try a different date.`;
      }

      session.data.date = text;
      // WhatsApp text messages have a length limit — cap the list at 20
      // slots (the 5-minute grid can otherwise produce dozens for a
      // wide-open day).
      const { text: listText, options } = numberList(
        slots.slice(0, 20).map((t) => ({ id: t, label: t }))
      );
      session.data.options = options;
      session.step = "time";
      session.last_message_id = messageId;
      await saveSession(session);
      return `Available times on ${text}:\n\n${listText}\n\nReply with the number of your preferred time.`;
    }

    case "time": {
      const choice = parseOption(text, session.data.options);
      if (!choice) return "Please reply with the number of one of the times listed.";
      session.data.start_time = choice.id;
      session.step = "name";
      session.last_message_id = messageId;
      await saveSession(session);
      return "What's your full name?";
    }

    case "name": {
      if (!text) return "Please tell us your full name.";
      session.data.customer_name = text;
      session.step = "email";
      session.last_message_id = messageId;
      await saveSession(session);
      return "What's your email address? (We'll send your booking confirmation there too.)";
    }

    case "email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        return "That doesn't look like a valid email — please try again.";
      }
      session.data.customer_email = text;
      session.step = "pet_name";
      session.last_message_id = messageId;
      await saveSession(session);
      return "What's your pet's name?";
    }

    case "pet_name": {
      if (!text) return "Please tell us your pet's name.";
      session.data.pet_name = text;
      session.step = "pet_breed";
      session.last_message_id = messageId;
      await saveSession(session);
      return 'What breed? (Reply "skip" if you\'d rather not say.)';
    }

    case "pet_breed": {
      session.data.pet_breed = text.toLowerCase() === "skip" ? undefined : text;

      const { data: prices } = await supabase.from("service_prices").select("*");
      const subtotal = lookupPrice(
        (prices ?? []) as ServicePrice[],
        session.data.pet_type!,
        session.data.service_id!,
        session.data.size
      );
      const priceLine =
        subtotal !== null
          ? `\n\nTotal: AED ${calculateTotals(subtotal).total.toFixed(2)} (incl. VAT)`
          : "";

      const { text: listText, options } = numberList([
        { id: "online", label: "Pay online now" },
        { id: "pay_on_arrival", label: "Pay on arrival (cash/card)" },
      ]);
      session.data.options = options;
      session.step = "payment_method";
      session.last_message_id = messageId;
      await saveSession(session);
      return `How would you like to pay?${priceLine}\n\n${listText}`;
    }

    case "payment_method": {
      const choice = parseOption(text, session.data.options);
      if (!choice) return "Please reply 1 to pay online or 2 to pay on arrival.";
      session.data.payment_method = choice.id as "online" | "pay_on_arrival";
      session.step = "confirm";
      session.last_message_id = messageId;
      await saveSession(session);

      const d = session.data;
      return (
        "Please confirm your booking:\n\n" +
        `Service: ${d.service_name}\n` +
        `Pet: ${d.pet_name} (${d.pet_type}${d.size ? `, ${d.size}` : ""})\n` +
        `Date: ${d.date} at ${d.start_time}\n` +
        `Area: ${d.zone_name}\n` +
        `Payment: ${choice.label}\n\n` +
        'Reply YES to confirm, or "restart" to start over.'
      );
    }

    case "confirm": {
      if (text.toLowerCase() !== "yes") {
        return 'Reply YES to confirm your booking, or "restart" to start over.';
      }

      const d = session.data;
      const result = await createBooking(
        {
          date: d.date!,
          start_time: d.start_time!,
          pet_type: d.pet_type!,
          service_id: d.service_id!,
          size: d.size,
          zone_id: d.zone_id!,
          customer_address: d.customer_address,
          customer_name: d.customer_name!,
          customer_email: d.customer_email!,
          // The WhatsApp sender's wa_id doubles as customer_phone — no
          // need to ask separately, and it's exactly the number we need
          // to message back on (see lib/booking/confirm.ts).
          customer_phone: waId,
          pet_name: d.pet_name!,
          pet_breed: d.pet_breed,
          payment_method: d.payment_method!,
          idempotency_key: `wa-${messageId}`,
        },
        "whatsapp"
      );

      await resetSession(waId);

      if (!result.ok) {
        return `Sorry, we couldn't complete that booking: ${result.error}\n\nReply "restart" to try again.`;
      }

      if (d.payment_method === "online") {
        return (
          "Almost done! Tap below to pay securely and confirm your booking:\n" +
          `${result.redirectUrl}\n\n` +
          `Your booking reference is ${result.bookingReference}.`
        );
      }

      return (
        "You're all set! ✅\n\n" +
        `Booking reference: ${result.bookingReference}\n` +
        `${d.service_name} for ${d.pet_name} on ${d.date} at ${d.start_time}.\n\n` +
        "We'll see you then! A confirmation has also been sent to your email."
      );
    }

    default: {
      await resetSession(waId);
      return GREETING;
    }
  }
}
