/**
 * Message text shared between the WhatsApp flow's own immediate replies
 * (lib/whatsapp/flow.ts) and the later async confirmation sent once an
 * online payment actually clears (lib/booking/confirm.ts).
 */

import type { Appointment } from "@/lib/types";

export function formatBookingConfirmedMessage(
  appt: Pick<Appointment, "booking_reference" | "pet_name" | "date" | "start_time">,
  serviceName: string
): string {
  return (
    `Payment received — you're all set! ✅\n\n` +
    `Booking reference: ${appt.booking_reference}\n` +
    `${serviceName} for ${appt.pet_name} on ${appt.date} at ${appt.start_time}.\n\n` +
    `We'll see you then!`
  );
}
